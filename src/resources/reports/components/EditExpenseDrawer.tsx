import { Drawer, Box, Typography, IconButton } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { EditBase, Toolbar, SaveButton, DeleteButton, useTranslate } from 'react-admin';
import { ExpenseForm } from '../../expenses/ExpenseForm';

interface EditExpenseDrawerProps {
  open: boolean;
  onClose: () => void;
  selectedAccountId: string;
  onSuccess: () => void;
  expenseId: string;
}

const EditToolbar = () => (
  <Toolbar>
    <SaveButton />
    <DeleteButton redirect={false} mutationOptions={{ onSuccess: () => window.location.reload() }} />
  </Toolbar>
);

export const EditExpenseDrawer = ({ open, onClose, selectedAccountId, onSuccess, expenseId }: EditExpenseDrawerProps) => {
  const translate = useTranslate();
  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
    >
      <Box sx={{ width: { xs: '100%', sm: 400 }, p: 2 }}>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
          <Typography variant="h6">
            {translate('app.drawers.edit_expense')}
          </Typography>
          <IconButton onClick={onClose}>
            <CloseIcon />
          </IconButton>
        </Box>

        {expenseId && (
          <EditBase
            resource="expenses"
            id={expenseId}
            redirect={false}
            mutationMode="optimistic"
            mutationOptions={{ onSuccess }}
            transform={(data: any) => ({ ...data, amount: Number(data.amount.toString().replace(',', '.')) })}
          >
            <ExpenseForm selectedAccountId={selectedAccountId} toolbar={<EditToolbar />} />
          </EditBase>
        )}
      </Box>
    </Drawer>
  );
};
