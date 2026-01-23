import { useTranslate } from 'react-admin'
import { TransactionDetailsView } from './components/TransactionDetailsView'

/**
 * Expense Show Component
 */
export const ExpenseShow = () => {
  const translate = useTranslate()

  return (
    <div>
      <h1>{translate('resources.transactions.show.title')}</h1>
      <p>{translate('resources.transactions.show.description')}</p>
      <TransactionDetailsView transaction={null} />
    </div>
  )
}