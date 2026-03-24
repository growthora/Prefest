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
  isRecoveryMode: boolean;
  isLoading: boolean;
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
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const clearAuthState = () => {
    setUser(null);
    setProfile(null);
    setAuthStatus('unauthenticated');
  };

  const loadProfileSafely = async (userId: string): Promise<Profile | null> => {
    try {
      return await authService.getProfile(userId);
    } catch (profileError: any) {
      const isAuthError =
        profileError?.code === 'PGRST301' ||
        profileError?.message?.includes('JWT') ||
        profileError?.status === 401;

      if (isAuthError) {
        throw new Error('ACCOUNT_UNAVAILABLE');
      }

      return null;
    }
  };

  const reconcileOrganizerSignupState = async (authUser: User, userProfile: Profile | null) => {
    const organizerIntent = !!authUser.user_metadata?.is_organizer;
    const hasOrganizerRole = (userProfile?.roles || []).some((role) => String(role).toUpperCase() === 'ORGANIZER');
    const organizerStatus = (userProfile?.organizer_status || 'NONE').toUpperCase();

    if (!organizerIntent || (hasOrganizerRole && organizerStatus !== 'NONE')) {
      return userProfile;
    }

    const synced = await authService.syncSignupRoles(authUser.id, true);
    if (!synced) {
      return userProfile;
    }

    try {
      return await authService.getProfile(authUser.id);
    } catch {
      return userProfile;
    }
  };

  const hydrateAuthenticatedUser = async (authUser: User) => {
    const baseProfile = await loadProfileSafely(authUser.id);
    const resolvedProfile = await reconcileOrganizerSignupState(authUser, baseProfile);
    setUser(authUser);
    setProfile(resolvedProfile);
    setAuthStatus('authenticated');
  };

  useEffect(() => {
    const storedRecoveryMode = sessionStorage.getItem('auth_recovery_mode');
    const isRecoveryHash = window.location.hash.includes('type=recovery');
    if (storedRecoveryMode === 'true' || isRecoveryHash) {
      setIsRecoveryMode(true);
      if (isRecoveryHash) {
        sessionStorage.setItem('auth_recovery_mode', 'true');
      }
    }

    const initAuth = async () => {
      try {
        setAuthStatus('checking');
        const session = await authService.getSession();
        if (session?.user) {
          const currentUser = await authService.getCurrentUser();
          if (!currentUser) throw new Error('Token invalido ou expirado');
          await hydrateAuthenticatedUser(currentUser);
        } else {
          setAuthStatus('unauthenticated');
        }
      } catch (err: any) {
        if (err?.message === 'ACCOUNT_UNAVAILABLE') {
          clearAuthState();
        } else {
          setAuthStatus('unauthenticated');
        }
      } finally {
        setIsLoading(false);
      }
    };

    initAuth();

    const { data: { subscription } } = authService.onAuthStateChange(async (authUser, event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setIsRecoveryMode(true);
        sessionStorage.setItem('auth_recovery_mode', 'true');
      } else if (event === 'SIGNED_OUT') {
        setIsRecoveryMode(false);
        sessionStorage.removeItem('auth_recovery_mode');
      }

      if (authUser) {
        try {
          await hydrateAuthenticatedUser(authUser);
        } catch (err: any) {
          if (err?.message === 'ACCOUNT_UNAVAILABLE') {
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

  useEffect(() => {
    if (!user) return;

    const updateLastSeen = async () => {
      try {
        await authService.updateProfile(user.id, { last_seen: new Date().toISOString() });
      } catch (err: any) {
        if (err?.code !== 'PGRST116') {
        }
      }
    };

    updateLastSeen();
    const interval = setInterval(updateLastSeen, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, [user]);

  const signIn = async (email: string, password: string) => {
    try {
      setIsLoading(true);
      setError(null);
      const { user: loggedUser } = await authService.signIn({ email, password });
      if (loggedUser) {
        await hydrateAuthenticatedUser(loggedUser);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao fazer login';
      const normalizedErrorMessage = errorMessage === 'ACCOUNT_UNAVAILABLE'
        ? 'Esta conta foi removida ou desativada e nao pode mais acessar a plataforma.'
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
      const { user: newUser, session } = await authService.signUp({ email, password, fullName, cpf, birthDate, isOrganizer });

      if (newUser && session) {
        await hydrateAuthenticatedUser(newUser);
      } else {
        clearAuthState();
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
      clearAuthState();
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
