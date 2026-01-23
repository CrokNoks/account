import React, { useState, useCallback } from 'react'
import {
  Box,
  Card,
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TablePagination,
  TextField,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  CircularProgress,
  Chip,
  Stack,
} from '@mui/material'
import EditIcon from '@mui/icons-material/Edit'
import DeleteIcon from '@mui/icons-material/Delete'
import { useTranslate } from 'react-admin'
import { useAccount } from '../../context/AccountContext'
import { useTransactions, useDeleteTransaction } from '../../hooks/useTransactions'
import { Transaction, TransactionType, ReconciliationStatus, TRANSACTION_TYPES, RECONCILIATION_STATUSES } from '../../types/transaction.types'
import { formatDate, formatCurrency } from '../../utils/formatters'

/**
 * Enhanced Transaction List Component
 * Uses new useTransactions hook with SWR for automatic deduplication
 */
export const TransactionListEnhanced = () => {
  const translate = useTranslate()
  const { selectedAccountId } = useAccount()
  const [page, setPage] = useState(0)
  const [limit, setLimit] = useState(20)
  const [filters, setFilters] = useState({ type: '', status: '' })
  const [deleteTarget, setDeleteTarget] = useState<Transaction | null>(null)

  const { transactions, total, isLoading, error, mutate } = useTransactions(
    selectedAccountId || '',
    {
      page: page + 1,
      limit,
      type: (filters.type as TransactionType) || undefined,
      status: (filters.status as ReconciliationStatus) || undefined,
    }
  )

  const { delete: deleteTransaction, isLoading: isDeleting } = useDeleteTransaction()

  const handleChangePage = useCallback(
    (_: unknown, newPage: number) => {
      setPage(newPage)
    },
    []
  )

  const handleChangeRowsPerPage = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      setLimit(parseInt(event.target.value, 10))
      setPage(0)
    },
    []
  )

  const handleDeleteClick = useCallback((transaction: Transaction) => {
    setDeleteTarget(transaction)
  }, [])

  const handleConfirmDelete = useCallback(async () => {
    if (!deleteTarget || !selectedAccountId) return

    try {
      await deleteTransaction(deleteTarget.id, selectedAccountId)
      mutate()
      setDeleteTarget(null)
    } catch (error) {
      console.error('Failed to delete transaction:', error)
    }
  }, [deleteTarget, selectedAccountId, deleteTransaction, mutate])

  const getTypeColor = (type: string): 'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning' => {
    switch (type) {
      case TRANSACTION_TYPES.EXPENSE:
        return 'error'
      case TRANSACTION_TYPES.INCOME:
        return 'success'
      case TRANSACTION_TYPES.TRANSFER:
        return 'info'
      case TRANSACTION_TYPES.ADJUSTMENT:
        return 'warning'
      default:
        return 'default'
    }
  }

  const getStatusColor = (
    status: string
  ): 'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning' => {
    switch (status) {
      case RECONCILIATION_STATUSES.PENDING:
        return 'warning'
      case RECONCILIATION_STATUSES.CONFIRMED:
        return 'info'
      case RECONCILIATION_STATUSES.RECONCILED:
        return 'success'
      case RECONCILIATION_STATUSES.DISPUTED:
        return 'error'
      case RECONCILIATION_STATUSES.REVERSED:
        return 'default'
      default:
        return 'default'
    }
  }

  if (!selectedAccountId) {
    return (
      <Box p={2}>
        <p>{translate('app.messages.select_account_first')}</p>
      </Box>
    )
  }

  if (error) {
    return (
      <Box p={2}>
        <p style={{ color: 'red' }}>{translate('ra.page.error')}</p>
      </Box>
    )
  }

  return (
    <Box p={2}>
      {/* Filters */}
      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Stack direction="row" spacing={2} sx={{ mb: 2 }}>
            <TextField
              select
              label={translate('resources.transactions.fields.type')}
              value={filters.type}
              onChange={e => setFilters({ ...filters, type: e.target.value })}
              size="small"
              sx={{ minWidth: 150 }}
              SelectProps={{
                native: true,
              }}
            >
              <option value="">{translate('ra.action.none')}</option>
              <option value={TRANSACTION_TYPES.EXPENSE}>{translate('resources.transactions.types.expense')}</option>
              <option value={TRANSACTION_TYPES.INCOME}>{translate('resources.transactions.types.income')}</option>
              <option value={TRANSACTION_TYPES.TRANSFER}>{translate('resources.transactions.types.transfer')}</option>
              <option value={TRANSACTION_TYPES.ADJUSTMENT}>{translate('resources.transactions.types.adjustment')}</option>
            </TextField>

            <TextField
              select
              label={translate('resources.transactions.fields.reconciliation_status')}
              value={filters.status}
              onChange={e => setFilters({ ...filters, status: e.target.value })}
              size="small"
              sx={{ minWidth: 150 }}
              SelectProps={{
                native: true,
              }}
            >
              <option value="">{translate('ra.action.none')}</option>
              <option value={RECONCILIATION_STATUSES.PENDING}>{translate('resources.transactions.statuses.pending')}</option>
              <option value={RECONCILIATION_STATUSES.CONFIRMED}>{translate('resources.transactions.statuses.confirmed')}</option>
              <option value={RECONCILIATION_STATUSES.RECONCILED}>{translate('resources.transactions.statuses.reconciled')}</option>
              <option value={RECONCILIATION_STATUSES.DISPUTED}>{translate('resources.transactions.statuses.disputed')}</option>
            </TextField>

            <Button
              variant="outlined"
              onClick={() => setFilters({ type: '', status: '' })}
            >
              {translate('ra.action.clear')}
            </Button>
          </Stack>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <Box sx={{ overflowX: 'auto' }}>
          <Table>
            <TableHead>
              <TableRow sx={{ backgroundColor: '#f5f5f5' }}>
                <TableCell>{translate('resources.transactions.fields.date')}</TableCell>
                <TableCell>{translate('resources.transactions.fields.description')}</TableCell>
                <TableCell align="right">{translate('resources.transactions.fields.amount')}</TableCell>
                <TableCell>{translate('resources.transactions.fields.type')}</TableCell>
                <TableCell>{translate('resources.transactions.fields.reconciliation_status')}</TableCell>
                <TableCell align="center">{translate('ra.action.actions')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {isLoading && (
                <TableRow>
                  <TableCell colSpan={6} align="center">
                    <CircularProgress />
                  </TableCell>
                </TableRow>
              )}
              {!isLoading && transactions.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} align="center">
                    {translate('ra.page.empty')}
                  </TableCell>
                </TableRow>
              )}
              {transactions.map(transaction => (
                <TableRow key={transaction.id} hover>
                  <TableCell>{formatDate(transaction.date)}</TableCell>
                  <TableCell>{transaction.description}</TableCell>
                  <TableCell align="right">
                    {formatCurrency(transaction.amount)}
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={translate(`resources.transactions.types.${transaction.type}`)}
                      color={getTypeColor(transaction.type)}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={translate(
                        `resources.transactions.statuses.${transaction.reconciliation_status}`
                      )}
                      color={getStatusColor(transaction.reconciliation_status)}
                      size="small"
                    />
                  </TableCell>
                  <TableCell align="center">
                    <Stack direction="row" spacing={1} justifyContent="center">
                      <Button
                        size="small"
                        startIcon={<EditIcon />}

                      >
                        {translate('ra.action.edit')}
                      </Button>
                      <Button
                        size="small"
                        color="error"
                        startIcon={<DeleteIcon />}
                        onClick={() => handleDeleteClick(transaction)}
                      >
                        {translate('ra.action.delete')}
                      </Button>
                    </Stack>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Box>

        {/* Pagination */}
        <TablePagination
          rowsPerPageOptions={[10, 20, 50, 100]}
          component="div"
          count={total}
          rowsPerPage={limit}
          page={page}
          onPageChange={handleChangePage}
          onRowsPerPageChange={handleChangeRowsPerPage}
        />
      </Card>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)}>
        <DialogTitle>{translate('ra.message.are_you_sure')}</DialogTitle>
        <DialogContent>
          <p>
            {translate('ra.message.bulk_delete_content')} "{deleteTarget?.description}"?
          </p>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteTarget(null)}>{translate('ra.action.cancel')}</Button>
          <Button
            onClick={handleConfirmDelete}
            color="error"
            variant="contained"
            disabled={isDeleting}
          >
            {isDeleting ? <CircularProgress size={20} /> : translate('ra.action.delete')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
