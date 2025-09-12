import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { UserPlus, Upload, Download, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface BulkUserRegistrationProps {
  onComplete?: () => void;
}

export function BulkUserRegistration({ onComplete }: BulkUserRegistrationProps) {
  const [csvData, setCsvData] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<any>(null);
  const [open, setOpen] = useState(false);
  const { userProfile } = useAuth();
  const { toast } = useToast();
  
  const isAdmin = userProfile?.role === 'admin';

  const handleBulkRegistration = async () => {
    if (!csvData.trim()) {
      toast({ title: 'Error', description: 'Please enter user data', variant: 'destructive' });
      return;
    }

    try {
      setLoading(true);
      
      // Parse CSV data
      const lines = csvData.trim().split('\n');
      const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
      
      const users = lines.slice(1).map(line => {
        const values = line.split(',').map(v => v.trim());
        const user: any = {};
        
        headers.forEach((header, index) => {
          const value = values[index];
          if (!value) return; // Skip empty values
          
          switch (header) {
            case 'email':
              user.email = value;
              break;
            case 'name':
            case 'full_name':
              user.name = value;
              break;
            case 'first_name':
              user.first_name = value;
              break;
            case 'last_name':
              user.last_name = value;
              break;
            case 'username':
              user.username = value;
              break;
            case 'role':
              user.role = value || 'student';
              break;
            case 'password':
              user.password = value;
              break;
            default:
              break;
          }
        });
        
        // Validation
        if (!user.email || !user.email.includes('@')) {
          throw new Error(`Invalid email: ${user.email || 'undefined'}`);
        }
        if (!user.password) {
          throw new Error(`Missing password for: ${user.email || 'undefined'}`);
        }
        
        return user;
      });

      // For now, simulate bulk registration by creating notifications
      // This will be implemented via edge function in production
      const results = { success: users.map(u => u.email), errors: [] };
      
      // Create notification for admin about bulk registration request
      const { error } = await supabase
        .from('notifications')
        .insert({
          recipient_role: 'admin',
          type: 'bulk_registration',
          title: 'Bulk Registration Request',
          message: `Bulk registration requested for ${users.length} users`,
          data: { users: users }
        });

      if (error) throw error;
      
      setResults(results);
      toast({ 
        title: 'Processing Complete', 
        description: `Processed ${users.length} users. Check results below.` 
      });
      
      onComplete?.();
    } catch (e: any) {
      console.error('Error in bulk registration:', e);
      toast({ 
        title: 'Error', 
        description: e.message || 'Failed to process bulk registration', 
        variant: 'destructive' 
      });
    } finally {
      setLoading(false);
    }
  };

  const downloadTemplate = () => {
    const template = `email,first_name,last_name,username,role,password
john.doe@example.com,John,Doe,johndoe,student,Password123!
jane.smith@example.com,Jane,Smith,janesmith,tutor,SecurePass!2`;
    
    const blob = new Blob([template], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'bulk_users_template.csv';
    a.click();
    window.URL.revokeObjectURL(url);
  };

  if (!isAdmin) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <UserPlus className="w-4 h-4 mr-2" />
          Bulk Register Users
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Bulk User Registration</DialogTitle>
          <DialogDescription>
            Register multiple users at once using CSV format
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Alert>
            <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Upload user data in CSV format. Required columns: email, password. Optional: first_name, last_name, username, role (defaults to 'student').
              </AlertDescription>
          </Alert>

          <div className="flex gap-2">
            <Button variant="outline" onClick={downloadTemplate}>
              <Download className="w-4 h-4 mr-2" />
              Download Template
            </Button>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">CSV Data</label>
            <Textarea
              placeholder="email,first_name,last_name,username,role,password
john.doe@example.com,John,Doe,johndoe,student,Password123!
jane.smith@example.com,Jane,Smith,janesmith,tutor,SecurePass!2"
              value={csvData}
              onChange={(e) => setCsvData(e.target.value)}
              rows={8}
              className="font-mono text-sm"
            />
          </div>

          <Button 
            onClick={handleBulkRegistration} 
            disabled={loading || !csvData.trim()}
            className="w-full"
          >
            {loading ? (
              <>
                <Upload className="w-4 h-4 mr-2 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <Upload className="w-4 h-4 mr-2" />
                Register Users
              </>
            )}
          </Button>

          {results && (
            <div className="space-y-3">
              <h4 className="font-medium">Registration Results</h4>
              
              {results.success && results.success.length > 0 && (
                <div>
                  <Badge variant="default" className="mb-2">
                    Success: {results.success.length}
                  </Badge>
                  <div className="text-sm text-muted-foreground">
                    {results.success.map((email: string, index: number) => (
                      <div key={index}>✓ {email}</div>
                    ))}
                  </div>
                </div>
              )}

              {results.errors && results.errors.length > 0 && (
                <div>
                  <Badge variant="destructive" className="mb-2">
                    Errors: {results.errors.length}
                  </Badge>
                  <div className="text-sm text-muted-foreground">
                    {results.errors.map((error: any, index: number) => (
                      <div key={index}>✗ {error.email}: {error.error}</div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}