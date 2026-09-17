import { LMSLayout } from "@/components/LMSLayout";
import { ReportManagement } from "@/components/ReportManagement";
import { StudentReportsView } from "@/components/StudentReportsView";
import { useAuth } from "@/contexts/AuthContext";

export default function Reports() {
  const { userProfile } = useAuth();
  const isStudent = userProfile?.role === "student";

  return (
    <LMSLayout>
      {isStudent ? <StudentReportsView /> : <ReportManagement />}
    </LMSLayout>
  );
}