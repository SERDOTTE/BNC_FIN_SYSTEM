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

  function getStatusMeta(status: Installment["status"]) {
    switch (status) {
      case "PAID":
        return { label: "PAGO", tone: "positive" };
      case "OVERDUE":
        return { label: "ATRASADA", tone: "danger" };
      case "PENDING":
        return { label: "PENDENTE", tone: "warning" };
      case "CANCELED":
        return { label: "CANCELADA", tone: "danger" };
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
        setFeedback(`Parcela ${installment.title} liquidada com sucesso.`);
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
            const statusMeta = getStatusMeta(installment.status);

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
                  {installment.status === "PAID" ? "Liquidada" : "Liquidar"}
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