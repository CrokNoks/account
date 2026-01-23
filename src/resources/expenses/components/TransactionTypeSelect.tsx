import { SelectInput, SelectInputProps } from 'react-admin'

interface TransactionTypeSelectProps extends Omit<SelectInputProps, 'choices'> {
  source?: string
  label?: string
}

/**
 * Transaction Type Select Component
 * Provides selection between expense, income, transfer, and adjustment types
 */
export const TransactionTypeSelect = ({
  source = 'type',
  label = 'resources.transactions.fields.type',
  ...props
}: TransactionTypeSelectProps) => {
  const choices = [
    {
      id: 'expense',
      name: 'resources.transactions.types.expense',
    },
    {
      id: 'income',
      name: 'resources.transactions.types.income',
    },
    {
      id: 'transfer',
      name: 'resources.transactions.types.transfer',
    },
    {
      id: 'adjustment',
      name: 'resources.transactions.types.adjustment',
    },
  ]

  return <SelectInput source={source} label={label} choices={choices} {...props} />
}
