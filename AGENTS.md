# AGENTS.md - Development Guidelines

This file contains essential information for agentic coding agents working in this repository.

## Project Overview

**Tech Stack:**
- Frontend: React 18, TypeScript, React Admin, Material UI, Vite
- Backend: Supabase (PostgreSQL, Auth, Edge Functions)
- Additional: TensorFlow.js (ML), Tesseract.js (OCR), Recharts (Charts)
- PWA: Vite PWA plugin with service worker

**Architecture:**
- React Admin framework for admin interface
- Supabase for database and authentication
- Strict separation of UI components and business logic
- Custom hooks for state management and side effects

## Development Commands

### Core Commands
```bash
npm run dev          # Start development server (localhost:5173)
npm run build        # TypeScript compilation + Vite build
npm run preview      # Preview production build
npm run lint         # ESLint with TypeScript rules
```

### Backend (Functions)
```bash
cd functions
npm run build        # NestJS compilation
npm run start        # Start NestJS server
npm run start:dev    # Development mode with watch
```

### Testing
No test framework is currently configured. When adding tests:
- Use Jest or Vitest for unit tests
- Use React Testing Library for component tests
- Follow React Admin testing patterns

## Code Style Guidelines

### TypeScript Configuration
- Strict mode enabled (`strict: true`)
- No unused locals/parameters
- ES2020 target with DOM libraries
- React JSX transform
- Bundler module resolution

### Import Organization
```typescript
// 1. React & React Admin imports
import { Admin, Resource } from 'react-admin';
import { useState } from 'react';

// 2. Third-party libraries
import { Box, Typography } from '@mui/material';
import * as tf from '@tensorflow/tfjs';

// 3. Internal imports (absolute from src)
import { dataProvider } from './providers/dataProvider';
import { CategoryClassifier } from './services/CategoryClassifier';
import { useAccount } from './context/AccountContext';
```

### Component Structure
```typescript
// 1. Imports
import React from 'react';
import { Box } from '@mui/material';

// 2. Interface definitions (if any)
interface ComponentProps {
  prop1: string;
  prop2?: number;
}

// 3. Component implementation
export const ComponentName: React.FC<ComponentProps> = ({ prop1, prop2 }) => {
  // 4. Hooks (custom hooks first, then built-in)
  const { selectedAccountId } = useAccount();
  const [state, setState] = useState<string>('');
  
  // 5. Event handlers
  const handleClick = () => {
    // handler logic
  };
  
  // 6. Render
  return (
    <Box>
      {/* JSX content */}
    </Box>
  );
};
```

### Naming Conventions
- **Components**: PascalCase (e.g., `CategoryShip`, `ExpenseForm`)
- **Hooks**: camelCase with `use` prefix (e.g., `useIsSmall`, `useAccount`)
- **Services/Classes**: PascalCase (e.g., `CategoryClassifier`)
- **Utilities**: camelCase (e.g., `csvParsers.ts`)
- **Constants**: UPPER_SNAKE_CASE (e.g., `BOW_SIZE = 200`)
- **Files**: PascalCase for components, camelCase for utilities

### Separation of Concerns

**UI Components:**
- Must be presentational only
- No direct API calls or business logic
- Accept props and emit events
- Use Material UI components

**Custom Hooks:**
- Handle all state management and side effects
- Encapsulate business logic
- Return state and handler functions
- Example: `useAccount()`, `useIsSmall()`

**Services:**
- Pure business logic classes
- No React dependencies
- Example: `CategoryClassifier`, `PaymentClassifier`

**Utils:**
- Pure functions (no side effects)
- Data transformation, parsing, calculations
- Example: `csvParsers.ts`, `reportCalculations.ts`

### Error Handling
```typescript
// Async operations
try {
  const result = await someOperation();
  return result;
} catch (error) {
  console.error('Operation failed:', error);
  throw error; // Re-throw or handle appropriately
}

// Optional chaining and nullish coalescing
const data = result?.data ?? null;
```

### React Admin Patterns
```typescript
// Resource components
export const ExpenseCreate = () => {
  const { selectedAccountId } = useAccount();
  const redirect = useRedirect();
  
  const transform = (data: any) => ({
    ...data,
    account_id: selectedAccountId,
    amount: Number(data.amount.toString().replace(',', '.'))
  });
  
  return (
    <Create transform={transform}>
      <ExpenseForm selectedAccountId={selectedAccountId} />
    </Create>
  );
};
```

### Material UI Usage
- Use the `sx` prop for one-off styles
- Create theme overrides for consistent styling
- Follow responsive design patterns with breakpoints
- Use `useMediaQuery` hook for responsive behavior

### File Organization
```
src/
├── components/          # Reusable UI components
├── context/            # React contexts
├── hooks/              # Custom hooks
├── providers/          # React Admin providers
├── resources/          # React Admin resources
│   ├── expenses/
│   ├── categories/
│   └── ...
├── services/           # Business logic services
├── utils/              # Pure utility functions
└── types/              # TypeScript type definitions
```

### Environment Variables
- Use `VITE_` prefix for client-side variables
- Access via `import.meta.env.VITE_VARIABLE_NAME`
- Never commit sensitive values to git

### Database Operations
- Use Supabase client from `src/supabaseClient.ts`
- Follow Row Level Security (RLS) policies
- Always filter by `account_id` for multi-tenant data
- Handle loading states appropriately

### Performance Considerations
- Use React.memo for expensive components
- Implement proper loading states
- Dispose of TensorFlow tensors when done
- Use pagination for large datasets

### Internationalization
- Use React Admin's i18n system
- Translation files in `src/i18n/`
- Support French (primary) and English
- Use translation keys for all user-facing text

## Security Guidelines
- Never expose Supabase service role keys
- Use RLS policies for data access control
- Validate all user inputs
- Sanitize data before database operations
- Use HTTPS in production

## Git Workflow
- Feature branches: `feature/description`
- Commit messages: Conventional Commits format
- Pull requests required for all changes
- Run lint before committing