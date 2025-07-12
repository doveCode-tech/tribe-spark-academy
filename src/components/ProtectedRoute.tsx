import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Loader } from 'lucide-react';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: 'student' | 'tutor' | 'admin';
}

export function ProtectedRoute({ children, requiredRole }: ProtectedRouteProps) {
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

      if (requiredRole && userProfile?.role !== requiredRole) {
        navigate('/unauthorized');
        return;
      }
    }
  }, [user, userProfile, loading, navigate, requiredRole]);

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

  if (requiredRole && userProfile?.role !== requiredRole) {
    return null;
  }

  return <>{children}</>;
}