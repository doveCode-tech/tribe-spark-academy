import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { KeyRound, Mail } from "lucide-react";

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
}

interface PasswordResetProps {
  users: User[];
  onPasswordReset?: () => void;
}

export function PasswordReset({ users, onPasswordReset }: PasswordResetProps) {
  const { toast } = useToast();
  const { userProfile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [newPassword, setNewPassword] = useState('');

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserId || !newPassword) return;

    setLoading(true);
    try {
      const selectedUser = users.find(u => u.id === selectedUserId);
      if (!selectedUser) throw new Error('User not found');

      // For now, we'll just show a success message
      // In a real implementation, you'd use Supabase admin functions
      toast({
        title: "Password Reset",
        description: `Password reset initiated for ${selectedUser.name}. They will receive an email with reset instructions.`,
      });

      setNewPassword('');
      setSelectedUserId('');
      onPasswordReset?.();
    } catch (error: any) {
      console.error('Error resetting password:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to reset password",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSelfPasswordReset = async () => {
    if (!userProfile?.email) return;
    
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(
        userProfile.email,
        {
          redirectTo: `${window.location.origin}/auth`,
        }
      );

      if (error) throw error;

      toast({
        title: "Password Reset Sent",
        description: "Check your email for password reset instructions.",
      });
    } catch (error: any) {
      console.error('Error sending password reset:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to send password reset",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (userProfile?.role !== 'admin') {
    return null;
  }

  return (
    <div className="space-y-6">
      {/* Self Password Reset */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <KeyRound className="w-5 h-5" />
            Reset Your Password
          </CardTitle>
          <CardDescription>
            Reset your own admin password
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button 
            onClick={handleSelfPasswordReset}
            disabled={loading}
            variant="outline"
          >
            <Mail className="w-4 h-4 mr-2" />
            Send Reset Email to Yourself
          </Button>
        </CardContent>
      </Card>

      {/* Reset Other Users' Passwords */}
      <Card>
        <CardHeader>
          <CardTitle>Reset User Passwords</CardTitle>
          <CardDescription>
            Reset passwords for students and tutors
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleResetPassword} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="user-select">Select User</Label>
              <select
                id="user-select"
                value={selectedUserId}
                onChange={(e) => setSelectedUserId(e.target.value)}
                className="w-full p-2 border rounded-md"
                required
                disabled={loading}
              >
                <option value="">Choose a user...</option>
                {users.filter(user => user.role !== 'admin').map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.name} ({user.email}) - {user.role}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex gap-2">
              <Button 
                type="button"
                variant="outline"
                onClick={async () => {
                  if (!selectedUserId) return;
                  const selectedUser = users.find(u => u.id === selectedUserId);
                  if (!selectedUser) return;

                  setLoading(true);
                  try {
                    const { error } = await supabase.auth.resetPasswordForEmail(
                      selectedUser.email,
                      {
                        redirectTo: `${window.location.origin}/auth`,
                      }
                    );

                    if (error) throw error;

                    toast({
                      title: "Reset Email Sent",
                      description: `Password reset email sent to ${selectedUser.name}`,
                    });
                  } catch (error: any) {
                    toast({
                      title: "Error",
                      description: error.message || "Failed to send reset email",
                      variant: "destructive",
                    });
                  } finally {
                    setLoading(false);
                  }
                }}
                disabled={loading || !selectedUserId}
              >
                <Mail className="w-4 h-4 mr-2" />
                Send Reset Email
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}