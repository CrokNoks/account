import AccountBalanceIcon from '@mui/icons-material/AccountBalance';
import { List } from 'react-admin';
import { EmptyState } from './EmptyState';

interface AccountRequiredProps {
  message?: string;
}

export const AccountRequired = ({
  message = 'Veuillez sélectionner un compte pour voir ces données.',
}: AccountRequiredProps) => {
  return (
    <List>
      <EmptyState
        icon={<AccountBalanceIcon fontSize="large" color="primary" />}
        title="Compte requis"
        description={message}
      />
    </List>
  );
};


