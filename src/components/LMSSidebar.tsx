import { 
  BookOpen, 
  GraduationCap, 
  Users, 
  BarChart3, 
  Settings, 
  Sparkles,
  Trophy,
  User,
  Home,
  PlusCircle,
  UserPlus,
  BookOpenCheck,
  FileText,
  Award,
  Calendar
} from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { useAuth } from "@/contexts/AuthContext";

// Define user role type
type UserRole = 'student' | 'tutor' | 'ultimate_tutor' | 'admin';

const studentItems = [
  { title: "Dashboard", url: "/", icon: Home },
  { title: "My Courses", url: "/courses", icon: BookOpen },
  { title: "Study Calendar", url: "/calendar", icon: Calendar },
  { title: "AI Learning Assistant", url: "/chat?tab=ai", icon: Sparkles },
  { title: "Portfolio", url: "/portfolio", icon: User },
  { title: "Achievements", url: "/achievements", icon: Trophy },
  { title: "Badges", url: "/badges", icon: Award },
  { title: "Profile", url: "/profile", icon: Settings },
];

const tutorItems = [
  { title: "Dashboard", url: "/", icon: Home },
  { title: "Courses", url: "/courses", icon: BookOpen },
  { title: "AI Learning Assistant", url: "/chat?tab=ai", icon: Sparkles },
  { title: "Reports", url: "/reports", icon: FileText },
  { title: "Badges", url: "/badges", icon: Award },
  { title: "Profile", url: "/profile", icon: Settings },
];

const ultimateTutorItems = [
  { title: "Dashboard", url: "/", icon: Home },
  { title: "Analytics", url: "/analytics", icon: BarChart3 },
  { title: "Manage Users", url: "/users", icon: Users },
  { title: "Course Management", url: "/courses", icon: BookOpen },
  { title: "AI Learning Assistant", url: "/chat?tab=ai", icon: Sparkles },
  { title: "Reports", url: "/reports", icon: FileText },
  { title: "Badges", url: "/badges", icon: Award },
  { title: "Profile", url: "/profile", icon: User },
  { title: "Settings", url: "/settings", icon: Settings },
];

const adminItems = [
  { title: "Dashboard", url: "/", icon: Home },
  { title: "Analytics", url: "/analytics", icon: BarChart3 },
  { title: "Manage Users", url: "/users", icon: Users },
  { title: "Course Management", url: "/courses", icon: BookOpen },
  { title: "AI Learning Assistant", url: "/chat?tab=ai", icon: Sparkles },
  { title: "Reports", url: "/reports", icon: FileText },
  { title: "Badges", url: "/badges", icon: Award },
  { title: "Create Tutor", url: "/create-tutor", icon: PlusCircle },
  { title: "Profile", url: "/profile", icon: User },
  { title: "Settings", url: "/settings", icon: Settings },
];

const getMenuItems = (role: UserRole | undefined) => {
  switch (role) {
    case 'student': return studentItems;
    case 'tutor': return tutorItems;
    case 'ultimate_tutor': return ultimateTutorItems;
    case 'admin': return adminItems;
    default: return studentItems;
  }
};

const getRoleDisplayName = (role: UserRole | undefined) => {
  switch (role) {
    case 'student': return 'Student Portal';
    case 'tutor': return 'Tutor Dashboard';
    case 'ultimate_tutor': return 'Ultimate Tutor Panel';
    case 'admin': return 'Admin Panel';
    default: return 'STEMTribe LMS';
  }
};

export function LMSSidebar() {
  const { state } = useSidebar();
  const { userProfile } = useAuth();
  const location = useLocation();
  const currentPath = location.pathname;
  const userRole = userProfile?.role as UserRole;
  const menuItems = getMenuItems(userRole);
  const collapsed = state === "collapsed";
  
  const isActive = (path: string) => currentPath === path;
  const getNavClass = ({ isActive }: { isActive: boolean }) =>
    isActive 
      ? "bg-purple-700 text-white font-semibold shadow-xs border border-purple-400/30" 
      : "text-slate-100 hover:text-white hover:bg-white/10 transition-colors";

  return (
    <Sidebar 
      className={`${collapsed ? "w-16" : "w-64"} transition-all duration-300 text-slate-100`}
      collapsible="icon"
    >
      <SidebarContent className="bg-sidebar border-r border-sidebar-border text-slate-100">
        {/* Logo/Brand Section */}
        <div className="p-4 border-b border-sidebar-border">
          {!collapsed && (
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-gradient-primary rounded-lg flex items-center justify-center shrink-0">
                <GraduationCap className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-white font-bold text-lg leading-tight">STEMTribe</h2>
                <p className="text-purple-200 text-xs font-medium">{getRoleDisplayName(userRole)}</p>
              </div>
            </div>
          )}
          {collapsed && (
            <div className="flex justify-center">
              <div className="w-8 h-8 bg-gradient-primary rounded-lg flex items-center justify-center">
                <GraduationCap className="w-5 h-5 text-white" />
              </div>
            </div>
          )}
        </div>

        {/* Main Navigation */}
        <SidebarGroup className="flex-1 px-2 py-4">
          <SidebarGroupContent>
            <SidebarMenu className="space-y-2">
              {menuItems.map((item) => {
                const active = isActive(item.url);
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild className="w-full">
                      <NavLink 
                        to={item.url} 
                        end 
                        className={getNavClass}
                      >
                        <item.icon className={`${collapsed ? 'w-5 h-5' : 'w-5 h-5 mr-3'} shrink-0 ${active ? 'text-white' : 'text-purple-200 group-hover:text-white'}`} />
                        {!collapsed && (
                          <span className={`font-medium text-sm ${active ? 'text-white font-semibold' : 'text-slate-100 group-hover:text-white'}`}>
                            {item.title}
                          </span>
                        )}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* User Profile Section */}
        <div className="p-4 border-t border-sidebar-border">
          {!collapsed && (
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-secondary rounded-full flex items-center justify-center shrink-0">
                <User className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white font-semibold text-sm truncate">
                  {userProfile?.name || 'User'}
                </p>
                <p className="text-purple-200 text-xs font-medium capitalize">
                  {userRole || 'student'}
                </p>
              </div>
            </div>
          )}
          {collapsed && (
            <div className="flex justify-center">
              <div className="w-8 h-8 bg-gradient-secondary rounded-full flex items-center justify-center">
                <User className="w-4 h-4 text-white" />
              </div>
            </div>
          )}
        </div>
      </SidebarContent>
    </Sidebar>
  );
}