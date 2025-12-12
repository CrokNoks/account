import { Layout, LayoutProps, AppBar, AppBarProps } from 'react-admin';
import { Box } from '@mui/material';
import { AccountSelector } from './components/AccountSelector';

const CustomAppBar = (props: AppBarProps) => (
  <AppBar {...props}>
    <Box flex="1" />
    <AccountSelector />
  </AppBar>
);

export const CustomLayout = (props: LayoutProps) => (
  <Layout {...props} appBar={CustomAppBar} />
);
