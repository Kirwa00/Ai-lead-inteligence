"use client";

import { useSession, signOut } from "next-auth/react";
import { useState, useRef, useEffect } from "react";

export default function TopBar() {
  const { data: session } = useSession();
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
    <header className="fixed top-0 right-0 w-[calc(100%-16rem)] h-16 z-40 bg-surface-container-low/80 backdrop-blur-xl border-b border-outline-variant flex items-center justify-between px-lg">
      {/* Search */}
      <div className="flex items-center bg-surface-container-lowest border border-outline-variant px-md py-xs rounded-xl w-96 focus-within:ring-1 focus-within:ring-primary transition-all">
        <span className="material-symbols-outlined text-on-surface-variant mr-sm text-body-sm">search</span>
        <input
          className="bg-transparent border-none outline-none text-on-surface placeholder:text-on-surface-variant text-body-sm w-full"
          placeholder="Search leads, campaigns, companies..."
          type="text"
        />
      </div>

      {/* Right actions */}
      <div className="flex items-center gap-lg">
        {/* Org switcher */}
        <div className="flex items-center gap-sm px-md py-xs border border-outline-variant rounded-xl bg-surface-container-lowest cursor-pointer hover:border-primary transition-colors">
          <span className="material-symbols-outlined text-primary text-body-sm">apartment</span>
          <span className="font-mono text-label-sm text-on-surface-variant">Enterprise Global</span>
          <span className="material-symbols-outlined text-on-surface-variant text-body-sm">expand_more</span>
        </div>

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
