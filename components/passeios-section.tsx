"use client";

import { FormEvent, useState, useTransition } from "react";

import { createPasseio } from "@/lib/api-client";
import { SectionCard } from "@/components/section-card";
import { BRANCHES, type BranchCode } from "@/lib/branches";
import type { PasseioOption } from "@/lib/types";

type Props = {
  initialPasseios: PasseioOption[];
};

export function PasseiosSection({ initialPasseios }: Props) {
  const [passeios, setPasseios] = useState<PasseioOption[]>(initialPasseios);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editNome, setEditNome] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState("");
  const [error, setError] = useState("");
  const [branchCode, setBranchCode] = useState<BranchCode>("CANCUN");
  const [isPending, startTransition] = useTransition();

  function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const nome = String(formData.get("nome") ?? "").trim();
    const selectedBranchCode = String(formData.get("branchCode") ?? "").trim() as BranchCode;

    if (!nome) {
      setFeedback("");
      setError("Informe o nome do passeio.");
      return;
    }

    if (selectedBranchCode !== "CANCUN" && selectedBranchCode !== "PUNTA_CANA") {
      setFeedback("");
      setError("Selecione a filial do passeio.");
      return;
    }

    startTransition(async () => {
      try {
        const created = await createPasseio({ nome, branchCode: selectedBranchCode });
        setPasseios((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)));
        setFeedback(`Passeio "${created.name}" cadastrado.`);
        setError("");
        form.reset();
        setBranchCode("CANCUN");
      } catch (err) {
        setFeedback("");
        setError(err instanceof Error ? err.message : "Erro ao criar passeio.");
      }
    });
  }

  function startEdit(item: PasseioOption) {
    setEditingId(item.id);
    setEditNome(item.name);
    setConfirmDeleteId(null);
    setFeedback("");
    setError("");
  }

  function cancelEdit() {
    setEditingId(null);
    setFeedback("");
    setError("");
  }

  function handleSave(id: string) {
    const nome = editNome.trim();
    if (!nome) {
      setError("Nome é obrigatório.");
      return;
    }

    startTransition(async () => {
      try {
        const res = await fetch(`/api/passeios/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ nome })
        });

        if (!res.ok) {
          const data = (await res.json()) as { error?: string };
          setError(data.error ?? "Erro ao atualizar passeio.");
          return;
        }

        const updated = (await res.json()) as PasseioOption;
        setPasseios((prev) =>
          prev.map((p) => (p.id === id ? updated : p)).sort((a, b) => a.name.localeCompare(b.name))
        );
        setEditingId(null);
        setFeedback(`Passeio "${updated.name}" atualizado.`);
        setError("");
      } catch {
        setFeedback("");
        setError("Erro ao atualizar passeio.");
      }
    });
  }

  function handleDelete(id: string) {
    if (confirmDeleteId !== id) {
      setConfirmDeleteId(id);
      setEditingId(null);
      setFeedback("");
      return;
    }

    const deletedName = passeios.find((p) => p.id === id)?.name ?? "";

    startTransition(async () => {
      try {
        const res = await fetch(`/api/passeios/${id}`, { method: "DELETE" });
        if (!res.ok) {
          const data = (await res.json()) as { error?: string };
          setFeedback("");
          setError(data.error ?? "Erro ao excluir passeio.");
          return;
        }

        setPasseios((prev) => prev.filter((p) => p.id !== id));
        setConfirmDeleteId(null);
        setFeedback(deletedName ? `Passeio "${deletedName}" excluído.` : "Passeio excluído.");
        setError("");
      } catch {
        setFeedback("");
        setError("Erro ao excluir passeio.");
      }
    });
  }

  return (
    <section className="two-col">
      <SectionCard
        title="Passeios cadastrados"
        description="Itens da tabela de passeios disponíveis para seleção nas vendas."
      >
        {feedback ? (
          <p className="subtle" style={{ marginTop: 0, marginBottom: 12 }}>
            {feedback}
          </p>
        ) : null}

        {error ? (
          <p className="subtle" style={{ color: "#c0392b", marginTop: 0, marginBottom: 12 }}>
            {error}
          </p>
        ) : null}

        <table>
          <thead>
            <tr>
              <th>Filial</th>
              <th>Passeio</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {passeios.map((item) =>
              editingId === item.id ? (
                <tr key={item.id}>
                  <td>
                    <strong>{item.branchLabel ?? (item.branchCode === "PUNTA_CANA" ? "PUNTA CANA" : "CANCUN")}</strong>
                  </td>
                  <td>
                    <input
                      value={editNome}
                      onChange={(e) => setEditNome(e.target.value)}
                      style={{
                        width: "100%",
                        border: "1px solid var(--line)",
                        borderRadius: 10,
                        padding: "6px 10px",
                        background: "rgba(255,255,255,0.8)"
                      }}
                    />
                  </td>
                  <td>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button
                        className="btn primary"
                        style={{ padding: "6px 12px" }}
                        disabled={isPending}
                        onClick={() => handleSave(item.id)}
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
                <tr key={item.id}>
                  <td>
                    <strong>{item.branchLabel ?? (item.branchCode === "PUNTA_CANA" ? "PUNTA CANA" : "CANCUN")}</strong>
                  </td>
                  <td>
                    <strong>{item.name}</strong>
                  </td>
                  <td>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button
                        className="btn secondary"
                        style={{ padding: "6px 12px" }}
                        disabled={isPending}
                        onClick={() => startEdit(item)}
                      >
                        Editar
                      </button>
                      <button
                        className={confirmDeleteId === item.id ? "btn btn-danger" : "btn secondary"}
                        style={{ padding: "6px 12px" }}
                        disabled={isPending}
                        onClick={() => handleDelete(item.id)}
                      >
                        {confirmDeleteId === item.id ? "Confirmar?" : "Excluir"}
                      </button>
                    </div>
                  </td>
                </tr>
              )
            )}
            {passeios.length === 0 && (
              <tr>
                <td colSpan={3} style={{ textAlign: "center", color: "var(--muted)" }}>
                  Nenhum passeio cadastrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </SectionCard>

      <SectionCard
        title="Cadastrar passeio"
        description="Adicione um novo passeio para uso nos itens das vendas."
      >
        <form className="form-grid" onSubmit={handleCreate}>
          <div className="field full">
            <label htmlFor="pas-filial">Filial</label>
            <select id="pas-filial" name="branchCode" value={branchCode} onChange={(e) => setBranchCode(e.target.value as BranchCode)} required>
              {BRANCHES.map((branch) => (
                <option key={branch.code} value={branch.code}>{branch.label}</option>
              ))}
            </select>
          </div>

          <div className="field full">
            <label htmlFor="pas-nome">Nome do passeio</label>
            <input id="pas-nome" name="nome" placeholder="Ex: Saona VIP" required />
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
