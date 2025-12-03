import { ReactNode } from 'react';
import { TopToolbar, CreateButton } from 'ra-ui-materialui';

interface ImportCreateToolbarProps {
  importButton?: ReactNode;
  createLabel?: string;
}

export const ImportCreateToolbar = ({
  importButton,
  createLabel,
}: ImportCreateToolbarProps) => {
  return (
    <TopToolbar>
      {importButton}
      <CreateButton label={createLabel} />
    </TopToolbar>
  );
};


