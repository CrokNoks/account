import { createContext, useState, useContext, useEffect, ReactNode } from 'react';

interface AccountContextType {
  selectedAccountId: string | null;
  setSelectedAccountId: (id: string | null) => void;
}

const AccountContext = createContext<AccountContextType | undefined>(undefined);

export const AccountProvider = ({ children }: { children: ReactNode }) => {
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(() => {
    try {
      const stored = localStorage.getItem('selectedAccountId');
      // Validate that stored value is a valid UUID-like string
      if (stored && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(stored)) {
        return stored;
      }
      return null;
    } catch (error) {
      console.warn('Failed to read selectedAccountId from localStorage:', error);
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
    } catch (error) {
      console.warn('Failed to write selectedAccountId to localStorage:', error);
    }
  }, [selectedAccountId]);

  // Listen for changes in other tabs
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'selectedAccountId') {
        if (e.newValue) {
          // Validate the new value
          if (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(e.newValue)) {
            setSelectedAccountId(e.newValue);
          } else {
            setSelectedAccountId(null);
          }
        } else {
          setSelectedAccountId(null);
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

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
