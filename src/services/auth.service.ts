import { supabase } from '../lib/supabase';
import type { User } from '@supabase/supabase-js';

export interface SignUpData {
  email: string;
  password: string;
  fullName: string;
  cpf: string;
  birthDate: string;
  isOrganizer?: boolean;
}

export interface SignInData {
  email: string;
  password: string;
}

export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  cpf: string | null;
  birth_date: string | null;
  city: string | null;
  avatar_url: string | null;
  bio: string | null;
  roles: string[];
  organizer_status: 'NONE' | 'PENDING' | 'APPROVED' | 'REJECTED';
  role?: string; // Mantendo para compatibilidade temporária
  single_mode: boolean;
  show_initials_only: boolean;
  match_intention: 'paquera' | 'amizade';
  match_gender_preference: 'homens' | 'mulheres' | 'todos';
  sexuality?: string;
  meet_attendees?: boolean;
  match_enabled?: boolean;
  looking_for?: string[];
  height?: number;
  relationship_status?: string;
  created_at: string;
  updated_at: string;
}

class AuthService {
  // Cadastro de novo usuário
  async signUp({ email, password, fullName, cpf, birthDate, isOrganizer = false }: SignUpData) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          cpf,
          birth_date: birthDate,
          is_organizer: isOrganizer // Passando metadata para debug se necessário
        },
      },
    });

    if (error) throw error;

    // Se o usuário foi criado com sucesso, vamos garantir que o perfil tenha as roles corretas
    if (data.user) {
      // Aguardar um momento para o trigger criar o perfil básico
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      const updates: any = {
        roles: ['BUYER'],
        organizer_status: 'NONE'
      };

      if (isOrganizer) {
        updates.roles.push('ORGANIZER');
        updates.organizer_status = 'PENDING';
      }

      const { error: updateError } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', data.user.id);
        
      if (updateError) {
        console.error('Erro ao atualizar roles do usuário:', updateError);
        // Não lançamos erro aqui para não bloquear o cadastro, o usuário pode pedir upgrade depois
      }
    }

    return data;
  }

  // Login
  async signIn({ email, password }: SignInData) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) throw error;
    return data;
  }

  // Logout
  async signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  }

  // Obter usuário atual
  async getCurrentUser(): Promise<User | null> {
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error) throw error;
    return user;
  }

  // Obter sessão atual
  async getSession() {
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error) throw error;
    return session;
  }

  // Obter perfil do usuário
  async getProfile(userId: string): Promise<Profile | null> {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) throw error;
    return data;
  }

  // Atualizar perfil
  async updateProfile(userId: string, updates: Partial<Profile>) {
    const { data, error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', userId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  // Enviar email de redefinição de senha
  async resetPasswordForEmail(email: string) {
    const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/update-password`,
    });
    if (error) throw error;
    return data;
  }

  // Atualizar senha
  async updatePassword(password: string) {
    const { data, error } = await supabase.auth.updateUser({
      password: password
    });
    if (error) throw error;
    return data;
  }

  // Listener para mudanças de autenticação
  onAuthStateChange(callback: (user: User | null) => void) {
    return supabase.auth.onAuthStateChange((_event, session) => {
      callback(session?.user ?? null);
    });
  }
}

export const authService = new AuthService();
