import { Layout, LayoutProps, AppBar, AppBarProps } from 'react-admin';
import { AccountSelector } from './components/AccountSelector';
import { Box } from '@mui/material';

const CustomAppBar = (props: AppBarProps) => (
    <AppBar {...props}>
        <Box flex="1" />
        <AccountSelector />
    </AppBar>
);

export const CustomLayout = (props: LayoutProps) => (
    <Layout {...props} appBar={CustomAppBar} />
);
