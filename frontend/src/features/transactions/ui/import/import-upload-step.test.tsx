import { render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it, vi } from 'vitest';
import fr from '../../../../../messages/fr.json';
import { ImportUploadStep } from './import-upload-step';

describe('ImportUploadStep', () => {
  it('links the delimiter label to its select', () => {
    render(
      <NextIntlClientProvider locale="fr" messages={fr}>
        <ImportUploadStep
          delimiter=","
          setDelimiter={vi.fn()}
          onFileUpload={vi.fn()}
          fileInputRef={{ current: null }}
          isProcessing={false}
        />
      </NextIntlClientProvider>,
    );

    expect(screen.getByLabelText(fr.Import.upload.delimiter)).toHaveTextContent(',');
  });
});
