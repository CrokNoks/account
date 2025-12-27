import {
  Edit,
} from 'react-admin';
import { useAccount } from '../../context/AccountContext';
import { ExpenseForm } from './ExpenseForm';

export const ExpenseEdit = () => {
  const { selectedAccountId } = useAccount();

  return (
    <Edit transform={(data: any) => ({ ...data, amount: Number(data.amount.toString().replace(',', '.')) })}>
      <ExpenseForm selectedAccountId={selectedAccountId} />
    </Edit>
  );
};
