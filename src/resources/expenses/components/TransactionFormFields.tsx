import { TextInput, DateInput, useTranslate } from 'react-admin'
import { Box, Typography } from '@mui/material'
import { TransactionTypeSelect } from './TransactionTypeSelect'
import { ReconciliationStatusSelect } from './ReconciliationStatusSelect'

interface TransactionFormFieldsProps {
  isEdit?: boolean
}

/**
 * Transaction Form Fields Component
 * Reusable form fields for creating and editing transactions
 */
export const TransactionFormFields = ({ isEdit = false }: TransactionFormFieldsProps) => {
  const translate = useTranslate()

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {/* Amount */}
      <Box>
        <Typography variant="h6" sx={{ mb: 2 }}>
          {translate('resources.transactions.fields.main_details')}
        </Typography>

        <TextInput
          source="amount"
          label={translate('resources.transactions.fields.amount')}
          type="number"
          inputProps={{
            step: 0.01,
            min: 0,
          }}
          validate={value => {
            if (!value || value <= 0) {
              return translate('validation.amount_required')
            }
            return undefined
          }}
          fullWidth
        />
      </Box>

      {/* Type */}
      <TransactionTypeSelect source="type" isRequired />

      {/* Date */}
      <DateInput source="date" label={translate('resources.transactions.fields.date')} validate={required('validation.date_required')} fullWidth />

      {/* Description */}
      <TextInput source="description" label={translate('resources.transactions.fields.description')} fullWidth multiline minRows={2} />

      {/* Category */}
      <TextInput source="category_id" label={translate('resources.transactions.fields.category')} fullWidth />
 
      {/* Payment Method */}
      <Box>
        <Typography variant="h6" sx={{ mb: 2, mt: 3 }}>
          {translate('resources.transactions.fields.payment_info')}
        </Typography>

        <TextInput source="payment_method" label={translate('resources.transactions.fields.payment_method')} fullWidth />
      </Box>

      {/* Reconciliation Status */}
      <Box>
        <Typography variant="h6" sx={{ mb: 2, mt: 3 }}>
          {translate('resources.transactions.fields.reconciliation')}
        </Typography>

        <ReconciliationStatusSelect source="reconciliation_status" isRequired={isEdit} />
      </Box>
    </Box>
  )
}

/**
 * Required validator function
 */
const required = (label: string) => (value: any) => (value ? undefined : label)
