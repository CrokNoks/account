import { SelectInput, SelectInputProps } from 'react-admin'

interface ReconciliationStatusSelectProps extends SelectInputProps {
  source?: string
  label?: string
}

/**
 * Reconciliation Status Select Component
 * Provides selection between reconciliation workflow states
 * pending → confirmed → reconciled → disputed → reversed
 */
export const ReconciliationStatusSelect = ({
  source = 'reconciliation_status',
  label = 'resources.transactions.fields.reconciliation_status',
  ...props
}: ReconciliationStatusSelectProps) => {
  const choices = [
    {
      id: 'pending',
      name: 'resources.transactions.statuses.pending',
    },
    {
      id: 'confirmed',
      name: 'resources.transactions.statuses.confirmed',
    },
    {
      id: 'reconciled',
      name: 'resources.transactions.statuses.reconciled',
    },
    {
      id: 'disputed',
      name: 'resources.transactions.statuses.disputed',
    },
    {
      id: 'reversed',
      name: 'resources.transactions.statuses.reversed',
    },
  ]

  return <SelectInput source={source} label={label} choices={choices} {...props} />
}
