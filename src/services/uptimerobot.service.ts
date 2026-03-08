import { invokeEdgeFunction } from '@/services/apiClient';

export interface UptimeRobotMonitor {
  id: number;
  friendly_name: string;
  url: string;
  type: number;
  subtype: string;
  keyword_type: string;
  keyword_value: string;
  http_username: string;
  http_password: string;
  port: string;
  interval: number;
  status: number;
  create_datetime: number;
  uptime_ratio: string;
  all_time_uptime_ratio: string;
  response_times?: Array<{ datetime: number; value: number }>;
  logs?: Array<{ type: number; datetime: number; duration: number; reason: { code: string; detail: string } }>;
}

interface UptimeRobotResponse {
  success: boolean;
  monitors: UptimeRobotMonitor[];
  pagination: unknown;
}

export const uptimeRobotService = {
  async getStatus(scope: 'prefest' | 'readonly' | 'main' = 'prefest') {
    const { data, error } = await invokeEdgeFunction<UptimeRobotResponse>('uptimerobot-status', {
      body: { scope },
      method: 'POST',
      requiresAuth: false,
    });

    if (error) throw error;
    return data;
  },
};


