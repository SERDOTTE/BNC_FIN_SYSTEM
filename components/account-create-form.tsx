"use client";

import { FormEvent, useState, useTransition } from "react";

import { createAccount } from "@/lib/api-client";
import type { Account } from "@/lib/types";

type AccountCreateFormProps = {
  onCreated?: (account: Account) => void;
};

export function AccountCreateForm({ onCreated }: AccountCreateFormProps) {
  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<string>("");

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);

    startTransition(async () => {
      try {
        const created = await createAccount({
          name: String(formData.get("name") ?? ""),
          type: String(formData.get("type") ?? "BANK") as Account["type"],
          baseCurrency: String(formData.get("baseCurrency") ?? "BRL") as Account["baseCurrency"]
        });

        setFeedback(`Conta criada: ${created.name}`);
        form.reset();
        onCreated?.(created);
      } catch (error) {
        setFeedback(error instanceof Error ? error.message : "Falha ao criar conta.");
      }
    });
  }

  return (
    <form className="form-grid" onSubmit={onSubmit}>
      <div className="field">
        <label htmlFor="account-name">Nome</label>
        <input id="account-name" name="name" placeholder="Conta Banco Principal" required />
      </div>
      <div className="field">
        <label htmlFor="account-type">Tipo</label>
        <select id="account-type" name="type" defaultValue="BANK" required>
          <option value="BANK">BANK</option>
          <option value="CASH">CASH</option>
          <option value="WALLET">WALLET</option>
          <option value="OTHER">OTHER</option>
        </select>
      </div>
      <div className="field full">
        <label htmlFor="account-base-currency">Moeda base</label>
        <select id="account-base-currency" name="baseCurrency" defaultValue="BRL" required>
          <option value="BRL">BRL</option>
          <option value="USD">USD</option>
          <option value="EUR">EUR</option>
          <option value="ARS">ARS</option>
        </select>
      </div>
      <div className="field full cta-row">
        <button className="btn primary" type="submit" disabled={isPending}>
          {isPending ? "Criando..." : "Criar conta"}
        </button>
      </div>
      {feedback ? <p className="subtle">{feedback}</p> : null}
    </form>
  );
}