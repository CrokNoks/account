'use client';

import { TagList } from "@/features/tags/ui/tag-list";
import { CreateTagDialog } from "@/features/tags/ui/create-tag-dialog";
import { useTranslations } from 'next-intl';

export default function TagsPage() {
  const t = useTranslations('Tags');

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-2">
          <h2 className="text-3xl font-bold tracking-tight">{t('title')}</h2>
          <p className="text-muted-foreground">
            {t('description')}
          </p>
        </div>
        <CreateTagDialog />
      </div>

      <TagList />
    </div>
  );
}
