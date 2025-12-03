import { useRef, useState } from 'react';
import { Button } from '@mui/material';
import { useNotify, useRefresh } from 'react-admin';
import UploadIcon from '@mui/icons-material/Upload';
import Papa from 'papaparse';
import { supabaseClient } from '../../supabaseClient';
import { useAccount } from '../../context/AccountContext';

export const ImportExpensesButton = () => {
    const { selectedAccountId } = useAccount();
    const notify = useNotify();
    const refresh = useRefresh();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [loading, setLoading] = useState(false);

    const handleClick = () => {
        fileInputRef.current?.click();
    };

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        if (!selectedAccountId) {
            notify('Veuillez sélectionner un compte', { type: 'warning' });
            return;
        }

        setLoading(true);
        Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            complete: async (results: any) => {
                try {
                    const rows = results.data;
                    const expensesToInsert = [];
                    const categoriesCache = new Map<string, string>(); // Name -> ID

                    // 1. Fetch existing categories to populate cache
                    const { data: existingCategories } = await supabaseClient
                        .from('categories')
                        .select('id, name')
                        .eq('account_id', selectedAccountId);
                    
                    if (existingCategories) {
                        existingCategories.forEach(c => categoriesCache.set(c.name.toLowerCase(), c.id));
                    }

                    for (const row of rows) {
                        const date = row.Date;
                        const description = row.Description;
                        const depenseStr = row['Dépenses'];
                        const revenuStr = row['Revenus'];
                        const categoryName = row.Catégorie;
                        const reconciled = row.Pointés === "x" || false;

                        if (!date) continue;

                        // Parse amount from either Dépenses (negative) or Revenus (positive)
                        let amount = 0;
                        if (depenseStr && depenseStr.trim()) {
                            const cleanStr = depenseStr.replace(/\s/g, '').replace(',', '.').replace(/[^\d.-]/g, '');
                            amount = -Math.abs(parseFloat(cleanStr));
                        } else if (revenuStr && revenuStr.trim()) {
                            const cleanStr = revenuStr.replace(/\s/g, '').replace(',', '.').replace(/[^\d.-]/g, '');
                            amount = Math.abs(parseFloat(cleanStr));
                        }

                        if (isNaN(amount) || amount === 0) continue;

                        // Parse date in dd/mm/yyyy format
                        let parsedDate: Date | null = null;
                        if (date.includes('/')) {
                            const [day, month, year] = date.split('/');
                            parsedDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
                        } else {
                            parsedDate = new Date(date);
                        }
                        
                        if (!parsedDate || isNaN(parsedDate.getTime())) {
                            console.warn(`Invalid date: ${date}`);
                            continue;
                        }

                        let categoryId = null;
                        if (categoryName) {
                            const normalizedName = categoryName.trim().toLowerCase();
                            if (categoriesCache.has(normalizedName)) {
                                categoryId = categoriesCache.get(normalizedName);
                            } else {
                                // Create new category
                                const { data: newCategory, error: catError } = await supabaseClient
                                    .from('categories')
                                    .insert({
                                        name: categoryName.trim(),
                                        account_id: selectedAccountId,
                                        color: '#9e9e9e' // Default gray
                                    })
                                    .select()
                                    .single();
                                
                                if (catError) {
                                    console.error('Error creating category:', catError);
                                } else if (newCategory) {
                                    categoryId = newCategory.id;
                                    categoriesCache.set(normalizedName, categoryId);
                                }
                            }
                        }

                        expensesToInsert.push({
                            account_id: selectedAccountId,
                            date: parsedDate.toISOString(),
                            description: description || '',
                            amount: amount,
                            category_id: categoryId,
                            reconciled,
                        });
                    }

                    if (expensesToInsert.length === 0) {
                        notify('Aucune dépense valide trouvée', { type: 'warning' });
                        setLoading(false);
                        return;
                    }

                    const { error } = await supabaseClient
                        .from('expenses')
                        .insert(expensesToInsert);

                    if (error) throw error;

                    notify(`${expensesToInsert.length} dépenses importées avec succès`, { type: 'success' });
                    refresh();
                } catch (error: any) {
                    console.error('Import error:', error);
                    notify(`Erreur lors de l'import: ${error.message}`, { type: 'error' });
                } finally {
                    setLoading(false);
                    if (fileInputRef.current) {
                        fileInputRef.current.value = '';
                    }
                }
            },
            error: (error: any) => {
                console.error('Parse error:', error);
                notify(`Erreur de lecture du fichier: ${error.message}`, { type: 'error' });
                setLoading(false);
            }
        });
    };

    return (
        <>
            <input
                type="file"
                ref={fileInputRef}
                style={{ display: 'none' }}
                accept=".csv"
                onChange={handleFileChange}
            />
            <Button
                variant="contained"
                onClick={handleClick}
                disabled={loading}
                startIcon={<UploadIcon />}
            >
                {loading ? "Importation..." : "Importer CSV"}
            </Button>
        </>
    );
};
