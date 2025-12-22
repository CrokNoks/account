import { useRef } from 'react';
import { Button } from '@mui/material';
import { useTranslate } from 'react-admin';
import UploadIcon from '@mui/icons-material/Upload';
import { useExpenseImport } from './hooks/useExpenseImport';


export const ImportExpensesButton = () => {
  const translate = useTranslate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const {
    importFile,
    loading
  } = useExpenseImport();

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    importFile(file);

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <>
      <input
        type="file"
        ref={fileInputRef}
        style={{ display: 'none' }}
        accept=".csv"
        onChange={handleFileChange}
      />
      <Button
        variant="contained"
        onClick={handleClick}
        disabled={loading}
        startIcon={<UploadIcon />}
      >
        {loading ? translate('app.components.import.loading') : translate('app.components.import.button')}
      </Button>
    </>
  );
};
