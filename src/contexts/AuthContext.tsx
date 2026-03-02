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

  console.log('🔐 AuthProvider renderizando', { user: user?.email, profile: profile?.email, authStatus, isLoading, isRecoveryMode });

  useEffect(() => {
    console.log('🔄 AuthProvider useEffect iniciando');
    
    // Check for recovery mode in session storage (persistence across reloads)
    const storedRecoveryMode = sessionStorage.getItem('auth_recovery_mode');
    if (storedRecoveryMode === 'true') {
      setIsRecoveryMode(true);
    }
    
    // Carregar sessão inicial
    const initAuth = async () => {
      try {
        console.log('⏳ Iniciando autenticação...');
        setAuthStatus('checking');
        
        const session = await authService.getSession();
        console.log('📦 Sessão obtida:', session?.user?.email || 'nenhuma');
        
        if (session?.user) {
          // Validar o token com getUser() para garantir que não está expirado/inválido
          try {
            const user = await authService.getCurrentUser();
            if (!user) throw new Error('Token inválido ou expirado');
            
            setUser(user);
            
            // Buscar perfil em paralelo se possível, ou sequencial
            try {
                const userProfile = await authService.getProfile(user.id);
                console.log('👤 Perfil obtido:', userProfile?.email);
                setProfile(userProfile);
              } catch (profileError: any) {
                console.error('❌ Erro ao buscar perfil:', profileError);
                
                // Se o erro for de autenticação (401/403), o token é inválido para o banco
                // Mas cuidado com erros de RLS ou "não encontrado" (PGRST116)
                if (profileError?.code === 'PGRST301' || profileError?.message?.includes('JWT') || profileError?.status === 401) {
                   console.warn('⚠️ Token inválido detectado ao buscar perfil. Forçando logout.');
                   await authService.signOut();
                   setUser(null);
                   setProfile(null);
                   setAuthStatus('unauthenticated');
                   return;
                }
                
                // Se o perfil não existe (PGRST116), não deslogamos. O usuário pode ter sido criado manualmente ou falha no trigger.
                if (profileError?.code === 'PGRST116') {
                  console.warn('⚠️ Perfil não encontrado para usuário autenticado via Auth. Mantendo sessão.');
                  // Opcional: Tentar criar perfil aqui se não existir?
                  // Por enquanto, apenas não deslogamos.
                }
              }
              setAuthStatus('authenticated');
          } catch (validationError) {
            console.warn('⚠️ Sessão inválida detectada:', validationError);
            await authService.signOut();
            setUser(null);
            setProfile(null);
            setAuthStatus('unauthenticated');
          }
        } else {
          setAuthStatus('unauthenticated');
        }
      } catch (err) {
        console.error('❌ Erro ao inicializar auth:', err);
        setAuthStatus('unauthenticated');
      } finally {
        setIsLoading(false);
        console.log('✅ Autenticação inicializada');
      }
    };

    initAuth();

    // Listener para mudanças de autenticação
    const { data: { subscription } } = authService.onAuthStateChange(async (user, event) => {
      console.log('🔄 Mudança de estado de auth detectada:', user?.email || 'logout', 'Event:', event);
      
      if (event === 'PASSWORD_RECOVERY') {
        console.log('🔒 Modo de recuperação de senha ativado');
        setIsRecoveryMode(true);
        sessionStorage.setItem('auth_recovery_mode', 'true');
      } else if (event === 'SIGNED_OUT') {
        setIsRecoveryMode(false);
        sessionStorage.removeItem('auth_recovery_mode');
      }

      if (user) {
        setUser(user);
        setAuthStatus('authenticated'); // Assume autenticado assim que tem user
        
        // Atualizar perfil em background se necessário
        try {
          const userProfile = await authService.getProfile(user.id);
          setProfile(userProfile);
        } catch (err) {
          console.error('Erro ao atualizar perfil no listener:', err);
        }
      } else {
        setUser(null);
        setProfile(null);
        setAuthStatus('unauthenticated');
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
          console.error('Error updating last_seen:', err);
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
        setUser(loggedUser);
        setAuthStatus('authenticated');
        
        try {
          const userProfile = await authService.getProfile(loggedUser.id);
          setProfile(userProfile);
        } catch (profileErr: any) {
          console.warn('⚠️ Erro ao buscar perfil no login:', profileErr);
          // Não falhamos o login se o perfil não carregar, a sessão existe
          if (profileErr?.code === 'PGRST116') {
             // Perfil não existe
          }
        }
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao fazer login';
      setError(errorMessage);
      throw new Error(errorMessage);
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
          console.warn('⚠️ Erro ao buscar perfil após cadastro:', profileErr);
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
      console.error('❌ Tentativa de atualizar perfil sem usuário logado');
      return;
    }

    try {
      console.log('🔄 Iniciando atualização de perfil:', { userId: user.id, updates });
      setIsLoading(true);
      setError(null);
      const updatedProfile = await authService.updateProfile(user.id, updates);
      console.log('✅ Perfil atualizado com sucesso:', updatedProfile);
      setProfile(updatedProfile);
    } catch (err) {
      console.error('❌ Erro ao atualizar perfil:', err);
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
