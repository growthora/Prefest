import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { DashboardLoader } from '@/components/dashboard/DashboardLoader';
import { ROUTE_PATHS } from '@/lib/index';

interface ProtectedRouteProps {
  allowedRoles?: string[];
  requireOrganizerApproved?: boolean;
}

export function ProtectedRoute({ allowedRoles, requireOrganizerApproved }: ProtectedRouteProps) {
  const { user, profile, isLoading, isRecoveryMode } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return <DashboardLoader />;
  }

  // If in recovery mode, block access to all protected routes and redirect to reset password
  if (isRecoveryMode) {
    return <Navigate to={ROUTE_PATHS.UPDATE_PASSWORD} replace />;
  }

  if (!user) {
    // Redirect to login page, but save the current location they were trying to access
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Role-based access control
  if (allowedRoles && allowedRoles.length > 0) {
    const userRoles = profile?.roles || [];
    // Check if user has at least one of the allowed roles
    // Case-insensitive check (admin vs ADMIN)
    const hasRole = allowedRoles.some(role => 
      userRoles.map(r => r.toUpperCase()).includes(role.toUpperCase())
    );

    if (!hasRole) {
      // console.warn(`Access denied: User ${user.email} missing roles [${allowedRoles.join(', ')}]`);
      return <Navigate to="/" replace />;
    }
  }

  // Organizer status check
  if (requireOrganizerApproved) {
    const isApproved = profile?.organizer_status === 'APPROVED';
    
    // Admin bypass: Check strictly against roles array
    const isAdmin = profile?.roles?.some(r => r.toUpperCase() === 'ADMIN');

    if (!isApproved && !isAdmin) {
      // console.warn(`Access denied: User ${user.email} is not an approved organizer`);
      return <Navigate to="/" replace />;
    }
  }

  return <Outlet />;
}

export default ProtectedRoute;
