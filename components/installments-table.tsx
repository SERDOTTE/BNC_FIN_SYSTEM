"use client";

import { useState, useTransition } from "react";

import { payInstallment } from "@/lib/api-client";
import { formatCurrency, formatDate } from "@/lib/formatters";
import type { Installment } from "@/lib/types";

type InstallmentsTableProps = {
  initialInstallments: Installment[];
  defaultAccountId: string;
};

export function InstallmentsTable({ initialInstallments, defaultAccountId }: InstallmentsTableProps) {
  const [installments, setInstallments] = useState(initialInstallments);
  const [feedback, setFeedback] = useState<string>("");
  const [isPending, startTransition] = useTransition();

  function isPastDue(dueDateIso: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const dueDate = new Date(`${dueDateIso}T00:00:00`);
    return dueDate.getTime() < today.getTime();
  }

  function resolveQueueStatus(installment: Installment): "PAID" | "OVERDUE" | "RECEBER" {
    if (installment.status === "PAID") {
      return "PAID";
    }

    if (installment.status === "OVERDUE" || isPastDue(installment.dueDate)) {
      return "OVERDUE";
    }

    return "RECEBER";
  }

  function getStatusMeta(status: "PAID" | "OVERDUE" | "RECEBER") {
    switch (status) {
      case "PAID":
        return { label: "RECEBIDO", tone: "positive" };
      case "OVERDUE":
        return { label: "ATRASO", tone: "danger" };
      case "RECEBER":
        return { label: "RECEBER", tone: "warning" };
      default:
        return { label: status, tone: "warning" };
    }
  }

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
            const queueStatus = resolveQueueStatus(installment);
            const statusMeta = getStatusMeta(queueStatus);

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
                <span className={`chip ${statusMeta.tone}`}>
                  {statusMeta.label}
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