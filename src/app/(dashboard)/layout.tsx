import Link from "next/link";
import { CalendarDays, BarChart2, Settings, Activity } from "lucide-react";

const nav = [
  { href: "/monitor",   label: "Post Monitor", icon: Activity },
  { href: "/calendar",  label: "Calendar",     icon: CalendarDays },
  { href: "/analytics", label: "Analytics",    icon: BarChart2 },
  { href: "/accounts",  label: "Accounts",     icon: Settings },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen">
      {/* Sidebar */}
      <aside className="w-56 bg-white border-r border-gray-200 flex flex-col">
        <div className="h-16 flex items-center px-5 border-b border-gray-200">
          <span className="text-lg font-bold text-blue-600 tracking-tight">Softmarche</span>
        </div>
        <nav className="flex-1 py-4 space-y-1 px-3">
          {nav.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-blue-50 hover:text-blue-700 transition-colors"
            >
              <Icon size={18} />
              {label}
            </Link>
          ))}
        </nav>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  );
}
