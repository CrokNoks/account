import { useEffect } from 'react';
import { useFormContext } from 'react-hook-form';

interface OCRFormUpdaterProps {
  ocrData: {
    amount?: number;
    description?: string;
    date?: string;
  };
}

export const OCRFormUpdater = ({ ocrData }: OCRFormUpdaterProps) => {
  const { setValue } = useFormContext();

  useEffect(() => {
    if (ocrData.description) {
      setValue('description', ocrData.description);
    }
    if (ocrData.amount) {
      setValue('amount', ocrData.amount.toString());
    }
    if (ocrData.date) {
      setValue('date', ocrData.date);
    }
  }, [ocrData, setValue]);

  return null;
};
