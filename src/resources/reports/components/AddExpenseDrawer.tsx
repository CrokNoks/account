import { useState, useEffect } from 'react';
import { Drawer, Box, Typography, IconButton } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { CreateBase, EditBase, useNotify } from 'react-admin';
import { ReceiptOCR } from '../../../components/ReceiptOCR';
import { ExpenseForm } from '../../expenses/ExpenseForm';

interface AddExpenseDrawerProps {
  open: boolean;
  onClose: () => void;
  selectedAccountId: string;
  onSuccess: () => void;
  expenseId?: string | null;
}

export const AddExpenseDrawer = ({ open, onClose, selectedAccountId, onSuccess, expenseId }: AddExpenseDrawerProps) => {
  const isEdit = !!expenseId;
  const notify = useNotify();
  const [ocrData, setOcrData] = useState<{
    amount?: number;
    description?: string;
    date?: string;
    notes?: string;
  }>({});
  const [ocrLoading, setOcrLoading] = useState(false);

  // Reset OCR data when drawer opens/closes
  useEffect(() => {
    if (!open) {
      setOcrData({});
      setOcrLoading(false);
    }
  }, [open]);

  const handleOCRExtract = (data: {
    amount?: number;
    description?: string;
    date?: string;
    notes?: string;
  }) => {
    setOcrData(data);
    notify('app.components.ocr.success', { type: 'success' });
  };

  const handleOCRLoadingChange = (loading: boolean) => {
    setOcrLoading(loading);
  };

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
    >
      <Box sx={{ width: { xs: '100vw', sm: 400 }, p: 2 }}>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
          <Typography variant="h6">
            {isEdit ? 'Modifier l\'opération' : 'Ajouter une opération'}
          </Typography>
          <IconButton onClick={onClose}>
            <CloseIcon />
          </IconButton>
        </Box>
        {isEdit ? (
          <EditBase
            resource="expenses"
            id={expenseId}
            transform={(data: any) => ({ ...data, account_id: selectedAccountId, amount: Number(data.amount.toString().replace(',', '.')) })}
            mutationOptions={{ onSuccess }}
          >
            <ExpenseForm selectedAccountId={selectedAccountId} />
          </EditBase>
        ) : (
          <>
            <ReceiptOCR onExtract={handleOCRExtract} onLoadingChange={handleOCRLoadingChange} />

            {!ocrLoading && (
              <>
                {ocrData && Object.keys(ocrData).length > 0 && (
                  <Box sx={{ mt: 2, p: 2, bgcolor: 'action.hover', borderRadius: 1 }}>
                    <Typography variant="subtitle2" gutterBottom>Données extraites :</Typography>
                    {ocrData.description && <Typography variant="body2">Description: {ocrData.description}</Typography>}
                    {ocrData.amount && <Typography variant="body2">Montant: {ocrData.amount} €</Typography>}
                    {ocrData.date && <Typography variant="body2">Date: {ocrData.date}</Typography>}
                    {ocrData.notes && <Typography variant="body2">Notes: {ocrData.notes}</Typography>}
                  </Box>
                )}
                <CreateBase
                  resource="expenses"
                  transform={(data: any) => ({ ...data, account_id: selectedAccountId, amount: Number(data.amount.toString().replace(',', '.')) })}
                  mutationOptions={{ onSuccess }}
                >
                  <ExpenseForm
                    selectedAccountId={selectedAccountId}
                    key={JSON.stringify(ocrData)}
                    defaultValues={{
                      description: ocrData.description || '',
                      amount: ocrData.amount?.toString() || '',
                      date: ocrData.date || new Date(),
                      notes: ocrData.notes || '',
                      reconciled: false
                    }}
                  />
                </CreateBase>
              </>
            )}
          </>
        )}
      </Box>
    </Drawer>
  );
};

