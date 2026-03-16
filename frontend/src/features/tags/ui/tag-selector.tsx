'use client';

import * as React from 'react';
import { Check, ChevronsUpDown, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { useTags } from '../api/use-tags';
import { useCreateTag } from '../api/use-create-tag';
import { toast } from 'sonner';

interface TagSelectorProps {
  accountId: string;
  selectedTagIds: string[];
  onChange: (tagIds: string[]) => void;
}

export function TagSelector({ accountId, selectedTagIds, onChange }: TagSelectorProps) {
  const [open, setOpen] = React.useState(false);
  const [inputValue, setInputValue] = React.useState('');
  const { data: tags } = useTags(accountId);
  const { mutate: createTag } = useCreateTag();

  const handleUnselect = (tagId: string) => {
    onChange(selectedTagIds.filter((id) => id !== tagId));
  };

  const handleSelect = (tagId: string) => {
    if (selectedTagIds.includes(tagId)) {
      handleUnselect(tagId);
    } else {
      onChange([...selectedTagIds, tagId]);
    }
  };

  const handleCreateTag = () => {
    if (!inputValue.trim()) return;
    
    createTag({
      accountId,
      name: inputValue.trim(),
    }, {
      onSuccess: (newTag) => {
        onChange([...selectedTagIds, newTag.id]);
        setInputValue('');
        toast.success(`Tag #${newTag.name} créé`);
      },
      onError: () => {
        toast.error("Erreur lors de la création du tag");
      }
    });
  };

  const selectedTags = tags?.filter((tag) => selectedTagIds.includes(tag.id)) || [];

  return (
    <div className="flex flex-col gap-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger 
          render={
            <Button
              variant="outline"
              role="combobox"
              aria-expanded={open}
              className="w-full h-11 justify-between font-normal"
            >
              <div className="flex gap-1 flex-wrap overflow-hidden">
                {selectedTags.length > 0 ? (
                  selectedTags.map((tag) => (
                    <Badge
                      key={tag.id}
                      variant="secondary"
                      className="mr-1 mb-1"
                      style={{ 
                        backgroundColor: tag.color ? `${tag.color}20` : undefined,
                        color: tag.color,
                        borderColor: tag.color ? `${tag.color}40` : undefined
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleUnselect(tag.id);
                      }}
                    >
                      {tag.name}
                      <X className="ml-1 h-3 w-3 opacity-50 hover:opacity-100" />
                    </Badge>
                  ))
                ) : (
                  <span className="text-muted-foreground">Ajouter des tags...</span>
                )}
              </div>
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          }
        />
        <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
          <Command>
            <CommandInput 
              placeholder="Rechercher ou créer un tag..." 
              value={inputValue}
              onValueChange={setInputValue}
            />
            <CommandList>
              <CommandEmpty>
                <Button 
                  variant="ghost" 
                  className="w-full justify-start text-xs h-8 px-2"
                  onClick={handleCreateTag}
                >
                  Créer le tag &quot;#{inputValue}&quot;
                </Button>
              </CommandEmpty>
              <CommandGroup>
                {tags?.map((tag) => (
                  <CommandItem
                    key={tag.id}
                    value={tag.name}
                    onSelect={() => handleSelect(tag.id)}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        selectedTagIds.includes(tag.id) ? "opacity-100" : "opacity-0"
                      )}
                    />
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: tag.color || '#94a3b8' }} />
                      {tag.name}
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}
