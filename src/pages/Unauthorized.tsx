import { ShieldAlert, ArrowLeft, Home } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

export default function Unauthorized() {
  const navigate = useNavigate();
  const { userProfile } = useAuth();

  const role = userProfile?.role || "student";

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/30 to-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-elevated border-border text-center">
        <CardHeader>
          <div className="mx-auto w-16 h-16 bg-destructive/10 text-destructive rounded-2xl flex items-center justify-center mb-2 animate-bounce">
            <ShieldAlert className="w-9 h-9" />
          </div>
          <CardTitle className="text-2xl font-bold">Hold on, Explorer! 🛑</CardTitle>
          <CardDescription className="text-base">
            You don't have permission to access this area.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            This part of the platform is reserved for {role === "student" ? "tutors and administrators" : "other staff members"}. Let's get you back to your learning space!
          </p>

          <div className="flex flex-col sm:flex-row gap-2 pt-2">
            <Button 
              variant="outline" 
              className="flex-1"
              onClick={() => navigate(-1)}
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Go Back
            </Button>
            <Button 
              className="flex-1 bg-gradient-primary text-white"
              onClick={() => navigate("/")}
            >
              <Home className="w-4 h-4 mr-2" />
              Dashboard
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
