import { supabase } from '../lib/supabase';
import type { User } from '@supabase/supabase-js';
import { invokeEdgeRoute } from '@/services/apiClient';
import { assertAuthEmailSafety } from '@/utils/email-security';

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
  phone: string | null;
  city: string | null;
  avatar_url: string | null;
  bio: string | null;
  roles: string[];
  organizer_status: 'NONE' | 'PENDING' | 'APPROVED' | 'REJECTED';
  role?: string;
  account_type?: 'comprador' | 'organizador' | 'comprador_organizador';
  single_mode: boolean;
  show_initials_only: boolean;
  match_intention: 'paquera' | 'amizade' | 'networking' | 'casual' | 'serio' | null;
  match_gender_preference: string[] | null;
  gender_identity?: string | null;
  sexuality?: string;
  meet_attendees?: boolean;
  match_enabled?: boolean;
  looking_for?: string[];
  height?: number;
  relationship_status?: string;
  last_seen?: string;
  privacy_settings?: {
    show_age: boolean;
    show_height: boolean;
    show_instagram: boolean;
    show_relationship: boolean;
  };
  allow_profile_view?: boolean;
  username?: string;
  created_at: string;
  updated_at: string;
}

class AuthService {
  async syncSignupRoles(_userId: string, isOrganizer: boolean): Promise<boolean> {
    for (let attempt = 0; attempt < 5; attempt++) {
      const { error } = await invokeEdgeRoute('auth-api/signup/sync-roles', {
        method: 'POST',
        body: { isOrganizer },
      });

      if (!error) {
        return true;
      }

      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    return false;
  }

  async checkRegistrationData(email: string, cpf: string) {
    const { data, error } = await invokeEdgeRoute<{
      email_exists: boolean;
      cpf_exists: boolean;
      email_deleted?: boolean;
      cpf_deleted?: boolean;
    }>('auth-api/register/check', {
      method: 'POST',
      body: { email, cpf },
      requiresAuth: false,
    });

    if (error) throw error;
    return (data || {
      email_exists: false,
      cpf_exists: false,
      email_deleted: false,
      cpf_deleted: false,
    }) as {
      email_exists: boolean;
      cpf_exists: boolean;
      email_deleted?: boolean;
      cpf_deleted?: boolean;
    };
  }

  async signUp({ email, password, fullName, cpf, birthDate, isOrganizer = false }: SignUpData) {
    assertAuthEmailSafety();

    const registrationCheck = await this.checkRegistrationData(email, cpf);
    if (registrationCheck.email_deleted || registrationCheck.cpf_deleted) {
      throw new Error('Esta conta foi excluida permanentemente e nao pode ser cadastrada novamente.');
    }
    if (registrationCheck.email_exists) {
      throw new Error('Este e-mail ja esta cadastrado. Tente fazer login.');
    }
    if (registrationCheck.cpf_exists) {
      throw new Error('Este CPF ja esta cadastrado. Entre em contato com o suporte se acredita ser um erro.');
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: window.location.origin,
        data: {
          full_name: fullName,
          cpf,
          birth_date: birthDate,
          is_organizer: isOrganizer
        },
      },
    });

    if (error) throw error;

    if (data.user) {
      await this.syncSignupRoles(data.user.id, isOrganizer);
    }

    return data;
  }

  async signIn({ email, password }: SignInData) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) throw error;
    return data;
  }

  async signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  }

  async getCurrentUser(): Promise<User | null> {
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error) throw error;
    return user;
  }

  async getSession() {
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error) throw error;
    return session;
  }

  async getProfile(_userId: string): Promise<Profile | null> {
    const { data, error } = await invokeEdgeRoute<{ profile: Profile | null }>('profile-api/me', {
      method: 'GET',
    });

    if (error) throw error;
    return data?.profile ?? null;
  }

  async updateProfile(_userId: string, updates: Partial<Profile>) {
    const { data, error } = await invokeEdgeRoute<{ profile: Profile }>('profile-api/me', {
      method: 'PUT',
      body: { updates },
    });

    if (error) throw error;
    if (!data?.profile) throw new Error('Falha ao atualizar perfil');
    return data.profile;
  }

  async completeProfile(data: { cpf: string; phone: string; birth_date: string }) {
    const { data: result, error } = await invokeEdgeRoute('profile-api/complete', {
      method: 'POST',
      body: data
    });

    if (error) throw error;
    return result;
  }

  async resetPasswordForEmail(email: string) {
    assertAuthEmailSafety();

    const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    if (error) throw error;
    return data;
  }

  async verifyOtp(email: string, token: string) {
    assertAuthEmailSafety();

    const { data, error } = await supabase.auth.verifyOtp({
      email,
      token,
      type: 'recovery',
    });

    if (error) throw error;
    return data;
  }

  async updatePassword(password: string) {
    assertAuthEmailSafety();

    const { data, error } = await supabase.auth.updateUser({
      password: password
    });
    if (error) throw error;
    return data;
  }

  async forceUpdatePassword(currentPassword: string, newPassword: string) {
    const { data, error } = await invokeEdgeRoute<{ ok: boolean }>('auth-api/password', {
      method: 'PUT',
      body: { currentPassword, newPassword },
    });

    if (error) throw error;
    if (!data?.ok) throw new Error('Falha ao atualizar senha');
    return data;
  }

  async resendConfirmationEmail(email: string) {
    assertAuthEmailSafety();

    const { data, error } = await supabase.auth.resend({
      type: 'signup',
      email: email,
      options: {
        emailRedirectTo: window.location.origin
      }
    });
    if (error) throw error;
    return data;
  }

  onAuthStateChange(callback: (user: User | null, event?: string) => void) {
    return supabase.auth.onAuthStateChange((event, session) => {
      callback(session?.user ?? null, event);
    });
  }
}

export const authService = new AuthService();
