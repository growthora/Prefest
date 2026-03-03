import { supabase } from '../lib/supabase';
import type { Profile } from './auth.service';

export interface UserWithStats extends Profile {
  total_events: number;
  total_spent: number;
}

export interface CreateUserData {
  email: string;
  password: string;
  full_name: string;
  roles?: string[];
}

export interface UpdateUserData {
  full_name?: string;
  bio?: string;
  city?: string;
  avatar_url?: string;
  roles?: string[];
  single_mode?: boolean;
  match_enabled?: boolean;
  show_initials_only?: boolean;
  match_intention?: 'paquera' | 'amizade';
  match_gender_preference?: 'homens' | 'mulheres' | 'todos';
  sexuality?: string;
  meet_attendees?: boolean;
  looking_for?: string[];
  height?: number;
  relationship_status?: string;
  allow_profile_view?: boolean;
  privacy_settings?: {
    show_age?: boolean;
    show_height?: boolean;
    show_instagram?: boolean;
    show_relationship?: boolean;
  };
}

class UserService {
  // Listar todos os usuarios
  async getAllUsers(): Promise<Profile[]> {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  }

  // Listar usuarios com estatisticas
  async getUsersWithStats(): Promise<UserWithStats[]> {
    const { data, error } = await supabase
      .from('profiles')
      .select(`
        *,
        event_participants!event_participants_user_id_fkey (
          total_paid
        )
      `)
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    // Calcular estatisticas
    return (data || []).map((user: any) => {
      const participants = user.event_participants || [];
      return {
        ...user,
        total_events: participants.length,
        total_spent: participants.reduce((sum: number, p: any) => sum + (p.total_paid || 0), 0),
      };
    });
  }

  // Buscar usuario por ID
  async getUserById(userId: string): Promise<Profile> {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) throw error;
    return data;
  }

  // Buscar usuario por username (slug)
  async getUserByUsername(username: string): Promise<Profile | null> {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('username', username)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null; // Not found
      throw error;
    }
    return data;
  }

  // Listar organizadores pendentes
  async getPendingOrganizers(): Promise<Profile[]> {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('organizer_status', 'PENDING')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  }

  // Atualizar status do organizador
  async updateOrganizerStatus(userId: string, status: 'APPROVED' | 'REJECTED'): Promise<void> {
    const { error } = await supabase
      .from('profiles')
      .update({ organizer_status: status })
      .eq('id', userId);

    if (error) throw error;
  }

  // Solicitar acesso de organizador
  async requestOrganizerAccess(userId: string): Promise<void> {
    const user = await this.getUserById(userId);
    const currentRoles = user.roles || ['BUYER'];
    
    // Adicionar ORGANIZER se nao existir
    const newRoles = currentRoles.includes('ORGANIZER') 
      ? currentRoles 
      : [...currentRoles, 'ORGANIZER'];

    const { error } = await supabase
      .from('profiles')
      .update({ 
        roles: newRoles,
        organizer_status: 'PENDING'
      })
      .eq('id', userId);

    if (error) throw error;
  }

  // Criar novo usuario (requer permissao admin)
  async createUser(userData: CreateUserData): Promise<{ user: any; profile: Profile }> {
    // Criar usuario no auth
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: userData.email,
      password: userData.password,
      options: {
        data: {
          full_name: userData.full_name,
        },
      },
    });

    if (authError) throw authError;

    // Aguardar criacao do perfil via trigger
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Atualizar roles se necessario
    if (userData.roles && userData.roles.length > 0 && authData.user) {
      const { data: profile, error: updateError } = await supabase
        .from('profiles')
        .update({ roles: userData.roles })
        .eq('id', authData.user.id)
        .select()
        .single();

      if (updateError) throw updateError;
      return { user: authData.user, profile };
    }

    const profile = await this.getUserById(authData.user!.id);
    return { user: authData.user, profile };
  }

  // Atualizar usuario
  async updateUser(userId: string, updates: UpdateUserData): Promise<Profile> {
    const { data, error } = await supabase
      .from('profiles')
      .update(updates as any)
      .eq('id', userId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  // Deletar usuario
  async deleteUser(userId: string): Promise<void> {
    const { error } = await supabase
      .from('profiles')
      .delete()
      .eq('id', userId);

    if (error) throw error;
  }

  // Obter estatisticas gerais
  async getStatistics() {
    const { count: totalUsers, error: usersError } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true });

    if (usersError) {
      // Silently ignore error
    }

    const { count: totalEvents, error: eventsError } = await supabase
      .from('events')
      .select('*', { count: 'exact', head: true });

    if (eventsError) {
      // Silently ignore error
    }

    const { data: revenue, error: revenueError } = await supabase
      .from('event_participants')
      .select('total_paid, event_id, joined_at, status, events(title, price)')
      .in('status', ['valid', 'used']);

    if (revenueError) {
      // Silently ignore error
    }

    const totalRevenue = (revenue || []).reduce((sum: number, item: any) => sum + (item.total_paid || 0), 0);

    const now = new Date();
    const startCurrentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startNextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const startPreviousMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

    const currentMonthRevenue = (revenue || []).reduce((sum: number, item: any) => {
      const joinedAt = item.joined_at ? new Date(item.joined_at) : null;
      if (joinedAt && joinedAt >= startCurrentMonth && joinedAt < startNextMonth) {
        return sum + (item.total_paid || 0);
      }
      return sum;
    }, 0);

    const previousMonthRevenue = (revenue || []).reduce((sum: number, item: any) => {
      const joinedAt = item.joined_at ? new Date(item.joined_at) : null;
      if (joinedAt && joinedAt >= startPreviousMonth && joinedAt < startCurrentMonth) {
        return sum + (item.total_paid || 0);
      }
      return sum;
    }, 0);

    const revenueByEvent = (revenue || []).reduce((acc: any, item: any) => {
      const eventId = item.event_id;
      if (!acc[eventId]) {
        acc[eventId] = {
          event_id: eventId,
          event_title: item.events?.title || 'Sem titulo',
          event_price: item.events?.price || 0,
          revenue: 0,
          tickets_sold: 0,
        };
      }
      acc[eventId].revenue += item.total_paid || 0;
      acc[eventId].tickets_sold += 1;
      return acc;
    }, {});

    const eventStats = Object.values(revenueByEvent);

    const { data: profilesCreated, error: profilesCreatedError } = await supabase
      .from('profiles')
      .select('created_at');

    if (profilesCreatedError) {
      // Silently ignore error
    }

    const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStartsOnMonday = (date: Date) => {
      const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
      const day = d.getDay();
      const diff = day === 0 ? -6 : 1 - day;
      d.setDate(d.getDate() + diff);
      return d;
    };

    const startCurrentWeek = weekStartsOnMonday(dayStart);
    const startNextWeek = new Date(startCurrentWeek);
    startNextWeek.setDate(startCurrentWeek.getDate() + 7);
    const startPreviousWeek = new Date(startCurrentWeek);
    startPreviousWeek.setDate(startCurrentWeek.getDate() - 7);

    const currentWeekNewUsers = (profilesCreated || []).reduce((sum: number, profile: any) => {
      const createdAt = profile.created_at ? new Date(profile.created_at) : null;
      if (createdAt && createdAt >= startCurrentWeek && createdAt < startNextWeek) {
        return sum + 1;
      }
      return sum;
    }, 0);

    const previousWeekNewUsers = (profilesCreated || []).reduce((sum: number, profile: any) => {
      const createdAt = profile.created_at ? new Date(profile.created_at) : null;
      if (createdAt && createdAt >= startPreviousWeek && createdAt < startCurrentWeek) {
        return sum + 1;
      }
      return sum;
    }, 0);

    const estimatedCosts = totalRevenue * 0.3;
    const profit = totalRevenue - estimatedCosts;
    const profitMargin = totalRevenue > 0 ? (profit / totalRevenue) * 100 : 0;

    const stats = {
      totalUsers: totalUsers || 0,
      totalEvents: totalEvents || 0,
      totalRevenue,
      estimatedCosts,
      profit,
      profitMargin,
      eventStats,
      comparison: {
        currentMonthRevenue,
        previousMonthRevenue,
        currentWeekNewUsers,
        previousWeekNewUsers,
      },
    };

    return stats;
  }
}

export const userService = new UserService();

