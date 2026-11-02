'use client';

import { Sidebar } from "@/shared/ui/layout/sidebar";
import { Header } from "@/shared/ui/layout/header";
import { BottomNav } from "@/shared/ui/layout/bottom-nav";
import { CreateTransactionDrawer } from "@/features/transactions/ui/create-transaction-drawer";
import { TagDetailDrawer } from "@/features/tags/ui/tag-detail-drawer";
import { BackendHealthGuard } from "@/shared/ui/layout/backend-health-guard";
import { CommandMenu } from "@/shared/ui/layout/command-menu";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <BackendHealthGuard>
      <div className="flex h-screen overflow-hidden bg-background text-foreground relative">
        <div className="hidden lg:flex h-full">
          <Sidebar />
        </div>
        <div className="flex flex-col flex-1 overflow-hidden">
          <main className="flex-1 overflow-y-auto px-4 pb-[calc(5.5rem+env(safe-area-inset-bottom))] lg:px-8 lg:pb-8">
            <Header />
            <div className="max-w-7xl mx-auto">
              {children}
            </div>
          </main>
        </div>
        
        {/* Global Drawer Instance (Headless) */}
        <CreateTransactionDrawer />
        <TagDetailDrawer />
        <CommandMenu />

        <BottomNav />
      </div>
    </BackendHealthGuard>
  );
}

