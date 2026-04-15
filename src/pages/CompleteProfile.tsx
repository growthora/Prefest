import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { authService } from '@/services/auth.service';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { Loader2, User, Phone, Calendar as CalendarIcon, ShieldCheck } from 'lucide-react';
import { toUserFriendlyErrorMessage } from '@/lib/appErrors';
import { Layout } from '@/components/Layout';
import { formatCPF, validateCPF } from '@/utils/validators';

const digitsOnly = (value: string) => value.replace(/\D/g, '');

const normalizeBirthDate = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return '';

  const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) {
    return trimmed;
  }

  const brMatch = trimmed.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (brMatch) {
    const [, day, month, year] = brMatch;
    return `${year}-${month}-${day}`;
  }

  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) {
    return '';
  }

  return parsed.toISOString().slice(0, 10);
};

export default function CompleteProfile() {
  const { user, profile, isLoading: isAuthLoading } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    cpf: '',
    phone: '',
    birth_date: '',
  });

  useEffect(() => {
    if (profile) {
      setFormData({
        cpf: profile.cpf ? formatCPF(profile.cpf) : '',
        phone: digitsOnly(profile.phone || ''),
        birth_date: normalizeBirthDate(profile.birth_date || ''),
      });
    }
  }, [profile]);

  useEffect(() => {
    if (!isAuthLoading && !user) {
      navigate('/login');
    }
  }, [user, isAuthLoading, navigate]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;

    setFormData((prev) => {
      if (name === 'cpf') {
        return { ...prev, cpf: formatCPF(value) };
      }

      if (name === 'phone') {
        return { ...prev, phone: digitsOnly(value).slice(0, 15) };
      }

      if (name === 'birth_date') {
        return { ...prev, birth_date: normalizeBirthDate(value) };
      }

      return { ...prev, [name]: value };
    });
  };

  const getValidatedPayload = () => {
    const payload = {
      cpf: digitsOnly(formData.cpf),
      phone: digitsOnly(formData.phone),
      birth_date: normalizeBirthDate(formData.birth_date),
    };

    if (!validateCPF(payload.cpf)) {
      toast.error('CPF invalido');
      return null;
    }

    if (payload.phone.length < 10) {
      toast.error('Telefone invalido');
      return null;
    }

    if (!payload.birth_date) {
      toast.error('Data de nascimento obrigatoria');
      return null;
    }

    const birthDate = new Date(`${payload.birth_date}T00:00:00`);
    const today = new Date();

    if (Number.isNaN(birthDate.getTime()) || birthDate > today) {
      toast.error('Data de nascimento invalida');
      return null;
    }

    return payload;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const payload = getValidatedPayload();
    if (!payload || !user) return;

    setLoading(true);

    try {
      await authService.completeProfile(payload);

      toast.success('Cadastro atualizado com sucesso!');

      setTimeout(() => {
        const redirectPath = sessionStorage.getItem('postRegisterRedirect');
        const isValidRedirect = redirectPath &&
          redirectPath.startsWith('/') &&
          !redirectPath.includes('//') &&
          !redirectPath.toLowerCase().startsWith('http');

        if (isValidRedirect) {
          sessionStorage.removeItem('postRegisterRedirect');
          window.location.href = redirectPath;
        } else {
          window.location.href = '/';
        }
      }, 1000);
    } catch (error: any) {
      toast.error(toUserFriendlyErrorMessage(error));
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
              Precisamos de algumas informacoes adicionais para garantir sua seguranca e acesso aos eventos.
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
                  Apenas numeros. Usado para emissao de ingressos.
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
                  Necessario para verificacao de idade em eventos +18.
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
