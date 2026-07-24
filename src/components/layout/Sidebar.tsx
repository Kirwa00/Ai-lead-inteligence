"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { clsx } from "clsx";

const navItems = [
  { href: "/dashboard", icon: "dashboard", label: "Dashboard" },
  { href: "/campaigns", icon: "precision_manufacturing", label: "Campaign Builder" },
  { href: "/leads", icon: "person_search", label: "Lead Explorer" },
  { href: "/research", icon: "travel_explore", label: "Research Agent" },
  { href: "/workforce", icon: "smart_toy", label: "AI Workforce" },
  { href: "/workflows", icon: "analytics", label: "Workflow Monitor" },
  { href: "/reports", icon: "assessment", label: "Reports" },
  { href: "/billing", icon: "credit_card", label: "Billing" },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="bg-surface-container-lowest h-screen w-64 fixed left-0 top-0 flex flex-col border-r border-outline-variant py-lg px-md z-50">
      {/* Brand */}
      <Link href="/dashboard" className="flex items-center gap-sm mb-2xl hover:opacity-90 transition-opacity">
        <div className="w-8 h-8 bg-primary-container rounded-lg flex items-center justify-center">
          <span className="material-symbols-outlined text-on-primary-container" style={{ fontVariationSettings: "'FILL' 1" }}>
            bolt
          </span>
        </div>
        <div className="flex flex-col">
          <span className="font-bold text-primary leading-none text-headline-sm">A1 Intelligence</span>
          <span className="font-mono text-label-sm text-on-surface-variant uppercase tracking-widest mt-0.5">Command Center</span>
        </div>
      </Link>

      {/* Nav */}
      <nav className="flex-1 space-y-xs">
        {navItems.map(({ href, icon, label }) => {
          const active = pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={clsx(
                "flex items-center gap-md p-sm font-mono text-label-md transition-colors duration-200",
                active
                  ? "text-primary border-r-2 border-primary bg-surface-container-low"
                  : "text-on-surface-variant hover:bg-surface-container-low"
              )}
            >
              <span
                className="material-symbols-outlined"
                style={active ? { fontVariationSettings: "'FILL' 1" } : undefined}
              >
                {icon}
              </span>
              {label}
            </Link>
          );
        })}
      </nav>

      {/* Bottom */}
      <div className="mt-auto">
        <div className="pt-xl border-t border-outline-variant mb-md">
          <Link
            href="/settings"
            className={clsx(
              "flex items-center gap-md p-sm font-mono text-label-md transition-colors duration-200",
              pathname.startsWith("/settings")
                ? "text-primary border-r-2 border-primary bg-surface-container-low"
                : "text-on-surface-variant hover:bg-surface-container-low"
            )}
          >
            <span className="material-symbols-outlined">settings</span>
            Settings
          </Link>
        </div>
        <Link
          href="/campaigns/new"
          className="bg-primary-container text-on-primary-container py-md px-lg font-mono text-label-md font-bold uppercase tracking-wider rounded-xl flex items-center justify-center gap-sm active:scale-95 transition-transform hover:brightness-105"
        >
          <span className="material-symbols-outlined text-sm">add</span>
          New Campaign
        </Link>
      </div>
    </aside>
  );
}
