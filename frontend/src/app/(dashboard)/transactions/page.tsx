import { TransactionList } from "@/features/transactions/ui/transaction-list";

export default function TransactionsPage() {
  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <h2 className="text-3xl font-bold tracking-tight">Transactions</h2>
        <p className="text-muted-foreground">
          View, filter and reconcile your financial operations.
        </p>
      </div>

      <TransactionList />
    </div>
  );
}
