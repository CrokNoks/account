# Phase 1 Deployment & Testing Guide

## Prerequisites

Before deploying Phase 1, ensure you have:

- ✅ Node.js 18+ installed
- ✅ Firebase CLI configured (`firebase login`)
- ✅ Supabase CLI configured (`supabase login`)
- ✅ Environment variables set up
- ✅ Read access to both Firebase and Supabase projects

## Deployment Steps

### Step 1: Apply Database Migrations

```bash
# Navigate to project root
cd /Users/lucas/Projects/perso/account-v2

# List pending migrations
supabase migration list

# Apply migrations to remote database
supabase db push

# Verify migrations were applied
supabase migration list --status applied
```

**Expected Output**:
```
Migration 20260123120000_create_transactions_table.sql - Applied
Migration 20260123120001_migrate_expenses_to_transactions.sql - Applied
```

### Step 2: Verify Database Schema

```bash
# Connect to Supabase and verify tables exist
supabase db pull --schema-only

# Check tables created
psql $DATABASE_URL -c "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'"
```

**Expected Tables**:
- `transactions`
- `transaction_types`
- `reconciliation_statuses`
- `payment_methods`
- `reconciliation_history`

### Step 3: Verify RLS Policies

```bash
# Check RLS policies are enabled
psql $DATABASE_URL -c "SELECT tablename, rowsecurity FROM pg_tables WHERE tablename IN ('transactions', 'payment_methods', 'reconciliation_history')"
```

**Expected Output**:
```
    tablename     | rowsecurity
------------------+-------------
 transactions     | t
 payment_methods  | t
 reconciliation_history | t
```

### Step 4: Build Functions

```bash
# Navigate to functions directory
cd functions

# Install dependencies (if needed)
npm install

# Build TypeScript
npm run build

# Verify build output
ls -la dist/
```

### Step 5: Deploy Functions

```bash
# From project root
firebase deploy --only functions

# Watch deployment logs
firebase functions:log --limit=50
```

**Expected Output**:
```
✓ functions[api]: Deployed successfully
✓ functions[longRunningTask]: Deployed successfully
✓ All done! Your functions are deployed.
```

### Step 6: Update Environment Variables

In `.env` file, add/update:

```env
# API Configuration
VITE_API_URL=https://us-central1-YOUR_PROJECT.cloudfunctions.net

# Firebase Configuration (if not already set)
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_SUPABASE_URL=https://your_project.supabase.co
VITE_SUPABASE_KEY=your_anon_key
```

## Testing

### Integration Tests (Recommended)

```bash
cd functions

# Run all tests
npm test

# Run specific test file
npm test -- transactions.service.spec.ts

# Run with coverage
npm test -- --coverage
```

### Manual API Testing

#### 1. Get Firebase Auth Token

```bash
# Using Firebase CLI
firebase auth:export /tmp/tokens.json --project=YOUR_PROJECT

# Or manually via Supabase:
curl -X POST "https://your_project.supabase.co/auth/v1/token?grant_type=password" \
  -H "apikey: YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password"}'
```

#### 2. Create Transaction

```bash
curl -X POST "https://us-central1-YOUR_PROJECT.cloudfunctions.net/api/transactions" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "account_id": "YOUR_ACCOUNT_ID",
    "type": "expense",
    "amount": 25.99,
    "currency": "EUR",
    "date": "2024-01-23",
    "description": "Test transaction",
    "category_id": "YOUR_CATEGORY_ID"
  }'
```

**Expected Response (201)**:
```json
{
  "id": "uuid",
  "account_id": "uuid",
  "type": "expense",
  "amount": 25.99,
  "currency": "EUR",
  "date": "2024-01-23",
  "description": "Test transaction",
  "reconciliation_status": "pending",
  "created_at": "2024-01-23T10:30:00Z",
  "updated_at": "2024-01-23T10:30:00Z"
}
```

#### 3. List Transactions

```bash
curl -X GET "https://us-central1-YOUR_PROJECT.cloudfunctions.net/api/transactions?account_id=YOUR_ACCOUNT_ID&limit=10" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

#### 4. Get Balance

```bash
curl -X GET "https://us-central1-YOUR_PROJECT.cloudfunctions.net/api/transactions/balance/YOUR_ACCOUNT_ID" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

#### 5. Update Transaction Status

```bash
curl -X PUT "https://us-central1-YOUR_PROJECT.cloudfunctions.net/api/transactions/TRANSACTION_ID?account_id=YOUR_ACCOUNT_ID" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "reconciliation_status": "reconciled",
    "reconciliation_reason": "Matched with bank statement"
  }'
```

### Performance Testing

```bash
# Load test with Apache Bench
ab -n 100 -c 10 \
  -H "Authorization: Bearer YOUR_TOKEN" \
  "https://us-central1-YOUR_PROJECT.cloudfunctions.net/api/transactions?account_id=YOUR_ACCOUNT_ID"

# Measure response time
time curl -X GET "https://us-central1-YOUR_PROJECT.cloudfunctions.net/api/transactions/balance/YOUR_ACCOUNT_ID" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Frontend Testing

#### 1. Verify Types

```bash
cd /Users/lucas/Projects/perso/account-v2

# TypeScript check
npx tsc --noEmit

# Check for type errors in transactions
npx tsc src/types/transaction.types.ts --noEmit
```

#### 2. Test Hooks

Create a test file `src/hooks/useTransactions.test.ts`:

```typescript
import { renderHook, waitFor } from '@testing-library/react'
import { useTransactions } from './useTransactions'

describe('useTransactions', () => {
  it('should fetch transactions for account', async () => {
    const { result } = renderHook(() =>
      useTransactions('test-account-id')
    )

    expect(result.current.isLoading).toBe(true)

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.transactions).toBeDefined()
  })
})
```

## Data Verification

### Check Migration Results

```bash
# Count migrated transactions
psql $DATABASE_URL -c "SELECT COUNT(*) as migrated_count FROM public.transactions WHERE metadata->>'migrated_from' = 'expenses'"

# Check type distribution
psql $DATABASE_URL -c "
  SELECT type, COUNT(*) as count
  FROM public.transactions
  WHERE metadata->>'migrated_from' = 'expenses'
  GROUP BY type
"

# Check reconciliation status
psql $DATABASE_URL -c "
  SELECT reconciliation_status, COUNT(*) as count
  FROM public.transactions
  WHERE metadata->>'migrated_from' = 'expenses'
  GROUP BY reconciliation_status
"
```

## Troubleshooting

### Migration Fails

**Problem**: "ERROR: relation does not exist"

**Solution**:
```bash
# Check if enum types exist
psql $DATABASE_URL -c "SELECT typname FROM pg_type WHERE typnamespace = 2200"

# Rerun migrations in order
supabase migration up 20260123120000
supabase migration up 20260123120001
```

### RLS Policy Errors

**Problem**: "row level security policy denied"

**Solution**:
```bash
# Verify user has account access
psql $DATABASE_URL -c "SELECT public.has_account_access('YOUR_ACCOUNT_ID', 'read')"

# Check RLS policies
psql $DATABASE_URL -c "SELECT policyname, qual FROM pg_policies WHERE tablename = 'transactions'"
```

### Auth Token Expired

**Problem**: "Invalid or expired token"

**Solution**:
```bash
# Get fresh token
supabase auth:create-user --email test@example.com --password password

# Use new token for API calls
```

### Function Cold Start

**Problem**: First request takes >30 seconds

**Solution**:
- This is normal for Firebase Functions
- Subsequent requests should be 100-500ms
- Monitor function performance in Firebase Console

## Rollback Plan

If issues occur, rollback is safe:

```bash
# Delete migrated data
psql $DATABASE_URL -c "DELETE FROM public.transactions WHERE metadata->>'migrated_from' = 'expenses'"

# Reverse migration down (revert Supabase)
supabase migration down 20260123120001
supabase migration down 20260123120000

# Redeploy previous functions version
firebase functions:delete api
firebase deploy --only functions
```

## Post-Deployment Checklist

- [ ] All migrations applied successfully
- [ ] Tables created with correct schema
- [ ] RLS policies enabled and verified
- [ ] Functions deployed and accessible
- [ ] Auth guard validates tokens correctly
- [ ] Create transaction endpoint works
- [ ] List transactions with pagination works
- [ ] Balance calculation returns correct values
- [ ] Reconciliation status updates persist
- [ ] Data migrated from expenses table
- [ ] Migration audit trail created
- [ ] Frontend types compile without errors
- [ ] API service fetches data successfully
- [ ] React hooks integrate with components
- [ ] Environment variables configured

## Performance Baseline

After deployment, measure these metrics:

**Database**:
- Transaction creation: <100ms
- List transactions (20 items): <50ms
- Balance calculation: <100ms
- Reconciliation status update: <50ms

**API**:
- Cold start: 5-30 seconds (first request)
- Warm requests: 100-500ms
- Error responses: <50ms

**Frontend**:
- Component render: <16ms (60fps)
- Hook fetch deduplication: 0ms (cache hit)
- Data display latency: <300ms

## Next Steps

1. ✅ Phase 1 completed
2. ⏭️  Phase 2: Reconciliation workflow (bank import, matching)
3. ⏭️  Phase 3: Payment method normalization
4. ⏭️  Phase 4: Audit logs and type centralization

---

**Deployment Date**: 2024-01-23
**Phase**: 1 (Transactions Table)
**Status**: Ready for Production
