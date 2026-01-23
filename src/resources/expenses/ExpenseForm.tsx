import {
  SimpleForm,
  TextInput,
  DateInput,
  required,
} from 'react-admin'
import { SmartCategoryInput } from './components/SmartCategoryInput'
import { TransactionTypeSelect } from './components/TransactionTypeSelect'
import { ReconciliationStatusSelect } from './components/ReconciliationStatusSelect'
import { PaymentMethodSelect } from './components/PaymentMethodSelect'

/**
 * Expense/Transaction Form Component
 * Handles creation and editing of transactions
 * Uses new transaction types and reconciliation workflow
 */
export const ExpenseForm = (props: any) => {
  const { selectedAccountId, toolbar, ...rest } = props

  const validateAmount = (value: any) => {
    if (!value) return 'required'
    const amount = parseFloat(String(value).replace(',', '.'))
    if (isNaN(amount)) return 'Nombre invalide'
    if (amount <= 0) return 'Le montant doit être positif'
    return undefined
  }

  return (
    <SimpleForm toolbar={toolbar} {...rest}>
      {/* Transaction Type Selection */}
      <TransactionTypeSelect source="type" validate={[required()]} fullWidth />

      {/* Description (required) */}
      <TextInput
        source="description"
        label="resources.expenses.fields.description"
        validate={[required()]}
        fullWidth
      />

      {/* Amount (always positive, type determines sign) */}
      <TextInput
        source="amount"
        label="resources.expenses.fields.amount"
        validate={[validateAmount]}
        inputProps={{ inputMode: 'decimal' }}
        fullWidth
      />

      {/* Date */}
      <DateInput
        source="date"
        label="resources.expenses.fields.date"
        validate={[required()]}
        fullWidth
      />

      {/* Category */}
      <SmartCategoryInput source="category_id" selectedAccountId={selectedAccountId} />

      {/* Notes (optional) */}
      <TextInput
        source="notes"
        label="resources.expenses.fields.note"
        multiline
        fullWidth
      />

      {/* Payment Method (dynamic from DB) */}
      <PaymentMethodSelect accountId={selectedAccountId} fullWidth />

      {/* Reconciliation Status (workflow aware) */}
      <ReconciliationStatusSelect source="reconciliation_status" fullWidth />
    </SimpleForm>
  )
}
