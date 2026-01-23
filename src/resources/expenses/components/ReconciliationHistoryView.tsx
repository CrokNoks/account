import React from 'react'
import {
  Box,
  Card,
  CardContent,
  CardHeader,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Chip,
  CircularProgress,
  Typography,
} from '@mui/material'
import { useTranslate } from 'react-admin'
import { formatDate } from '../../../utils/formatters'

interface ReconciliationHistoryViewProps {
  transactionId: string
  accountId: string
}

/**
 * Reconciliation History View Component
 * Displays audit trail of reconciliation status changes
 */
export const ReconciliationHistoryView = ({ transactionId, accountId }: ReconciliationHistoryViewProps) => {
  const translate = useTranslate()
   const [history, setHistory] = React.useState<any[]>([])
   const [isLoading, setIsLoading] = React.useState(true)
   const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    const loadHistory = async () => {
      try {
        setIsLoading(true)
        const data = await fetch(`/api/transactions/${transactionId}/reconciliation-history?account_id=${accountId}`)
          .then(res => res.json())
        setHistory(data)
      } catch (err) {
        console.error('Failed to load reconciliation history:', err)
        setError(err instanceof Error ? err.message : 'Unknown error')
      } finally {
        setIsLoading(false)
      }
    }

    if (transactionId) {
      loadHistory()
    }
  }, [transactionId, accountId])

  const getStatusColor = (
    status: string
  ): 'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning' => {
    const colors: Record<string, any> = {
      pending: 'warning',
      confirmed: 'info',
      reconciled: 'success',
      disputed: 'error',
      reversed: 'default',
    }
    return colors[status] || 'default'
  }

  if (isLoading) {
    return (
      <Card>
        <CardContent>
          <Box display="flex" justifyContent="center">
            <CircularProgress />
          </Box>
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card>
        <CardContent>
          <Typography color="error">{error}</Typography>
        </CardContent>
      </Card>
    )
  }

  if (history.length === 0) {
    return (
      <Card>
        <CardContent>
          <Typography color="textSecondary">{translate('ra.page.empty')}</Typography>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader title={translate('resources.transactions.fields.reconciliation_history')} />
      <CardContent>
        <Box sx={{ overflowX: 'auto' }}>
          <Table size="small">
            <TableHead>
              <TableRow sx={{ backgroundColor: '#f5f5f5' }}>
                <TableCell>{translate('resources.transactions.fields.changed_at')}</TableCell>
                <TableCell>{translate('resources.transactions.fields.old_status')}</TableCell>
                <TableCell>{translate('ra.action.change')}</TableCell>
                <TableCell>{translate('resources.transactions.fields.new_status')}</TableCell>
                <TableCell>{translate('resources.transactions.fields.reason')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {history.map(entry => (
                <TableRow key={entry.id}>
                  <TableCell>{formatDate(entry.changed_at)}</TableCell>
                  <TableCell>
                    {entry.old_status ? (
                      <Chip
                        label={translate(`resources.transactions.statuses.${entry.old_status}`)}
                        color={getStatusColor(entry.old_status)}
                        size="small"
                      />
                    ) : (
                      <Typography color="textSecondary">{translate('ra.action.none')}</Typography>
                    )}
                  </TableCell>
                  <TableCell>→</TableCell>
                  <TableCell>
                    <Chip
                      label={translate(`resources.transactions.statuses.${entry.new_status}`)}
                      color={getStatusColor(entry.new_status)}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>{entry.reason || '-'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Box>
      </CardContent>
    </Card>
  )
}
