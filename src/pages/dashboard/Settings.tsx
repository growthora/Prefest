import React, { useEffect, useState } from 'react';
import { Settings as SettingsIcon, User, Save, Loader2 } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { useAuth } from '@/hooks/useAuth';
import { authService, type Profile } from '@/services/auth.service';
import { toast } from 'sonner';
import { DashboardLoader } from '@/components/dashboard/DashboardLoader';

const profileFormSchema = z.object({
  full_name: z.string().min(2, {
    message: "Nome deve ter pelo menos 2 caracteres.",
  }),
  bio: z.string().max(500, {
    message: "Bio não pode ter mais de 500 caracteres.",
  }).optional(),
});

type ProfileFormValues = z.infer<typeof profileFormSchema>;

export function Settings() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: {
      full_name: "",
      bio: "",
    },
  });

  useEffect(() => {
    async function loadProfile() {
      if (!user) return;
      try {
        setLoading(true);
        const data = await authService.getProfile(user.id);
        if (data) {
          setProfile(data);
          form.reset({
            full_name: data.full_name || "",
            bio: data.bio || "",
          });
        }
      } catch (error) {
        console.error('Failed to load profile', error);
        toast.error("Erro ao carregar perfil");
      } finally {
        setLoading(false);
      }
    }
    loadProfile();
  }, [user, form]);

  async function onSubmit(data: ProfileFormValues) {
    if (!user) return;
    try {
      setSaving(true);
      await authService.updateProfile(user.id, {
        full_name: data.full_name,
        bio: data.bio,
      });
      toast.success("Perfil atualizado com sucesso!");
    } catch (error) {
      console.error('Failed to update profile', error);
      toast.error("Erro ao atualizar perfil");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <DashboardLoader />;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <h1 className="text-3xl font-bold tracking-tight">Configurações</h1>
      <p className="text-muted-foreground">Gerencie as configurações da sua conta de organizador.</p>
      
      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Perfil Público</CardTitle>
            <CardDescription>
              Essas informações serão exibidas publicamente nos seus eventos.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
                <FormField
                  control={form.control}
                  name="full_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nome Completo</FormLabel>
                      <FormControl>
                        <Input placeholder="Seu nome ou nome da organização" {...field} />
                      </FormControl>
                      <FormDescription>
                        Este é o nome que aparecerá como organizador dos eventos.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="bio"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Bio</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Conte um pouco sobre você ou sua organização..."
                          className="resize-none"
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        Uma breve descrição para seus participantes.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                   <div className="space-y-2">
                     <FormLabel className="text-muted-foreground">Email (Não editável)</FormLabel>
                     <Input disabled value={profile?.email || ""} />
                   </div>
                   <div className="space-y-2">
                     <FormLabel className="text-muted-foreground">CPF (Não editável)</FormLabel>
                     <Input disabled value={profile?.cpf || ""} />
                   </div>
                </div>

                <div className="flex justify-end">
                  <Button type="submit" disabled={saving}>
                    {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {saving ? "Salvando..." : "Salvar Alterações"}
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
