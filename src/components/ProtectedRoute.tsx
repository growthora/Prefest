import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { DashboardLoader } from '@/components/dashboard/DashboardLoader';
import { ROUTE_PATHS } from '@/lib/index';

interface ProtectedRouteProps {
  allowedRoles?: string[];
  requireOrganizerApproved?: boolean;
  allowEquipeBypass?: boolean;
}

export function ProtectedRoute({ allowedRoles, requireOrganizerApproved, allowEquipeBypass = false }: ProtectedRouteProps) {
  const { user, profile, isLoading, isRecoveryMode } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return <DashboardLoader />;
  }

  if (isRecoveryMode) {
    return <Navigate to={ROUTE_PATHS.UPDATE_PASSWORD} replace />;
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  const normalizedRoles = (profile?.roles || []).map((role) => String(role).toUpperCase());

  if (allowedRoles && allowedRoles.length > 0) {
    const hasRole = allowedRoles.some((role) => normalizedRoles.includes(role.toUpperCase()));
    if (!hasRole) {
      return <Navigate to="/" replace />;
    }
  }

  if (requireOrganizerApproved) {
    const isApproved = (profile?.organizer_status || 'NONE').toUpperCase() === 'APPROVED';
    const isAdmin = normalizedRoles.includes('ADMIN');
    const isEquipe = normalizedRoles.includes('EQUIPE');

    if (!isApproved && !isAdmin && !(allowEquipeBypass && isEquipe)) {
      return <Navigate to="/" replace />;
    }
  }

  return <Outlet />;
}

export default ProtectedRoute;
