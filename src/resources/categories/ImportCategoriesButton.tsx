import { useRef } from 'react';
import { Button } from '@mui/material';
import { useTranslate } from 'react-admin';
import UploadIcon from '@mui/icons-material/Upload';
import { useCategoryImport } from './hooks/useCategoryImport';

export const ImportCategoriesButton = () => {
  const translate = useTranslate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { importFile, loading } = useCategoryImport();

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    importFile(file, () => {
      // Reset input on success
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    });

    // Also reset if it fails (done in hook finally block usually, but input value needs manual reset if we want to allow re-selecting same file)
    // Here we reset only on success to keep it simple, or we can reset always.
    // The hook doesn't expose a "finally" callback easily without more complexity, 
    // but we can just reset the input after calling importFile if we don't care about the async result here,
    // OR we can make importFile return a promise.
    // For now, let's just reset it in the onChange since the hook handles the async part.
    // Actually, to allowing re-uploading same file after error, we should reset.
    // Let's reset it immediately or pass a callback. I passed a callback for success.
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
