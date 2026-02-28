import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useConfirm } from '@/contexts/ConfirmContext';
import { couponService, type Coupon } from '@/services/coupon.service';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Ticket, Plus, Search, Trash2, Power, Calendar } from 'lucide-react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';

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
    opacity: 1
  }
};

export default function AdminCoupons() {
  const { user } = useAuth();
  const { confirm } = useConfirm();
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  
  const [newCoupon, setNewCoupon] = useState({
    code: '',
    description: '',
    discount_type: 'percentage' as 'percentage' | 'fixed',
    discount_value: 0,
    max_uses: undefined as number | undefined,
    valid_until: '',
  });

  useEffect(() => {
    loadCoupons();
  }, []);

  const loadCoupons = async () => {
    try {
      setIsLoading(true);
      const data = await couponService.getAllCoupons();
      setCoupons(data);
    } catch (error) {
      console.error('Erro ao carregar cupons:', error);
      toast.error('Erro ao carregar cupons');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    try {
      setIsLoading(true);
      
      await couponService.createCoupon({
        code: newCoupon.code.toUpperCase(),
        description: newCoupon.description,
        discount_type: newCoupon.discount_type,
        discount_value: newCoupon.discount_value,
        max_uses: newCoupon.max_uses,
        valid_until: newCoupon.valid_until || undefined,
      }, user.id);

      setNewCoupon({
        code: '',
        description: '',
        discount_type: 'percentage',
        discount_value: 0,
        max_uses: undefined,
        valid_until: '',
      });

      setIsCreateDialogOpen(false);
      await loadCoupons();
      toast.success('Cupom criado com sucesso!');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao criar cupom');
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleCoupon = async (couponId: string, currentStatus: boolean) => {
    try {
      // Optimistic update
      setCoupons(coupons.map(c => 
        c.id === couponId ? { ...c, active: !currentStatus } : c
      ));
      
      await couponService.toggleCouponStatus(couponId, !currentStatus);
      toast.success(`Cupom ${!currentStatus ? 'ativado' : 'desativado'} com sucesso!`);
    } catch (err) {
      // Revert on error
      setCoupons(coupons.map(c => 
        c.id === couponId ? { ...c, active: currentStatus } : c
      ));
      toast.error(err instanceof Error ? err.message : 'Erro ao atualizar cupom');
    }
  };

  const handleDeleteCoupon = async (couponId: string) => {
    if (!await confirm({
      title: 'Deletar Cupom',
      description: 'Tem certeza que deseja deletar este cupom? Esta ação não pode ser desfeita.',
      variant: 'destructive',
      confirmText: 'Deletar',
    })) return;

    try {
      setIsLoading(true);
      await couponService.deleteCoupon(couponId);
      toast.success('Cupom deletado com sucesso!');
      await loadCoupons();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao deletar cupom');
    } finally {
      setIsLoading(false);
    }
  };

  const filteredCoupons = coupons.filter(coupon => 
    coupon.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (coupon.description && coupon.description.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <motion.div 
      className="space-y-6 pb-8"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Gerenciar Cupons</h1>
          <p className="text-muted-foreground mt-1">
            Crie e gerencie cupons de desconto para seus eventos.
          </p>
        </div>
        <Button onClick={() => setIsCreateDialogOpen(true)} className="bg-primary hover:bg-primary/90">
          <Plus className="w-4 h-4 mr-2" />
          Novo Cupom
        </Button>
      </div>

      <div className="flex items-center space-x-2 bg-card p-2 rounded-lg border shadow-sm">
        <Search className="w-5 h-5 text-muted-foreground ml-2" />
        <Input
          placeholder="Buscar cupons por código..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="border-none shadow-none focus-visible:ring-0"
        />
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      ) : filteredCoupons.length === 0 ? (
        <div className="text-center py-12 bg-card rounded-lg border border-dashed">
          <Ticket className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium">Nenhum cupom encontrado</h3>
          <p className="text-muted-foreground mt-2">
            {searchTerm ? 'Tente buscar com outros termos.' : 'Crie seu primeiro cupom de desconto.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <AnimatePresence>
            {filteredCoupons.map((coupon) => (
              <motion.div key={coupon.id} variants={itemVariants} layout>
                <Card className={`h-full border-l-4 ${coupon.active ? 'border-l-green-500' : 'border-l-gray-300'}`}>
                  <CardHeader className="pb-2">
                    <div className="flex justify-between items-start">
                      <div className="flex items-center gap-2">
                        <Ticket className="w-5 h-5 text-primary" />
                        <CardTitle className="font-mono text-xl tracking-wider">{coupon.code}</CardTitle>
                      </div>
                      <Badge variant={coupon.active ? 'default' : 'secondary'}>
                        {coupon.active ? 'Ativo' : 'Inativo'}
                      </Badge>
                    </div>
                    <CardDescription>{coupon.description || 'Sem descrição'}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-muted-foreground">Desconto:</span>
                      <span className="font-bold text-lg text-primary">
                        {coupon.discount_type === 'percentage' 
                          ? `${coupon.discount_value}%` 
                          : `R$ ${coupon.discount_value.toFixed(2)}`}
                      </span>
                    </div>
                    
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-muted-foreground">Usos:</span>
                      <span>
                        {coupon.current_uses}
                        {coupon.max_uses ? ` / ${coupon.max_uses}` : ''}
                      </span>
                    </div>

                    {coupon.valid_until && (
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-muted-foreground">Validade:</span>
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {new Date(coupon.valid_until).toLocaleDateString('pt-BR')}
                        </span>
                      </div>
                    )}

                    <div className="flex gap-2 pt-2">
                      <Button
                        size="sm"
                        variant={coupon.active ? "outline" : "default"}
                        className="flex-1"
                        onClick={() => handleToggleCoupon(coupon.id, coupon.active)}
                      >
                        <Power className="w-4 h-4 mr-2" />
                        {coupon.active ? 'Desativar' : 'Ativar'}
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => handleDeleteCoupon(coupon.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Dialog Criar Cupom */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Criar Novo Cupom</DialogTitle>
            <DialogDescription>Configure as regras do novo cupom de desconto.</DialogDescription>
          </DialogHeader>
          
          <form onSubmit={handleCreateCoupon} className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="code">Código do Cupom *</Label>
              <Input
                id="code"
                value={newCoupon.code}
                onChange={(e) => setNewCoupon({ ...newCoupon, code: e.target.value.toUpperCase() })}
                placeholder="Ex: VERAO2024"
                required
                className="uppercase font-mono"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="discount_type">Tipo de Desconto *</Label>
                <Select
                  value={newCoupon.discount_type}
                  onValueChange={(value: 'percentage' | 'fixed') => 
                    setNewCoupon({ ...newCoupon, discount_type: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percentage">Porcentagem (%)</SelectItem>
                    <SelectItem value="fixed">Valor Fixo (R$)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="discount_value">Valor *</Label>
                <Input
                  id="discount_value"
                  type="number"
                  step="0.01"
                  min="0"
                  value={newCoupon.discount_value}
                  onChange={(e) => setNewCoupon({ ...newCoupon, discount_value: parseFloat(e.target.value) })}
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="max_uses">Limite de Usos</Label>
                <Input
                  id="max_uses"
                  type="number"
                  min="1"
                  value={newCoupon.max_uses || ''}
                  onChange={(e) => setNewCoupon({ ...newCoupon, max_uses: e.target.value ? parseInt(e.target.value) : undefined })}
                  placeholder="Ilimitado"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="valid_until">Válido Até</Label>
                <Input
                  id="valid_until"
                  type="datetime-local"
                  value={newCoupon.valid_until}
                  onChange={(e) => setNewCoupon({ ...newCoupon, valid_until: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Descrição</Label>
              <Input
                id="description"
                value={newCoupon.description}
                onChange={(e) => setNewCoupon({ ...newCoupon, description: e.target.value })}
                placeholder="Ex: Desconto especial de verão"
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? 'Criando...' : 'Criar Cupom'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
