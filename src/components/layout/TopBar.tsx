"use client";

import { useSession, signOut } from "next-auth/react";
import { useState, useRef, useEffect } from "react";
import { useSidebar } from "@/components/layout/SidebarContext";

export default function TopBar({ orgName }: { orgName?: string | null }) {
  const { data: session } = useSession();
  const { toggle } = useSidebar();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const initials = session?.user?.name
    ? session.user.name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
    : "?";

  return (
    <header className="fixed top-0 right-0 left-0 lg:left-64 h-16 z-40 bg-surface-container-low/80 backdrop-blur-xl border-b border-outline-variant flex items-center justify-between px-lg gap-md">
      {/* Mobile menu button */}
      <button
        onClick={toggle}
        className="lg:hidden text-on-surface-variant hover:text-primary transition-colors shrink-0"
        aria-label="Open menu"
      >
        <span className="material-symbols-outlined">menu</span>
      </button>

      {/* Search */}
      <div className="hidden md:flex items-center bg-surface-container-lowest border border-outline-variant px-md py-xs rounded-xl w-full max-w-96 focus-within:ring-1 focus-within:ring-primary transition-all">
        <span className="material-symbols-outlined text-on-surface-variant mr-sm text-body-sm">search</span>
        <input
          className="bg-transparent border-none outline-none text-on-surface placeholder:text-on-surface-variant text-body-sm w-full"
          placeholder="Search leads, campaigns, companies..."
          type="text"
        />
      </div>

      {/* Right actions */}
      <div className="flex items-center gap-lg ml-auto">
        {/* Workspace name */}
        <a
          href="/settings"
          className="hidden sm:flex items-center gap-sm px-md py-xs border border-outline-variant rounded-xl bg-surface-container-lowest hover:border-primary transition-colors"
        >
          <span className="material-symbols-outlined text-primary text-body-sm">apartment</span>
          <span className="font-mono text-label-sm text-on-surface-variant truncate max-w-[10rem]">
            {orgName ?? "Workspace"}
          </span>
        </a>

        <div className="flex items-center gap-md border-l border-outline-variant pl-lg">
          {/* Live badge */}
          <div className="flex items-center gap-xs px-sm py-xs bg-surface-container-high rounded border border-outline-variant">
            <span className="w-2 h-2 bg-primary rounded-full animate-status-pulse" />
            <span className="font-mono text-label-sm text-primary uppercase">Live</span>
          </div>

          {/* Notifications */}
          <div className="text-on-surface-variant hover:text-primary transition-colors relative cursor-pointer">
            <span className="material-symbols-outlined">notifications</span>
            <span className="absolute top-0 right-0 w-2 h-2 bg-primary rounded-full border-2 border-surface-container-low" />
          </div>

          {/* Avatar + dropdown */}
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setMenuOpen((o) => !o)}
              className="w-8 h-8 rounded-full border border-primary/20 bg-primary-container flex items-center justify-center cursor-pointer hover:border-primary transition-colors"
            >
              <span className="font-mono text-label-sm font-bold text-on-primary-container">{initials}</span>
            </button>

            {menuOpen && (
              <div className="absolute right-0 top-10 w-56 bg-surface-container-low border border-outline-variant rounded-xl shadow-lg overflow-hidden z-50">
                <div className="px-md py-md border-b border-outline-variant">
                  <div className="text-body-sm font-semibold text-on-surface truncate">
                    {session?.user?.name ?? "User"}
                  </div>
                  <div className="font-mono text-label-sm text-on-surface-variant truncate">
                    {session?.user?.email ?? ""}
                  </div>
                </div>
                <button
                  onClick={() => signOut({ callbackUrl: "/login" })}
                  className="w-full flex items-center gap-sm px-md py-sm text-left text-body-sm text-on-surface-variant hover:bg-surface-container-high hover:text-error transition-colors"
                >
                  <span className="material-symbols-outlined text-body-sm">logout</span>
                  Sign out
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
