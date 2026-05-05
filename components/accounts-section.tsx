"use client";

import { useState, useTransition } from "react";

import { AccountCreateForm } from "@/components/account-create-form";
import { SectionCard } from "@/components/section-card";
import { formatCurrency } from "@/lib/formatters";
import type { Account } from "@/lib/types";

type Props = {
  initialAccounts: Account[];
};

export function AccountsSection({ initialAccounts }: Props) {
  const [accounts, setAccounts] = useState<Account[]>(initialAccounts);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<{ name: string; type: Account["type"]; baseCurrency: Account["baseCurrency"] }>({ name: "", type: "BANK", baseCurrency: "BRL" });
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [error, setError] = useState<string>("");
  const [isPending, startTransition] = useTransition();

  function startEdit(account: Account) {
    setEditingId(account.id);
    setEditValues({ name: account.name, type: account.type, baseCurrency: account.baseCurrency });
    setConfirmDeleteId(null);
    setError("");
  }

  function cancelEdit() {
    setEditingId(null);
    setConfirmDeleteId(null);
    setError("");
  }

  function handleDelete(id: string) {
    if (confirmDeleteId !== id) {
      setConfirmDeleteId(id);
      setEditingId(null);
      return;
    }
    startTransition(async () => {
      try {
        const res = await fetch(`/api/accounts/${id}`, { method: "DELETE" });
        if (!res.ok) {
          const data = await res.json() as { error?: string };
          setError(data.error ?? "Erro ao excluir conta.");
          return;
        }
        setAccounts((prev) => prev.filter((a) => a.id !== id));
        setConfirmDeleteId(null);
        setError("");
      } catch {
        setError("Erro ao excluir conta.");
      }
    });
  }

  function handleSave(id: string) {
    if (!editValues.name.trim()) {
      setError("O nome da conta é obrigatório.");
      return;
    }
    startTransition(async () => {
      try {
        const res = await fetch(`/api/accounts/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(editValues),
        });
        if (!res.ok) {
          const data = await res.json() as { error?: string };
          setError(data.error ?? "Erro ao atualizar conta.");
          return;
        }
        const updated = await res.json() as Account;
        setAccounts((prev) => prev.map((a) => (a.id === id ? updated : a)));
        setEditingId(null);
        setError("");
      } catch {
        setError("Erro ao atualizar conta.");
      }
    });
  }

  function handleCreated(account: Account) {
    setAccounts((prev) => [...prev, account]);
    setError("");
  }

  return (
    <section className="two-col">
      <SectionCard title="Mapa de contas" description="Contas bancárias, caixa e carteiras ativas no tenant.">
        {error ? <p className="subtle" style={{ color: "#c0392b", marginTop: 0, marginBottom: 12 }}>{error}</p> : null}
        <table>
          <thead>
            <tr>
              <th>Conta</th>
              <th>Tipo</th>
              <th>Moeda</th>
              <th>Saldo</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {accounts.map((account) =>
              editingId === account.id ? (
                <tr key={account.id}>
                  <td>
                    <input
                      value={editValues.name}
                      onChange={(e) => setEditValues((v) => ({ ...v, name: e.target.value }))}
                      style={{ width: "100%", border: "1px solid var(--line)", borderRadius: 10, padding: "6px 10px", background: "rgba(255,255,255,0.8)" }}
                    />
                  </td>
                  <td>
                    <select
                      value={editValues.type}
                      onChange={(e) => setEditValues((v) => ({ ...v, type: e.target.value as Account["type"] }))}
                      style={{ border: "1px solid var(--line)", borderRadius: 10, padding: "6px 10px", background: "rgba(255,255,255,0.8)" }}
                    >
                      <option value="BANK">BANK</option>
                      <option value="CASH">CASH</option>
                      <option value="WALLET">WALLET</option>
                      <option value="OTHER">OTHER</option>
                    </select>
                  </td>
                  <td>
                    <select
                      value={editValues.baseCurrency}
                      onChange={(e) => setEditValues((v) => ({ ...v, baseCurrency: e.target.value as Account["baseCurrency"] }))}
                      style={{ border: "1px solid var(--line)", borderRadius: 10, padding: "6px 10px", background: "rgba(255,255,255,0.8)" }}
                    >
                      <option value="BRL">BRL</option>
                      <option value="USD">USD</option>
                      <option value="EUR">EUR</option>
                      <option value="ARS">ARS</option>
                    </select>
                  </td>
                  <td>{formatCurrency(account.balance, account.baseCurrency)}</td>
                  <td>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button className="btn primary" style={{ padding: "6px 12px" }} disabled={isPending} onClick={() => handleSave(account.id)}>
                        {isPending ? "..." : "Salvar"}
                      </button>
                      <button className="btn secondary" style={{ padding: "6px 12px" }} onClick={cancelEdit}>
                        Cancelar
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                <tr key={account.id}>
                  <td><strong>{account.name}</strong></td>
                  <td>{account.type}</td>
                  <td>{account.baseCurrency}</td>
                  <td>{formatCurrency(account.balance, account.baseCurrency)}</td>
                  <td>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button
                        className="btn secondary"
                        style={{ padding: "6px 12px" }}
                        onClick={() => startEdit(account)}
                        disabled={isPending}
                      >
                        Editar
                      </button>
                      <button
                        className={confirmDeleteId === account.id ? "btn btn-danger" : "btn secondary"}
                        style={{ padding: "6px 12px" }}
                        onClick={() => handleDelete(account.id)}
                        disabled={isPending}
                      >
                        {confirmDeleteId === account.id ? "Confirmar?" : "Excluir"}
                      </button>
                    </div>
                  </td>
                </tr>
              )
            )}
            {accounts.length === 0 && (
              <tr>
                <td colSpan={5} style={{ textAlign: "center", color: "var(--muted)" }}>
                  Nenhuma conta cadastrada.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </SectionCard>

      <SectionCard title="Nova conta" description="Payload previsto pelo contrato da API.">
        <AccountCreateForm onCreated={handleCreated} />
      </SectionCard>
    </section>
  );
}
