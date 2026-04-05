"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { APP_VERSION } from "@/lib/version";

const allLinks = [
  { href: "/", label: "Home", roles: ["creator", "maintainer"] },
  { href: "/setup", label: "Setup", roles: ["creator"] },
  { href: "/players", label: "Players", roles: ["creator"] },
  { href: "/maintenance", label: "Maintenance", roles: ["creator", "maintainer"] },
  { href: "/communications", label: "Communications", roles: ["creator"] },
  { href: "/log", label: "Activity Log", roles: ["creator"] },
  { href: "/reports", label: "Reports", roles: ["creator"] },
  { href: "/guide", label: "Player Guide", roles: ["creator", "maintainer"] },
];

export function Nav() {
  const pathname = usePathname();
  const [role, setRole] = useState<string | null>(null);

  useEffect(() => {
    const checkRole = () => setRole(sessionStorage.getItem("setupRole"));
    checkRole();
    // Listen for manual storage events (dispatched from home page)
    window.addEventListener("storage", checkRole);
    return () => window.removeEventListener("storage", checkRole);
  }, []);

  // Also re-check when navigating
  useEffect(() => {
    setRole(sessionStorage.getItem("setupRole"));
  }, [pathname]);

  if (role !== "creator" && role !== "maintainer") {
    return null;
  }

  return (
    <nav className="w-56 border-r border-border bg-gray-50 p-4 flex flex-col gap-1">
      <div className="mb-6 px-3">
        <div className="text-lg font-bold">Games Signup</div>
        <div className="text-[10px] text-muted">v{APP_VERSION}</div>
      </div>
      {allLinks.filter((link) => link.roles.includes(role!)).map((link) => {
        const isActive =
          link.href === "/" ? pathname === "/" : pathname.startsWith(link.href);
        return (
          <Link
            key={link.href}
            href={link.href}
            className={`px-3 py-2 rounded text-sm transition-colors ${
              isActive
                ? "bg-primary text-white"
                : "text-foreground hover:bg-gray-200"
            }`}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
