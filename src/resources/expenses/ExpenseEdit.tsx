
import { Edit, useTranslate } from 'react-admin'
import { Transaction } from '../../types/transaction.types'
import { ExpenseForm } from './ExpenseForm'

/**
 * Expense Edit Component
 * Edit transaction via form
 */
export const ExpenseEdit = () => {
  const translate = useTranslate()

  return (
    <Edit<Transaction>
      title={translate('ra.action.edit')}
      transform={data => ({
        ...data,
        // Ensure amount is always positive, type determines semantics
        amount: Math.abs(Number(data.amount)),
      })}
    >
      <ExpenseForm />
    </Edit>
  )
}
