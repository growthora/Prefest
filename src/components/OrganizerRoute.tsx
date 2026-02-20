import React, { useEffect, useState } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { DashboardLoader } from '@/components/dashboard/DashboardLoader';

export function OrganizerRoute() {
  const { user, profile, isLoading } = useAuth();
  
  // Debug info
  useEffect(() => {
    if (!isLoading && user) {
      console.log('OrganizerRoute check:', { 
        userId: user.id, 
        profileId: profile?.id,
        roles: profile?.roles,
        organizerStatus: profile?.organizer_status 
      });
    }
  }, [user, profile, isLoading]);

  if (isLoading) {
    return <DashboardLoader />;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Check if user is an approved organizer
  // Also support 'roles' array checking for 'ORGANIZER' or 'admin' (legacy/dev support)
  const isOrganizer = 
    profile?.organizer_status === 'APPROVED' || 
    profile?.roles?.includes('ORGANIZER') ||
    profile?.roles?.includes('admin'); // Fallback for admin

  if (!isOrganizer) {
    console.warn('Access denied: User is not an approved organizer');
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}

export default OrganizerRoute;
