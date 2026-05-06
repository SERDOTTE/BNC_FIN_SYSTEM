"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { LogoutButton } from "@/components/logout-button";

const navItems = [
  { href: "/", label: "Dashboard" },
  { href: "/receivables", label: "Vendas" },
  { href: "/payables", label: "Pagamentos" },
  { href: "/installments", label: "Parcelas" },
  { href: "/accounts", label: "Contas" },
  { href: "/fornecedores", label: "Fornecedores" },
  { href: "/passeios", label: "Passeios" },
  { href: "/reports", label: "Relatórios" }
] as const;

export function Sidebar() {
  const pathname = usePathname();
  const [email, setEmail] = useState<string>("");

  useEffect(() => {
    let active = true;

    fetch("/api/auth/me", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) {
          return null;
        }

        const body = (await response.json().catch(() => ({}))) as { email?: string };
        return body.email ?? "";
      })
      .then((value) => {
        if (active) {
          setEmail(value ?? "");
        }
      })
      .catch(() => {
        if (active) {
          setEmail("");
        }
      });

    return () => {
      active = false;
    };
  }, []);

  return (
    <aside className="sidebar">
      <div className="sidebar-auth-top">
        <p className="sidebar-welcome">Bem-vindo{email ? `, ${email}` : ""}</p>
        <LogoutButton />
      </div>

      <div className="brand">
        <h1>Brasileiros no Caribe - Controle Financeiro</h1>
        <p>
          Visão do fluxo de caixa realizado e projeção futura.
        </p>
      </div>

      <nav className="nav">
        {navItems.map((item) => {
          const isActive = pathname === item.href;

          return (
            <Link key={item.href} href={item.href} className={`nav-item ${isActive ? "active" : ""}`}>
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}