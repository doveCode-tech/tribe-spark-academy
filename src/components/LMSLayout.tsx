import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { LMSSidebar } from "@/components/LMSSidebar";
import { Button } from "@/components/ui/button";
import { Bell, Search, LogOut } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/AuthContext";

interface LMSLayoutProps {
  children: React.ReactNode;
}

export function LMSLayout({ children }: LMSLayoutProps) {
  const { signOut, userProfile } = useAuth();

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <LMSSidebar />
        
        <div className="flex-1 flex flex-col">
          {/* Top Header */}
          <header className="h-16 border-b border-border bg-card shadow-sm">
            <div className="h-full px-6 flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <SidebarTrigger className="lg:hidden" />
                <h1 className="text-xl font-semibold text-foreground hidden sm:block">
                  STEMTribe Learning Management System
                </h1>
              </div>
              
              <div className="flex items-center space-x-4">
                {/* Search Bar */}
                <div className="relative hidden md:block">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                  <Input 
                    placeholder="Search courses, lessons..." 
                    className="pl-10 w-64"
                  />
                </div>
                
                {/* User Actions */}
                <div className="flex items-center space-x-2">
                  <Button variant="outline" size="icon" className="relative">
                    <Bell className="w-4 h-4" />
                    <span className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground text-xs rounded-full w-5 h-5 flex items-center justify-center">
                      3
                    </span>
                  </Button>
                  
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={signOut}
                  >
                    <LogOut className="w-4 h-4 mr-2" />
                    Logout
                  </Button>
                </div>
              </div>
            </div>
          </header>

          {/* Main Content */}
          <main className="flex-1 p-6 overflow-auto">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}