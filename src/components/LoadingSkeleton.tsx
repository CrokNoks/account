import React from 'react';
import { Box, Skeleton, Card, Typography } from '@mui/material';

// Skeleton interfaces following TypeScript guidelines
interface SkeletonListProps {
  count?: number;
  variant?: 'expense' | 'category' | 'account';
}

// Memoized skeleton for expense list items following performance guidelines
const ExpenseSkeleton: React.FC = React.memo(() => {
  const skeletonHeight = 40;

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', py: 1 }}>
      <Skeleton 
        variant="circular" 
        width={skeletonHeight} 
        height={skeletonHeight} 
        sx={{ mr: 2 }} 
      />
      <Box sx={{ flex: 1 }}>
        <Skeleton variant="text" width="60%" height={20} sx={{ mb: 0.5 }} />
        <Skeleton variant="text" width="40%" height={16} />
      </Box>
      <Skeleton variant="rectangular" width={100} height={32} sx={{ mx: 1 }} />
      <Skeleton variant="rectangular" width={80} height={32} sx={{ mx: 1 }} />
      <Skeleton variant="rectangular" width={40} height={32} />
    </Box>
  );
});

ExpenseSkeleton.displayName = 'ExpenseSkeleton';

// Memoized skeleton list component with proper key generation
const SkeletonList: React.FC<SkeletonListProps> = React.memo(({ 
  count = 5, 
  variant = 'expense' 
}) => {
  const renderSkeleton = (index: number): React.ReactNode => {
    const key = `${variant}-skeleton-${index}`;
    
    switch (variant) {
      case 'expense':
        return <ExpenseSkeleton key={key} />;
      case 'category':
        return <CategorySkeleton key={key} />;
      case 'account':
        return <AccountListSkeletonItem key={key} />;
      default:
        return <ExpenseSkeleton key={key} />;
    }
  };

  return (
    <Box>
      {Array.from({ length: count }, (_, index) => renderSkeleton(index))}
    </Box>
  );
});

SkeletonList.displayName = 'SkeletonList';

// Legacy export for backward compatibility
const ExpenseListSkeleton = ({ count = 5 }: { count?: number }) => (
  <SkeletonList count={count} variant="expense" />
);

ExpenseListSkeleton.displayName = 'ExpenseListSkeleton';

// Memoized category skeleton
const CategorySkeleton: React.FC = React.memo(() => (
  <Box sx={{ display: 'flex', alignItems: 'center', py: 1 }}>
    <Skeleton variant="circular" width={24} height={24} sx={{ mr: 2 }} />
    <Skeleton variant="text" width="40%" height={20} sx={{ mr: 2 }} />
    <Skeleton variant="rectangular" width={100} height={24} sx={{ mr: 2 }} />
    <Skeleton variant="rectangular" width={60} height={24} sx={{ mr: 1 }} />
    <Skeleton variant="circular" width={20} height={20} />
  </Box>
));

CategorySkeleton.displayName = 'CategorySkeleton';

// Memoized account skeleton item
const AccountListSkeletonItem: React.FC = React.memo(() => (
  <Box sx={{ display: 'flex', alignItems: 'center', py: 1 }}>
    <Skeleton variant="circular" width={32} height={32} sx={{ mr: 2 }} />
    <Box sx={{ flex: 1 }}>
      <Skeleton variant="text" width="50%" height={20} sx={{ mb: 0.5 }} />
      <Skeleton variant="text" width="30%" height={16} />
    </Box>
    <Skeleton variant="rectangular" width={80} height={28} sx={{ mr: 1 }} />
    <Skeleton variant="rectangular" width={40} height={28} />
  </Box>
));

AccountListSkeletonItem.displayName = 'AccountListSkeletonItem';

// Skeleton for category list
const CategoryListSkeleton = ({ count = 5 }: { count?: number }) => (
  <Box>
    {Array.from({ length: count }).map((_, index) => (
      <CategorySkeleton key={index} />
    ))}
  </Box>
);

CategoryListSkeleton.displayName = 'CategoryListSkeleton';

// Skeleton for account list
const AccountListSkeleton = ({ count = 3 }: { count?: number }) => (
  <Box>
    {Array.from({ length: count }).map((_, index) => (
      <AccountListSkeletonItem key={index} />
    ))}
  </Box>
);

AccountListSkeleton.displayName = 'AccountListSkeleton';

// Skeleton for report dashboard
const ReportDashboardSkeleton: React.FC = React.memo(() => (
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
));

ReportDashboardSkeleton.displayName = 'ReportDashboardSkeleton';

// Skeleton for form inputs
const FormSkeleton: React.FC = React.memo(() => (
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
));

FormSkeleton.displayName = 'FormSkeleton';

// Skeleton for data tables
const TableSkeleton: React.FC<{ rows?: number; columns?: number }> = React.memo(({ 
  rows = 5, 
  columns = 4 
}) => {
  return (
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
});

TableSkeleton.displayName = 'TableSkeleton';

// Main loading component that switches between skeleton types
interface LoadingSkeletonProps {
  type: 'expense' | 'expenses' | 'category' | 'categories' | 'report' | 'account' | 'accounts' | 'form' | 'table';
  count?: number;
  columns?: number;
}

const LoadingSkeleton: React.FC<LoadingSkeletonProps> = React.memo(({ 
  type, 
  count, 
  columns 
}) => {
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
      return <AccountListSkeletonItem />;
    case 'accounts':
      return <AccountListSkeleton count={count} />;
    case 'form':
      return <FormSkeleton />;
    case 'table':
      return <TableSkeleton rows={count} columns={columns} />;
    default:
      return (
        <Box sx={{ p: 2, textAlign: 'center' }}>
          <Typography>Loading...</Typography>
        </Box>
      );
  }
});

LoadingSkeleton.displayName = 'LoadingSkeleton';

export {
  ExpenseListSkeleton as ExpenseListSkeletonExport,
  CategoryListSkeleton,
  AccountListSkeleton,
  ReportDashboardSkeleton,
  FormSkeleton,
  TableSkeleton,
  ExpenseSkeleton,
  CategorySkeleton,
  AccountListSkeletonItem,
  SkeletonList,
  LoadingSkeleton
};