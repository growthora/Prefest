import { invokeEdgeFunction } from './apiClient';

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
    const { data, error } = await invokeEdgeFunction<{ coupon: Coupon }>('events-api', {
      body: { op: 'coupons.create', params: { couponData, createdBy } },
    });

    if (error) throw error;
    if (!data?.coupon) throw new Error('Falha ao criar cupom');
    return data.coupon;
  }

  // Listar todos os cupons (admin)
  async getAllCoupons(): Promise<Coupon[]> {
    // console.log('🔍 [CouponService] Buscando cupons...');
    const { data, error } = await invokeEdgeFunction<{ coupons: Coupon[] }>('events-api', {
      body: { op: 'coupons.listAll' },
    });

    if (error) throw error;
    return data?.coupons || [];
  }

  // Listar cupons ativos
  async getActiveCoupons(): Promise<Coupon[]> {
    const { data, error } = await invokeEdgeFunction<{ coupons: Coupon[] }>('events-api', {
      body: { op: 'coupons.listActive' },
    });

    if (error) throw error;
    return data?.coupons || [];
  }

  // Validar cupom
  async validateCoupon(code: string): Promise<Coupon> {
    const { data, error } = await invokeEdgeFunction<{ coupon: Coupon }>('events-api', {
      body: { op: 'coupons.validate', params: { code } },
    });

    if (error) throw error;
    if (!data?.coupon) throw new Error('Cupom inválido ou expirado');
    return data.coupon;
  }

  // Aplicar cupom
  async applyCoupon(
    couponId: string, 
    userId: string, 
    eventId: string, 
    originalPrice: number
  ): Promise<{ discount: number; finalPrice: number; couponUsage: CouponUsage }> {
    const { data, error } = await invokeEdgeFunction<{
      discount: number;
      finalPrice: number;
      couponUsage: CouponUsage;
    }>('events-api', {
      body: { op: 'coupons.apply', params: { couponId, userId, eventId, originalPrice } },
    });

    if (error) throw error;
    if (!data) throw new Error('Falha ao aplicar cupom');
    return data;
  }

  // Atualizar cupom
  async updateCoupon(couponId: string, updates: Partial<Coupon>): Promise<Coupon> {
    const { data, error } = await invokeEdgeFunction<{ coupon: Coupon }>('events-api', {
      body: { op: 'coupons.update', params: { couponId, updates } },
    });

    if (error) throw error;
    if (!data?.coupon) throw new Error('Falha ao atualizar cupom');
    return data.coupon;
  }

  // Deletar cupom
  async deleteCoupon(couponId: string): Promise<void> {
    const { error } = await invokeEdgeFunction('events-api', {
      body: { op: 'coupons.delete', params: { couponId } },
    });

    if (error) throw error;
  }

  // Ativar/Desativar cupom
  async toggleCouponStatus(couponId: string, active: boolean): Promise<Coupon> {
    return this.updateCoupon(couponId, { active });
  }

  // Ver uso de cupons (admin)
  async getCouponUsage(couponId?: string): Promise<CouponUsage[]> {
    const { data, error } = await invokeEdgeFunction<{ usage: CouponUsage[] }>('events-api', {
      body: { op: 'coupons.usage.list', params: { couponId } },
    });

    if (error) throw error;
    return data?.usage || [];
  }

  // Ver cupons usados pelo usuário
  async getUserCouponUsage(userId: string): Promise<CouponUsage[]> {
    const { data, error } = await invokeEdgeFunction<{ usage: CouponUsage[] }>('events-api', {
      body: { op: 'coupons.usage.listByUser', params: { userId } },
    });

    if (error) throw error;
    return data?.usage || [];
  }
}

export const couponService = new CouponService();


