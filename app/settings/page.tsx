import { Settings as SettingsIcon, Shield, Building, Bell } from "lucide-react";

export default function SettingsPage() {
  return (
    <div className="p-8 pb-20 max-w-5xl mx-auto space-y-8">
      <div>
        <h1 className="page-title text-white">System Settings</h1>
        <p className="mt-1 text-sm text-muted">Configure SOMENTM organization policies, working hours, and access permissions.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="card p-5 space-y-3 border-l-4 border-l-red-500">
          <Building className="text-red-400" size={24} />
          <h2 className="text-base font-semibold text-white">Organization Details</h2>
          <p className="text-xs text-muted">Company name, logo, timezone, and working hours threshold (09:00 AM).</p>
        </div>

        <div className="card p-5 space-y-3 border-l-4 border-l-blue-500">
          <Shield className="text-blue-400" size={24} />
          <h2 className="text-base font-semibold text-white">Roles & Permissions</h2>
          <p className="text-xs text-muted">Configure access rights for Super Admin, HR Admin, Manager, Employee, and Intern.</p>
        </div>

        <div className="card p-5 space-y-3 border-l-4 border-l-purple-500">
          <Bell className="text-purple-400" size={24} />
          <h2 className="text-base font-semibold text-white">Notifications & Alerts</h2>
          <p className="text-xs text-muted">Email invitation triggers via Resend and system action notifications.</p>
        </div>
      </div>
    </div>
  );
}
