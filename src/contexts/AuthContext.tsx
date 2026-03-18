import React, { createContext, useContext, useEffect, useState } from 'react';
import { authService, type Profile } from '@/services/auth.service';
import type { User } from '@supabase/supabase-js';

export type AuthStatus = 'checking' | 'authenticated' | 'unauthenticated';

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  authStatus: AuthStatus;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isEmailConfirmed: boolean;
  isRecoveryMode: boolean; // Novo estado para controlar fluxo de recuperação
  isLoading: boolean; // Mantido para compatibilidade, mas authStatus é preferível para carregamento inicial
  error: string | null;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, fullName: string, cpf: string, birthDate: string, isOrganizer?: boolean) => Promise<void>;
  signOut: () => Promise<void>;
  updateProfile: (updates: Partial<Profile>) => Promise<void>;
  resendConfirmation: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [authStatus, setAuthStatus] = useState<AuthStatus>('checking');
  const [isRecoveryMode, setIsRecoveryMode] = useState(false);
  const [isLoading, setIsLoading] = useState(true); // Mantido para operações de login/update
  const [error, setError] = useState<string | null>(null);

  const clearAuthState = () => {
    setUser(null);
    setProfile(null);
    setAuthStatus('unauthenticated');
  };

  const signOutInvalidAccount = async () => {
    try {
      await authService.signOut();
    } catch {
    } finally {
      clearAuthState();
    }
  };

  const loadRequiredProfile = async (userId: string): Promise<Profile> => {
    try {
      const userProfile = await authService.getProfile(userId);

      if (!userProfile) {
        throw new Error('PROFILE_MISSING');
      }

      return userProfile;
    } catch (profileError: any) {
      const isMissingProfile =
        profileError?.code === 'PGRST116' ||
        profileError?.message?.includes('0 rows') ||
        profileError?.message === 'PROFILE_MISSING';

      const isAuthError =
        profileError?.code === 'PGRST301' ||
        profileError?.message?.includes('JWT') ||
        profileError?.status === 401;

      if (isMissingProfile || isAuthError) {
        await signOutInvalidAccount();
        throw new Error('ACCOUNT_UNAVAILABLE');
      }

      throw profileError;
    }
  };

  useEffect(() => {
    // Check for recovery mode in session storage (persistence across reloads)
    const storedRecoveryMode = sessionStorage.getItem('auth_recovery_mode');
    // Also check URL hash for recovery type
    const isRecoveryHash = window.location.hash.includes('type=recovery');
    if (storedRecoveryMode === 'true' || isRecoveryHash) {
      setIsRecoveryMode(true);
      if (isRecoveryHash) {
        sessionStorage.setItem('auth_recovery_mode', 'true');
      }
    }

    // Carregar sessão inicial
    const initAuth = async () => {
      try {
        setAuthStatus('checking');
        const session = await authService.getSession();
        if (session?.user) {
          // Validar o token com getUser() para garantir que não está expirado/inválido
          try {
            const user = await authService.getCurrentUser();
            if (!user) throw new Error('Token inválido ou expirado');

            const userProfile = await loadRequiredProfile(user.id);
            setUser(user);
            setProfile(userProfile);
            setAuthStatus('authenticated');
          } catch (validationError) {
            clearAuthState();
          }
        } else {
          setAuthStatus('unauthenticated');
        }
      } catch (err) {
        setAuthStatus('unauthenticated');
      } finally {
        setIsLoading(false);
      }
    };

    initAuth();

    // Listener para mudanças de autenticação
    const { data: { subscription } } = authService.onAuthStateChange(async (user, event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setIsRecoveryMode(true);
        sessionStorage.setItem('auth_recovery_mode', 'true');
      } else if (event === 'SIGNED_OUT') {
        setIsRecoveryMode(false);
        sessionStorage.removeItem('auth_recovery_mode');
      }

      if (user) {
        try {
          const userProfile = await loadRequiredProfile(user.id);
          setUser(user);
          setProfile(userProfile);
          setAuthStatus('authenticated');
        } catch (err: any) {
          if (err?.message !== 'ACCOUNT_UNAVAILABLE') {
            clearAuthState();
          }
        }
      } else {
        clearAuthState();
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // Update last_seen every 5 minutes
  useEffect(() => {
    if (!user) return;

    const updateLastSeen = async () => {
      try {
        await authService.updateProfile(user.id, { last_seen: new Date().toISOString() });
      } catch (err: any) {
        // Ignora erro PGRST116 (Result contains 0 rows) que ocorre quando:
        // 1. O usuário foi deletado do banco mas ainda está logado no frontend
        // 2. RLS impede a atualização
        if (err?.code !== 'PGRST116') {
          // Erro silencioso
        }
      }
    };

    updateLastSeen(); // Initial update
    const interval = setInterval(updateLastSeen, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, [user]);

  const signIn = async (email: string, password: string) => {
    try {
      setIsLoading(true);
      setError(null);
      const { user: loggedUser } = await authService.signIn({ email, password });
      if (loggedUser) {
        const userProfile = await loadRequiredProfile(loggedUser.id);
        setUser(loggedUser);
        setProfile(userProfile);
        setAuthStatus('authenticated');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao fazer login';
      const normalizedErrorMessage = errorMessage === 'ACCOUNT_UNAVAILABLE'
        ? 'Esta conta foi removida ou desativada e não pode mais acessar a plataforma.'
        : errorMessage;
      setError(normalizedErrorMessage);
      throw new Error(normalizedErrorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const signUp = async (email: string, password: string, fullName: string, cpf: string, birthDate: string, isOrganizer: boolean = false) => {
    try {
      setIsLoading(true);
      setError(null);
      const { user: newUser } = await authService.signUp({ email, password, fullName, cpf, birthDate, isOrganizer });
      
      if (newUser) {
        setUser(newUser);
        setAuthStatus('authenticated');
        
        // Aguardar um pouco para o trigger criar o perfil
        await new Promise(resolve => setTimeout(resolve, 1000));
        try {
          const userProfile = await authService.getProfile(newUser.id);
          setProfile(userProfile);
        } catch (profileErr) {
          // Erro silencioso
        }
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao criar conta';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const signOut = async () => {
    try {
      setIsLoading(true);
      setError(null);
      await authService.signOut();
      setUser(null);
      setProfile(null);
      setAuthStatus('unauthenticated');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao fazer logout';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const updateProfile = async (updates: Partial<Profile>) => {
    if (!user) {
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      const updatedProfile = await authService.updateProfile(user.id, updates);
      setProfile(updatedProfile);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao atualizar perfil';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const resendConfirmation = async () => {
    if (!user?.email) return;
    try {
      setIsLoading(true);
      await authService.resendConfirmationEmail(user.email);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao reenviar email';
      throw new Error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        authStatus,
        isAuthenticated: !!user,
        isAdmin: profile?.roles?.some(r => r.toUpperCase() === 'ADMIN') ?? false,
        isEmailConfirmed: !!user?.email_confirmed_at,
      isRecoveryMode,
      isLoading,
      error,
      signIn,
        signUp,
        signOut,
        updateProfile,
        resendConfirmation,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

