import { createContext, useCallback, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import api from '../services/api';
import type { Enterprise, UserEnterprise } from '../dtos';
import { useAuth } from './AuthContext';

interface EnterpriseContextData {
  enterprises: UserEnterprise[];
  current: Enterprise | null;
  setCurrent(enterprise: Enterprise): void;
  loading: boolean;
  refresh(): void;
}

const STORAGE_KEY = '@CobreaiHub:enterprise';

const EnterpriseContext = createContext<EnterpriseContextData>(
  {} as EnterpriseContextData,
);

export function EnterpriseProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth();
  const [enterprises, setEnterprises] = useState<UserEnterprise[]>([]);
  const [current, setCurrent] = useState<Enterprise | null>(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : null;
  });
  const [loading, setLoading] = useState(false);

  const handleSetCurrent = useCallback((enterprise: Enterprise) => {
    setCurrent(enterprise);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(enterprise));
  }, []);

  const clearCurrent = useCallback(() => {
    setCurrent(null);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  const refresh = useCallback(async () => {
    if (!isAuthenticated) {
      clearCurrent();
      setEnterprises([]);
      return;
    }
    setLoading(true);
    try {
      const response = await api.get<UserEnterprise[]>('/userEnterprise/my-enterprises');
      const list = Array.isArray(response.data) ? response.data : [];
      setEnterprises(list);

      // Lê o current diretamente do localStorage (não da closure) para
      // evitar usar valor desatualizado entre renders.
      const storedRaw = localStorage.getItem(STORAGE_KEY);
      const stored: Enterprise | null = storedRaw ? JSON.parse(storedRaw) : null;

      // Verifica se a org armazenada ainda pertence ao usuário atual
      const storedStillValid =
        stored && list.some(ue => ue.enterprise.id === stored.id);

      if (storedStillValid && stored) {
        // Mantém a seleção mas atualiza com dados frescos (logo, cor, etc)
        const fresh = list.find(ue => ue.enterprise.id === stored.id)?.enterprise;
        if (fresh) handleSetCurrent(fresh);
      } else if (list.length > 0) {
        // Auto-seleciona a primeira org do usuário
        handleSetCurrent(list[0].enterprise);
      } else {
        // Usuário não tem orgs vinculadas
        clearCurrent();
      }
    } catch {
      // Falhou ao buscar — não muda o estado
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, handleSetCurrent, clearCurrent]);

  useEffect(() => {
    refresh();
  }, [isAuthenticated, refresh]);

  return (
    <EnterpriseContext.Provider
      value={{ enterprises, current, setCurrent: handleSetCurrent, loading, refresh }}
    >
      {children}
    </EnterpriseContext.Provider>
  );
}

export function useEnterprise(): EnterpriseContextData {
  const context = useContext(EnterpriseContext);
  if (!context)
    throw new Error('useEnterprise must be used within EnterpriseProvider');
  return context;
}
