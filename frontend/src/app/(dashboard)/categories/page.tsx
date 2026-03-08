import { CategoryList } from "@/features/categories/ui/category-list";
import { CreateCategoryDialog } from "@/features/categories/ui/create-category-dialog";

export default function CategoriesPage() {
  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-2">
          <h2 className="text-3xl font-bold tracking-tight">Categories</h2>
          <p className="text-muted-foreground">
            Manage your budget categories and default templates.
          </p>
        </div>
        <CreateCategoryDialog />
      </div>

      <CategoryList />
    </div>
  );
}
