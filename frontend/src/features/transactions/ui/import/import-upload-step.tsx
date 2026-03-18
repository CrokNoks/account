'use client';

import React from 'react';
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Upload, FileUp, Loader2, Columns } from 'lucide-react';

interface ImportUploadStepProps {
  delimiter: ',' | ';';
  setDelimiter: (v: ',' | ';') => void;
  onFileUpload: (event: React.ChangeEvent<HTMLInputElement>) => void;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  isProcessing: boolean;
}

export function ImportUploadStep({
  delimiter,
  setDelimiter,
  onFileUpload,
  fileInputRef,
  isProcessing
}: ImportUploadStepProps) {
  return (
    <div className="p-12 flex flex-col items-center justify-center text-center space-y-6 h-full min-h-[400px]">
      <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mb-4">
        <Upload className="w-10 h-10 text-primary" />
      </div>
      <input type="file" accept=".csv" className="hidden" ref={fileInputRef} onChange={onFileUpload} />
      
      <div className="flex flex-col items-center gap-6 bg-muted/20 p-8 rounded-xl border max-w-md w-full shadow-sm">
        <div className="space-y-3 w-full text-left">
          <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
            <Columns className="w-3 h-3" /> Séparateur CSV
          </label>
          <Select value={delimiter} onValueChange={(v) => setDelimiter(v as ',' | ';')}>
            <SelectTrigger className="w-full h-11"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value=",">Virgule ( , )</SelectItem>
              <SelectItem value=";">Point-virgule ( ; )</SelectItem>
            </SelectContent>
          </Select>
        </div>
        
        <div className="space-y-2">
          <h3 className="text-xl font-semibold">Sélectionnez votre fichier</h3>
          <p className="text-muted-foreground text-sm">Le fichier CSV exporté par votre banque.</p>
        </div>
        
        <Button size="lg" onClick={() => fileInputRef.current?.click()} disabled={isProcessing} className="w-full h-12 text-base font-semibold shadow-lg shadow-primary/20">
          {isProcessing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <FileUp className="w-4 h-4 mr-2" />}
          Choisir le fichier
        </Button>
      </div>
    </div>
  );
}
