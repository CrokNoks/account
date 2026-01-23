import { SelectInput, SelectInputProps } from 'react-admin'
import { useEffect, useState } from 'react'


interface PaymentMethodSelectProps extends Omit<SelectInputProps, 'choices'> {
  accountId: string
  source?: string
  label?: string
  isLoading?: boolean
}

/**
 * Payment Method Select Component
 * Dynamically loads payment methods from the database
 */
export const PaymentMethodSelect = ({
  accountId,
  source = 'payment_method_id',
  label = 'resources.transactions.fields.payment_method',
  ...props
}: PaymentMethodSelectProps) => {
  const [choices, setChoices] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (!accountId) return

    const loadPaymentMethods = async () => {
      try {
        setIsLoading(true)
        // Placeholder - will be implemented with real API
        setChoices([
          { id: 'card', name: 'Carte bancaire' },
          { id: 'cash', name: 'Espèces' },
          { id: 'transfer', name: 'Virement' },
        ])
      } catch (error) {
        console.error('Failed to load payment methods:', error)
      } finally {
        setIsLoading(false)
      }
    }

    loadPaymentMethods()
  }, [accountId])

  return (
    <SelectInput
      source={source}
      label={label}
      choices={choices}
      isLoading={isLoading}
      {...props}
    />
  )
}
