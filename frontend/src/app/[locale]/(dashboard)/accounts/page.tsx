'use client';

import { AccountList } from "@/features/accounts/ui/account-list";
import { CreateAccountDialog } from "@/features/accounts/ui/create-account-dialog";
import { useUiStore } from "@/shared/model/use-ui-store";
import { useEffect } from "react";
import { HelpButton } from "@/shared/ui/tour/HelpButton";

export default function AccountsPage() {
  const { startTour, completedTours } = useUiStore();

  useEffect(() => {
    if (!completedTours['account']) {
      const timer = setTimeout(() => {
        startTour('account');
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [completedTours, startTour]);

  return (
    <div className="flex flex-col gap-4 lg:gap-8">
      <div className="flex items-center justify-between">
        <HelpButton tour="account" className="h-8 w-8" />
        <CreateAccountDialog />
      </div>

      <AccountList />
    </div>
  );
}
