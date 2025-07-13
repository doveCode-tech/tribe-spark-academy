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

    console.log('User profile in Index:', userProfile);
    console.log('User role:', userProfile.role);

    switch (userProfile.role) {
      case 'admin':
        console.log('Rendering AdminDashboard');
        return <AdminDashboard />;
      case 'tutor':
        console.log('Rendering TutorDashboard');
        return <TutorDashboard />;
      case 'student':
      default:
        console.log('Rendering StudentDashboard');
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
