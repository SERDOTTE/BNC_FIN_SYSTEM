# Backend Architecture (NestJS)

## 1) Module Structure

```text
src/
  app.module.ts
  main.ts
  common/
    database/
      prisma.service.ts
      transaction-manager.ts
    auth/
      auth.module.ts
      guards/
    idempotency/
      idempotency.module.ts
      idempotency.service.ts
      idempotency.interceptor.ts
    audit/
      audit.module.ts
      audit.service.ts
    outbox/
      outbox.module.ts
      outbox.service.ts
    errors/
      domain-errors.ts
  modules/
    companies/
    users/
    accounts/
    exchange/
    receivables/
      application/
        use-cases/
          create-receivable.use-case.ts
          cancel-receivable.use-case.ts
      domain/
        entities/
        services/
      infrastructure/
        receivables.repository.ts
        installments.repository.ts
    payables/
      application/
        use-cases/
          create-payable.use-case.ts
          pay-payable.use-case.ts
          cancel-payable.use-case.ts
    transactions/
      application/
        use-cases/
          create-manual-transaction.use-case.ts
          reverse-transaction.use-case.ts
    forecasts/
      application/
        use-cases/
          create-forecast.use-case.ts
          realize-forecast.use-case.ts
    reports/
      application/
        use-cases/
          get-cash-flow-report.use-case.ts
          get-overdue-report.use-case.ts
```

## 2) Layering Rules

1. Controllers call Use Cases only.
2. Use Cases orchestrate transaction boundaries and domain rules.
3. Repositories are infrastructure adapters (Prisma/SQL).
4. Domain services contain pure business rules (currency conversion, installment split).
5. Cross-cutting concerns (audit, idempotency, outbox) stay in `common`.

## 3) Critical Use Cases and Atomic Transactions

## 3.1 Create Receivable with Automatic Installments

Business behavior:
1. Create receivable header.
2. Split value by installments with deterministic remainder distribution.
3. Create installments.
4. Create one forecast per installment (`direction=IN`).
5. Write audit and outbox event.

Transaction boundary:
- Single DB transaction (`prisma.$transaction`) for steps 1-5.

Pseudo-flow:
```ts
await prisma.$transaction(async (tx) => {
  const receivable = await receivablesRepo.create(tx, data);

  const split = installmentSplitter.splitInCents(data.totalAmount, data.installmentsCount);

  for (const part of split) {
    const installment = await installmentsRepo.create(tx, {
      receivableId: receivable.id,
      installmentNumber: part.number,
      amount: part.amount,
      dueDate: part.dueDate,
    });

    await forecastsRepo.create(tx, {
      direction: 'IN',
      originType: 'RECEIVABLE_INSTALLMENT',
      originId: installment.id,
      status: 'PENDING',
      ...fxSnapshot,
    });
  }

  await auditService.logTx(tx, ...);
  await outboxService.enqueueTx(tx, ...);
});
```

## 3.2 Pay Receivable Installment (Idempotent + Concurrency Safe)

Business behavior:
1. Validate idempotency key (`company + endpoint + key`).
2. Lock installment row (`SELECT ... FOR UPDATE`).
3. If already paid, return previous result safely.
4. Create immutable realized transaction (`direction=IN`, origin link).
5. Mark installment as paid.
6. Mark related forecast as realized.
7. Write audit and outbox.
8. Save idempotency response and commit.

Transaction boundary:
- Single DB transaction.
- Lock required to avoid double payment race.

Pseudo-flow:
```ts
await prisma.$transaction(async (tx) => {
  const idem = await idemService.claimOrGet(tx, req.idempotencyKey, req.hash);
  if (idem.isCompleted) return idem.previousResponse;

  const installment = await installmentsRepo.lockById(tx, req.installmentId); // FOR UPDATE
  if (installment.status === 'PAID') return alreadyPaidResponse;

  const transaction = await transactionsRepo.create(tx, {
    direction: 'IN',
    originType: 'RECEIVABLE_INSTALLMENT',
    originId: installment.id,
    ...fxSnapshot,
  });

  await installmentsRepo.markPaid(tx, installment.id, transaction.id, req.paidAt);
  await forecastsRepo.markRealizedByOrigin(tx, 'RECEIVABLE_INSTALLMENT', installment.id);

  await auditService.logTx(tx, ...);
  await outboxService.enqueueTx(tx, ...);
  await idemService.complete(tx, idem.id, 200, responseBody);
});
```

## 3.3 Pay Payable (Idempotent + Concurrency Safe)

Business behavior:
1. Validate idempotency key.
2. Lock payable row.
3. Ensure status is not paid/canceled.
4. Create immutable realized transaction (`direction=OUT`, origin link).
5. Mark payable as paid.
6. Mark forecast as realized.
7. Persist idempotency response.

Transaction boundary:
- Single DB transaction.

## 3.4 Reverse Realized Transaction

Business behavior:
1. Load original transaction.
2. Validate it has not been reversed.
3. Create reversal transaction with opposite direction and reference `reversalOfTransactionId`.
4. Keep history immutable.

Transaction boundary:
- Single DB transaction.

## 4) Domain Services You Should Isolate

1. `InstallmentSplitterService`: split using cents and deterministic remainder.
2. `FxSnapshotService`: resolve exchange rate and snapshot (`rateId`, `rate`, `convertedAmount`, `targetCurrency`).
3. `CashFlowCalculatorService`: aggregate realized/projected with same currency policy.
4. `OverdueClassifierService`: enforce overdue status transitions.

## 5) Idempotency Contract in Backend

1. Mandatory header for payment commands: `Idempotency-Key`.
2. Hash request body (`SHA-256`) and compare with stored key usage.
3. Same key + different payload must return HTTP `409`.
4. Store response body and status code for replay.
5. TTL recommended: 24h to 72h.

## 6) Recommended Scheduled Jobs

1. Mark overdue installments/payables daily.
2. Sync exchange rates periodically.
3. Publish pending outbox events continuously.
4. Expire old idempotency keys daily.

## 7) Testing Strategy (Minimum)

1. Unit tests:
- installment split logic
- fx conversion/snapshot logic
- status transition rules

2. Integration tests (transactional):
- pay installment twice with same idempotency key
- concurrent pay calls for the same installment
- reversal of realized transaction

3. Contract tests:
- OpenAPI request/response validation for payments and reports

## 8) Non-Functional Targets

1. Traceability: every financial mutation has `requestId`, `actorUserId`, `originType`, `originId`.
2. Consistency: no direct balance field as source of truth.
3. Performance: indexes by `company_id + date/status` and batched report queries.
4. Security: tenant scoping in every repository query.
