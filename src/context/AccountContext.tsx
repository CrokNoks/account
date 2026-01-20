import { createContext, useState, useContext, useEffect, ReactNode } from 'react';

interface AccountContextType {
  selectedAccountId: string | null;
  setSelectedAccountId: (id: string | null) => void;
}

const AccountContext = createContext<AccountContextType | undefined>(undefined);

export const AccountProvider = ({ children }: { children: ReactNode }) => {
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(() => {
    try {
      return localStorage.getItem('selectedAccountId');
    } catch {
      return null;
    }
  });

  useEffect(() => {
    try {
      if (selectedAccountId) {
        localStorage.setItem('selectedAccountId', selectedAccountId);
      } else {
        localStorage.removeItem('selectedAccountId');
      }
    } catch {
      // Handle localStorage errors gracefully
    }
  }, [selectedAccountId]);

  return (
    <AccountContext.Provider value={{ selectedAccountId, setSelectedAccountId }}>
      {children}
    </AccountContext.Provider>
  );
};

export const useAccount = () => {
  const context = useContext(AccountContext);
  if (context === undefined) {
    throw new Error('useAccount must be used within an AccountProvider');
  }
  return context;
};
