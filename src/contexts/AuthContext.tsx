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

export function AuthProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<AuthState>(() => {
    const token = localStorage.getItem('@DrPlantaoHub:token');
    const user = localStorage.getItem('@DrPlantaoHub:user');

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

    localStorage.setItem('@DrPlantaoHub:token', token);
    localStorage.setItem('@DrPlantaoHub:user', JSON.stringify(user));

    setData({ token, user });
  }, []);

  const signOut = useCallback(() => {
    localStorage.removeItem('@DrPlantaoHub:token');
    localStorage.removeItem('@DrPlantaoHub:user');
    localStorage.removeItem('@DrPlantaoHub:enterprise');
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
