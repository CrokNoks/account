'use client';

import { RecurringTransactionList } from "@/features/recurring/ui/recurring-transaction-list";
import { CreateRecurringDialog } from "@/features/recurring/ui/create-recurring-dialog";

export default function RecurringPage() {
  return (
    <div className="flex flex-col gap-4 lg:gap-8">
      <div className="flex justify-end">
        <CreateRecurringDialog />
      </div>

      <RecurringTransactionList />
    </div>
  );
}
