import { Box, Skeleton, Card, Typography } from '@mui/material';

// Skeleton for expense list items
export const ExpenseSkeleton = () => (
  <Box sx={{ display: 'flex', alignItems: 'center', py: 1 }}>
    <Skeleton variant="circular" width={40} height={40} sx={{ mr: 2 }} />
    <Box sx={{ flex: 1 }}>
      <Skeleton variant="text" width="60%" height={20} sx={{ mb: 0.5 }} />
      <Skeleton variant="text" width="40%" height={16} />
    </Box>
    <Skeleton variant="rectangular" width={100} height={32} sx={{ mx: 1 }} />
    <Skeleton variant="rectangular" width={80} height={32} sx={{ mx: 1 }} />
    <Skeleton variant="rectangular" width={40} height={32} />
  </Box>
);

// Skeleton for expense list (multiple items)
export const ExpenseListSkeleton = ({ count = 5 }: { count?: number }) => (
  <Box>
    {Array.from({ length: count }).map((_, index) => (
      <ExpenseSkeleton key={index} />
    ))}
  </Box>
);

// Skeleton for category items
export const CategorySkeleton = () => (
  <Box sx={{ display: 'flex', alignItems: 'center', py: 1 }}>
    <Skeleton variant="circular" width={24} height={24} sx={{ mr: 2 }} />
    <Skeleton variant="text" width="40%" height={20} sx={{ mr: 2 }} />
    <Skeleton variant="text" width={80} height={20} sx={{ mr: 2 }} />
    <Skeleton variant="text" width={60} height={20} />
  </Box>
);

// Skeleton for category list
export const CategoryListSkeleton = ({ count = 5 }: { count?: number }) => (
  <Box>
    {Array.from({ length: count }).map((_, index) => (
      <CategorySkeleton key={index} />
    ))}
  </Box>
);

// Skeleton for report dashboard
export const ReportDashboardSkeleton = () => (
  <Box sx={{ display: 'grid', gap: 3 }}>
    {/* Summary cards skeleton */}
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' }, gap: 2 }}>
      {Array.from({ length: 4 }).map((_, index) => (
        <Card key={index} sx={{ p: 2 }}>
          <Skeleton variant="text" width="60%" height={16} sx={{ mb: 1 }} />
          <Skeleton variant="text" width="80%" height={32} />
        </Card>
      ))}
    </Box>
    
    {/* Chart skeleton */}
    <Card sx={{ p: 2, height: 400 }}>
      <Skeleton variant="text" width="40%" height={24} sx={{ mb: 2 }} />
      <Skeleton variant="rectangular" width="100%" height={320} />
    </Card>
    
    {/* Recent transactions skeleton */}
    <Card sx={{ p: 2 }}>
      <Skeleton variant="text" width="40%" height={24} sx={{ mb: 2 }} />
      <Box>
        {Array.from({ length: 5 }).map((_, index) => (
          <Box key={index} sx={{ display: 'flex', alignItems: 'center', py: 1, borderBottom: '1px solid', borderColor: 'divider' }}>
            <Skeleton variant="text" width="20%" height={16} />
            <Skeleton variant="text" width="40%" height={16} sx={{ mx: 2 }} />
            <Skeleton variant="text" width="20%" height={16} />
          </Box>
        ))}
      </Box>
    </Card>
  </Box>
);

// Skeleton for account list
export const AccountSkeleton = () => (
  <Card sx={{ p: 2, mb: 2 }}>
    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <Box sx={{ display: 'flex', alignItems: 'center' }}>
        <Skeleton variant="circular" width={48} height={48} sx={{ mr: 2 }} />
        <Box>
          <Skeleton variant="text" width={120} height={24} sx={{ mb: 0.5 }} />
          <Skeleton variant="text" width={80} height={16} />
        </Box>
      </Box>
      <Skeleton variant="text" width={100} height={24} />
    </Box>
  </Card>
);

export const AccountListSkeleton = ({ count = 3 }: { count?: number }) => (
  <Box>
    {Array.from({ length: count }).map((_, index) => (
      <AccountSkeleton key={index} />
    ))}
  </Box>
);

// Skeleton for form inputs
export const FormSkeleton = () => (
  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
    <Box>
      <Skeleton variant="text" width="30%" height={16} sx={{ mb: 1 }} />
      <Skeleton variant="rectangular" width="100%" height={56} />
    </Box>
    <Box>
      <Skeleton variant="text" width="30%" height={16} sx={{ mb: 1 }} />
      <Skeleton variant="rectangular" width="100%" height={56} />
    </Box>
    <Box>
      <Skeleton variant="text" width="30%" height={16} sx={{ mb: 1 }} />
      <Skeleton variant="rectangular" width="100%" height={56} />
    </Box>
    <Box sx={{ display: 'flex', gap: 2, mt: 2 }}>
      <Skeleton variant="rectangular" width={120} height={40} />
      <Skeleton variant="rectangular" width={120} height={40} />
    </Box>
  </Box>
);

// Skeleton for data tables
export const TableSkeleton = ({ rows = 5, columns = 4 }: { rows?: number; columns?: number }) => (
  <Box>
    {/* Header */}
    <Box sx={{ display: 'flex', borderBottom: '2px solid', borderColor: 'divider', pb: 1, mb: 1 }}>
      {Array.from({ length: columns }).map((_, index) => (
        <Skeleton key={index} variant="text" width={`${100 / columns}%`} height={20} sx={{ mr: 1 }} />
      ))}
    </Box>
    
    {/* Rows */}
    {Array.from({ length: rows }).map((_, rowIndex) => (
      <Box key={rowIndex} sx={{ display: 'flex', py: 1, borderBottom: '1px solid', borderColor: 'divider' }}>
        {Array.from({ length: columns }).map((_, colIndex) => (
          <Skeleton key={colIndex} variant="text" width={`${100 / columns}%`} height={20} sx={{ mr: 1 }} />
        ))}
      </Box>
    ))}
  </Box>
);

// Main loading component that switches between skeleton types
interface LoadingSkeletonProps {
  type: 'expense' | 'expenses' | 'category' | 'categories' | 'report' | 'account' | 'accounts' | 'form' | 'table';
  count?: number;
  columns?: number;
}

export const LoadingSkeleton = ({ type, count, columns }: LoadingSkeletonProps) => {
  switch (type) {
    case 'expense':
      return <ExpenseSkeleton />;
    case 'expenses':
      return <ExpenseListSkeleton count={count} />;
    case 'category':
      return <CategorySkeleton />;
    case 'categories':
      return <CategoryListSkeleton count={count} />;
    case 'report':
      return <ReportDashboardSkeleton />;
    case 'account':
      return <AccountSkeleton />;
    case 'accounts':
      return <AccountListSkeleton count={count} />;
    case 'form':
      return <FormSkeleton />;
    case 'table':
      return <TableSkeleton rows={count} columns={columns} />;
    default:
      return <Box sx={{ p: 2, textAlign: 'center' }}>
        <Typography>Loading...</Typography>
      </Box>;
  }
};