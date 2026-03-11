import { Sidebar } from "@/shared/ui/layout/sidebar";
import { Header } from "@/shared/ui/layout/header";
import { BottomNav } from "@/shared/ui/layout/bottom-nav";
import { CreateTransactionDrawer } from "@/features/transactions/ui/create-transaction-drawer";
import { useUiStore } from "@/shared/model/use-ui-store";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const setCreateTransactionDrawerOpen = useUiStore((state) => state.setCreateTransactionDrawerOpen);

  return (
    <div className="flex h-screen overflow-hidden bg-background text-foreground relative">
      <div className="hidden lg:flex h-full">
        <Sidebar />
      </div>
      <div className="flex flex-col flex-1 overflow-hidden">
        <main className="flex-1 overflow-y-auto px-4 pb-20 lg:px-8 lg:pb-8">
          <Header />
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
        </main>
      </div>
      
      {/* Mobile FAB */}
      <div className="lg:hidden fixed bottom-20 right-4 z-40">
        <Button 
          size="icon" 
          className="h-14 w-14 rounded-full shadow-lg border-primary/20" 
          onClick={() => setCreateTransactionDrawerOpen(true)}
        >
          <Plus className="h-6 w-6" />
        </Button>
      </div>

      {/* Global Drawer Instance (Headless) */}
      <CreateTransactionDrawer trigger={null} />

      <BottomNav />
    </div>
  );
}

