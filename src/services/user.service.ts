import type { Profile } from './auth.service';
import { invokeEdgeFunction } from './apiClient';

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
    const { data, error } = await invokeEdgeFunction<{ users: Profile[] }>('events-api', {
      body: { op: 'adminUsers.list' },
    });

    if (error) throw error;
    return data?.users || [];
  }

  // Listar usuarios com estatisticas
  async getUsersWithStats(): Promise<UserWithStats[]> {
    const { data, error } = await invokeEdgeFunction<{ users: UserWithStats[] }>('events-api', {
      body: { op: 'adminUsers.listWithStats' },
    });

    if (error) throw error;
    return data?.users || [];
  }

  // Buscar usuario por ID
  async getUserById(userId: string): Promise<Profile> {
    const { data, error } = await invokeEdgeFunction<{ user: Profile | null }>('events-api', {
      body: { op: 'adminUsers.getById', params: { userId } },
    });

    if (error) throw error;
    if (!data?.user) throw new Error('Usuário não encontrado');
    return data.user;
  }

  // Buscar usuario por username (slug)
  async getUserByUsername(username: string): Promise<Profile | null> {
    const { data, error } = await invokeEdgeFunction<{ user: Profile | null }>('events-api', {
      body: { op: 'adminUsers.getByUsername', params: { username } },
    });

    if (error) throw error;
    return data?.user ?? null;
  }

  // Listar organizadores pendentes
  async getPendingOrganizers(): Promise<Profile[]> {
    const { data, error } = await invokeEdgeFunction<{ users: Profile[] }>('events-api', {
      body: { op: 'adminUsers.pendingOrganizers' },
    });

    if (error) throw error;
    return data?.users || [];
  }

  // Atualizar status do organizador
  async updateOrganizerStatus(userId: string, status: 'APPROVED' | 'REJECTED'): Promise<void> {
    const { error } = await invokeEdgeFunction('events-api', {
      body: { op: 'adminUsers.updateOrganizerStatus', params: { userId, status } },
    });

    if (error) throw error;
  }

  // Solicitar acesso de organizador
  async requestOrganizerAccess(userId: string): Promise<void> {
    const { error } = await invokeEdgeFunction('events-api', {
      body: { op: 'adminUsers.requestOrganizerAccess', params: { userId } },
    });

    if (error) throw error;
  }

  // Criar novo usuario (requer permissao admin)
  async createUser(userData: CreateUserData): Promise<{ user: any; profile: Profile }> {
    const { data, error } = await invokeEdgeFunction<{ user: any; profile: Profile }>('events-api', {
      body: { op: 'adminUsers.create', params: { userData } },
    });

    if (error) throw error;
    if (!data?.user || !data?.profile) throw new Error('Falha ao criar usuário');
    return data;
  }

  // Atualizar usuario
  async updateUser(userId: string, updates: UpdateUserData): Promise<Profile> {
    const { data, error } = await invokeEdgeFunction<{ user: Profile }>('events-api', {
      body: { op: 'adminUsers.update', params: { userId, updates } },
    });

    if (error) throw error;
    if (!data?.user) throw new Error('Falha ao atualizar usuário');
    return data.user;
  }

  async updateUserPasswordAsAdmin(userId: string, newPassword: string): Promise<void> {
    const { data, error } = await invokeEdgeFunction('admin-update-user-password', {
      body: {
        userId,
        newPassword,
      },
      method: 'POST',
      requiresAuth: true,
    });

    if (error) throw error;
    if ((data as any)?.ok !== true) {
      throw new Error((data as any)?.error || 'Falha ao atualizar senha do usuário');
    }
  }
  async getOrganizerOptions(): Promise<OrganizerOption[]> {
    const { data, error } = await invokeEdgeFunction<{ organizers: OrganizerOption[] }>('events-api', {
      body: { op: 'adminUsers.organizerOptions' },
    });

    if (error) throw error;
    return data?.organizers || [];
  }

  async getTeamOrganizerForUser(userId: string): Promise<string | null> {
    const { data, error } = await invokeEdgeFunction<{ organizerId: string | null }>('events-api', {
      body: { op: 'adminUsers.team.getOrganizerForUser', params: { userId } },
    });

    if (error) throw error;
    return data?.organizerId || null;
  }

  async upsertTeamMemberLink(userId: string, organizerId: string): Promise<void> {
    const { error } = await invokeEdgeFunction('events-api', {
      body: { op: 'adminUsers.team.upsertLink', params: { userId, organizerId } },
    });

    if (error) throw error;
  }

  async removeTeamMemberLink(userId: string): Promise<void> {
    const { error } = await invokeEdgeFunction('events-api', {
      body: { op: 'adminUsers.team.removeLink', params: { userId } },
    });

    if (error) throw error;
  }
  // Deletar usuario
  async deleteUser(userId: string): Promise<void> {
    const { data, error } = await invokeEdgeFunction('admin-delete-user', {
      body: { userId },
      method: 'POST',
      requiresAuth: true,
    });

    if (error) throw error;
    if ((data as any)?.ok !== true) {
      throw new Error((data as any)?.error || 'Falha ao excluir usuário');
    }
  }

  // Obter estatisticas gerais
  async getStatistics() {
    const { data, error } = await invokeEdgeFunction('events-api', {
      body: { op: 'adminUsers.statistics' },
    });

    if (error) throw error;
    return data as any;
  }
}

export const userService = new UserService();
