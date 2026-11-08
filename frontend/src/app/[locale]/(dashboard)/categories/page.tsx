'use client';

import { CategoryList } from "@/features/categories/ui/category-list";
import { CreateCategoryDialog } from "@/features/categories/ui/create-category-dialog";

export default function CategoriesPage() {
  return (
    <div className="flex flex-col gap-4 lg:gap-8">
      <div className="flex justify-end">
        <CreateCategoryDialog />
      </div>

      <CategoryList />
    </div>
  );
}
