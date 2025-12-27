import {
  Create,
  useRedirect,
} from 'react-admin';
import { useAccount } from '../../context/AccountContext';
import { AccountRequired } from '../../components/AccountRequired';
import { ExpenseForm } from './ExpenseForm';

export const ExpenseCreate = () => {
  const { selectedAccountId } = useAccount();
  const redirect = useRedirect();

  const transform = (data: any) => ({
    ...data,
    account_id: selectedAccountId,
    amount: Number(data.amount.toString().replace(',', '.'))
  });

  if (!selectedAccountId) {
    return <div><AccountRequired message="app.components.account_required.message" /></div>;
  }

  return (
    <Create
      transform={transform}
      mutationOptions={{
        onSuccess: () => {
          redirect('/reports');
        },
      }}
    >
      <ExpenseForm selectedAccountId={selectedAccountId} />
    </Create>
  );
};
