'use client';

import { TagList } from "@/features/tags/ui/tag-list";
import { CreateTagDialog } from "@/features/tags/ui/create-tag-dialog";

export default function TagsPage() {
  return (
    <div className="flex flex-col gap-4 lg:gap-8">
      <div className="flex justify-end">
        <CreateTagDialog />
      </div>

      <TagList />
    </div>
  );
}
