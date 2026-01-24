# Account v2 - Development Guide for AI Agents

**Version 2.1**  
Account v2 Development Team  
January 2026

> **Note for AI Agents:** This guide contains project-specific development patterns, build commands, and coding standards for Account v2 finance management application. Combine these with React optimization rules from skills directory for comprehensive development guidance.

---

## 🚀 Build & Development Commands

### Frontend (React/Vite)
```bash
npm run dev                 # Start dev server with --host flag
npm run build               # TypeScript compile + Vite build
npm run preview             # Preview production build locally
npm run lint                # ESLint with TypeScript, zero warnings allowed
```

### Backend (Firebase Functions)
```bash
cd functions/
npm run build               # TypeScript compilation
npm run dev                 # Build + start emulators with debugging
npm run serve               # Build + start emulators (no debug)
npm run deploy              # Deploy to Firebase Functions
npm run logs                # View function logs
```

### Testing (Future)
```bash
npm run test                 # Run all tests
npm run test:watch          # Watch mode
npm run test:coverage       # Generate coverage report
```

---

## 📁 Project Structure & Aliases

### Path Aliases
```typescript
'@'              → src/
'@components'     → src/components/
'@hooks'          → src/hooks/
'@utils'          → src/utils/
'@context'        → src/context/
'@providers'      → src/providers/
'@resources'      → src/resources/
```

---

## 🎨 Code Style Guidelines

### Import Organization
```typescript
// 1. React & core libraries
import React, { useState, useEffect } from 'react';
import { Box, Typography, Button } from '@mui/material';

// 2. Third-party libraries
import { useQuery } from '@tanstack/react-query';
import { Admin, Resource } from 'react-admin';

// 3. Internal imports (use aliases)
import { ExpenseList } from '@resources/expenses';
import { LoadingSkeleton } from '@components';
import { useIsSmall } from '@hooks';
import { dataProvider } from '@providers/dataProvider';
```

### TypeScript Standards
- **Strict mode enabled** in tsconfig.json
- **Explicit types** for function parameters and returns
- **Interface over type** for object shapes that may be extended
- **Utility types** preferred: `Partial<T>`, `Pick<T, K>`, `Omit<T, K>`

```typescript
interface Expense {
  id: string;
  amount: number;
  category: string;
  createdAt: Date;
}

const filterExpenses = (expenses: Expense[], filter: ExpenseFilter): Expense[] => {
  // implementation
};
```

### Component Patterns
```typescript
interface LoadingSkeletonProps {
  variant?: 'text' | 'rectangular' | 'circular';
  count?: number;
}

export const LoadingSkeleton: React.FC<LoadingSkeletonProps> = ({
  variant = 'text',
  count = 1
}) => {
  // Component logic
};
```

### Custom Hooks
```typescript
export const useIsSmall = (): boolean => {
  return useMediaQuery<Theme>((theme) => theme.breakpoints.down("sm"));
};

export const useExpenses = (filters?: ExpenseFilter) => {
  return useQuery({
    queryKey: ['expenses', filters],
    queryFn: () => dataProvider.getList('expenses', { filter: filters })
  });
};
```

---

## 🏗️ React Admin Patterns

### Resource Structure
```typescript
// resources/expenses/index.ts
export const ExpenseList = () => (
  <List>
    <Datagrid>{/* Fields */}</Datagrid>
  </List>
);

export const ExpenseCreate = () => (
  <Create>
    <SimpleForm>{/* Form fields */}</SimpleForm>
  </Create>
);

export { ExpenseEdit } from './ExpenseEdit';
export { ExpenseShow } from './ExpenseShow';
```

### Data Provider Integration
```typescript
const Component = () => {
  const { data, isLoading, error } = useQuery({
    queryKey: ['resource'],
    queryFn: () => dataProvider.getList('resource')
  });
};
```

---

## 🎯 Error Handling

### Error Boundaries
```typescript
import { ErrorBoundary } from '@components/ErrorBoundary';

<ErrorBoundary fallback={<ErrorFallback />}>
  <RiskyComponent />
</ErrorBoundary>
```

### Async Error Handling
```typescript
const handleSave = async (data: Expense) => {
  try {
    await dataProvider.create('expenses', { data });
    showNotification('Expense saved successfully');
  } catch (error) {
    console.error('Failed to save expense:', error);
    showNotification('Failed to save expense', 'error');
  }
};
```

---

## 🚀 Performance Guidelines

### Bundle Optimization (configured in vite.config.ts)
- Manual chunks: react-vendor, ra-vendor, mui-vendor, utils-vendor
- Source maps enabled for debugging
- Heavy utilities isolated (OCR, TensorFlow)

### Component Optimization
```typescript
import React, { memo } from 'react';

export const ExpenseChart = memo(({ data }: ExpenseChartProps) => {
  // Heavy chart rendering
});

const { data: expenses } = useQuery({
  queryKey: ['expenses'],
  queryFn: fetchExpenses,
  staleTime: 5 * 60 * 1000, // 5 minutes
});
```

### Skeleton Loading Patterns
```typescript
{isLoading ? (
  <ExpenseListSkeleton count={5} />
) : (
  <ExpenseList />
)}
```

---

## 📝 Naming Conventions

### Files & Directories
- **Components**: PascalCase (`LoadingSkeleton.tsx`)
- **Hooks**: camelCase with `use` prefix (`useIsSmall.tsx`)
- **Utilities**: camelCase (`formatCurrency.ts`)
- **Resources**: PascalCase (`ExpenseList.tsx`)

### Variables & Functions
```typescript
const expenseCategories = ['food', 'transport', 'housing'];
const calculateTotalAmount = (expenses: Expense[]): number => {
  return expenses.reduce((sum, expense) => sum + expense.amount, 0);
};

const isSmall = useIsSmall();
const hasExpenses = expenses.length > 0;
const canEdit = user.permissions.includes('edit');
```

### Constants
```typescript
const API_BASE_URL = 'https://api.example.com';
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const DEFAULT_CURRENCY = 'EUR';
```

---

## 🔧 Environment Configuration

```typescript
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (import.meta.env.DEV) {
  console.log('Development mode');
}
```

---

## 📋 Development Checklist

### Before Committing
1. **Build passes**: `npm run build` completes without errors
2. **Lint passes**: `npm run lint` returns no warnings
3. **TypeScript compiles**: No type errors
4. **Components tested**: Manual testing of new features
5. **Performance impact**: Consider bundle size impact

### Code Review Points
1. **Type safety**: All interfaces properly typed
2. **Performance**: Memoization applied where needed
3. **Error handling**: Proper try-catch and error boundaries
4. **Accessibility**: MUI components used correctly
5. **Responsive**: Mobile-first design maintained

---

## 🔗 Key Resources

- **Performance Rules**: `.agents/skills/vercel-react-best-practices/`
- **Documentation**: `docs/` directory
- **Backend Patterns**: `docs/architecture/`
- **AI Skills**: `.agents/skills/` directory

---

**Remember**: This is a finance application handling sensitive user data. Prioritize security, performance, and user experience in all development decisions.