import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { authService } from '@/services/auth.service';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { Loader2, User, Phone, Calendar as CalendarIcon, ShieldCheck } from 'lucide-react';
import { Layout } from '@/components/Layout';

export default function CompleteProfile() {
  const { user, profile, isLoading: isAuthLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    cpf: '',
    phone: '',
    birth_date: ''
  });

  // Pre-fill data if available in profile
  useEffect(() => {
    if (profile) {
      setFormData({
        cpf: profile.cpf || '',
        phone: profile.phone || '',
        birth_date: profile.birth_date || ''
      });
    }
  }, [profile]);

  // Redirect if not logged in
  useEffect(() => {
    if (!isAuthLoading && !user) {
      navigate('/login');
    }
  }, [user, isAuthLoading, navigate]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const validateForm = () => {
    if (!formData.cpf || formData.cpf.length < 11) {
      toast.error('CPF inválido');
      return false;
    }
    if (!formData.phone || formData.phone.length < 10) {
      toast.error('Telefone inválido');
      return false;
    }
    if (!formData.birth_date) {
      toast.error('Data de nascimento obrigatória');
      return false;
    }
    
    // Validate age (optional but good practice)
    const birthDate = new Date(formData.birth_date);
    const today = new Date();
    if (birthDate > today) {
      toast.error('Data de nascimento inválida');
      return false;
    }

    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;
    if (!user) return;

    setLoading(true);

    try {
      // Usar a Edge Function via authService para garantir validação segura no servidor
      // Isso resolve o erro 401 ao garantir que o token seja validado no contexto da função server-side
      await authService.completeProfile({
        cpf: formData.cpf,
        phone: formData.phone,
        birth_date: formData.birth_date
      });

      toast.success('Cadastro atualizado com sucesso! ðŸŽ‰');
      
      // Pequeno delay para garantir propagação
      setTimeout(() => {
        const redirectPath = sessionStorage.getItem('postRegisterRedirect');
        
        // Validação de segurança: deve começar com / e não conter // ou protocolo
        const isValidRedirect = redirectPath && 
          redirectPath.startsWith('/') && 
          !redirectPath.includes('//') &&
          !redirectPath.toLowerCase().startsWith('http');

        if (isValidRedirect) {
          sessionStorage.removeItem('postRegisterRedirect');
          // Forçar reload na rota correta para atualizar contexto e redirecionar
          window.location.href = redirectPath;
        } else {
          // Fallback seguro se não houver redirect válido
          window.location.href = '/';
        }
      }, 1000);

    } catch (error: any) {
      // console.error('Erro ao atualizar perfil:', error);
      toast.error(error.message || 'Erro ao atualizar perfil');
    } finally {
      setLoading(false);
    }
  };


  if (isAuthLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <Layout>
      <div className="container max-w-lg mx-auto py-10 px-4">
        <Card className="border-border bg-card/50 backdrop-blur-sm shadow-xl">
          <CardHeader className="space-y-1">
            <div className="flex items-center gap-2 mb-2">
              <ShieldCheck className="w-6 h-6 text-primary" />
              <CardTitle className="text-2xl font-bold">Complete seu Cadastro</CardTitle>
            </div>
            <CardDescription>
              Precisamos de algumas informações adicionais para garantir sua segurança e acesso aos eventos.
            </CardDescription>
          </CardHeader>
          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="cpf" className="flex items-center gap-2">
                  <User className="w-4 h-4 text-muted-foreground" />
                  CPF
                </Label>
                <Input
                  id="cpf"
                  name="cpf"
                  placeholder="000.000.000-00"
                  value={formData.cpf}
                  onChange={handleChange}
                  required
                />
                <p className="text-[10px] text-muted-foreground">
                  Apenas números. Usado para emissão de ingressos.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone" className="flex items-center gap-2">
                  <Phone className="w-4 h-4 text-muted-foreground" />
                  Telefone / WhatsApp
                </Label>
                <Input
                  id="phone"
                  name="phone"
                  type="tel"
                  placeholder="(00) 00000-0000"
                  value={formData.phone}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="birth_date" className="flex items-center gap-2">
                  <CalendarIcon className="w-4 h-4 text-muted-foreground" />
                  Data de Nascimento
                </Label>
                <Input
                  id="birth_date"
                  name="birth_date"
                  type="date"
                  value={formData.birth_date}
                  onChange={handleChange}
                  required
                />
                <p className="text-[10px] text-muted-foreground">
                  Necessário para verificação de idade em eventos +18.
                </p>
              </div>
            </CardContent>
            <CardFooter>
              <Button 
                type="submit" 
                className="w-full font-bold" 
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  'Salvar e Continuar'
                )}
              </Button>
            </CardFooter>
          </form>
        </Card>
      </div>
    </Layout>
  );
}

