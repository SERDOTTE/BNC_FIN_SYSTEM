"use client";

import { FormEvent, useState, useTransition } from "react";

import { SectionCard } from "@/components/section-card";
import type { Supplier } from "@/lib/types";

type Props = {
  initialSuppliers: Supplier[];
};

export function FornecedoresSection({ initialSuppliers }: Props) {
  const [suppliers, setSuppliers] = useState<Supplier[]>(initialSuppliers);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editNome, setEditNome] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState("");
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  // ── CREATE ──────────────────────────────────────────────
  function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const nome = (new FormData(form).get("nome") as string ?? "").trim();
    if (!nome) return;

    startTransition(async () => {
      try {
        const res = await fetch("/api/fornecedores", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ nome }),
        });
        if (!res.ok) {
          const data = await res.json() as { error?: string };
          setError(data.error ?? "Erro ao criar fornecedor.");
          return;
        }
        const created = await res.json() as Supplier;
        setSuppliers((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)));
        setFeedback(`Fornecedor "${created.name}" cadastrado.`);
        setError("");
        form.reset();
      } catch {
        setError("Erro ao criar fornecedor.");
      }
    });
  }

  // ── EDIT ────────────────────────────────────────────────
  function startEdit(s: Supplier) {
    setEditingId(s.id);
    setEditNome(s.name);
    setConfirmDeleteId(null);
    setError("");
  }

  function cancelEdit() {
    setEditingId(null);
    setError("");
  }

  function handleSave(id: string) {
    const nome = editNome.trim();
    if (!nome) { setError("Nome é obrigatório."); return; }

    startTransition(async () => {
      try {
        const res = await fetch(`/api/fornecedores/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ nome }),
        });
        if (!res.ok) {
          const data = await res.json() as { error?: string };
          setError(data.error ?? "Erro ao atualizar fornecedor.");
          return;
        }
        const updated = await res.json() as Supplier;
        setSuppliers((prev) =>
          prev.map((s) => (s.id === id ? updated : s)).sort((a, b) => a.name.localeCompare(b.name))
        );
        setEditingId(null);
        setError("");
      } catch {
        setError("Erro ao atualizar fornecedor.");
      }
    });
  }

  // ── DELETE ───────────────────────────────────────────────
  function handleDelete(id: string) {
    if (confirmDeleteId !== id) {
      setConfirmDeleteId(id);
      setEditingId(null);
      return;
    }
    startTransition(async () => {
      try {
        const res = await fetch(`/api/fornecedores/${id}`, { method: "DELETE" });
        if (!res.ok) {
          const data = await res.json() as { error?: string };
          setError(data.error ?? "Erro ao excluir fornecedor.");
          return;
        }
        setSuppliers((prev) => prev.filter((s) => s.id !== id));
        setConfirmDeleteId(null);
        setError("");
      } catch {
        setError("Erro ao excluir fornecedor.");
      }
    });
  }

  return (
    <section className="two-col">
      {/* ── Tabela de fornecedores ── */}
      <SectionCard
        title="Fornecedores cadastrados"
        description="Lista de fornecedores ativos para uso em pagamentos e passeios."
      >
        {error ? (
          <p className="subtle" style={{ color: "#c0392b", marginTop: 0, marginBottom: 12 }}>
            {error}
          </p>
        ) : null}

        <table>
          <thead>
            <tr>
              <th>Nome</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {suppliers.map((s) =>
              editingId === s.id ? (
                <tr key={s.id}>
                  <td>
                    <input
                      value={editNome}
                      onChange={(e) => setEditNome(e.target.value)}
                      style={{
                        width: "100%",
                        border: "1px solid var(--line)",
                        borderRadius: 10,
                        padding: "6px 10px",
                        background: "rgba(255,255,255,0.8)",
                      }}
                    />
                  </td>
                  <td>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button
                        className="btn primary"
                        style={{ padding: "6px 12px" }}
                        disabled={isPending}
                        onClick={() => handleSave(s.id)}
                      >
                        {isPending ? "..." : "Salvar"}
                      </button>
                      <button
                        className="btn secondary"
                        style={{ padding: "6px 12px" }}
                        onClick={cancelEdit}
                      >
                        Cancelar
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                <tr key={s.id}>
                  <td>
                    <strong>{s.name}</strong>
                  </td>
                  <td>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button
                        className="btn secondary"
                        style={{ padding: "6px 12px" }}
                        disabled={isPending}
                        onClick={() => startEdit(s)}
                      >
                        Editar
                      </button>
                      <button
                        className={confirmDeleteId === s.id ? "btn btn-danger" : "btn secondary"}
                        style={{ padding: "6px 12px" }}
                        disabled={isPending}
                        onClick={() => handleDelete(s.id)}
                      >
                        {confirmDeleteId === s.id ? "Confirmar?" : "Excluir"}
                      </button>
                    </div>
                  </td>
                </tr>
              )
            )}
            {suppliers.length === 0 && (
              <tr>
                <td colSpan={2} style={{ textAlign: "center", color: "var(--muted)" }}>
                  Nenhum fornecedor cadastrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </SectionCard>

      {/* ── Formulário de cadastro ── */}
      <SectionCard
        title="Cadastrar fornecedor"
        description="Adicione um novo fornecedor para uso em pagamentos e passeios."
      >
        {feedback ? (
          <p className="subtle" style={{ marginTop: 0, marginBottom: 12 }}>
            {feedback}
          </p>
        ) : null}

        <form className="form-grid" onSubmit={handleCreate}>
          <div className="field full">
            <label htmlFor="forn-nome">Nome do fornecedor</label>
            <input
              id="forn-nome"
              name="nome"
              placeholder="Ex: Passeios Caribe Ltda"
              required
            />
          </div>
          <div className="field full cta-row">
            <button className="btn primary" type="submit" disabled={isPending}>
              {isPending ? "Salvando..." : "Cadastrar"}
            </button>
          </div>
        </form>
      </SectionCard>
    </section>
  );
}
