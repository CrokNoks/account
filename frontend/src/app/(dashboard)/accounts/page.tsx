import { AccountList } from "@/features/accounts/ui/account-list";
import { CreateAccountDialog } from "@/features/accounts/ui/create-account-dialog";

export default function AccountsPage() {
  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-2">
          <h2 className="text-3xl font-bold tracking-tight">Accounts</h2>
          <p className="text-muted-foreground">
            Manage your bank accounts and initial balances.
          </p>
        </div>
        <CreateAccountDialog />
      </div>

      <AccountList />
    </div>
  );
}
