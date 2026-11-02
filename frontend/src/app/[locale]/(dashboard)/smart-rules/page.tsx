'use client';

import { SmartRulesList } from "@/features/smart-rules/ui/smart-rules-list";
import { CreateSmartRuleDialog } from "@/features/smart-rules/ui/create-smart-rule-dialog";
import { Sparkles } from 'lucide-react';
import { useTranslations } from 'next-intl';

export default function SmartRulesPage() {
  const t = useTranslations('SmartRules');

  return (
    <div className="flex flex-col gap-4 lg:gap-8">
      <div className="flex items-center justify-between max-lg:justify-end">
        <div className="flex flex-col gap-2 max-lg:hidden">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg text-primary">
              <Sparkles className="w-6 h-6" />
            </div>
            <h2 className="text-3xl font-bold tracking-tight">{t('title')}</h2>
          </div>
          <p className="text-muted-foreground">
            {t('description')}
          </p>
        </div>
        <CreateSmartRuleDialog />
      </div>

      <SmartRulesList />
    </div>
  );
}
