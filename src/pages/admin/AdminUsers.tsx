import { useState, useEffect } from 'react';
import { userService, type UserWithStats, type CreateUserData, type UpdateUserData, type OrganizerOption } from '@/services/user.service';
import { type Profile } from '@/services/auth.service';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { useConfirm } from '@/contexts/ConfirmContext';
import { Users, Pencil, Trash2, Plus, Search, Calendar, DollarSign, UserPlus } from 'lucide-react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { toUserFriendlyErrorMessage } from '@/lib/appErrors';

export default function AdminUsers() {
  const { isAdmin } = useAuth();
  const [users, setUsers] = useState<UserWithStats[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const { confirm } = useConfirm();
  
  const [isCreateUserDialogOpen, setIsCreateUserDialogOpen] = useState(false);
  const [isEditUserDialogOpen, setIsEditUserDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<Profile | null>(null);
  
  const [newUser, setNewUser] = useState<CreateUserData & {
    role: 'user' | 'admin';
    account_type: 'comprador' | 'organizador' | 'comprador_organizador';
    is_team_member: boolean;
    team_organizer_id: string;
  }>({
    email: '',
    password: '',
    full_name: '',
    role: 'user',
    account_type: 'comprador',
    is_team_member: false,
    team_organizer_id: '',
  });

  const [userUpdate, setUserUpdate] = useState<UpdateUserData & {
    role?: 'user' | 'admin';
    account_type?: 'comprador' | 'organizador' | 'comprador_organizador';
    is_team_member?: boolean;
    team_organizer_id?: string;
    new_password?: string;
    confirm_password?: string;
  }>({});

  const [organizerOptions, setOrganizerOptions] = useState<OrganizerOption[]>([]);

  useEffect(() => {
    void loadUsers();
    void loadOrganizerOptions();
  }, []);

  const loadUsers = async () => {
    try {
      setIsLoading(true);
      const data = await userService.getUsersWithStats();
      setUsers(data);
    } catch (error) {
      toast.error('Erro ao carregar usuários');
    } finally {
      setIsLoading(false);
    }
  };

  const loadOrganizerOptions = async () => {
    try {
      const options = await userService.getOrganizerOptions();
      setOrganizerOptions(options);
    } catch {
      toast.error('Erro ao carregar organizadores');
    }
  };

  const getRolesFromPermissionAndAccountType = (
    role: 'user' | 'admin',
    accountType: 'comprador' | 'organizador' | 'comprador_organizador',
    isTeamMember = false
  ): string[] => {
    const result: string[] = [];
    if (accountType === 'comprador' || accountType === 'comprador_organizador') result.push('BUYER');
    if (accountType === 'organizador' || accountType === 'comprador_organizador') result.push('ORGANIZER');
    if (isTeamMember) {
      result.push('EQUIPE');
      if (!result.includes('BUYER')) result.push('BUYER');
    }
    if (role === 'admin') result.push('ADMIN');
    return [...new Set(result)];
  };

  const getOrganizerStatusFromAccountType = (
    accountType: 'comprador' | 'organizador' | 'comprador_organizador'
  ): 'NONE' | 'APPROVED' => {
    if (accountType === 'organizador' || accountType === 'comprador_organizador') {
      return 'APPROVED';
    }
    return 'NONE';
  };

  const getRoleFromUser = (user: Profile): 'user' | 'admin' => {
    const upperRoles = (user.roles || []).map(r => r.toUpperCase());
    if (upperRoles.includes('ADMIN') || user.role === 'admin') return 'admin';
    return 'user';
  };

  const getAccountTypeFromUser = (user: Profile): 'comprador' | 'organizador' | 'comprador_organizador' => {
    if (user.account_type && ['comprador', 'organizador', 'comprador_organizador'].includes(user.account_type)) {
      return user.account_type as 'comprador' | 'organizador' | 'comprador_organizador';
    }
    const upperRoles = (user.roles || []).map(r => r.toUpperCase());
    const hasBuyer = upperRoles.includes('BUYER');
    const hasOrganizer = upperRoles.includes('ORGANIZER');
    if (hasBuyer && hasOrganizer) return 'comprador_organizador';
    if (hasOrganizer) return 'organizador';
    return 'comprador';
  };

  const isTeamMemberFromUser = (user: Profile): boolean => {
    const upperRoles = (user.roles || []).map(r => r.toUpperCase());
    return upperRoles.includes('EQUIPE');
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      setIsLoading(true);
      if (newUser.password.length < 8) {
        throw new Error('A senha deve ter no mínimo 8 caracteres.');
      }
      if (newUser.is_team_member && !newUser.team_organizer_id) {
        throw new Error('Selecione o organizador responsável para usuário de equipe.');
      }

      const created = await userService.createUser({
        email: newUser.email,
        password: newUser.password,
        full_name: newUser.full_name,
        role: newUser.role,
        account_type: newUser.account_type,
        roles: getRolesFromPermissionAndAccountType(newUser.role, newUser.account_type, newUser.is_team_member),
        organizer_status: getOrganizerStatusFromAccountType(newUser.account_type),
      });

      if (newUser.is_team_member && newUser.team_organizer_id) {
        await userService.upsertTeamMemberLink(created.profile.id, newUser.team_organizer_id);
      }

      toast.success('Usuário criado com sucesso!');
      setIsCreateUserDialogOpen(false);
      setNewUser({
        email: '',
        password: '',
        full_name: '',
        role: 'user',
        account_type: 'comprador',
        is_team_member: false,
        team_organizer_id: '',
      });
      await loadUsers();
    } catch (err) {
      toast.error(toUserFriendlyErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;

    try {
      setIsLoading(true);

      const resolvedRole = userUpdate.role || getRoleFromUser(editingUser);
      const resolvedAccountType = userUpdate.account_type || getAccountTypeFromUser(editingUser);
      const isTeamMember = Boolean(userUpdate.is_team_member);

      if (isTeamMember && !userUpdate.team_organizer_id) {
        throw new Error('Selecione o organizador responsável para usuário de equipe.');
      }

      const updateData: UpdateUserData = {
        full_name: userUpdate.full_name,
        bio: userUpdate.bio,
        avatar_url: userUpdate.avatar_url,
        single_mode: userUpdate.single_mode,
        role: resolvedRole,
        account_type: resolvedAccountType,
        roles: getRolesFromPermissionAndAccountType(resolvedRole, resolvedAccountType, isTeamMember),
        organizer_status: getOrganizerStatusFromAccountType(resolvedAccountType),
      };

      if (userUpdate.new_password || userUpdate.confirm_password) {
        if (!userUpdate.new_password || !userUpdate.confirm_password) {
          throw new Error('Preencha nova senha e confirmação.');
        }
        if (userUpdate.new_password.length < 8) {
          throw new Error('A nova senha deve ter no mínimo 8 caracteres.');
        }
        if (userUpdate.new_password !== userUpdate.confirm_password) {
          throw new Error('A confirmação da senha não confere.');
        }
      }

      await userService.updateUser(editingUser.id, updateData);

      if (isTeamMember && userUpdate.team_organizer_id) {
        await userService.upsertTeamMemberLink(editingUser.id, userUpdate.team_organizer_id);
      } else {
        await userService.removeTeamMemberLink(editingUser.id);
      }

      if (userUpdate.new_password) {
        await userService.updateUserPasswordAsAdmin(editingUser.id, userUpdate.new_password);
      }
      toast.success('Usuário atualizado! Se estiver logado, peça para relogar para aplicar as permissões.');
      setIsEditUserDialogOpen(false);
      setEditingUser(null);
      setUserUpdate({});
      await loadUsers();
    } catch (err) {
      toast.error(toUserFriendlyErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!await confirm({
      title: 'Deletar Usuário',
      description: 'Tem certeza que deseja deletar este usuário? Esta ação não pode ser desfeita.',
      variant: 'destructive',
      confirmText: 'Deletar',
    })) return;

    try {
      setIsLoading(true);
      await userService.deleteUser(userId);
      toast.success('Usuário deletado com sucesso!');
      await loadUsers();
    } catch (err) {
      toast.error(toUserFriendlyErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  };

  const openEditUserDialog = async (user: Profile) => {
    setEditingUser(user);

    const teamByRole = isTeamMemberFromUser(user);
    setUserUpdate({
      full_name: user.full_name || '',
      bio: user.bio || '',
      avatar_url: user.avatar_url || '',
      role: getRoleFromUser(user),
      account_type: getAccountTypeFromUser(user),
      is_team_member: teamByRole,
      team_organizer_id: '',
      single_mode: user.single_mode,
      show_initials_only: user.show_initials_only,
      new_password: '',
      confirm_password: '',
    });

    try {
      const organizerId = await userService.getTeamOrganizerForUser(user.id);
      if (organizerId) {
        setUserUpdate((prev) => ({
          ...prev,
          is_team_member: true,
          team_organizer_id: organizerId,
        }));
      }
    } catch {
      toast.error('Erro ao carregar vínculo de equipe');
    }

    setIsEditUserDialogOpen(true);
  };

  const filteredUsers = users.filter(user => 
    (user.full_name?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
    (user.email?.toLowerCase() || '').includes(searchTerm.toLowerCase())
  );

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1,
      transition: {
        type: "spring",
        stiffness: 100
      }
    }
  };

  if (!isAdmin) {
    return (
      <div className="p-6">
        <Card>
          <CardHeader>
            <CardTitle>Acesso negado</CardTitle>
            <CardDescription>Somente administradores podem gerenciar usuários.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <motion.div 
      className="space-y-8 pb-8"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-primary to-purple-600 bg-clip-text text-transparent">
            Usuários
          </h1>
          <p className="text-muted-foreground mt-1">
            Gerencie todos os usuários do sistema
          </p>
        </div>
        <Dialog open={isCreateUserDialogOpen} onOpenChange={setIsCreateUserDialogOpen}>
          <DialogTrigger asChild>
            <Button className="w-full md:w-auto bg-primary hover:bg-primary/90 shadow-lg hover:shadow-primary/20 transition-all duration-300">
              <Plus className="w-4 h-4 mr-2" />
              Adicionar Usuário
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Criar Novo Usuário</DialogTitle>
              <DialogDescription>Preencha os dados do novo usuário para criar uma conta.</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreateUser} className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label htmlFor="new-user-email">Email *</Label>
                <div className="relative">
                  <Input
                    id="new-user-email"
                    type="email"
                    value={newUser.email}
                    onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                    required
                    className="pl-9"
                    placeholder="email@exemplo.com"
                  />
                  <Users className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-user-password">Senha *</Label>
                <Input
                  id="new-user-password"
                  type="password"
                  value={newUser.password}
                  onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                  required
                  minLength={8}
                  placeholder="******"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-user-name">Nome Completo *</Label>
                <Input
                  id="new-user-name"
                  value={newUser.full_name}
                  onChange={(e) => setNewUser({ ...newUser, full_name: e.target.value })}
                  required
                  placeholder="Nome e Sobrenome"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-user-role">Permissão</Label>
                <Select
                  value={newUser.role}
                  onValueChange={(value: 'user' | 'admin') =>
                    setNewUser({ ...newUser, role: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="user">Usuário</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-user-account-type">Tipo de Conta</Label>
                <Select
                  value={newUser.account_type}
                  onValueChange={(value: 'comprador' | 'organizador' | 'comprador_organizador') =>
                    setNewUser({ ...newUser, account_type: value })
                  }
                >
                  <SelectTrigger id="new-user-account-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="comprador">Comprador</SelectItem>
                    <SelectItem value="organizador">Organizador</SelectItem>
                    <SelectItem value="comprador_organizador">Comprador e Organizador</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-user-team-member">Membro de Equipe</Label>
                <Select
                  value={newUser.is_team_member ? 'sim' : 'nao'}
                  onValueChange={(value: 'sim' | 'nao') =>
                    setNewUser({
                      ...newUser,
                      is_team_member: value === 'sim',
                      team_organizer_id: value === 'sim' ? newUser.team_organizer_id : '',
                    })
                  }
                >
                  <SelectTrigger id="new-user-team-member">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="nao">Não</SelectItem>
                    <SelectItem value="sim">Sim</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {newUser.is_team_member && (
                <div className="space-y-2">
                  <Label htmlFor="new-user-team-organizer">Organizador Responsável</Label>
                  <Select
                    value={newUser.team_organizer_id}
                    onValueChange={(value) => setNewUser({ ...newUser, team_organizer_id: value })}
                  >
                    <SelectTrigger id="new-user-team-organizer">
                      <SelectValue placeholder="Selecione um organizador" />
                    </SelectTrigger>
                    <SelectContent>
                      {organizerOptions.map((organizer) => (
                        <SelectItem key={organizer.id} value={organizer.id}>
                          {organizer.full_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <DialogFooter>
                <Button type="submit" disabled={isLoading} className="w-full">
                  {isLoading ? 'Criando...' : 'Criar Usuário'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <motion.div variants={itemVariants}>
          <Card className="hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total de Usuários</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{users.length}</div>
            </CardContent>
          </Card>
        </motion.div>
        <motion.div variants={itemVariants}>
          <Card className="hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Novos este Mês</CardTitle>
              <UserPlus className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {users.filter(u => {
                  const date = new Date(u.created_at || '');
                  const now = new Date();
                  return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
                }).length}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar usuários por nome ou email..."
          className="pl-9 h-12 text-lg"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        <AnimatePresence>
          {filteredUsers.map((user) => (
            <motion.div
              key={user.id}
              variants={itemVariants}
              layout
              initial="hidden"
              animate="visible"
              exit={{ opacity: 0, scale: 0.9 }}
              whileHover={{ y: -5, transition: { duration: 0.2 } }}
            >
              <Card className="h-full overflow-hidden hover:shadow-xl transition-all duration-300 border-l-4 border-l-primary/20 hover:border-l-primary">
                <CardHeader className="pb-2 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    {(() => {
                      const role = getRoleFromUser(user);
                      const accountType = getAccountTypeFromUser(user);
                      return (
                        <div className="flex min-w-0 flex-1 flex-wrap gap-2">
                          <Badge variant={role === 'admin' ? 'default' : 'outline'} className="max-w-full whitespace-normal text-center leading-tight">
                            {role === 'admin' ? 'Administrador' : 'Usuário'}
                          </Badge>
                          <Badge variant="secondary" className="max-w-full whitespace-normal text-center leading-tight">
                            {accountType === 'comprador'
                              ? 'Comprador'
                              : accountType === 'organizador'
                              ? 'Organizador'
                              : 'Comprador e Organizador'}
                          </Badge>
                          {isTeamMemberFromUser(user) && (
                            <Badge variant="outline" className="max-w-full whitespace-normal text-center leading-tight">Equipe</Badge>
                          )}
                        </div>
                      );
                    })()}
                    <div className="flex shrink-0 gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-primary"
                        onClick={() => { void openEditUserDialog(user); }}
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        onClick={() => handleDeleteUser(user.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-1 min-w-0">
                  <CardTitle className="text-lg leading-tight break-words" title={user.full_name || ''}>
                    {user.full_name || 'Sem nome'}
                  </CardTitle>
                  <CardDescription className="break-all leading-snug" title={user.email}>
                    {user.email}
                  </CardDescription>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-3 mt-2">
                    <div className="flex min-w-0 flex-col items-center p-3 bg-muted/30 rounded-lg text-center">
                      <span className="text-xs text-muted-foreground">Eventos</span>
                      <span className="font-bold flex items-center gap-1 text-lg leading-none">
                        <Calendar className="w-3 h-3" />
                        {user.total_events || 0}
                      </span>
                    </div>
                    <div className="flex min-w-0 flex-col items-center p-3 bg-muted/30 rounded-lg text-center">
                      <span className="text-xs text-muted-foreground">Gastos</span>
                      <span className="font-bold flex items-center gap-1 text-lg leading-none whitespace-nowrap">
                        <DollarSign className="w-3 h-3" />
                        R$ {user.total_spent?.toFixed(0) || '0'}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {filteredUsers.length === 0 && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center py-12"
        >
          <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
            <Users className="w-8 h-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold text-foreground">Nenhum usuário encontrado</h3>
          <p className="text-muted-foreground">
            Tente buscar por outro termo ou adicione um novo usuário.
          </p>
        </motion.div>
      )}

      {/* Edit User Dialog */}
      <Dialog open={isEditUserDialogOpen} onOpenChange={setIsEditUserDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Usuário</DialogTitle>
            <DialogDescription>Atualize os dados do usuário</DialogDescription>
          </DialogHeader>
          {editingUser && (
            <form onSubmit={handleUpdateUser} className="space-y-4">
              <div className="space-y-2">
                <Label>Email (não editável)</Label>
                <Input value={editingUser.email} disabled />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-user-name">Nome Completo</Label>
                <Input
                  id="edit-user-name"
                  value={userUpdate.full_name || ''}
                  onChange={(e) => setUserUpdate({ ...userUpdate, full_name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-user-bio">Bio</Label>
                <Textarea
                  id="edit-user-bio"
                  value={userUpdate.bio || ''}
                  onChange={(e) => setUserUpdate({ ...userUpdate, bio: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-user-role">Permissão</Label>
                <Select
                  value={userUpdate.role}
                  onValueChange={(value: 'user' | 'admin') =>
                    setUserUpdate({ ...userUpdate, role: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="user">Usuário</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-user-account-type">Tipo de Conta</Label>
                <Select
                  value={userUpdate.account_type}
                  onValueChange={(value: 'comprador' | 'organizador' | 'comprador_organizador') =>
                    setUserUpdate({ ...userUpdate, account_type: value })
                  }
                >
                  <SelectTrigger id="edit-user-account-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="comprador">Comprador</SelectItem>
                    <SelectItem value="organizador">Organizador</SelectItem>
                    <SelectItem value="comprador_organizador">Comprador e Organizador</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-user-team-member">Membro de Equipe</Label>
                <Select
                  value={userUpdate.is_team_member ? 'sim' : 'nao'}
                  onValueChange={(value: 'sim' | 'nao') =>
                    setUserUpdate({
                      ...userUpdate,
                      is_team_member: value === 'sim',
                      team_organizer_id: value === 'sim' ? (userUpdate.team_organizer_id || '') : '',
                    })
                  }
                >
                  <SelectTrigger id="edit-user-team-member">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="nao">Não</SelectItem>
                    <SelectItem value="sim">Sim</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {userUpdate.is_team_member && (
                <div className="space-y-2">
                  <Label htmlFor="edit-user-team-organizer">Organizador Responsável</Label>
                  <Select
                    value={userUpdate.team_organizer_id || ''}
                    onValueChange={(value) => setUserUpdate({ ...userUpdate, team_organizer_id: value })}
                  >
                    <SelectTrigger id="edit-user-team-organizer">
                      <SelectValue placeholder="Selecione um organizador" />
                    </SelectTrigger>
                    <SelectContent>
                      {organizerOptions.map((organizer) => (
                        <SelectItem key={organizer.id} value={organizer.id}>
                          {organizer.full_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="rounded-md border p-3 space-y-3">
                <div>
                  <h4 className="font-medium">Segurança da Conta</h4>
                  <p className="text-sm text-muted-foreground">Defina uma nova senha para o usuário.</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-user-new-password">Nova senha</Label>
                  <Input
                    id="edit-user-new-password"
                    type="password"
                    minLength={8}
                    value={userUpdate.new_password || ''}
                    onChange={(e) => setUserUpdate({ ...userUpdate, new_password: e.target.value })}
                    placeholder="Mínimo 8 caracteres"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-user-confirm-password">Confirmar senha</Label>
                  <Input
                    id="edit-user-confirm-password"
                    type="password"
                    minLength={8}
                    value={userUpdate.confirm_password || ''}
                    onChange={(e) => setUserUpdate({ ...userUpdate, confirm_password: e.target.value })}
                    placeholder="Repita a nova senha"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button type="submit" disabled={isLoading}>
                  {isLoading ? 'Atualizando...' : 'Atualizar'}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}

