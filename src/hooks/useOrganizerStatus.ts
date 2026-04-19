
import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { invokeEdgeFunction } from '@/services/apiClient';

export function useOrganizerStatus() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [asaasStatus, setAsaasStatus] = useState<'pending' | 'approved' | 'rejected' | 'not_connected'>('not_connected');
  const [isActive, setIsActive] = useState(false);
  const [accountId, setAccountId] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      checkStatus();
    } else {
        setLoading(false);
    }
  }, [user]);

  const checkStatus = async () => {
    try {
      setLoading(true);
      const { data, error } = await invokeEdgeFunction<{ account: any | null }>('events-api', {
        body: { op: 'organizerAsaas.getAccount' },
      });

      if (error || !data?.account) {
        setAsaasStatus('not_connected');
        setIsActive(false);
        setAccountId(null);
        return;
      }

      setAsaasStatus((data.account.kyc_status as any) ?? 'not_connected');
      setIsActive(Boolean(data.account.is_active));
      setAccountId(data.account.asaas_account_id ?? null);
    } catch (err) {
      // console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return {
    loading,
    asaasStatus,
    isActive,
    accountId,
    checkStatus
  };
}
