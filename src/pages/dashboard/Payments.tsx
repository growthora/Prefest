import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { AsaasConnect } from '@/components/dashboard/organizer/AsaasConnect';

export function Payments() {
  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Meus Pagamentos</h1>
      </div>

      <AsaasConnect />

      <Card>
        <CardContent className="pt-6 text-sm text-muted-foreground">
          O saldo e o historico de transacoes nao sao exibidos nesta tela.
        </CardContent>
      </Card>
    </div>
  );
}

export default Payments;
