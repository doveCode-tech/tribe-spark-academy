import { LMSLayout } from "@/components/LMSLayout";
import { AdminDashboard } from "@/components/AdminDashboard";
import { StudentsList } from "@/components/StudentsList";
import { useAuth } from "@/contexts/AuthContext";

export default function Users() {
  const { userProfile } = useAuth();
  const isTutor = userProfile?.role === 'tutor' || userProfile?.role === 'ultimate_tutor';
  const isAdmin = userProfile?.role === 'admin';

  return (
    <LMSLayout>
      {isTutor && !isAdmin ? (
        <StudentsList />
      ) : (
        <AdminDashboard />
      )}
    </LMSLayout>
  );
}
