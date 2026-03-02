import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { DashboardLoader } from '@/components/dashboard/DashboardLoader';

interface ProtectedRouteProps {
  allowedRoles?: string[];
  requireOrganizerApproved?: boolean;
}

export function ProtectedRoute({ allowedRoles, requireOrganizerApproved }: ProtectedRouteProps) {
  const { user, profile, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return <DashboardLoader />;
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
      userRoles.map(r => r.toLowerCase()).includes(role.toLowerCase()) ||
      // Fallback for legacy 'role' field or specific email checks
      (role.toLowerCase() === 'admin' && profile?.email === 'admin@prefest.com')
    );

    if (!hasRole) {
      console.warn(`Access denied: User ${user.email} missing roles [${allowedRoles.join(', ')}]`);
      return <Navigate to="/" replace />;
    }
  }

  // Organizer status check
  if (requireOrganizerApproved) {
    const isApproved = profile?.organizer_status === 'APPROVED';
    // Admins bypass this check usually, but let's be strict unless explicitly allowed
    // If admin should bypass, we can add logic here. For now, let's assume admins are also organizers or we add 'admin' to allowedRoles logic.
    // Actually, AdminRoute had logic: role 'admin' OR approved organizer. 
    // If we use requireOrganizerApproved=true, we might want to allow admins too.
    
    const isAdmin = profile?.roles?.some(r => r.toLowerCase() === 'admin') || profile?.email === 'admin@prefest.com';

    if (!isApproved && !isAdmin) {
      console.warn(`Access denied: User ${user.email} is not an approved organizer`);
      return <Navigate to="/" replace />;
    }
  }

  return <Outlet />;
}

export default ProtectedRoute;
