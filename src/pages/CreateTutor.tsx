import { LMSLayout } from "@/components/LMSLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

export default function CreateTutor() {
  const navigate = useNavigate();
  return (
    <LMSLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Create Tutor</h1>
          <p className="text-muted-foreground">Add new tutors to the platform</p>
        </div>
        <Alert>
          <Info className="h-4 w-4" />
          <AlertTitle>Setup in progress</AlertTitle>
          <AlertDescription>
            We are enabling secure admin actions for creating tutors. This page will be fully functional after a short backend update.
          </AlertDescription>
        </Alert>
        <Card>
          <CardHeader>
            <CardTitle>Next Steps</CardTitle>
            <CardDescription>Manage users from the Users section for now</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => navigate('/users')}>Go to Manage Users</Button>
          </CardContent>
        </Card>
      </div>
    </LMSLayout>
  );
}
