import { createContext, useCallback, useContext, useState } from 'react';
import type { ReactNode } from 'react';
import api from '../services/api';
import type { User } from '../dtos';

interface AuthState {
  token: string;
  user: User;
}

interface SignInCredentials {
  email: string;
  password: string;
}

interface AuthContextData {
  user: User;
  signIn(credentials: SignInCredentials): Promise<void>;
  signOut(): void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextData>({} as AuthContextData);

const STORAGE_PREFIX = '@CobreaiHub';
const LEGACY_PREFIX = '@DrPlantaoHub';
const KEYS = ['token', 'user', 'enterprise'] as const;

/**
 * Migra chaves do localStorage do prefixo antigo (@DrPlantaoHub) pro novo
 * (@CobreaiHub) na primeira inicialização — evita deslogar usuários que já
 * estavam logados no momento do rebranding.
 */
function migrateLegacyKeys() {
  for (const key of KEYS) {
    const newKey = `${STORAGE_PREFIX}:${key}`;
    const oldKey = `${LEGACY_PREFIX}:${key}`;
    if (!localStorage.getItem(newKey) && localStorage.getItem(oldKey)) {
      localStorage.setItem(newKey, localStorage.getItem(oldKey)!);
    }
    if (localStorage.getItem(oldKey)) localStorage.removeItem(oldKey);
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<AuthState>(() => {
    migrateLegacyKeys();
    const token = localStorage.getItem(`${STORAGE_PREFIX}:token`);
    const user = localStorage.getItem(`${STORAGE_PREFIX}:user`);

    if (token && user) {
      return { token, user: JSON.parse(user) };
    }

    return {} as AuthState;
  });

  const signIn = useCallback(async ({ email, password }: SignInCredentials) => {
    const response = await api.post('/sessions', { email, password });
    const { token, user } = response.data;

    // Verifica se o usuário tem ao menos uma organização vinculada antes
    // de completar o login. Sem userEnterprise → sem acesso ao hub.
    const enterprisesRes = await api.get('/userEnterprise/my-enterprises', {
      headers: { Authorization: `Bearer ${token}` },
    });
    const enterprises = Array.isArray(enterprisesRes.data) ? enterprisesRes.data : [];
    if (enterprises.length === 0) {
      throw new Error(
        'Esta conta não tem acesso ao hub. Solicite ao administrador da organização que vincule você como membro.',
      );
    }

    localStorage.setItem(`${STORAGE_PREFIX}:token`, token);
    localStorage.setItem(`${STORAGE_PREFIX}:user`, JSON.stringify(user));

    setData({ token, user });
  }, []);

  const signOut = useCallback(() => {
    for (const key of KEYS) {
      localStorage.removeItem(`${STORAGE_PREFIX}:${key}`);
    }
    setData({} as AuthState);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user: data.user,
        signIn,
        signOut,
        isAuthenticated: !!data.token,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextData {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
