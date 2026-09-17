import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Loader } from 'lucide-react';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: 'student' | 'tutor' | 'ultimate_tutor' | 'admin';
  allowedRoles?: Array<'student' | 'tutor' | 'ultimate_tutor' | 'admin'>;
}

export function ProtectedRoute({ children, requiredRole, allowedRoles }: ProtectedRouteProps) {
  const { user, userProfile, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading) {
      if (!user) {
        navigate('/auth');
        return;
      }

      if (userProfile && !userProfile.approved) {
        navigate('/pending-approval');
        return;
      }

      const role = userProfile?.role as 'student' | 'tutor' | 'ultimate_tutor' | 'admin' | undefined;

      if (requiredRole && role !== requiredRole) {
        navigate('/unauthorized');
        return;
      }

      if (allowedRoles && allowedRoles.length > 0 && (!role || !allowedRoles.includes(role))) {
        navigate('/unauthorized');
        return;
      }
    }
  }, [user, userProfile, loading, navigate, requiredRole, allowedRoles]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader className="w-8 h-8 animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  if (userProfile && !userProfile.approved) {
    return null;
  }

  const role = userProfile?.role as 'student' | 'tutor' | 'ultimate_tutor' | 'admin' | undefined;

  if (requiredRole && role !== requiredRole) {
    return null;
  }

  if (allowedRoles && allowedRoles.length > 0 && (!role || !allowedRoles.includes(role))) {
    return null;
  }

  return <>{children}</>;
}