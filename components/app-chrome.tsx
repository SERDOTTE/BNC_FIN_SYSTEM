"use client";

import { usePathname } from "next/navigation";

import { Sidebar } from "@/components/sidebar";

type AppChromeProps = {
  children: React.ReactNode;
};

export function AppChrome({ children }: AppChromeProps) {
  const pathname = usePathname();
  const isLogin = pathname === "/login";

  if (isLogin) {
    return <main className="content content-login">{children}</main>;
  }

  return (
    <div className="app-shell">
      <Sidebar />
      <main className="content">{children}</main>
    </div>
  );
}
