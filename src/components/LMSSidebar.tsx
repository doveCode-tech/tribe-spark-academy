import { 
  BookOpen, 
  GraduationCap, 
  Users, 
  BarChart3, 
  Settings, 
  MessageCircle,
  Trophy,
  User,
  Home,
  PlusCircle,
  UserPlus,
  BookOpenCheck
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

// Define user role type
type UserRole = 'student' | 'tutor' | 'admin';

// Mock user role for now - in real app this would come from auth context
const userRole = 'student' as UserRole;

const studentItems = [
  { title: "Dashboard", url: "/", icon: Home },
  { title: "My Courses", url: "/courses", icon: BookOpen },
  { title: "Achievements", url: "/achievements", icon: Trophy },
  { title: "Portfolio", url: "/portfolio", icon: User },
  { title: "AI Assistant", url: "/chat", icon: MessageCircle },
];

const tutorItems = [
  { title: "Dashboard", url: "/", icon: Home },
  { title: "My Students", url: "/students", icon: Users },
  { title: "Courses", url: "/courses", icon: BookOpen },
  { title: "Grading", url: "/grading", icon: BookOpenCheck },
  { title: "Create Student", url: "/create-student", icon: UserPlus },
  { title: "AI Assistant", url: "/chat", icon: MessageCircle },
];

const adminItems = [
  { title: "Dashboard", url: "/", icon: Home },
  { title: "Analytics", url: "/analytics", icon: BarChart3 },
  { title: "Manage Users", url: "/users", icon: Users },
  { title: "Course Management", url: "/courses", icon: BookOpen },
  { title: "Create Tutor", url: "/create-tutor", icon: PlusCircle },
  { title: "Settings", url: "/settings", icon: Settings },
];

const getMenuItems = () => {
  switch (userRole) {
    case 'student': return studentItems;
    case 'tutor': return tutorItems;
    case 'admin': return adminItems;
    default: return studentItems;
  }
};

const getRoleDisplayName = () => {
  switch (userRole) {
    case 'student': return 'Student Portal';
    case 'tutor': return 'Tutor Dashboard';
    case 'admin': return 'Admin Panel';
    default: return 'STEMTribe LMS';
  }
};

export function LMSSidebar() {
  const { state } = useSidebar();
  const location = useLocation();
  const currentPath = location.pathname;
  const menuItems = getMenuItems();
  const collapsed = state === "collapsed";
  
  const isActive = (path: string) => currentPath === path;
  const getNavClass = ({ isActive }: { isActive: boolean }) =>
    isActive 
      ? "bg-sidebar-primary text-sidebar-primary-foreground font-medium" 
      : "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors";

  return (
    <Sidebar 
      className={`${collapsed ? "w-16" : "w-64"} transition-all duration-300`}
      collapsible="icon"
    >
      <SidebarContent className="bg-sidebar border-r border-sidebar-border">
        {/* Logo/Brand Section */}
        <div className="p-4 border-b border-sidebar-border">
          {!collapsed && (
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-gradient-primary rounded-lg flex items-center justify-center">
                <GraduationCap className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-sidebar-foreground font-bold text-lg">STEMTribe</h2>
                <p className="text-sidebar-foreground/70 text-xs">{getRoleDisplayName()}</p>
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
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild className="w-full">
                    <NavLink 
                      to={item.url} 
                      end 
                      className={getNavClass}
                    >
                      <item.icon className={`${collapsed ? 'w-5 h-5' : 'w-5 h-5 mr-3'}`} />
                      {!collapsed && <span className="font-medium">{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* User Profile Section */}
        <div className="p-4 border-t border-sidebar-border">
          {!collapsed && (
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-secondary rounded-full flex items-center justify-center">
                <User className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sidebar-foreground font-medium text-sm truncate">
                  Alex Johnson
                </p>
                <p className="text-sidebar-foreground/70 text-xs capitalize">
                  {userRole}
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