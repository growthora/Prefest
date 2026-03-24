import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { AsaasConnect } from '@/components/dashboard/organizer/AsaasConnect';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

export function Payments() {
  const [isWithdrawModalOpen, setIsWithdrawModalOpen] = useState(false);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Meus Pagamentos</h1>
        <Button onClick={() => setIsWithdrawModalOpen(true)}>
          Sacar agora
        </Button>
      </div>

      <AsaasConnect />

      <Card>
        <CardContent className="pt-6 text-sm text-muted-foreground">
          O saldo e o historico de transacoes nao sao exibidos nesta tela.
        </CardContent>
      </Card>

      <Dialog open={isWithdrawModalOpen} onOpenChange={setIsWithdrawModalOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Como sacar seu valor no Asaas</DialogTitle>
            <DialogDescription>
              O saque do saldo do organizador deve ser feito diretamente no painel do Asaas.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 text-sm text-muted-foreground">
            <p>1. Acesse sua conta no Asaas com o e-mail e a senha cadastrados.</p>
            <p>2. Verifique se o saldo ja esta disponivel para transferencia.</p>
            <p>3. No painel do Asaas, entre na area de saldo, conta ou transferencias.</p>
            <p>4. Escolha a opcao de transferir, sacar ou enviar o valor para sua conta bancaria.</p>
            <p>5. Confirme os dados bancarios cadastrados antes de finalizar a operacao.</p>
            <p>6. Revise o valor do saque, confira possiveis taxas e conclua a solicitacao.</p>
            <p>7. Caso o saldo ainda nao esteja liberado, aguarde o prazo de disponibilidade do Asaas.</p>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsWithdrawModalOpen(false)}>
              Fechar
            </Button>
            <Button asChild>
              <a href="https://www.asaas.com/" target="_blank" rel="noopener noreferrer">
                Abrir Asaas
              </a>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default Payments;
