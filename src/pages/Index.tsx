import { LMSLayout } from "@/components/LMSLayout";
import { StudentDashboard } from "@/components/StudentDashboard";
import { AdminDashboard } from "@/components/AdminDashboard";
import { TutorDashboard } from "@/components/TutorDashboard";
import { useAuth } from "@/contexts/AuthContext";

const Index = () => {
  const { userProfile } = useAuth();

  const renderDashboard = () => {
    if (!userProfile) {
      return <div>Loading...</div>;
    }

    switch (userProfile.role) {
      case 'admin':
        return <AdminDashboard />;
      case 'tutor':
        return <TutorDashboard />;
      case 'student':
      default:
        return <StudentDashboard />;
    }
  };

  return (
    <LMSLayout>
      {renderDashboard()}
    </LMSLayout>
  );
};

export default Index;
