import { useState, useEffect } from 'react';
import { userService, type UserWithStats, type CreateUserData, type UpdateUserData } from '@/services/user.service';
import { type Profile } from '@/services/auth.service';
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
import { motion } from 'framer-motion';

export default function AdminUsers() {
  const [users, setUsers] = useState<UserWithStats[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const { confirm } = useConfirm();
  
  const [isCreateUserDialogOpen, setIsCreateUserDialogOpen] = useState(false);
  const [isEditUserDialogOpen, setIsEditUserDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<Profile | null>(null);
  
  const [newUser, setNewUser] = useState<CreateUserData>({
    email: '',
    password: '',
    full_name: '',
    role: 'user',
  });

  const [userUpdate, setUserUpdate] = useState<UpdateUserData>({});

  useEffect(() => {
    loadUsers();
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

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      setIsLoading(true);
      await userService.createUser(newUser);
      toast.success('Usuário criado com sucesso!');
      setIsCreateUserDialogOpen(false);
      setNewUser({
        email: '',
        password: '',
        full_name: '',
        role: 'user',
      });
      await loadUsers();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao criar usuário');
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;

    try {
      setIsLoading(true);
      await userService.updateUser(editingUser.id, userUpdate);
      toast.success('Usuário atualizado com sucesso!');
      setIsEditUserDialogOpen(false);
      setEditingUser(null);
      setUserUpdate({});
      await loadUsers();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao atualizar usuário');
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
      toast.error(err instanceof Error ? err.message : 'Erro ao deletar usuário');
    } finally {
      setIsLoading(false);
    }
  };

  const openEditUserDialog = (user: Profile) => {
    setEditingUser(user);
    setUserUpdate({
      full_name: user.full_name || '',
      bio: user.bio || '',
      avatar_url: user.avatar_url || '',
      role: user.role,
      single_mode: user.single_mode,
      show_initials_only: user.show_initials_only,
    });
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
                  minLength={6}
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
                <Label htmlFor="new-user-role">Função</Label>
                <Select
                  value={newUser.role}
                  onValueChange={(value: 'user' | 'admin' | 'equipe') =>
                    setNewUser({ ...newUser, role: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="user">Usuário</SelectItem>
                    <SelectItem value="equipe">Equipe</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
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
                <CardHeader className="pb-2">
                  <div className="flex justify-between items-start">
                    <Badge variant={user.role === 'admin' ? 'default' : user.role === 'equipe' ? 'secondary' : 'outline'} className="mb-2">
                      {user.role === 'admin' ? 'Administrador' : user.role === 'equipe' ? 'Equipe' : 'Usuário'}
                    </Badge>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-primary"
                        onClick={() => openEditUserDialog(user)}
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
                  <CardTitle className="text-lg line-clamp-1" title={user.full_name || ''}>
                    {user.full_name || 'Sem nome'}
                  </CardTitle>
                  <CardDescription className="line-clamp-1" title={user.email}>
                    {user.email}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4 mt-2">
                    <div className="flex flex-col items-center p-2 bg-muted/30 rounded-lg">
                      <span className="text-xs text-muted-foreground">Eventos</span>
                      <span className="font-bold flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {user.total_events || 0}
                      </span>
                    </div>
                    <div className="flex flex-col items-center p-2 bg-muted/30 rounded-lg">
                      <span className="text-xs text-muted-foreground">Gastos</span>
                      <span className="font-bold flex items-center gap-1">
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
                <Label htmlFor="edit-user-role">Função</Label>
                <Select
                  value={userUpdate.role}
                  onValueChange={(value: 'user' | 'admin' | 'equipe') =>
                    setUserUpdate({ ...userUpdate, role: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="user">Usuário</SelectItem>
                    <SelectItem value="equipe">Equipe</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
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
