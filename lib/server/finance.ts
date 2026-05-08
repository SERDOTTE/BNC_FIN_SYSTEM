import type { Currency, DailyFlowInflowDetail, DailyFlowPoint, DashboardData, ReportsData } from "@/lib/types";
import {
  companyIdFromEnv,
  readCurrency,
  readFirstString,
  readNumber,
  supabaseSelect,
  toIsoDate,
  type SupabaseRow
} from "@/lib/server/supabase-admin";

type InstallmentRow = SupabaseRow & {
  receivables?: SupabaseRow | null;
};

type FlowBucket = {
  inflow: number;
  outflow: number;
};

type DailyFlowBucket = FlowBucket & {
  inflowDetails: DailyFlowInflowDetail[];
};

function addDays(base: Date, days: number) {
  const next = new Date(base);
  next.setDate(next.getDate() + days);
  return next;
}

function formatDate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function monthKey(date: string) {
  return date.slice(0, 7);
}

function isSameOrAfter(date: string, start: string) {
  return date >= start;
}

function isSameOrBefore(date: string, end: string) {
  return date <= end;
}

function isOpenStatus(status: string) {
  return status === "PENDING" || status === "OPEN" || status === "PARTIALLY_PAID" || status === "OVERDUE";
}

async function selectWithCompany<T extends SupabaseRow>(path: string): Promise<T[]> {
  const companyId = companyIdFromEnv();
  const separator = path.includes("?") ? "&" : "?";
  const fullPath = companyId ? `${path}${separator}company_id=eq.${encodeURIComponent(companyId)}` : path;
  return supabaseSelect<T>(fullPath);
}

async function getInstallments() {
  return selectWithCompany<InstallmentRow>(
    "receivable_installments?select=*,receivables(id,customer_name,sale_code,sale_number)&order=due_date.asc"
  );
}

async function getPayables() {
  return selectWithCompany<SupabaseRow>("payables?select=*&order=due_date.asc");
}

async function getTransactions() {
  return selectWithCompany<SupabaseRow>("transactions?select=*&order=occurred_at.asc");
}

async function getLatestUsdRate() {
  const rows = await supabaseSelect<SupabaseRow>(
    "exchange_rates?select=rate&from_currency=eq.USD&to_currency=eq.BRL&order=valid_at.desc&limit=1"
  );
  return rows.length > 0 ? readNumber(rows[0], ["rate"]) : 0;
}

function mapInstallmentAmount(row: InstallmentRow) {
  return readNumber(row, ["projected_amount_brl_base", "amount", "amount_converted", "amount_contract"]);
}

function mapPayableAmount(row: SupabaseRow) {
  return readNumber(row, ["projected_amount_brl_base", "amount", "amount_converted", "amount_contract"]);
}

export async function buildDashboardData(): Promise<DashboardData> {
  const [installments, payables, transactions, currentUsdRate] = await Promise.all([
    getInstallments(),
    getPayables(),
    getTransactions(),
    getLatestUsdRate()
  ]);

  const today = new Date();
  const todayIso = formatDate(today);
  const horizonIso = formatDate(addDays(today, 30));
  const currentMonth = monthKey(todayIso);

  let currentCash = 0;
  for (const row of transactions) {
    const direction = readFirstString(row, ["direction"]);
    const amount = readNumber(row, ["amount_converted", "amount_original"]);
    currentCash += direction === "OUT" ? -amount : amount;
  }

  let futureInflow = 0;
  let futureOutflow = 0;
  let monthReceived = 0;
  let monthToReceive = 0;
  let monthOverdue = 0;
  let overdueInstallments = 0;
  let netUsdExposure = 0;

  const attentionItems: DashboardData["attentionItems"] = [];
  const cashTimeline: DashboardData["cashTimeline"] = [];

  for (const row of installments) {
    const dueDate = toIsoDate(row.due_date);
    const status = readFirstString(row, ["status"]);
    const amount = mapInstallmentAmount(row);
    const currency = readCurrency(row, ["currency"]);
    const customerName = readFirstString((row.receivables as SupabaseRow | null) ?? {}, ["customer_name"]);
    const countsAsScheduledInflow = status !== "CANCELED";

    if (status === "OVERDUE" || (status === "PENDING" && dueDate && dueDate < todayIso)) {
      overdueInstallments += 1;
    }

    const inCurrentMonth = dueDate && monthKey(dueDate) === currentMonth;
    const isPaid = status === "PAID";
    const isCanceled = status === "CANCELED";
    const isLate = status === "OVERDUE" || ((status === "PENDING" || status === "OPEN" || status === "PARTIALLY_PAID") && dueDate && dueDate < todayIso);

    if (inCurrentMonth && !isCanceled) {
      if (isPaid) {
        monthReceived += amount;
      } else if (isLate) {
        monthOverdue += amount;
      } else {
        monthToReceive += amount;
      }
    }

    if (countsAsScheduledInflow && dueDate && isSameOrAfter(dueDate, todayIso) && isSameOrBefore(dueDate, horizonIso)) {
      futureInflow += amount;
      cashTimeline.push({
        id: `installment-${readFirstString(row, ["id"])}`,
        title: `Parcela ${readNumber(row, ["installment_number"])}`,
        description: customerName || "Recebimento previsto",
        date: dueDate,
        amount,
        currency
      });
    }

    if (isOpenStatus(status) && currency === "USD") {
      netUsdExposure += amount;
    }

    if (
      countsAsScheduledInflow &&
      dueDate &&
      isSameOrBefore(dueDate, horizonIso) &&
      attentionItems.length < 5
    ) {
      const isLate = dueDate < todayIso;
      attentionItems.push({
        id: `attention-installment-${readFirstString(row, ["id"])}`,
        title: customerName ? `Parcela de ${customerName}` : "Parcela de venda",
        description: isLate ? "Recebimento em atraso no calendário." : "Recebimento previsto no calendário.",
        dueDate,
        amount,
        currency,
        level: isLate ? "danger" : "warning",
        label: isLate ? "Cobrar" : "Acompanhar"
      });
    }
  }

  for (const row of payables) {
    const dueDate = toIsoDate(row.due_date);
    const status = readFirstString(row, ["status"]);
    const amount = mapPayableAmount(row);
    const currency = readCurrency(row, ["currency"]);
    const supplierName = readFirstString(row, ["supplier_name"]);
    const countsAsScheduledOutflow = status !== "CANCELED";

    if (status === "OVERDUE" || (status === "PENDING" && dueDate && dueDate < todayIso)) {
      overdueInstallments += 1;
    }

    if (isOpenStatus(status) && dueDate && isSameOrAfter(dueDate, todayIso) && isSameOrBefore(dueDate, horizonIso)) {
      futureOutflow += amount;
      cashTimeline.push({
        id: `payable-${readFirstString(row, ["id"])}`,
        title: supplierName || "Pagamento previsto",
        description: "Compromisso aberto no Supabase.",
        date: dueDate,
        amount: -amount,
        currency
      });
    }

    if (isOpenStatus(status) && currency === "USD") {
      netUsdExposure -= amount;
    }

    if (
      countsAsScheduledOutflow &&
      dueDate &&
      isSameOrBefore(dueDate, horizonIso) &&
      attentionItems.length < 5
    ) {
      const isLate = dueDate < todayIso;
      attentionItems.push({
        id: `attention-payable-${readFirstString(row, ["id"])}`,
        title: supplierName || "Pagamento previsto",
        description: isLate ? "Pagamento em atraso no calendário." : "Pagamento previsto no calendário.",
        dueDate,
        amount: -amount,
        currency,
        level: isLate ? "danger" : "warning",
        label: isLate ? "Priorizar" : "Programar"
      });
    }
  }

  cashTimeline.sort((left, right) => left.date.localeCompare(right.date));

  const projectedNet = futureInflow - futureOutflow;
  const projectedClosingBalance = currentCash + projectedNet;
  const baseRate = currentUsdRate || 1;
  const scenarios = [
    { name: "Otimista", rate: Number((baseRate * 0.97).toFixed(2)) },
    { name: "Base", rate: Number(baseRate.toFixed(2)) },
    { name: "Pessimista", rate: Number((baseRate * 1.05).toFixed(2)) }
  ].map((scenario) => ({
    ...scenario,
    projectedNet: Number((projectedNet + netUsdExposure * (scenario.rate - baseRate)).toFixed(2))
  }));

  return {
    currentCash: Number(currentCash.toFixed(2)),
    futureInflow: Number(futureInflow.toFixed(2)),
    futureOutflow: Number(futureOutflow.toFixed(2)),
    projectedNet: Number(projectedNet.toFixed(2)),
    projectedClosingBalance: Number(projectedClosingBalance.toFixed(2)),
    monthReceived: Number(monthReceived.toFixed(2)),
    monthToReceive: Number(monthToReceive.toFixed(2)),
    monthOverdue: Number(monthOverdue.toFixed(2)),
    overdueInstallments,
    currentUsdRate: Number(baseRate.toFixed(2)),
    netUsdExposure: Number(netUsdExposure.toFixed(2)),
    attentionItems,
    scenarios,
    cashTimeline: cashTimeline.slice(0, 12)
  };
}

export async function buildReportsData(): Promise<ReportsData> {
  const [installments, payables, currentUsdRate] = await Promise.all([
    getInstallments(),
    getPayables(),
    getLatestUsdRate()
  ]);

  const todayIso = formatDate(new Date());
  const baseRate = currentUsdRate || 1;
  const projectedByDateMap = new Map<string, FlowBucket>();
  const exposureByMonth = new Map<string, number>();

  for (const row of installments) {
    const status = readFirstString(row, ["status"]);
    const dueDate = toIsoDate(row.due_date);
    if (!isOpenStatus(status) || !dueDate || dueDate < todayIso) {
      continue;
    }

    const amount = mapInstallmentAmount(row);
    const flow = projectedByDateMap.get(dueDate) ?? { inflow: 0, outflow: 0 };
    flow.inflow += amount;
    projectedByDateMap.set(dueDate, flow);

    if (readCurrency(row, ["currency"]) === "USD") {
      exposureByMonth.set(monthKey(dueDate), (exposureByMonth.get(monthKey(dueDate)) ?? 0) + amount);
    }
  }

  for (const row of payables) {
    const status = readFirstString(row, ["status"]);
    const dueDate = toIsoDate(row.due_date);
    if (!isOpenStatus(status) || !dueDate || dueDate < todayIso) {
      continue;
    }

    const amount = mapPayableAmount(row);
    const flow = projectedByDateMap.get(dueDate) ?? { inflow: 0, outflow: 0 };
    flow.outflow += amount;
    projectedByDateMap.set(dueDate, flow);

    if (readCurrency(row, ["currency"]) === "USD") {
      exposureByMonth.set(monthKey(dueDate), (exposureByMonth.get(monthKey(dueDate)) ?? 0) - amount);
    }
  }

  const projectedByDate = Array.from(projectedByDateMap.entries())
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([date, flow]) => ({
      date,
      inflow: Number(flow.inflow.toFixed(2)),
      outflow: Number(flow.outflow.toFixed(2)),
      net: Number((flow.inflow - flow.outflow).toFixed(2))
    }));

  const netProjected = projectedByDate.reduce((total, item) => total + item.net, 0);
  const scenarioCards = [
    { name: "Otimista", usdRate: Number((baseRate * 0.97).toFixed(2)) },
    { name: "Base", usdRate: Number(baseRate.toFixed(2)) },
    { name: "Pessimista", usdRate: Number((baseRate * 1.05).toFixed(2)) }
  ].map((scenario) => ({
    ...scenario,
    netProjected: Number((netProjected + scenario.usdRate - baseRate).toFixed(2))
  }));

  const exposureMonthly = Array.from(exposureByMonth.entries())
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([month, netUsd]) => ({
      month,
      netUsd: Number(netUsd.toFixed(2)),
      brlAtSpot: Number((netUsd * baseRate).toFixed(2)),
      brlPlus10: Number((netUsd * baseRate * 1.1).toFixed(2))
    }));

  return {
    scenarioCards,
    projectedByDate,
    exposureMonthly
  };
}

export async function buildDailyCashFlow(month: number, year: number): Promise<DailyFlowPoint[]> {
  const [transactions, installments] = await Promise.all([getTransactions(), getInstallments()]);
  const daysInMonth = new Date(year, month, 0).getDate();
  const buckets = new Map<number, DailyFlowBucket>();

  // Inflow is projected from receivable due dates (sales schedule), regardless of payment confirmation.
  for (const row of installments) {
    const dueDate = toIsoDate(row.due_date);
    if (!dueDate) {
      continue;
    }

    const [rowYear, rowMonth, rowDay] = dueDate.split("-").map((value) => Number.parseInt(value, 10));
    if (rowYear !== year || rowMonth !== month) {
      continue;
    }

    const status = readFirstString(row, ["status"]);
    if (status === "CANCELED") {
      continue;
    }

    const amount = mapInstallmentAmount(row);
    const currency = readCurrency(row, ["currency", "currency_contract"]);
    const amountBrl = readNumber(row, ["projected_amount_brl_base", "amount", "amount_converted", "amount_contract"]);
    const receivable = (row.receivables as SupabaseRow | null) ?? {};
    const bucket = buckets.get(rowDay) ?? { inflow: 0, outflow: 0, inflowDetails: [] };
    bucket.inflow += amount;
    bucket.inflowDetails.push({
      installmentId: readFirstString(row, ["id"]),
      receivableId: readFirstString(row, ["receivable_id"]),
      customerName: readFirstString(receivable, ["customer_name"]) || "Cliente sem nome",
      saleCode: readFirstString(receivable, ["sale_code"]) || undefined,
      saleNumber: readNumber(receivable, ["sale_number"]) || undefined,
      installmentNumber: readNumber(row, ["installment_number"]),
      dueDate,
      amount,
      currency,
      amountBrl
    });
    buckets.set(rowDay, bucket);
  }

  // Outflow remains based on registered transactions.
  for (const row of transactions) {
    const occurredAt = toIsoDate(row.occurred_at);
    if (!occurredAt) {
      continue;
    }

    const [rowYear, rowMonth, rowDay] = occurredAt.split("-").map((value) => Number.parseInt(value, 10));
    if (rowYear !== year || rowMonth !== month) {
      continue;
    }

    const direction = readFirstString(row, ["direction"]);
    const amount = readNumber(row, ["amount_converted", "amount_original"]);
    const bucket = buckets.get(rowDay) ?? { inflow: 0, outflow: 0, inflowDetails: [] };
    if (direction === "OUT") {
      bucket.outflow += amount;
    }
    buckets.set(rowDay, bucket);
  }

  return Array.from({ length: daysInMonth }, (_, index) => {
    const day = index + 1;
    const bucket = buckets.get(day) ?? { inflow: 0, outflow: 0, inflowDetails: [] };
    return {
      date: `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
      day,
      inflow: Number(bucket.inflow.toFixed(2)),
      outflow: Number(bucket.outflow.toFixed(2)),
      inflowDetails: bucket.inflowDetails
    };
  });
}