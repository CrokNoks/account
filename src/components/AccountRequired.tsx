import AccountBalanceIcon from '@mui/icons-material/AccountBalance';
import { List, useTranslate } from 'react-admin';
import { EmptyState } from './EmptyState';

interface AccountRequiredProps {
  message?: string;
}

export const AccountRequired = ({
  message = 'app.components.account_required.message',
}: AccountRequiredProps) => {
  const translate = useTranslate();
  return (
    <List>
      <EmptyState
        icon={<AccountBalanceIcon fontSize="large" color="primary" />}
        title={translate('app.components.account_required.title')}
        description={translate(message)}
      />
    </List>
  );
};


