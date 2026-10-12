import "server-only";
import { readFile } from "fs/promises";
import path from "path";
import { PDFDocument, PDFFont, PDFPage, StandardFonts, rgb, type RGB } from "pdf-lib";
import QRCode from "qrcode";
import { formatDate } from "@/lib/time";

const INK = rgb(0.035, 0.039, 0.047); // #090a0c
const MUTED = rgb(0.4, 0.44, 0.52); // #667085
const FAINT = rgb(0.6, 0.64, 0.7);
const BRAND = rgb(1, 0.231, 0.231); // #ff3b3b
const ROSE = rgb(1, 0.302, 0.427); // #ff4d6d
const PAPER = rgb(0.988, 0.98, 0.973);
const RULE = rgb(0.88, 0.87, 0.86);

export type CertificateData = {
  code: string;
  fullName: string;
  role: string;
  department: string;
  startDate: string | null;
  endDate: string | null;
  grade: string | null;
  issuedAt: string; // ISO
  signatoryName: string;
  signatoryTitle: string;
  verifyUrl: string; // full URL to /verify/<code>
};

export type LetterData = CertificateData & { body: string };

// ---------------------------------------------------------------- helpers

/** Standard PDF fonts only cover Latin-1; swap or drop anything they can't draw. */
function safe(font: PDFFont, text: string) {
  const supported = new Set(font.getCharacterSet());
  return text
    .replace(/→/g, "to")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .split("")
    .map((ch) => (supported.has(ch.codePointAt(0)!) ? ch : ch === "\n" ? ch : ""))
    .join("");
}

function wrap(font: PDFFont, text: string, size: number, maxWidth: number) {
  const lines: string[] = [];
  for (const para of safe(font, text).split("\n")) {
    let line = "";
    for (const word of para.split(/\s+/).filter(Boolean)) {
      const next = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(next, size) > maxWidth && line) {
        lines.push(line);
        line = word;
      } else line = next;
    }
    lines.push(line);
  }
  return lines;
}

function tracked(page: PDFPage, text: string, x: number, y: number, font: PDFFont, size: number, spacing: number, color: RGB) {
  let cx = x;
  for (const ch of safe(font, text)) {
    page.drawText(ch, { x: cx, y, size, font, color });
    cx += font.widthOfTextAtSize(ch, size) + spacing;
  }
  return cx - x;
}

/** The site's red→rose accent bar, drawn as thin colour steps. */
function accentBar(page: PDFPage, x: number, y: number, w: number, h: number) {
  const steps = 60;
  for (let i = 0; i < steps; i++) {
    const t = i / (steps - 1);
    page.drawRectangle({
      x: x + (w / steps) * i,
      y,
      width: w / steps + 0.5,
      height: h,
      color: rgb(BRAND.red + (ROSE.red - BRAND.red) * t, BRAND.green + (ROSE.green - BRAND.green) * t, BRAND.blue + (ROSE.blue - BRAND.blue) * t),
    });
  }
}

/** The printed halftone "iris": a dotted ring, densest in the middle of the band. */
/** `clip` keeps dots inside a box (x0, y0, x1, y1) so the ring never runs over frames or text. */
function halftoneRing(page: PDFPage, cx: number, cy: number, inner: number, outer: number, pitch = 9, clip?: [number, number, number, number]) {
  const mid = (inner + outer) / 2;
  const half = (outer - inner) / 2;
  for (let x = cx - outer; x <= cx + outer; x += pitch) {
    for (let y = cy - outer; y <= cy + outer; y += pitch) {
      const d = Math.hypot(x - cx, y - cy);
      if (d < inner || d > outer) continue;
      if (clip && (x < clip[0] || y < clip[1] || x > clip[2] || y > clip[3])) continue;
      const k = 1 - Math.abs(d - mid) / half; // 0 at edges → 1 mid-band
      page.drawCircle({ x, y, size: 0.5 + 1.3 * k, color: BRAND, opacity: 0.18 + 0.35 * k });
    }
  }
}

async function logo(doc: PDFDocument) {
  try {
    const bytes = await readFile(path.join(process.cwd(), "public", "somentm-logo.png"));
    return await doc.embedPng(bytes);
  } catch {
    return null; // never fail an issue over the logo
  }
}

async function qr(doc: PDFDocument, url: string) {
  const png = await QRCode.toBuffer(url, { type: "png", margin: 0, width: 300, errorCorrectionLevel: "M", color: { dark: "#090a0cff", light: "#00000000" } });
  return doc.embedPng(png);
}

async function fonts(doc: PDFDocument) {
  return {
    sans: await doc.embedFont(StandardFonts.Helvetica),
    sansBold: await doc.embedFont(StandardFonts.HelveticaBold),
    serif: await doc.embedFont(StandardFonts.TimesRoman),
    serifItalic: await doc.embedFont(StandardFonts.TimesRomanItalic),
    mono: await doc.embedFont(StandardFonts.Courier),
  };
}

async function brandHeader(doc: PDFDocument, page: PDFPage, x: number, top: number, f: Awaited<ReturnType<typeof fonts>>) {
  const img = await logo(doc);
  if (img) page.drawImage(img, { x, y: top - 34, width: 34, height: 34 });
  const tx = img ? x + 46 : x;
  tracked(page, "SOMENTM", tx, top - 16, f.sansBold, 13, 3.6, INK);
  tracked(page, "HR & PEOPLE OPERATIONS", tx, top - 30, f.sans, 7, 1.6, MUTED);
}

function meta(doc: PDFDocument, title: string, d: CertificateData) {
  doc.setTitle(`${title} — ${d.fullName}`);
  doc.setAuthor("SOMENTM HR");
  doc.setSubject(`Verification code ${d.code}`);
  doc.setCreator("SOMENTM HR Portal");
  doc.setCreationDate(new Date(d.issuedAt));
}

// ---------------------------------------------------------------- certificate

export async function renderCertificate(d: CertificateData): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  meta(doc, "Certificate of Internship Completion", d);
  const f = await fonts(doc);
  const W = 841.89, H = 595.28, M = 64;
  const page = doc.addPage([W, H]);

  page.drawRectangle({ x: 0, y: 0, width: W, height: H, color: PAPER });
  page.drawRectangle({ x: 20, y: 20, width: W - 40, height: H - 40, borderColor: RULE, borderWidth: 0.8 });
  accentBar(page, 20, H - 24, W - 40, 4);
  halftoneRing(page, W - 150, H - 170, 62, 128, 9, [W - 300, H - 320, W - 34, H - 38]);

  await brandHeader(doc, page, M, H - 56, f);

  let y = H - 180;
  tracked(page, "CERTIFICATE OF INTERNSHIP COMPLETION", M, y, f.sansBold, 9, 2.4, BRAND);
  y -= 40;
  page.drawText("This certifies that", { x: M, y, size: 16, font: f.serifItalic, color: MUTED });
  y -= 52;
  // shrink very long names to fit
  let nameSize = 46;
  const name = safe(f.serif, d.fullName);
  while (f.serif.widthOfTextAtSize(name, nameSize) > W - M * 2 - 140 && nameSize > 26) nameSize -= 2;
  page.drawText(name, { x: M, y, size: nameSize, font: f.serif, color: INK });
  y -= 34;

  const body = `has successfully completed an internship at SOMENTM as ${d.role} in the ${d.department} team, from ${formatDate(d.startDate)} to ${formatDate(d.endDate)}.`;
  for (const line of wrap(f.sans, body, 12.5, 520)) {
    page.drawText(line, { x: M, y, size: 12.5, font: f.sans, color: MUTED });
    y -= 19;
  }
  if (d.grade) {
    y -= 8;
    const lw = tracked(page, "FINAL EVALUATION", M, y + 2, f.sansBold, 7.5, 1.8, FAINT);
    page.drawText(safe(f.serif, d.grade), { x: M + lw + 12, y, size: 16, font: f.serif, color: INK });
  }

  // signature
  const sy = 92;
  page.drawLine({ start: { x: M, y: sy + 30 }, end: { x: M + 210, y: sy + 30 }, thickness: 0.6, color: INK });
  page.drawText(safe(f.sansBold, d.signatoryName), { x: M, y: sy + 14, size: 11, font: f.sansBold, color: INK });
  page.drawText(safe(f.sans, d.signatoryTitle), { x: M, y: sy, size: 9, font: f.sans, color: MUTED });
  page.drawText(`Approved digitally · ${formatDate(d.issuedAt)}`, { x: M, y: sy - 14, size: 8, font: f.sans, color: FAINT });

  // verification
  const q = await qr(doc, d.verifyUrl);
  const qs = 74;
  const qx = W - M - qs;
  page.drawImage(q, { x: qx, y: sy - 18, width: qs, height: qs });
  const vx = qx - 196;
  tracked(page, "VERIFY THIS CERTIFICATE", vx, sy + 40, f.sansBold, 7, 1.6, FAINT);
  page.drawText(d.code, { x: vx, y: sy + 22, size: 12, font: f.mono, color: INK });
  for (const [i, line] of wrap(f.sans, d.verifyUrl.replace(/^https?:\/\//, ""), 8, 186).entries()) {
    page.drawText(line, { x: vx, y: sy + 6 - i * 11, size: 8, font: f.sans, color: MUTED });
  }

  return doc.save();
}

// ---------------------------------------------------------------- letter

export async function renderRecommendation(d: LetterData): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  meta(doc, "Letter of Recommendation", d);
  const f = await fonts(doc);
  const W = 595.28, H = 841.89, M = 64, width = W - M * 2;
  const size = 10.5, lead = 16.5;

  const newPage = () => {
    const p = doc.addPage([W, H]);
    p.drawRectangle({ x: 0, y: 0, width: W, height: H, color: PAPER });
    accentBar(p, 0, H - 5, W, 5);
    return p;
  };

  let page = newPage();
  halftoneRing(page, W - 24, H - 24, 44, 92, 8, [W - 130, H - 112, W - 10, H - 12]);
  await brandHeader(doc, page, M, H - 52, f);

  let y = H - 128;
  page.drawText(formatDate(d.issuedAt), { x: M, y, size: 9.5, font: f.sans, color: MUTED });
  const ref = `Ref. ${d.code}`;
  page.drawText(ref, { x: W - M - f.mono.widthOfTextAtSize(ref, 9), y, size: 9, font: f.mono, color: MUTED });

  y -= 46;
  tracked(page, "LETTER OF RECOMMENDATION", M, y, f.sansBold, 8.5, 2.2, BRAND);
  y -= 30;
  page.drawText(safe(f.serif, d.fullName), { x: M, y, size: 26, font: f.serif, color: INK });
  y -= 18;
  page.drawText(safe(f.sans, `${d.role} · ${d.department} · ${formatDate(d.startDate)} to ${formatDate(d.endDate)}`), { x: M, y, size: 9.5, font: f.sans, color: MUTED });
  y -= 36;
  page.drawText("To whom it may concern,", { x: M, y, size, font: f.sans, color: INK });
  y -= lead * 1.6;

  for (const para of d.body.split(/\n\s*\n/)) {
    for (const line of wrap(f.sans, para.trim(), size, width)) {
      if (y < 170) {
        page = newPage();
        y = H - 80;
      }
      page.drawText(line, { x: M, y, size, font: f.sans, color: INK });
      y -= lead;
    }
    y -= lead * 0.6;
  }

  if (y < 200) {
    page = newPage();
    y = H - 80;
  }
  y -= 10;
  page.drawText("Sincerely,", { x: M, y, size, font: f.sans, color: INK });
  y -= 44;
  page.drawLine({ start: { x: M, y: y + 14 }, end: { x: M + 180, y: y + 14 }, thickness: 0.6, color: INK });
  page.drawText(safe(f.sansBold, d.signatoryName), { x: M, y, size: 11, font: f.sansBold, color: INK });
  y -= 14;
  page.drawText(safe(f.sans, `${d.signatoryTitle}, SOMENTM`), { x: M, y, size: 9.5, font: f.sans, color: MUTED });

  // verification footer on the last page
  const q = await qr(doc, d.verifyUrl);
  page.drawLine({ start: { x: M, y: 96 }, end: { x: W - M, y: 96 }, thickness: 0.5, color: RULE });
  page.drawImage(q, { x: M, y: 36, width: 48, height: 48 });
  page.drawText("Verify this letter", { x: M + 62, y: 70, size: 8.5, font: f.sansBold, color: INK });
  page.drawText(`${d.verifyUrl.replace(/^https?:\/\//, "")}`, { x: M + 62, y: 56, size: 8, font: f.sans, color: MUTED });
  page.drawText(`Code ${d.code} · Issued digitally by SOMENTM HR`, { x: M + 62, y: 43, size: 8, font: f.sans, color: FAINT });

  return doc.save();
}
