import { invokeEdgeFunction } from '@/services/apiClient';

export interface TeamMember {
  id: string;
  organizer_id: string;
  user_id: string;
  created_at: string;
  full_name: string | null;
  email: string | null;
  roles: string[];
}

interface TeamResponse {
  ok: boolean;
  error?: string;
  members?: TeamMember[];
  member?: TeamMember;
}

class TeamService {
  async listMembers(): Promise<TeamMember[]> {
    const { data, error } = await invokeEdgeFunction<TeamResponse>('organizer-manage-team', {
      method: 'POST',
      body: { action: 'list' },
      requiresAuth: true,
    });

    if (error) throw error;
    if (!data?.ok) throw new Error(data?.error || 'Erro ao listar equipe');
    return data.members || [];
  }

  async createMember(payload: { fullName: string; email: string; password: string }): Promise<TeamMember> {
    const { data, error } = await invokeEdgeFunction<TeamResponse>('organizer-manage-team', {
      method: 'POST',
      body: {
        action: 'create',
        fullName: payload.fullName,
        email: payload.email,
        password: payload.password,
      },
      requiresAuth: true,
    });

    if (error) throw error;
    if (!data?.ok || !data.member) throw new Error(data?.error || 'Erro ao criar membro');
    return data.member;
  }

  async removeMember(memberUserId: string): Promise<void> {
    const { data, error } = await invokeEdgeFunction<TeamResponse>('organizer-manage-team', {
      method: 'POST',
      body: { action: 'remove', memberUserId },
      requiresAuth: true,
    });

    if (error) throw error;
    if (!data?.ok) throw new Error(data?.error || 'Erro ao remover membro');
  }
}

export const teamService = new TeamService();
