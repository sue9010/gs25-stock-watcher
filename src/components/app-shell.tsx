import type { ReactNode } from "react";
import Link from "next/link";

import { logout } from "@/features/auth/actions";

const navigation = [
  { label: "Dashboard", href: "/" },
  { label: "Products", href: "/products" },
  { label: "Stores", href: "/stores" },
  { label: "Watch List", href: "/watch-list" },
  { label: "Notifications", href: "/notifications" },
  { label: "History", href: "/history" },
  { label: "Settings", href: "/settings" },
] as const;

type AppShellProps = Readonly<{
  children: ReactNode;
  activeNav: "Dashboard" | "Products" | "Stores" | "Watch List" | "Notifications" | "History" | "Settings";
  userEmail: string;
}>;

export function AppShell({ activeNav, children, userEmail }: AppShellProps) {
  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[240px_minmax(0,1fr)]">
      <aside className="border-b border-slate-800 bg-slate-950/90 lg:min-h-screen lg:border-r lg:border-b-0">
        <div className="flex h-16 items-center gap-3 border-b border-slate-800 px-5">
          <span className="flex size-9 items-center justify-center rounded-lg bg-emerald-400 text-sm font-black text-slate-950">
            25
          </span>
          <div>
            <p className="text-sm font-semibold text-white">Stock Watcher</p>
            <p className="text-[11px] text-slate-500">Personal inventory monitor</p>
          </div>
        </div>
        <nav aria-label="관리 메뉴" className="flex gap-1 overflow-x-auto p-3 lg:block lg:space-y-1">
          {navigation.map((item) => {
            const className = `block shrink-0 rounded-lg px-3 py-2 text-sm ${
              item.label === activeNav
                ? "bg-emerald-400/10 font-medium text-emerald-300"
                : "text-slate-500"
            }`;

            return (
              <Link
                key={item.label}
                href={item.href}
                aria-current={item.label === activeNav ? "page" : undefined}
                className={className}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>

      <div className="min-w-0">
        <header className="flex h-16 items-center justify-between border-b border-slate-800 bg-slate-950/60 px-4 backdrop-blur sm:px-6">
          <div>
            <p className="text-sm font-medium text-slate-200">Dashboard</p>
            <p className="text-xs text-slate-500">Asia/Seoul · Supabase 연결됨</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden max-w-56 truncate rounded-full border border-slate-700 px-3 py-1.5 text-xs text-slate-400 sm:block">
              {userEmail}
            </span>
            <form action={logout}>
              <button
                type="submit"
                className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-300 transition hover:border-slate-600 hover:bg-slate-800"
              >
                로그아웃
              </button>
            </form>
          </div>
        </header>
        <main className="space-y-4 p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}
