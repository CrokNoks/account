import { SavingsGoalsList } from "@/features/savings/ui/savings-goals-list";
import { CreateSavingsGoalDialog } from "@/features/savings/ui/create-savings-goal-dialog";
import { Target } from 'lucide-react';

export default function SavingsPage() {
  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg text-primary">
              <Target className="w-6 h-6" />
            </div>
            <h2 className="text-3xl font-bold tracking-tight">Objectifs d&apos;Épargne</h2>
          </div>
          <p className="text-muted-foreground">
            Donnez du sens à votre épargne en fixant des objectifs précis.
          </p>
        </div>
        <CreateSavingsGoalDialog />
      </div>

      <SavingsGoalsList />
    </div>
  );
}
