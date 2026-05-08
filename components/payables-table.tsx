"use client";

import { useState, useTransition } from "react";

import { payPayable } from "@/lib/api-client";
import { formatCurrency, formatDate } from "@/lib/formatters";
import type { Payable } from "@/lib/types";

type PayablesTableProps = {
  initialPayables: Payable[];
  defaultAccountId: string;
};

export function PayablesTable({ initialPayables, defaultAccountId }: PayablesTableProps) {
  const [payables, setPayables] = useState(initialPayables);
  const [feedback, setFeedback] = useState<string>("");
  const [isPending, startTransition] = useTransition();

  function handlePay(payable: Payable) {
    startTransition(async () => {
      try {
        await payPayable(payable.id, {
          accountId: defaultAccountId,
          paidAt: new Date().toISOString(),
          description: `Liquidação de ${payable.supplierName}`
        });

        setPayables((current) =>
          current.map((item) =>
            item.id === payable.id
              ? {
                  ...item,
                  status: "PAID"
                }
              : item
          )
        );
        setFeedback(`Conta ${payable.supplierName} liquidado com sucesso.`);
      } catch (error) {
        setFeedback(error instanceof Error ? error.message : "Falha ao liquidar conta a pagar.");
      }
    });
  }

  return (
    <>
      <table>
        <thead>
          <tr>
            <th>Fornecedor</th>
            <th>Vencimento</th>
            <th>Contrato</th>
            <th>Base BRL</th>
            <th>Status</th>
            <th>Ação</th>
          </tr>
        </thead>
        <tbody>
          {payables.map((payable) => (
            <tr key={payable.id}>
              <td><strong>{payable.supplierName}</strong></td>
              <td>{formatDate(payable.dueDate)}</td>
              <td>{formatCurrency(payable.amountContract, payable.currencyContract)}</td>
              <td>{formatCurrency(payable.projectedAmountBrlBase, "BRL")}</td>
              <td>
                <span className={`chip ${payable.status === "PAID" ? "positive" : payable.status === "OVERDUE" ? "danger" : "warning"}`}>
                  {payable.status}
                </span>
              </td>
              <td>
                <button
                  className="btn secondary"
                  type="button"
                  disabled={isPending || payable.status === "PAID" || payable.status === "CANCELED"}
                  onClick={() => handlePay(payable)}
                >
                  {payable.status === "PAID" ? "Liquidado" : "Liquidar"}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {feedback ? <p className="subtle" style={{ marginTop: 12 }}>{feedback}</p> : null}
    </>
  );
}