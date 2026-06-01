export type Currency = "BRL" | "USD" | "EUR" | "ARS";
export type BranchCode = "CANCUN" | "PUNTA_CANA";

export type LookupOption = {
  id: string;
  name: string;
};

export type PasseioOption = LookupOption & {
  branchCode: BranchCode;
  branchLabel: string;
};

export type Account = {
  id: string;
  name: string;
  type: "BANK" | "CASH" | "WALLET" | "OTHER";
  baseCurrency: Currency;
  balance: number;
};

export type Supplier = {
  id: string;
  name: string;
};

export type Receivable = {
  id: string;
  branchCode: BranchCode;
  branchLabel: string;
  customerName: string;
  sellerId?: string;
  sellerName?: string;
  saleCode?: string;
  saleNumber?: number;
  description?: string;
  totalAmount: number;
  currency: Currency;
  saleDate: string;
  installmentsCount: number;
  status: "OPEN" | "PARTIALLY_PAID" | "PAID" | "OVERDUE" | "CANCELED";
};

export type Installment = {
  id: string;
  receivableId: string;
  receivableStatus?: Receivable["status"];
  installmentCode?: string;
  title: string;
  customerName: string;
  installmentNumber: number;
  amountContract: number;
  currencyContract: Currency;
  projectedAmountBrlBase: number;
  dueDate: string;
  status: "PENDING" | "PAID" | "OVERDUE" | "CANCELED";
};

export type Payable = {
  id: string;
  supplierId?: string;
  supplierName: string;
  amountContract: number;
  currencyContract: Currency;
  projectedAmountBrlBase: number;
  dueDate: string;
  status: "PENDING" | "PAID" | "OVERDUE" | "CANCELED";
};

export type DashboardAttentionItem = {
  id: string;
  title: string;
  description: string;
  dueDate: string;
  amount: number;
  currency: Currency;
  level: "positive" | "warning" | "danger";
  label: string;
};

export type DashboardScenario = {
  name: string;
  rate: number;
  projectedNet: number;
};

export type TimelineItem = {
  id: string;
  title: string;
  description: string;
  date: string;
  amount: number;
  currency: Currency;
};

export type DashboardData = {
  currentCash: number;
  futureInflow: number;
  futureOutflow: number;
  projectedNet: number;
  projectedClosingBalance: number;
  monthReceived: number;
  monthToReceive: number;
  monthOverdue: number;
  overdueInstallments: number;
  currentUsdRate: number;
  netUsdExposure: number;
  attentionItems: DashboardAttentionItem[];
  scenarios: DashboardScenario[];
  cashTimeline: TimelineItem[];
};

export type DashboardMonthlyInstallmentDetail = {
  installmentId: string;
  receivableId: string;
  branchCode: BranchCode;
  branchLabel: string;
  customerName: string;
  sellerId?: string;
  sellerName?: string;
  saleCode?: string;
  saleNumber?: number;
  installmentNumber: number;
  totalInstallments: number;
  dueDate: string;
  paymentDate?: string;
  amountBrl: number;
  status: Installment["status"];
};

export type DashboardMonthlySaleDetail = {
  receivableId: string;
  branchCode: BranchCode;
  branchLabel: string;
  customerName: string;
  sellerId?: string;
  sellerName?: string;
  saleCode?: string;
  saleNumber?: number;
  saleDate: string;
  status: Receivable["status"];
  installmentsCount: number;
  fxRateUsdBrl: number;
  totalSaleUsd: number;
  totalSaleBrl: number;
  receivableInMonthBrl: number;
  projectedReceiptsBrl: number;
  receivedBrl: number;
  pendingBrl: number;
  overdueBrl: number;
};

export type DashboardSellerMonthlySummary = {
  sellerId?: string;
  sellerName: string;
  salesCount: number;
  averageUsdRate: number;
  totalSalesUsd: number;
  totalSalesBrl: number;
  receivableInMonthBrl: number;
};

export type DashboardBranchMonthlySummary = {
  branchCode: BranchCode;
  branchLabel: string;
  salesCount: number;
  totalSalesBrl: number;
  projectedReceiptsBrl: number;
  monthReceivedBrl: number;
  monthToReceiveBrl: number;
  monthOverdueBrl: number;
};

export type DashboardMonthlyBreakdown = {
  month: number;
  year: number;
  monthReceived: number;
  monthToReceive: number;
  monthOverdue: number;
  installmentsReceived: DashboardMonthlyInstallmentDetail[];
  installmentsToReceive: DashboardMonthlyInstallmentDetail[];
  installmentsOverdue: DashboardMonthlyInstallmentDetail[];
  salesCount: number;
  totalSalesMonthUsd: number;
  totalSalesMonthBrl: number;
  projectedReceiptsMonthBrl: number;
  branchSummaries: DashboardBranchMonthlySummary[];
  sellerSummaries: DashboardSellerMonthlySummary[];
  sales: DashboardMonthlySaleDetail[];
};

export type ReportsData = {
  scenarioCards: Array<{
    name: string;
    usdRate: number;
    netProjected: number;
  }>;
  projectedByDate: Array<{
    date: string;
    inflow: number;
    outflow: number;
    net: number;
  }>;
  exposureMonthly: Array<{
    month: string;
    netUsd: number;
    brlAtSpot: number;
    brlPlus10: number;
  }>;
};

export type CreateAccountRequest = {
  name: string;
  type: Account["type"];
  baseCurrency: Currency;
};

export type SaleItem = {
  passeioId: string;
  passeioNome: string;
  fornecedorId: string;
  fornecedorNome: string;
  adultos: number;
  criancas: number;
  custoUnitarioAdulto: number;
  custoUnitarioCrianca: number;
  totalItem: number;
  currency: Currency;
};

export type InstallmentInput = {
  dueDate: string;
  amountOverride?: string;
  meioPagamentoId: string;
  meioPagamentoNome: string;
  meioPagamentoTipo: string;
  accountId: string;
  accountName: string;
  cashReceiverId: string;
  cashReceiverName: string;
};

export type CreateReceivableRequest = {
  branchCode: BranchCode;
  customerName: string;
  sellerId: string;
  sellerName: string;
  fxRateUsdBrl?: number;
  description?: string;
  totalAmount: number;
  currency: Currency;
  saleDate: string;
  installmentsCount: number;
  items: SaleItem[];
  saleCode?: string;
  saleNumber?: number;
  installmentCodes?: string[];
  installmentDueDates?: string[];
  installmentAmounts?: number[];
  installmentInputs?: InstallmentInput[];
  meioPagamentoId?: string;
  meioPagamentoNome?: string;
  meioPagamentoTipo?: string;
  accountId?: string;
  accountName?: string;
  cashReceiverId?: string;
  cashReceiverName?: string;
};

export type CreatePayableRequest = {
  supplierId?: string;
  supplierName: string;
  description?: string;
  amount: number;
  currency: Currency;
  dueDate: string;
};

export type PayInstallmentRequest = {
  accountId: string;
  paidAt: string;
  description?: string;
};

export type PayPayableRequest = {
  accountId: string;
  paidAt: string;
  description?: string;
};

export type PaymentResult = {
  installmentId?: string;
  payableId?: string;
  transactionId: string;
};

export type DailyFlowPoint = {
  date: string;
  day: number;
  inflow: number;
  outflow: number;
  inflowDetails?: DailyFlowInflowDetail[];
};

export type DailyFlowInflowDetail = {
  installmentId: string;
  receivableId: string;
  customerName: string;
  saleCode?: string;
  saleNumber?: number;
  installmentNumber: number;
  dueDate: string;
  amount: number;
  currency: Currency;
  amountBrl: number;
};