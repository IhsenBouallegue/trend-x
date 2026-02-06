"use client";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { AccountSelector } from "./account-selector";
import { ModeToggle } from "./mode-toggle";

const navLinks = [
  { href: "/", label: "Dashboard" },
  { href: "/setup", label: "Setup" },
  { href: "/settings", label: "Settings" },
  { href: "/docs", label: "Docs" },
] as const;

export default function Header() {
  const pathname = usePathname();
  const isDashboard = pathname === "/";

  function isActive(href: string) {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  }

  return (
    <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto w-full max-w-5xl px-4">
        <div className="flex flex-row items-center justify-between py-3">
          <div className="flex items-center gap-4">
            <Link href="/" className="flex items-center gap-2">
              <Image
                src="/logo.png"
                alt="Trend-X"
                width={32}
                height={32}
                className="size-8 shrink-0"
                priority
              />
              <span className="font-semibold tracking-tight">TREND-X</span>
            </Link>

            <div className="h-4 w-px bg-border" />

            <nav className="flex items-center gap-3">
              {navLinks.map(({ href, label }) => (
                <Link
                  key={href}
                  href={href}
                  className={cn(
                    "text-sm font-medium transition-colors hover:text-foreground",
                    isActive(href) ? "text-foreground" : "text-muted-foreground"
                  )}
                >
                  {label}
                </Link>
              ))}
            </nav>
          </div>

          <div className="flex items-center gap-2">
            {isDashboard && <AccountSelector />}
            <ModeToggle />
          </div>
        </div>
      </div>
    </header>
  );
}
