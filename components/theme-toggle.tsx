"use client";
import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

export function ThemeToggle() {
  const [light, setLight] = useState(false);
  useEffect(() => { setLight(document.documentElement.classList.contains("light")); }, []);
  const toggle = () => {
    const next = !light; setLight(next);
    document.documentElement.classList.toggle("light", next);
    try { localStorage.setItem("somentm-theme", next ? "light" : "dark"); } catch {}
  };
  return (
    <button onClick={toggle} className="btn-ghost w-full justify-start" aria-label="Toggle theme">
      {light ? <Moon size={16} /> : <Sun size={16} />} {light ? "Dark mode" : "Light mode"}
    </button>
  );
}
