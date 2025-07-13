import { LMSLayout } from "@/components/LMSLayout";
import { StudentDashboard } from "@/components/StudentDashboard";
import { AdminDashboard } from "@/components/AdminDashboard";
import { TutorDashboard } from "@/components/TutorDashboard";
import { useAuth } from "@/contexts/AuthContext";

const Index = () => {
  const { userProfile } = useAuth();

  const renderDashboard = () => {
    if (!userProfile) {
      return (
        <div className="flex items-center justify-center h-64">
          <div className="text-muted-foreground">Loading user profile...</div>
        </div>
      );
    }

    console.log('User profile in Index:', userProfile);
    console.log('User role:', userProfile.role);
    console.log('User role type:', typeof userProfile.role);

    // Ensure we're comparing the role correctly
    const userRole = userProfile.role?.toLowerCase()?.trim();
    
    switch (userRole) {
      case 'admin':
        console.log('Rendering AdminDashboard');
        return <AdminDashboard />;
      case 'tutor':
        console.log('Rendering TutorDashboard');
        return <TutorDashboard />;
      case 'student':
      default:
        console.log('Rendering StudentDashboard, role was:', userRole);
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
