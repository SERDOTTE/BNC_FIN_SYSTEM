"use client";

import { FormEvent, useEffect, useState, useTransition } from "react";

import { createPayable, listSuppliers } from "@/lib/api-client";
import type { Currency, LookupOption, Payable } from "@/lib/types";

type PayableCreateFormProps = {
  onCreated?: (payable: Payable) => void;
};

export function PayableCreateForm({ onCreated }: PayableCreateFormProps) {
  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<string>("");
  const [suppliers, setSuppliers] = useState<LookupOption[]>([]);

  useEffect(() => {
    let active = true;

    listSuppliers()
      .then((items) => {
        if (active) {
          setSuppliers(items);
        }
      })
      .catch(() => {
        if (active) {
          setSuppliers([]);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);

    startTransition(async () => {
      try {
        const supplierId = String(formData.get("supplierId") ?? "").trim();
        const supplier = suppliers.find((item) => item.id === supplierId);

        if (!supplier) {
          throw new Error("Selecione um fornecedor válido.");
        }

        const created = await createPayable({
          supplierId,
          supplierName: supplier.name,
          description: String(formData.get("description") ?? ""),
          amount: Number(formData.get("amount") ?? 0),
          currency: String(formData.get("currency") ?? "BRL") as Currency,
          dueDate: String(formData.get("dueDate") ?? "")
        });

        setFeedback(`Conta a pagar criada: ${created.supplierName}`);
        form.reset();
        onCreated?.(created);
      } catch (error) {
        setFeedback(error instanceof Error ? error.message : "Falha ao criar conta a pagar.");
      }
    });
  }

  return (
    <form className="form-grid" onSubmit={onSubmit}>
      <div className="field">
        <label htmlFor="payable-supplier">Fornecedor</label>
        <select id="payable-supplier" name="supplierId" defaultValue="" required>
          <option value="" disabled>{suppliers.length ? "Selecione o fornecedor" : "Carregando fornecedores..."}</option>
          {suppliers.map((supplier) => (
            <option key={supplier.id} value={supplier.id}>
              {supplier.name}
            </option>
          ))}
        </select>
      </div>
      <div className="field">
        <label htmlFor="payable-amount">Valor</label>
        <input id="payable-amount" name="amount" type="number" min="0.01" step="0.01" placeholder="500.00" required />
      </div>
      <div className="field">
        <label htmlFor="payable-currency">Moeda</label>
        <select id="payable-currency" name="currency" defaultValue="USD" required>
          <option value="BRL">BRL</option>
          <option value="USD">USD</option>
          <option value="EUR">EUR</option>
          <option value="ARS">ARS</option>
        </select>
      </div>
      <div className="field">
        <label htmlFor="payable-due-date">Vencimento</label>
        <input id="payable-due-date" name="dueDate" type="date" required />
      </div>
      <div className="field full">
        <label htmlFor="payable-description">Descrição</label>
        <textarea id="payable-description" name="description" placeholder="Campanha trimestral e mídia de performance." />
      </div>
      <div className="field full cta-row">
        <button className="btn primary" type="submit" disabled={isPending}>
          {isPending ? "Criando..." : "Criar conta a pagar"}
        </button>
      </div>
      {feedback ? <p className="subtle">{feedback}</p> : null}
    </form>
  );
}