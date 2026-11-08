'use client';

import { SmartRulesList } from "@/features/smart-rules/ui/smart-rules-list";
import { CreateSmartRuleDialog } from "@/features/smart-rules/ui/create-smart-rule-dialog";

export default function SmartRulesPage() {
  return (
    <div className="flex flex-col gap-4 lg:gap-8">
      <div className="flex justify-end">
        <CreateSmartRuleDialog />
      </div>

      <SmartRulesList />
    </div>
  );
}
