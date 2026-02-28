import React, { useEffect } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { DashboardLoader } from '@/components/dashboard/DashboardLoader';

export function AdminRoute() {
  const { user, profile, isLoading } = useAuth();
  
  // Debug info
  useEffect(() => {
    if (!isLoading && user) {
      console.log('AdminRoute check:', { 
        userId: user.id, 
        profileId: profile?.id,
        roles: profile?.roles
      });
    }
  }, [user, profile, isLoading]);

  if (isLoading) {
    return <DashboardLoader />;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Check if user is an admin
  const isAdmin = 
    profile?.roles?.includes('admin') || 
    profile?.roles?.includes('ADMIN') ||
    profile?.email === 'admin@prefest.com'; // Fallback for hardcoded admin if needed

  if (!isAdmin) {
    console.warn('Access denied: User is not an admin');
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}

export default AdminRoute;
