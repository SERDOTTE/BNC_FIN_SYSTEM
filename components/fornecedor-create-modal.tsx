"use client";

import { FormEvent, useState, useTransition } from "react";

import { createFornecedor } from "@/lib/api-client";
import type { LookupOption } from "@/lib/types";

type Props = {
  onClose: () => void;
  onCreated: (supplier: LookupOption) => void;
};

export function FornecedorCreateModal({ onClose, onCreated }: Props) {
  const [isPending, startTransition] = useTransition();
  const [nome, setNome] = useState("");
  const [error, setError] = useState("");

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedName = nome.trim();

    if (!trimmedName) {
      setError("Informe o nome do fornecedor.");
      return;
    }

    startTransition(async () => {
      try {
        const created = await createFornecedor({ nome: trimmedName });
        onCreated(created);
      } catch (submitError) {
        setError(submitError instanceof Error ? submitError.message : "Erro ao criar fornecedor.");
      }
    });
  }

  return (
    <div className="flow-detail-overlay" role="dialog" aria-modal="true" aria-label="Cadastrar fornecedor">
      <div className="flow-detail-modal" style={{ width: "min(520px, 96vw)" }}>
        <div className="flow-detail-header">
          <div>
            <h3>Cadastrar fornecedor</h3>
            <p className="subtle">Adicione um fornecedor sem sair do cadastro da venda.</p>
          </div>
          <button className="btn secondary small" type="button" onClick={onClose}>
            ✕
          </button>
        </div>

        {error ? (
          <p className="subtle" style={{ color: "#c0392b", margin: 0 }}>
            {error}
          </p>
        ) : null}

        <form className="form-grid" onSubmit={handleSubmit}>
          <div className="field full">
            <label htmlFor="inline-fornecedor-nome">Nome do fornecedor</label>
            <input
              id="inline-fornecedor-nome"
              value={nome}
              onChange={(event) => {
                setNome(event.target.value);
                if (error) {
                  setError("");
                }
              }}
              placeholder="Ex: Passeios Caribe Ltda"
              autoFocus
              required
            />
          </div>

          <div className="field full" style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
            <button className="btn secondary" type="button" onClick={onClose} disabled={isPending}>
              Cancelar
            </button>
            <button className="btn primary" type="submit" disabled={isPending}>
              {isPending ? "Salvando..." : "Salvar fornecedor"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}