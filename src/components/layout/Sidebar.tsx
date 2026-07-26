"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { clsx } from "clsx";
import { useSidebar } from "@/components/layout/SidebarContext";

// Core get-leads-and-follow-up loop only. AI Workforce/Activity Log are
// secondary observability views (still reachable directly, not in primary
// nav); Research Agent's standalone page is a disconnected demo that
// doesn't persist anything — the real Research Agent runs per-campaign.
const navItems = [
  { href: "/dashboard", icon: "dashboard", label: "Dashboard" },
  { href: "/campaigns", icon: "precision_manufacturing", label: "Campaign Builder" },
  { href: "/leads", icon: "person_search", label: "Lead Explorer" },
  { href: "/reports", icon: "assessment", label: "Reports" },
  { href: "/billing", icon: "credit_card", label: "Billing" },
];

export default function Sidebar({ orgName }: { orgName?: string | null }) {
  const pathname = usePathname();
  const { open, close } = useSidebar();

  return (
    <>
      {/* Mobile backdrop */}
      {open && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={close}
          aria-hidden="true"
        />
      )}

      <aside
        className={clsx(
          "bg-surface-container-lowest h-screen w-64 fixed left-0 top-0 flex flex-col border-r border-outline-variant py-lg px-md z-50 transition-transform duration-200",
          open ? "translate-x-0" : "-translate-x-full",
          "lg:translate-x-0"
        )}
      >
        {/* Brand */}
        <div className="flex items-center justify-between mb-2xl">
          <Link href="/dashboard" className="flex items-center gap-sm hover:opacity-90 transition-opacity">
            <div className="w-8 h-8 bg-primary-container rounded-lg flex items-center justify-center">
              <span className="material-symbols-outlined text-on-primary-container" style={{ fontVariationSettings: "'FILL' 1" }}>
                bolt
              </span>
            </div>
            <div className="flex flex-col">
              <span className="font-bold text-primary leading-none text-headline-sm">A1 Intelligence</span>
              <span className="font-mono text-label-sm text-on-surface-variant uppercase tracking-widest mt-0.5">
                {orgName ?? "Command Center"}
              </span>
            </div>
          </Link>
          <button
            onClick={close}
            className="lg:hidden text-on-surface-variant hover:text-primary transition-colors"
            aria-label="Close menu"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 space-y-xs overflow-y-auto">
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
    </>
  );
}
