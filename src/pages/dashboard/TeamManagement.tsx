import React, { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { teamService, type TeamMember } from '@/services/team.service';
import { useToast } from '@/components/ui/use-toast';
import { Loader2, Trash2, Users } from 'lucide-react';

const MAX_MEMBERS = 2;

export default function TeamManagement() {
  const { toast } = useToast();

  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [removingUserId, setRemovingUserId] = useState<string | null>(null);

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const remaining = useMemo(() => Math.max(0, MAX_MEMBERS - members.length), [members.length]);

  const getFriendlyCreateError = (message: string) => {
    const raw = String(message || '').toLowerCase();

    if (raw.includes('minimo 8') || raw.includes('mínimo 8') || raw.includes('minimum 8')) {
      return 'A senha deve ter no minimo 8 caracteres.';
    }

    if (
      raw.includes('already been registered') ||
      raw.includes('ja e um usuario nosso') ||
      raw.includes('já é um usuário nosso') ||
      raw.includes('email address has already been registered')
    ) {
      return 'Esse e-mail ja e um usuario nosso, portanto nao pode ser habilitado para funcao de equipe nele. Entre em contato com nosso suporte e solicite internamente.';
    }

    if (raw.includes('email confirmation required')) {
      return 'Contas de equipe nao precisam confirmacao de e-mail. Tente novamente.';
    }

    return message || 'Nao foi possivel criar o membro da equipe.';
  };

  const loadMembers = async () => {
    try {
      setLoading(true);
      const data = await teamService.listMembers();
      setMembers(data);
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Erro ao carregar equipe',
        description: error?.message || 'Nao foi possivel listar membros da equipe.',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMembers();
  }, []);

  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!fullName.trim() || !email.trim() || !password) {
      toast({
        variant: 'destructive',
        title: 'Campos obrigatorios',
        description: 'Preencha nome, e-mail e senha.',
      });
      return;
    }

    if (password.length < 8) {
      toast({
        variant: 'destructive',
        title: 'Senha invalida',
        description: 'A senha deve ter no minimo 8 caracteres.',
      });
      return;
    }

    if (members.length >= MAX_MEMBERS) {
      toast({
        variant: 'destructive',
        title: 'Limite atingido',
        description: 'Cada organizador pode criar no maximo 2 membros de equipe.',
      });
      return;
    }

    try {
      setSubmitting(true);
      const created = await teamService.createMember({
        fullName: fullName.trim(),
        email: email.trim(),
        password,
      });

      setMembers((prev) => [created, ...prev]);
      setFullName('');
      setEmail('');
      setPassword('');

      toast({
        title: 'Membro criado',
        description: 'Conta de equipe criada com as roles COMPRADOR e EQUIPE.',
      });
    } catch (error: any) {
      const friendlyError = getFriendlyCreateError(String(error?.message || ''));
      const duplicateEmail = friendlyError.includes('Esse e-mail ja e um usuario nosso');
      toast({
        variant: 'destructive',
        title: duplicateEmail ? 'E-mail indisponivel para equipe' : 'Erro ao criar membro',
        description: friendlyError,
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleRemove = async (memberUserId: string) => {
    try {
      setRemovingUserId(memberUserId);
      await teamService.removeMember(memberUserId);
      setMembers((prev) => prev.filter((member) => member.user_id !== memberUserId));
      toast({
        title: 'Membro removido',
        description: 'A conta operacional foi removida com sucesso.',
      });
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Erro ao remover membro',
        description: error?.message || 'Nao foi possivel remover o membro.',
      });
    } finally {
      setRemovingUserId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Equipe</h1>
        <p className="text-muted-foreground">
          Crie ate {MAX_MEMBERS} contas operacionais para leitura de ingressos no scanner.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Novo membro</CardTitle>
          <CardDescription>
            Restam {remaining} vaga(s) disponiveis para sua equipe.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCreate} className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="team-full-name">Nome</Label>
              <Input
                id="team-full-name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Nome do membro"
                disabled={submitting || members.length >= MAX_MEMBERS}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="team-email">Email</Label>
              <Input
                id="team-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="membro@email.com"
                disabled={submitting || members.length >= MAX_MEMBERS}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="team-password">Senha</Label>
              <Input
                id="team-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Minimo 8 caracteres"
                disabled={submitting || members.length >= MAX_MEMBERS}
              />
            </div>
            <div className="md:col-span-3">
              <Button type="submit" disabled={submitting || members.length >= MAX_MEMBERS}>
                {submitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Criando...
                  </>
                ) : (
                  'Criar membro da equipe'
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Membros cadastrados
          </CardTitle>
          <CardDescription>Contas de equipe vinculadas ao seu organizador.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Carregando membros...
            </div>
          ) : members.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum membro cadastrado.</p>
          ) : (
            <div className="space-y-3">
              {members.map((member) => (
                <div key={member.id} className="rounded-lg border p-3 flex items-center justify-between gap-4">
                  <div>
                    <p className="font-medium text-sm">{member.full_name || 'Sem nome'}</p>
                    <p className="text-xs text-muted-foreground">{member.email || '-'}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Roles: {(member.roles || []).join(', ') || 'BUYER, EQUIPE'}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleRemove(member.user_id)}
                    disabled={removingUserId === member.user_id}
                    className="text-destructive"
                  >
                    {removingUserId === member.user_id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
