import { useTranslate } from 'react-admin'
import { Box, Card, CardContent, CardHeader, Typography, CircularProgress, Alert } from '@mui/material'
import { Transaction } from '../../../types/transaction.types'

/**
 * Transaction Details View Component
 */
interface TransactionDetailsViewProps {
  transaction: Transaction | null
  loading?: boolean
  error?: string | null
}

export const TransactionDetailsView = ({ transaction, loading = false, error }: TransactionDetailsViewProps) => {
  const translate = useTranslate()

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight={400}>
        <CircularProgress />
      </Box>
    )
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ mb: 2 }}>
        {translate('resources.transactions.errors.detailsError')}: {error}
      </Alert>
    )
  }

  if (!transaction) {
    return (
      <Alert severity="info" sx={{ mb: 2 }}>
        {translate('resources.transactions.errors.noTransaction')}
      </Alert>
    )
  }

  return (
    <Card>
      <CardHeader title={translate('resources.transactions.details.title')} />
      <CardContent>
        <Box display="flex" flexDirection="column" gap={2}>
          <Typography variant="body1" gutterBottom>
            <strong>{translate('resources.transactions.fields.description')}:</strong> {transaction.description}
          </Typography>
          <Typography variant="body2" gutterBottom>
            <strong>{translate('resources.transactions.fields.amount')}:</strong> {transaction.amount} {transaction.currency || 'EUR'}
          </Typography>
          <Typography variant="body2" gutterBottom>
            <strong>{translate('resources.transactions.fields.date')}:</strong> {transaction.date}
          </Typography>
          <Typography variant="body2" gutterBottom>
            <strong>{translate('resources.transactions.fields.type')}:</strong> {transaction.type}
          </Typography>
          {transaction.notes && (
            <Typography variant="body2">
              <strong>{translate('resources.transactions.fields.notes')}:</strong> {transaction.notes}
            </Typography>
          )}
        </Box>
      </CardContent>
    </Card>
  )
}