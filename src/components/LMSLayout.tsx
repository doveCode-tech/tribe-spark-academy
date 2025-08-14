import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { LMSSidebar } from "@/components/LMSSidebar";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { NotificationsBell } from "@/components/NotificationsBell";
import { SearchBar } from "@/components/SearchBar";
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
                  <SearchBar />
                </div>
                
                {/* User Actions */}
                 <div className="flex items-center space-x-2">
                   {/* Notifications */}
                   <NotificationsBell />
                   
                   <Avatar className="h-8 w-8">
                     <AvatarImage src={userProfile?.avatar_url || undefined} alt={userProfile?.name || userProfile?.email || 'User'} />
                     <AvatarFallback>{(userProfile?.name || userProfile?.email || '?').slice(0,2).toUpperCase()}</AvatarFallback>
                   </Avatar>
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