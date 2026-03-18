'use client';

import React from 'react';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { X } from 'lucide-react';
import { formatCurrency, toCents } from '@/shared/lib/format';
import { ParsedTransaction } from '../../model/import-types';
import { Category } from '@/features/categories/model/types';

interface ImportValidationStepProps {
  parsedData: ParsedTransaction[];
  setParsedData: React.Dispatch<React.SetStateAction<ParsedTransaction[]>>;
  categories?: Category[];
}

export function ImportValidationStep({
  parsedData,
  setParsedData,
  categories
}: ImportValidationStepProps) {
  return (
    <div className="p-0">
      <Table className="table-fixed w-full">
        <TableHeader>
          <TableRow className="bg-muted/30">
            <TableHead className="w-[120px] pl-8 text-xs">Date</TableHead>
            <TableHead className="min-w-[250px] text-xs">Description</TableHead>
            <TableHead className="w-[150px] text-right text-xs">Montant</TableHead>
            <TableHead className="w-[300px] text-xs">Catégorie</TableHead>
            <TableHead className="w-[60px]"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {parsedData.map((row) => (
            <TableRow key={row.id}>
              <TableCell className="pl-8 font-medium text-xs">{row.date}</TableCell>
              <TableCell className="truncate text-xs" title={row.description}>{row.description}</TableCell>
              <TableCell className={`text-right font-bold text-xs ${parseFloat(row.amount) < 0 ? 'text-red-500' : 'text-green-500'}`}>
                {formatCurrency(toCents(row.amount))}
              </TableCell>
              <TableCell>
                <Select value={row.categoryId || 'none'} onValueChange={(v) => {
                  setParsedData(prev => prev.map(item => item.id === row.id ? { ...item, categoryId: v === 'none' ? null : v, predicted: false } : item));
                }}>
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue>
                      {row.categoryId ? (
                        <div className="flex items-center gap-2 truncate">
                          <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: categories?.find(c => c.id === row.categoryId)?.color }} />
                          <span className="truncate">{categories?.find(c => c.id === row.categoryId)?.name}</span>
                        </div>
                      ) : <span className="text-muted-foreground italic">Pas de catégorie</span>}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Non catégorisé</SelectItem>
                    {categories?.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>
                        <div className="flex items-center gap-2 text-xs">
                          <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: cat.color }} />
                          {cat.name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </TableCell>
              <TableCell className="pr-8">
                <Button variant="ghost" size="icon-sm" onClick={() => setParsedData(prev => prev.filter(p => p.id !== row.id))} className="h-8 w-8 text-muted-foreground hover:text-destructive">
                  <X className="w-4 h-4" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
