import React, { createContext, useState, useContext, ReactNode } from 'react';

interface ApiKeyContextType {
  apiKey: string | null;
  setApiKey: (key: string | null) => void;
  isApiKeySet: boolean;
}

const ApiKeyContext = createContext<ApiKeyContextType | undefined>(undefined);

export const ApiKeyProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [apiKey, setApiKeyInternal] = useState<string | null>(() => {
    try {
      return localStorage.getItem('gemini_api_key');
    } catch (e) {
      console.error("Could not access local storage", e);
      return null;
    }
  });

  const setApiKey = (key: string | null) => {
    setApiKeyInternal(key);
    try {
        if (key) {
            localStorage.setItem('gemini_api_key', key);
        } else {
            localStorage.removeItem('gemini_api_key');
        }
    } catch (e) {
        console.error("Could not access local storage", e);
    }
  };
  
  const isApiKeySet = !!apiKey;

  return (
    <ApiKeyContext.Provider value={{ apiKey, setApiKey, isApiKeySet }}>
      {children}
    </ApiKeyContext.Provider>
  );
};

export const useApiKey = () => {
  const context = useContext(ApiKeyContext);
  if (context === undefined) {
    throw new Error('useApiKey must be used within an ApiKeyProvider');
  }
  return context;
};
