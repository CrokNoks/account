
import { Create, SimpleForm, useTranslate } from 'react-admin'
import { Transaction } from '../../types/transaction.types'
import { TransactionFormFields } from './components/TransactionFormFields'
import { useAccount } from '../../context/AccountContext'

/**
 * Expense Create Component
 * Create new transaction
 */
export const ExpenseCreate = () => {
  const translate = useTranslate()
  const { selectedAccountId } = useAccount()

  return (
    <Create<Transaction>
      title={translate('resources.expenses.actions.create')}
      transform={data => ({
        ...data,
        account_id: selectedAccountId,
        // Ensure amount is always positive, type determines semantics
        amount: Math.abs(Number(data.amount)),
      })}
    >
      <SimpleForm>
        <TransactionFormFields isEdit={false} />
      </SimpleForm>
    </Create>
  )
}
