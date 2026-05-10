"use client";

import { useState, useTransition } from "react";

import { payInstallment } from "@/lib/api-client";
import { formatCurrency, formatDate, resolveInstallmentStatus, installmentStatusLabel, installmentStatusTone } from "@/lib/formatters";
import type { Installment } from "@/lib/types";

type InstallmentsTableProps = {
  initialInstallments: Installment[];
  defaultAccountId: string;
};

export function InstallmentsTable({ initialInstallments, defaultAccountId }: InstallmentsTableProps) {
  const [installments, setInstallments] = useState(initialInstallments);
  const [feedback, setFeedback] = useState<string>("");
  const [isPending, startTransition] = useTransition();

  function handlePay(installment: Installment) {
    startTransition(async () => {
      try {
        await payInstallment(installment.id, {
          accountId: defaultAccountId,
          paidAt: new Date().toISOString(),
          description: `Baixa da ${installment.title}`
        });

        setInstallments((current) =>
          current.map((item) =>
            item.id === installment.id
              ? {
                  ...item,
                  status: "PAID"
                }
              : item
          )
        );
        setFeedback(`Parcela ${installment.title} liquidado com sucesso.`);
      } catch (error) {
        setFeedback(error instanceof Error ? error.message : "Falha ao liquidar parcela.");
      }
    });
  }

  return (
    <>
      <table>
        <thead>
          <tr>
            <th>Parcela</th>
            <th>Vencimento</th>
            <th>Original</th>
            <th>Base</th>
            <th>Status</th>
            <th>Ação</th>
          </tr>
        </thead>
        <tbody>
          {installments.map((installment) => {
            const resolvedStatus = resolveInstallmentStatus(installment.status, installment.dueDate);
            const label = installmentStatusLabel(resolvedStatus);
            const tone = installmentStatusTone(resolvedStatus);

            return <tr key={installment.id}>
              <td>
                <strong>{installment.title}</strong>
                <div className="subtle">
                  {installment.customerName}
                  {installment.installmentCode ? ` · Código ${installment.installmentCode}` : ""}
                </div>
              </td>
              <td>{formatDate(installment.dueDate)}</td>
              <td>{formatCurrency(installment.amountContract, installment.currencyContract)}</td>
              <td>{formatCurrency(installment.projectedAmountBrlBase, "BRL")}</td>
              <td>
                <span className={`chip ${tone}`}>
                  {label}
                </span>
              </td>
              <td>
                <button
                  className="btn secondary"
                  type="button"
                  disabled={isPending || installment.status === "PAID" || installment.status === "CANCELED"}
                  onClick={() => handlePay(installment)}
                >
                  {installment.status === "PAID" ? "Recebido" : "Receber"}
                </button>
              </td>
            </tr>;
          })}
        </tbody>
      </table>
      {feedback ? <p className="subtle" style={{ marginTop: 12 }}>{feedback}</p> : null}
    </>
  );
}