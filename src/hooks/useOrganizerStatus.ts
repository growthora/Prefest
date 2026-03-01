
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';

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
      const { data, error } = await supabase
        .from('organizer_asaas_accounts')
        .select('kyc_status, is_active, asaas_account_id')
        .eq('organizer_user_id', user?.id)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Error checking organizer status:', error);
      }

      if (data) {
        setAsaasStatus(data.kyc_status as any);
        setIsActive(data.is_active);
        setAccountId(data.asaas_account_id);
      } else {
        setAsaasStatus('not_connected');
        setIsActive(false);
        setAccountId(null);
      }
    } catch (err) {
      console.error(err);
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
