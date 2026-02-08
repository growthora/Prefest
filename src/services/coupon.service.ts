import { supabase } from '../lib/supabase';

export interface Coupon {
  id: string;
  code: string;
  description: string | null;
  discount_type: 'percentage' | 'fixed';
  discount_value: number;
  max_uses: number | null;
  current_uses: number;
  valid_from: string;
  valid_until: string | null;
  active: boolean;
  created_by: string | null;
  created_at: string;
}

export interface CouponUsage {
  id: string;
  coupon_id: string;
  user_id: string;
  event_id: string | null;
  discount_applied: number;
  used_at: string;
}

export interface CreateCouponData {
  code: string;
  description?: string;
  discount_type: 'percentage' | 'fixed';
  discount_value: number;
  max_uses?: number;
  valid_from?: string;
  valid_until?: string;
}

class CouponService {
  // Criar cupom (apenas admin)
  async createCoupon(couponData: CreateCouponData, createdBy: string): Promise<Coupon> {
    const { data, error } = await supabase
      .from('coupons')
      .insert({
        ...couponData,
        created_by: createdBy,
      } as any)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  // Listar todos os cupons (admin)
  async getAllCoupons(): Promise<Coupon[]> {
    console.log('🔍 [CouponService] Buscando cupons...');
    const { data, error } = await supabase
      .from('coupons')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('❌ [CouponService] Erro ao buscar cupons:', error);
      throw error;
    }
    console.log('✅ [CouponService] Cupons encontrados:', data?.length || 0);
    return data || [];
  }

  // Listar cupons ativos
  async getActiveCoupons(): Promise<Coupon[]> {
    const now = new Date().toISOString();
    
    const { data, error } = await supabase
      .from('coupons')
      .select('*')
      .eq('active', true)
      .lte('valid_from', now)
      .or(`valid_until.is.null,valid_until.gte.${now}`)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  }

  // Validar cupom
  async validateCoupon(code: string): Promise<Coupon> {
    const now = new Date().toISOString();
    
    const { data, error } = await supabase
      .from('coupons')
      .select('*')
      .eq('code', code.toUpperCase())
      .eq('active', true)
      .lte('valid_from', now)
      .or(`valid_until.is.null,valid_until.gte.${now}`)
      .single();

    if (error) throw new Error('Cupom inválido ou expirado');
    
    // Verificar se atingiu o limite de usos
    if (data.max_uses && data.current_uses >= data.max_uses) {
      throw new Error('Cupom esgotado');
    }

    return data;
  }

  // Aplicar cupom
  async applyCoupon(
    couponId: string, 
    userId: string, 
    eventId: string, 
    originalPrice: number
  ): Promise<{ discount: number; finalPrice: number; couponUsage: CouponUsage }> {
    // Buscar cupom
    const { data: coupon, error: couponError } = await supabase
      .from('coupons')
      .select('*')
      .eq('id', couponId)
      .single();

    if (couponError) throw couponError;

    // Calcular desconto
    let discount = 0;
    if (coupon.discount_type === 'percentage') {
      discount = (originalPrice * coupon.discount_value) / 100;
    } else {
      discount = coupon.discount_value;
    }

    // Garantir que o desconto não seja maior que o preço
    discount = Math.min(discount, originalPrice);
    const finalPrice = originalPrice - discount;

    // Registrar uso
    const { data: usage, error: usageError } = await supabase
      .from('coupon_usage')
      .insert({
        coupon_id: couponId,
        user_id: userId,
        event_id: eventId,
        discount_applied: discount,
      } as any)
      .select()
      .single();

    if (usageError) throw usageError;

    return {
      discount,
      finalPrice,
      couponUsage: usage,
    };
  }

  // Atualizar cupom
  async updateCoupon(couponId: string, updates: Partial<Coupon>): Promise<Coupon> {
    const { data, error } = await supabase
      .from('coupons')
      .update(updates as any)
      .eq('id', couponId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  // Deletar cupom
  async deleteCoupon(couponId: string): Promise<void> {
    const { error } = await supabase
      .from('coupons')
      .delete()
      .eq('id', couponId);

    if (error) throw error;
  }

  // Ativar/Desativar cupom
  async toggleCouponStatus(couponId: string, active: boolean): Promise<Coupon> {
    return this.updateCoupon(couponId, { active });
  }

  // Ver uso de cupons (admin)
  async getCouponUsage(couponId?: string): Promise<CouponUsage[]> {
    let query = supabase
      .from('coupon_usage')
      .select('*')
      .order('used_at', { ascending: false });

    if (couponId) {
      query = query.eq('coupon_id', couponId);
    }

    const { data, error } = await query;

    if (error) throw error;
    return data || [];
  }

  // Ver cupons usados pelo usuário
  async getUserCouponUsage(userId: string): Promise<CouponUsage[]> {
    const { data, error } = await supabase
      .from('coupon_usage')
      .select('*')
      .eq('user_id', userId)
      .order('used_at', { ascending: false });

    if (error) throw error;
    return data || [];
  }
}

export const couponService = new CouponService();
