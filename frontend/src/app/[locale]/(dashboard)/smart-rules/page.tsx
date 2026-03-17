import { SmartRulesList } from "@/features/smart-rules/ui/smart-rules-list";
import { CreateSmartRuleDialog } from "@/features/smart-rules/ui/create-smart-rule-dialog";
import { useTranslations } from 'next-intl';
import { Sparkles } from 'lucide-react';

export default function SmartRulesPage() {
  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg text-primary">
              <Sparkles className="w-6 h-6" />
            </div>
            <h2 className="text-3xl font-bold tracking-tight">Règles Intelligentes</h2>
          </div>
          <p className="text-muted-foreground">
            Automatisez la catégorisation et l&apos;étiquetage de vos transactions.
          </p>
        </div>
        <CreateSmartRuleDialog />
      </div>

      <SmartRulesList />
    </div>
  );
}
