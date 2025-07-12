import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Clock, GraduationCap } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

export default function PendingApproval() {
  const { signOut } = useAuth();

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted flex items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-elevated">
        <CardHeader className="text-center">
          <div className="mx-auto w-12 h-12 bg-gradient-primary rounded-lg flex items-center justify-center mb-4">
            <Clock className="w-6 h-6 text-white" />
          </div>
          <CardTitle className="text-2xl font-bold">Account Pending Approval</CardTitle>
          <CardDescription>
            Your student account is waiting for admin approval
          </CardDescription>
        </CardHeader>
        
        <CardContent className="text-center space-y-4">
          <div className="p-4 bg-warning/10 rounded-lg border border-warning/20">
            <p className="text-sm text-muted-foreground">
              Thank you for registering with STEMTribe LMS! Your account has been created successfully, 
              but it needs to be approved by an administrator before you can access courses.
            </p>
          </div>
          
          <div className="space-y-2">
            <h4 className="font-semibold">What's next?</h4>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• An admin will review your account</li>
              <li>• You'll receive an email when approved</li>
              <li>• Then you can start learning!</li>
            </ul>
          </div>
          
          <Button 
            variant="outline" 
            onClick={signOut}
            className="w-full"
          >
            Sign Out
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}