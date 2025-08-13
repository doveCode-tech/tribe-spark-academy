import { ReactNode } from "react";
import { useAuth } from "@/contexts/AuthContext";

interface RoleBasedAccessProps {
  children: ReactNode;
  requiredRole?: 'student' | 'tutor' | 'ultimate_tutor' | 'admin';
  requiredLevel?: number; // 1=student, 2=tutor, 3=ultimate_tutor, 4=admin
  fallback?: ReactNode;
}

export function RoleBasedAccess({ 
  children, 
  requiredRole, 
  requiredLevel, 
  fallback = null 
}: RoleBasedAccessProps) {
  const { userProfile } = useAuth();

  if (!userProfile) {
    return <>{fallback}</>;
  }

  // Check by specific role
  if (requiredRole && userProfile.role !== requiredRole) {
    return <>{fallback}</>;
  }

  // Check by role level (allows hierarchy)
  if (requiredLevel) {
    const userLevel = userProfile.role_level || 1;
    if (userLevel < requiredLevel) {
      return <>{fallback}</>;
    }
  }

  return <>{children}</>;
}

// Convenience components for common role checks
export function AdminOnly({ children, fallback }: { children: ReactNode; fallback?: ReactNode }) {
  return (
    <RoleBasedAccess requiredRole="admin" fallback={fallback}>
      {children}
    </RoleBasedAccess>
  );
}

export function UltimateTutorAndAbove({ children, fallback }: { children: ReactNode; fallback?: ReactNode }) {
  return (
    <RoleBasedAccess requiredLevel={3} fallback={fallback}>
      {children}
    </RoleBasedAccess>
  );
}

export function TutorAndAbove({ children, fallback }: { children: ReactNode; fallback?: ReactNode }) {
  return (
    <RoleBasedAccess requiredLevel={2} fallback={fallback}>
      {children}
    </RoleBasedAccess>
  );
}