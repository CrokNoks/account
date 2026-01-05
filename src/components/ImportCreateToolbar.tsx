import { ReactNode } from 'react';
import { TopToolbar, CreateButton } from 'ra-ui-materialui';

interface ImportCreateToolbarProps {
  importButton?: ReactNode;
  createLabel?: string;
  children?: ReactNode;
}

export const ImportCreateToolbar = ({
  importButton,
  createLabel,
  children
}: ImportCreateToolbarProps) => {
  return (
    <TopToolbar>
      {children}
      {importButton}
      <CreateButton label={createLabel} />
    </TopToolbar>
  );
};


