import type {
  Account,
  CreateAccountRequest,
  CreatePayableRequest,
  CreateReceivableRequest,
  DailyFlowPoint,
  DashboardData,
  Installment,
  LookupOption,
  PayInstallmentRequest,
  PayPayableRequest,
  Payable,
  PaymentResult,
  Receivable,
  ReportsData
} from "@/lib/types";

function makeIdempotencyKey(prefix: string) {
  const random = Math.random().toString(36).slice(2, 10);
  return `${prefix}-${Date.now()}-${random}`;
}

async function fetchRouteJson<T>(path: string): Promise<T> {
  const response = await fetch(path, {
    headers: {
      "Content-Type": "application/json"
    },
    cache: "no-store"
  });

  if (!response.ok) {
    const content = await response.text();
    throw new Error(`Falha ao carregar ${path}: ${response.status} ${content}`);
  }

  return response.json() as Promise<T>;
}

async function sendRouteJson<TResponse, TRequest = unknown>(
  path: string,
  method: "POST" | "PUT" | "PATCH" | "DELETE",
  body?: TRequest,
  headers?: Record<string, string>
): Promise<TResponse> {
  const response = await fetch(path, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...headers
    },
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store"
  });

  if (!response.ok) {
    const content = await response.text();
    throw new Error(`Falha em ${method} ${path}: ${response.status} ${content}`);
  }

  if (response.status === 204) {
    return {} as TResponse;
  }

  return response.json() as Promise<TResponse>;
}

function getMonthRange(month: number, year: number) {
  const end = new Date(year, month, 0);
  return { daysInMonth: end.getDate() };
}

export async function getDashboardData(): Promise<DashboardData> {
  return fetchRouteJson<DashboardData>("/api/dashboard");
}

export async function listAccounts(): Promise<Account[]> {
  return fetchRouteJson<Account[]>("/api/accounts");
}

export async function listEmployees(): Promise<LookupOption[]> {
  return fetchRouteJson<LookupOption[]>("/api/employees");
}

export async function listSuppliers(): Promise<LookupOption[]> {
  return fetchRouteJson<LookupOption[]>("/api/fornecedores");
}

export async function listPasseios(): Promise<LookupOption[]> {
  return fetchRouteJson<LookupOption[]>("/api/passeios");
}

export async function createPasseio(payload: { nome: string; moedaCusto?: string }): Promise<LookupOption> {
  return sendRouteJson<LookupOption, { nome: string; moedaCusto?: string }>("/api/passeios", "POST", payload);
}

export async function listFornecedores(): Promise<LookupOption[]> {
  return fetchRouteJson<LookupOption[]>("/api/fornecedores");
}

export async function createFornecedor(payload: { nome: string }): Promise<LookupOption> {
  return sendRouteJson<LookupOption, { nome: string }>("/api/fornecedores", "POST", payload);
}

export async function listMeiosPagamento(): Promise<Array<LookupOption & { tipo: string; contaRecebimento?: string }>> {
  return fetchRouteJson<Array<LookupOption & { tipo: string; contaRecebimento?: string }>>("/api/meios-pagamento");
}

export async function fetchPasseioFornecedorPreco(
  passeioId: string,
  fornecedorId: string
): Promise<{ custoAdulto: number; custoCrianca: number }> {
  return fetchRouteJson<{ custoAdulto: number; custoCrianca: number }>(
    `/api/passeio-fornecedor?passeioId=${encodeURIComponent(passeioId)}&fornecedorId=${encodeURIComponent(fornecedorId)}`
  );
}

export async function listReceivables(): Promise<Receivable[]> {
  return fetchRouteJson<Receivable[]>("/api/receivables");
}

export async function listInstallments(): Promise<Installment[]> {
  return fetchRouteJson<Installment[]>("/api/installments");
}

export async function listPayables(): Promise<Payable[]> {
  return fetchRouteJson<Payable[]>("/api/payables");
}

export async function getReportsData(): Promise<ReportsData> {
  return fetchRouteJson<ReportsData>("/api/reports");
}

export async function getDailyCashFlowByMonth(month: number, year: number): Promise<DailyFlowPoint[]> {
  const data = await fetchRouteJson<DailyFlowPoint[]>(`/api/reports/cash-flow?month=${month}&year=${year}`);
  const { daysInMonth } = getMonthRange(month, year);

  if (data.length === daysInMonth) {
    return data;
  }

  return Array.from({ length: daysInMonth }, (_, index) => data[index] ?? {
    date: `${year}-${String(month).padStart(2, "0")}-${String(index + 1).padStart(2, "0")}`,
    day: index + 1,
    inflow: 0,
    outflow: 0,
    inflowDetails: []
  });
}

export async function createAccount(payload: CreateAccountRequest): Promise<Account> {
  return sendRouteJson<Account, CreateAccountRequest>("/api/accounts", "POST", payload);
}

export async function createReceivable(payload: CreateReceivableRequest): Promise<Receivable> {
  return sendRouteJson<Receivable, CreateReceivableRequest>("/api/receivables", "POST", payload);
}

export async function markReceivableAsReceived(receivableId: string): Promise<Receivable> {
  return sendRouteJson<Receivable, { status: string }>(
    `/api/receivables/${receivableId}/status`,
    "PATCH",
    { status: "RECEBIDO" }
  );
}

export async function updateReceivableStatus(
  receivableId: string,
  status: "OPEN" | "OVERDUE" | "PAID"
): Promise<Receivable> {
  return sendRouteJson<Receivable, { status: string }>(
    `/api/receivables/${receivableId}/status`,
    "PATCH",
    { status }
  );
}

export async function updateReceivable(
  receivableId: string,
  payload: {
    customerName?: string;
    description?: string;
    saleDate?: string;
    totalAmount?: number;
    currency?: string;
    sellerId?: string;
    sellerName?: string;
    fxRateUsdBrl?: number;
    installmentsCount?: number;
    installmentInputs?: Array<{
      dueDate: string;
      meioPagamentoId?: string;
      meioPagamentoNome?: string;
      meioPagamentoTipo?: string;
      accountId?: string;
      accountName?: string;
      cashReceiverId?: string;
      cashReceiverName?: string;
    }>;
  }
): Promise<Receivable> {
  return sendRouteJson<Receivable, typeof payload>(`/api/receivables/${receivableId}`, "PATCH", payload);
}

export async function deleteReceivable(receivableId: string): Promise<void> {
  await sendRouteJson<unknown>(`/api/receivables/${receivableId}`, "DELETE");
}

export async function createPayable(payload: CreatePayableRequest): Promise<Payable> {
  return sendRouteJson<Payable, CreatePayableRequest>("/api/payables", "POST", payload);
}

export async function payInstallment(installmentId: string, payload: PayInstallmentRequest): Promise<PaymentResult> {
  return sendRouteJson<PaymentResult, PayInstallmentRequest>(
    `/api/installments/${installmentId}/pay`,
    "POST",
    payload,
    {
      "Idempotency-Key": makeIdempotencyKey(`installment-${installmentId}`)
    }
  );
}

export async function updateInstallmentStatus(
  installmentId: string,
  status: "PENDING" | "OVERDUE" | "PAID"
): Promise<{ id: string; status: Installment["status"] }> {
  return sendRouteJson<{ id: string; status: Installment["status"] }, { status: string }>(
    `/api/installments/${installmentId}/status`,
    "PATCH",
    { status }
  );
}

export async function payPayable(payableId: string, payload: PayPayableRequest): Promise<PaymentResult> {
  return sendRouteJson<PaymentResult, PayPayableRequest>(
    `/api/payables/${payableId}/pay`,
    "POST",
    payload,
    {
      "Idempotency-Key": makeIdempotencyKey(`payable-${payableId}`)
    }
  );
}

