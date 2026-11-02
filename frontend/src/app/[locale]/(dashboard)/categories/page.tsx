'use client';

import { CategoryList } from "@/features/categories/ui/category-list";
import { CreateCategoryDialog } from "@/features/categories/ui/create-category-dialog";
import { useTranslations } from 'next-intl';

export default function CategoriesPage() {
  const t = useTranslations('Categories');

  return (
    <div className="flex flex-col gap-4 lg:gap-8">
      <div className="flex items-center justify-between max-lg:justify-end">
        <div className="flex flex-col gap-2 max-lg:hidden">
          <h2 className="text-3xl font-bold tracking-tight">{t('title')}</h2>
          <p className="text-muted-foreground">
            {t('description')}
          </p>
        </div>
        <CreateCategoryDialog />
      </div>

      <CategoryList />
    </div>
  );
}
