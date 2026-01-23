# Phase 1 Quick Start Guide

**Date**: January 2026  
**Duration**: 1-2 hours for setup and basic testing

---

## Prerequisites

- Node.js 18+
- Firebase CLI installed
- Supabase CLI installed
- Git (for version control)
- PostMan or similar for API testing (optional)

---

## 1. Database Setup (15 minutes)

### Apply Migrations

```bash
# Navigate to supabase
cd supabase

# Apply migration 1: Create tables
supabase migration up

# Expected output:
# ✓ Migrated 20260123120000_create_transactions_table.sql
# ✓ 5 tables created
# ✓ 12 RLS policies applied
# ✓ 11 indexes created
# ✓ 4 triggers registered

# Apply migration 2: Migrate data
supabase migration up

# Expected output:
# ✓ Migrated 20260123120001_migrate_expenses_to_transactions.sql
# ✓ X transactions migrated from expenses
# ✓ Verification passed
```

### Verify Database

```bash
# Connect to Supabase
supabase link

# Check tables
SELECT tablename FROM pg_tables WHERE schemaname = 'public';
# Should see: transactions, reconciliation_history, payment_methods, etc.

# Check data
SELECT COUNT(*) FROM transactions;
# Should see: X transactions (migrated from expenses)

# Check RLS
SELECT * FROM pg_policies WHERE schemaname = 'public';
# Should see: 12 policies listed
```

---

## 2. Backend Setup (20 minutes)

### Deploy Firebase Functions

```bash
# Navigate to functions
cd functions

# Install dependencies
npm install

# Build
npm run build

# Deploy to Firebase
firebase deploy --only functions

# Expected output:
# ✓ functions[api]: Successful HTTP deployment
# ✓ Function URL: https://us-central1-PROJECT.cloudfunctions.net/api
```

### Test Backend Endpoints

```bash
# Set up environment
export API_URL="https://us-central1-PROJECT.cloudfunctions.net/api"
export ACCOUNT_ID="YOUR_ACCOUNT_ID"
export TOKEN="YOUR_FIREBASE_TOKEN"

# Test 1: Create Transaction
curl -X POST $API_URL/transactions \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "account_id": "'$ACCOUNT_ID'",
    "type": "expense",
    "amount": 25.50,
    "date": "2026-01-20",
    "description": "Coffee at Starbucks",
    "category": "Food",
    "payment_method": "credit_card",
    "reconciliation_status": "pending"
  }'

# Expected: 201 Created with transaction ID

# Test 2: List Transactions
curl -X GET "$API_URL/transactions?account_id=$ACCOUNT_ID&limit=10" \
  -H "Authorization: Bearer $TOKEN"

# Expected: 200 OK with list of transactions

# Test 3: Get Account Balance
curl -X GET "$API_URL/transactions/balance?account_id=$ACCOUNT_ID" \
  -H "Authorization: Bearer $TOKEN"

# Expected: 200 OK with balance and date
```

---

## 3. Frontend Setup (25 minutes)

### Install Dependencies

```bash
# Root directory
npm install

# Ensure @mui/material is installed
npm install @mui/material @emotion/react @emotion/styled
```

### Verify Components

```bash
# Check that new files exist
ls src/types/transaction.types.ts
ls src/services/transactionAPI.ts
ls src/hooks/useTransactions.ts
ls src/resources/expenses/components/

# Should see all 7 new components
```

### Update Translations

Add to all language files (e.g., `src/i18n/en/resources.json`):

```json
{
  "resources": {
    "transactions": {
      "name": "Transactions",
      "types": {
        "expense": "Expense",
        "income": "Income",
        "transfer": "Transfer",
        "adjustment": "Adjustment"
      },
      "statuses": {
        "pending": "Pending",
        "confirmed": "Confirmed",
        "reconciled": "Reconciled",
        "disputed": "Disputed",
        "reversed": "Reversed"
      },
      "fields": {
        "type": "Type",
        "amount": "Amount",
        "date": "Date",
        "description": "Description",
        "category": "Category",
        "payment_method": "Payment Method",
        "reconciliation_status": "Reconciliation Status",
        "reconciliation_history": "Reconciliation History"
      }
    }
  }
}
```

### Run Frontend

```bash
# Start development server
npm run dev

# Open http://localhost:5173

# Navigate to Expenses resource
# Should see updated list, create, edit, show pages
```

---

## 4. Basic Testing (30 minutes)

### Test Create

1. Click "Create" on Expenses
2. Fill form:
   - Type: "Expense"
   - Amount: "25.50"
   - Date: Today
   - Description: "Test transaction"
   - Category: "Other"
   - Payment Method: "Cash"
   - Reconciliation Status: "Pending"
3. Click Submit
4. ✅ Should see success message
5. ✅ New transaction in list

### Test View

1. Click on transaction in list
2. ✅ Should see ExpenseShow with tabs:
   - Tab 1: Details (all fields displayed)
   - Tab 2: Reconciliation History (empty initially)

### Test Edit

1. From ExpenseShow, click Edit
2. Change status to "Confirmed"
3. Click Submit
4. ✅ Status updated in list
5. ✅ Go back to Show
6. ✅ Tab 2 should now show history entry

### Test List

1. Create 3-5 more transactions
2. ✅ All visible in list
3. Try filtering/sorting
4. ✅ Table updates correctly

---

## 5. Reconciliation Workflow Test (15 minutes)

### Test Complete Workflow

```
Create: pending
  ↓
Edit → confirmed
  ↓
Show: Check history (1 entry)
  ↓
Edit → reconciled
  ↓
Show: Check history (2 entries)
  ↓
Edit → disputed
  ↓
Show: Check history (3 entries)
  ↓
Edit → reversed
  ↓
Show: Check history (4 entries)
```

### Verify History

In Tab 2 (Reconciliation History):
- [ ] 4 entries visible
- [ ] Timestamps in order
- [ ] Status transitions correct
- [ ] Reasons recorded (if entered)

---

## 6. Database Verification (10 minutes)

### Check Data Integrity

```sql
-- Check transaction count
SELECT COUNT(*) as total_transactions FROM transactions;

-- Check reconciliation history
SELECT 
  transaction_id,
  old_status,
  new_status,
  changed_at
FROM reconciliation_history
ORDER BY changed_at DESC
LIMIT 10;

-- Check balance calculation
SELECT 
  account_id,
  SUM(amount) as total_amount,
  SUM(CASE WHEN type = 'expense' THEN -amount ELSE amount END) as net_balance
FROM transactions
GROUP BY account_id;

-- Verify RLS is working
-- (as non-account user)
SELECT * FROM transactions;
-- Should return: 0 rows (no access)
```

---

## Troubleshooting

### Issue: "Cannot GET /api/transactions"
**Solution**: Firebase Functions not deployed. Run `firebase deploy --only functions`

### Issue: "Missing required field: type"
**Solution**: CreateTransactionDto validation. Ensure all required fields in form.

### Issue: "Unauthorized"
**Solution**: Firebase token invalid. Get new token and set Authorization header.

### Issue: "Payment methods not loading"
**Solution**: Check `supabase/migrations/20260123120000_*` - payment_methods table might not exist.

### Issue: "Tab 2 shows no history"
**Solution**: History only appears after status changes. Create transaction and then edit to change status.

### Issue: "Form submission fails"
**Solution**: Check browser console for validation errors. Ensure all required fields filled.

---

## Performance Check

### Expected Response Times

| Operation | Expected | Actual |
|-----------|----------|--------|
| Create transaction | <500ms | _____ |
| List 50 items | <200ms | _____ |
| Update transaction | <300ms | _____ |
| Delete transaction | <200ms | _____ |
| Load history | <300ms | _____ |
| API healthcheck | <100ms | _____ |

*Fill in actual times after testing*

---

## Completion Checklist

- [ ] Database migrations applied
- [ ] Firebase Functions deployed
- [ ] Frontend starts without errors
- [ ] Create transaction works
- [ ] List displays correctly
- [ ] Show page displays details
- [ ] Edit updates transaction
- [ ] Reconciliation status changes
- [ ] History displays changes
- [ ] Delete works with confirmation
- [ ] All response times acceptable
- [ ] No console errors
- [ ] Translations display correctly

---

## Next Steps

### Immediate (This Sprint)
1. Add more i18n translations (25+ keys)
2. Update ExpenseForm integration
3. Run comprehensive manual testing

### Short-term (Next Sprint)
1. Update ReceiptOCR component
2. Performance optimization
3. Create test suite

### Medium-term (Before Production)
1. Load testing
2. Security audit
3. Accessibility review

### Production Deployment
1. Deploy to staging first
2. Run full validation
3. Deploy to production
4. Monitor for issues

---

## Documentation References

- **Complete Index**: [PHASE1_COMPLETE_INDEX.md](PHASE1_COMPLETE_INDEX.md)
- **Before/After**: [PHASE1_BEFORE_AFTER.md](PHASE1_BEFORE_AFTER.md)
- **Frontend Guide**: [docs/PHASE1_FRONTEND_ADAPTATION.md](docs/PHASE1_FRONTEND_ADAPTATION.md)
- **Backend Guide**: [docs/PHASE1_TRANSACTIONS_COMPLETE.md](docs/PHASE1_TRANSACTIONS_COMPLETE.md)
- **Deployment**: [docs/PHASE1_DEPLOYMENT.md](docs/PHASE1_DEPLOYMENT.md)
- **Verification**: [docs/FRONTEND_VERIFICATION.md](docs/FRONTEND_VERIFICATION.md)

---

## Support

**Questions?** Check the documentation references above.  
**Stuck?** See Troubleshooting section.  
**Issue?** Check GitHub issues or project board.

---

**Estimated Time**: 1-2 hours for complete setup and basic testing  
**Next Milestone**: Comprehensive integration testing  
**Timeline to Production**: 1-2 weeks

✅ **Ready to start?** Begin with Database Setup above.
