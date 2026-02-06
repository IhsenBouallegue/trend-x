"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";

import { useAccountList } from "@/hooks/queries";

interface AccountContextValue {
  selectedAccountId: string | null;
  setSelectedAccountId: (id: string | null) => void;
}

const AccountContext = createContext<AccountContextValue | null>(null);

const STORAGE_KEY = "trend-x-selected-account";
const OVERVIEW_VALUE = "__overview__";

export function AccountProvider({ children }: { children: React.ReactNode }) {
  const [selectedAccountId, setSelectedAccountIdState] = useState<string | null>(null);
  const [initialized, setInitialized] = useState(false);

  // Get accounts to validate selection
  const { data: accounts } = useAccountList();

  // Load from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === OVERVIEW_VALUE) {
      // User explicitly selected overview - keep selectedAccountId as null
      setSelectedAccountIdState(null);
    } else if (stored) {
      setSelectedAccountIdState(stored);
    }
    setInitialized(true);
  }, []);

  // Validate selection when accounts change
  useEffect(() => {
    if (!initialized || !accounts) return;

    const stored = localStorage.getItem(STORAGE_KEY);

    // If stored is OVERVIEW_VALUE, respect that choice and keep null
    if (stored === OVERVIEW_VALUE) {
      return;
    }

    // If no selection or selection is invalid, select first account (but only on first load)
    if (selectedAccountId === null || !accounts.some((a) => a.id === selectedAccountId)) {
      if (accounts.length > 0 && !stored) {
        // Only auto-select if there's no stored preference at all (fresh install)
        setSelectedAccountIdState(accounts[0].id);
        localStorage.setItem(STORAGE_KEY, accounts[0].id);
      } else if (accounts.length > 0 && stored && !accounts.some((a) => a.id === stored)) {
        // Stored account no longer exists, select first account
        setSelectedAccountIdState(accounts[0].id);
        localStorage.setItem(STORAGE_KEY, accounts[0].id);
      }
    }
  }, [accounts, selectedAccountId, initialized]);

  const setSelectedAccountId = useCallback((id: string | null) => {
    setSelectedAccountIdState(id);
    if (id) {
      localStorage.setItem(STORAGE_KEY, id);
    } else {
      // When explicitly setting to null (Overview), store the sentinel value
      localStorage.setItem(STORAGE_KEY, OVERVIEW_VALUE);
    }
  }, []);

  return (
    <AccountContext.Provider value={{ selectedAccountId, setSelectedAccountId }}>
      {children}
    </AccountContext.Provider>
  );
}

export function useAccount() {
  const context = useContext(AccountContext);
  if (!context) {
    throw new Error("useAccount must be used within an AccountProvider");
  }
  return context;
}
