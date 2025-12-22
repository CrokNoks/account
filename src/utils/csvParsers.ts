import Papa from 'papaparse';


export interface ExpenseImportData {
  date: string;
  description: string;
  amount: number;
  category_id: null;
  reconciled: boolean;
  payment_method?: string;
  confidence?: number;
  metadata?: any;
}

export interface CategoryImportData {
  name: string;
  description: string;
  color: string;
}

/**
 * Extracts the initial balance from a Credit Agricole CSV content if present.
 * Looks for line 7 (index 6) matches.
 */
export const extractInitialBalance = (lines: string[]): number | null => {
  if (lines.length > 6) {
    const balanceLine = lines[6];
    // Extract number: space regularized, comma to dot
    // Regex matches number at the end of string or just a number
    const balanceMatch = balanceLine.replace(/\u00A0/g, ' ').replace(/\s/g, '').replace(',', '.').match(/-?\d+(\.\d+)?/);
    if (balanceMatch) {
      return parseFloat(balanceMatch[0]);
    }
  }
  return null;
};

/**
 * Parses Credit Agricole or Standard CSV content.
 * Handles header offset logic internally (skips 10 lines if CA format detected).
 */
export const parseExpenseCSV = (fileContent: string): Promise<{ expenses: ExpenseImportData[]; initialBalance: number | null }> => {
  return new Promise((resolve, reject) => {
    const lines = fileContent.split('\n');
    let csvContent = fileContent;
    let initialBalance = null;

    // Heuristic: If line 11 (index 10) contains "Date" or typical headers
    // CA Headers: Date;Libellé;Débit;Crédit
    if (lines.length > 10 && (lines[10].toLowerCase().includes('date') || lines[10].toLowerCase().includes('libellé'))) {
      csvContent = lines.slice(10).join('\n');
      initialBalance = extractInitialBalance(lines);
    }

    Papa.parse(csvContent, {
      header: true,
      skipEmptyLines: true,
      complete: async (results: any) => {
        try {
          const rows = results.data;
          const expenses: ExpenseImportData[] = [];



          for (const row of rows) {
            // Support multiple formats
            const dateStr = row.Date || row['Date opération'];
            const description = row.Description || row['Libellé'];

            let amount = 0;
            const debitStr = row['Débit'] || row['Débit euros'];
            const creditStr = row['Crédit'] || row['Crédit euros'];

            if (debitStr) {
              const cleanStr = debitStr.replace(/\s/g, '').replace(',', '.').replace(/[^\d.-]/g, '');
              if (cleanStr) amount = -Math.abs(parseFloat(cleanStr));
            } else if (creditStr) {
              const cleanStr = creditStr.replace(/\s/g, '').replace(',', '.').replace(/[^\d.-]/g, '');
              if (cleanStr) amount = Math.abs(parseFloat(cleanStr));
            } else {
              // Fallback
              const depenseStr = row['Dépenses'];
              const revenuStr = row['Revenus'];

              if (depenseStr && depenseStr.trim()) {
                const cleanStr = depenseStr.replace(/\s/g, '').replace(',', '.').replace(/[^\d.-]/g, '');
                amount = -Math.abs(parseFloat(cleanStr));
              } else if (revenuStr && revenuStr.trim()) {
                const cleanStr = revenuStr.replace(/\s/g, '').replace(',', '.').replace(/[^\d.-]/g, '');
                amount = Math.abs(parseFloat(cleanStr));
              }
            }

            if (isNaN(amount) || amount === 0) continue;
            if (!dateStr) continue;

            let parsedDate: Date | null = null;
            if (dateStr.includes('/')) {
              const [day, month, year] = dateStr.split('/');
              parsedDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
            } else {
              parsedDate = new Date(dateStr);
            }

            if (!parsedDate || isNaN(parsedDate.getTime())) {
              console.warn(`Invalid date: ${dateStr}`);
              continue;
            }

            // Parse multi-line description
            const rawDescription = description || '';
            const descLines = rawDescription.split('\n').filter((l: string) => l.trim().length > 0);

            // First line is often the type (e.g., 'PRLV SEPA', 'CB')
            // Second line is usually the main description/label
            let mainDescription = rawDescription;
            let metadata: any = { raw_import: rawDescription };

            if (descLines.length > 1) {
              // If we have multiple lines
              const typeHint = descLines[0];
              const realLabel = descLines[1];
              const references = descLines.slice(2);

              mainDescription = realLabel;
              metadata = {
                ...metadata,
                import_type_hint: typeHint.trim(),
                import_references: references
              };
            } else {
              // Single line case: try to be smart or just store it
              metadata = {
                ...metadata,
                import_type_hint: null // No distinct type hint line
              };
            }

            // Simple Mapper Logic
            const hint = (metadata.import_type_hint || rawDescription).toUpperCase();
            let finalMethod = 'other';

            if (hint.includes('REGLEMENT') || hint.includes('PRELEVEMENT')) finalMethod = 'direct_debit';
            else if (hint.includes('CB') || hint.includes('CARTE') || hint.includes('PAIEMENT PAR CARTE')) finalMethod = 'credit_card';
            else if (hint.includes('VIR') || hint.includes('VIREMENT')) finalMethod = 'transfer';
            else if (hint.includes('CHEQUE')) finalMethod = 'check';
            else if (hint.includes('RETRAIT')) finalMethod = 'cash';

            expenses.push({
              date: parsedDate.toISOString(),
              description: mainDescription,
              amount: amount,
              category_id: null,
              reconciled: false,
              payment_method: finalMethod,
              confidence: 1, // Deterministic
              metadata: metadata
            });
          }

          resolve({ expenses, initialBalance });
        } catch (error) {
          reject(error);
        }
      },
      error: (error: any) => reject(error)
    });
  });
};

export const parseCategoryCSV = (fileContent: string): Promise<CategoryImportData[]> => {
  return new Promise((resolve, reject) => {
    Papa.parse(fileContent, {
      header: true,
      skipEmptyLines: true,
      complete: (results: any) => {
        try {
          const categories = results.data.map((row: any) => ({
            name: row.name || row.Nom || row.nom,
            description: row.description || row.Description || '',
            color: row.color || row.Couleur || row.couleur || '#000000',
          }));

          const validCategories = categories.filter((c: any) => c.name);
          resolve(validCategories);
        } catch (error) {
          reject(error);
        }
      },
      error: (error: any) => reject(error)
    });
  });
};
