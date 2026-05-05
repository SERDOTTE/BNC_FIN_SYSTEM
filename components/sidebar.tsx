"use client";

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

  return (
    <aside className="sidebar">
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

      <div className="sidebar-footer">
        <LogoutButton />
      </div>
    </aside>
  );
}