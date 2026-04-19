import type { Profile } from './auth.service';
import { invokeEdgeFunction, invokeEdgeRoute } from './apiClient';

export interface UserWithStats extends Profile {
  total_events: number;
  total_spent: number;
}

export interface OrganizerOption {
  id: string;
  full_name: string;
  email: string;
}

export interface CreateUserData {
  email: string;
  password: string;
  full_name: string;
  roles?: string[];
  role?: 'admin' | 'user';
  account_type?: 'comprador' | 'organizador' | 'comprador_organizador';
  organizer_status?: 'NONE' | 'PENDING' | 'APPROVED' | 'REJECTED';
}

export interface UpdateUserData {
  full_name?: string;
  bio?: string;
  city?: string;
  avatar_url?: string;
  roles?: string[];
  role?: 'admin' | 'user';
  account_type?: 'comprador' | 'organizador' | 'comprador_organizador';
  organizer_status?: 'NONE' | 'PENDING' | 'APPROVED' | 'REJECTED';
  single_mode?: boolean;
  match_enabled?: boolean;
  show_initials_only?: boolean;
  match_intention?: 'paquera' | 'amizade' | 'networking' | 'casual' | 'serio' | null;
  match_gender_preference?: string[] | null;
  gender_identity?: string | null;
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
    const { data, error } = await invokeEdgeRoute<{ users: Profile[] }>('admin-api/users', {
      method: 'GET',
    });

    if (error) throw error;
    return data?.users || [];
  }

  // Listar usuarios com estatisticas
  async getUsersWithStats(): Promise<UserWithStats[]> {
    const { data, error } = await invokeEdgeRoute<{ users: UserWithStats[] }>('admin-api/users/with-stats', {
      method: 'GET',
    });

    if (error) throw error;
    return data?.users || [];
  }

  // Buscar usuario por ID
  async getUserById(userId: string): Promise<Profile> {
    const { data, error } = await invokeEdgeRoute<{ user: Profile | null }>(`admin-api/users/${userId}`, {
      method: 'GET',
    });

    if (error) throw error;
    if (!data?.user) throw new Error('Usuário não encontrado');
    return data.user;
  }

  // Buscar usuario por username (slug)
  async getUserByUsername(username: string): Promise<Profile | null> {
    const { data, error } = await invokeEdgeRoute<{ user: Profile | null }>(`admin-api/users/by-username/${encodeURIComponent(username)}`, {
      method: 'GET',
    });

    if (error) throw error;
    return data?.user ?? null;
  }

  // Listar organizadores pendentes
  async getPendingOrganizers(): Promise<Profile[]> {
    const { data, error } = await invokeEdgeRoute<{ users: Profile[] }>('admin-api/users/pending-organizers', {
      method: 'GET',
    });

    if (error) throw error;
    return data?.users || [];
  }

  // Atualizar status do organizador
  async updateOrganizerStatus(userId: string, status: 'APPROVED' | 'REJECTED'): Promise<void> {
    const { error } = await invokeEdgeRoute(`admin-api/users/${userId}/organizer-status`, {
      method: 'PUT',
      body: { status },
    });

    if (error) throw error;
  }

  // Solicitar acesso de organizador
  async requestOrganizerAccess(userId: string): Promise<void> {
    const { error } = await invokeEdgeRoute(`admin-api/users/${userId}/request-organizer-access`, {
      method: 'POST',
    });

    if (error) throw error;
  }

  // Criar novo usuario (requer permissao admin)
  async createUser(userData: CreateUserData): Promise<{ user: any; profile: Profile }> {
    const { data, error } = await invokeEdgeRoute<{ user: any; profile: Profile }>('admin-api/users', {
      method: 'POST',
      body: { userData },
    });

    if (error) throw error;
    if (!data?.user || !data?.profile) throw new Error('Falha ao criar usuário');
    return data;
  }

  // Atualizar usuario
  async updateUser(userId: string, updates: UpdateUserData): Promise<Profile> {
    const { data, error } = await invokeEdgeRoute<{ user: Profile }>(`admin-api/users/${userId}`, {
      method: 'PUT',
      body: { updates },
    });

    if (error) throw error;
    if (!data?.user) throw new Error('Falha ao atualizar usuário');
    return data.user;
  }

  async updateUserPasswordAsAdmin(userId: string, newPassword: string): Promise<void> {
    const { data, error } = await invokeEdgeRoute<{ ok: boolean }>(`admin-api/users/${userId}/password`, {
      method: 'PUT',
      body: { newPassword },
    });

    if (error) throw error;
    if (!data?.ok) {
      throw new Error('Falha ao atualizar senha do usuário');
    }
  }
  async getOrganizerOptions(): Promise<OrganizerOption[]> {
    const { data, error } = await invokeEdgeRoute<{ organizers: OrganizerOption[] }>('admin-api/users/organizer-options', {
      method: 'GET',
    });

    if (error) throw error;
    return data?.organizers || [];
  }

  async getTeamOrganizerForUser(userId: string): Promise<string | null> {
    const { data, error } = await invokeEdgeRoute<{ organizerId: string | null }>(`admin-api/users/${userId}/team-organizer`, {
      method: 'GET',
    });

    if (error) throw error;
    return data?.organizerId || null;
  }

  async upsertTeamMemberLink(userId: string, organizerId: string): Promise<void> {
    const { error } = await invokeEdgeRoute(`admin-api/users/${userId}/team-organizer`, {
      method: 'PUT',
      body: { organizerId },
    });

    if (error) throw error;
  }

  async removeTeamMemberLink(userId: string): Promise<void> {
    const { error } = await invokeEdgeRoute(`admin-api/users/${userId}/team-organizer`, {
      method: 'DELETE',
    });

    if (error) throw error;
  }
  // Deletar usuario
  async deleteUser(userId: string): Promise<void> {
    const { data, error } = await invokeEdgeRoute<{ ok: boolean }>(`admin-api/users/${userId}`, {
      method: 'DELETE',
    });

    if (error) throw error;
    if (!data?.ok) {
      throw new Error('Falha ao excluir usuário');
    }
  }

  // Obter estatisticas gerais
  async getStatistics() {
    const { data, error } = await invokeEdgeRoute('admin-api/users/statistics', {
      method: 'GET',
    });

    if (error) throw error;
    return data as any;
  }
}

export const userService = new UserService();
