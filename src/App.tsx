import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";

import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import Index from "./pages/Index";
import Courses from "./pages/Courses";
import CourseDetail from "./pages/CourseDetail";
import LessonDetail from "./pages/LessonDetail";
import Achievements from "./pages/Achievements";
import Portfolio from "./pages/Portfolio";
import Chat from "./pages/Chat";
import Auth from "./pages/Auth";
import Register from "./pages/Register";
import ResetPassword from "./pages/ResetPassword";
import Profile from "./pages/Profile";
import PendingApproval from "./pages/PendingApproval";
import NotFound from "./pages/NotFound";
import Analytics from "./pages/Analytics";
import Users from "./pages/Users";
import Settings from "./pages/Settings";
import CreateTutor from "./pages/CreateTutor";
import Reports from "./pages/Reports";
import Badges from "./pages/Badges";
import Lessons from "./pages/Lessons";
import TutorCourseDetail from "./pages/TutorCourseDetail";
import PublicPortfolio from "./pages/PublicPortfolio";



const App = () => (
  <TooltipProvider>
    <Toaster />
    <Sonner />
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/auth" element={<Auth />} />
          <Route path="/register" element={<Register />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/pending-approval" element={<PendingApproval />} />
          <Route path="/" element={
            <ProtectedRoute>
              <Index />
            </ProtectedRoute>
          } />
          <Route path="/courses" element={
            <ProtectedRoute>
              <Courses />
            </ProtectedRoute>
          } />
          <Route path="/courses/:courseId" element={
            <ProtectedRoute>
              <CourseDetail />
            </ProtectedRoute>
          } />
          <Route path="/lesson/:lessonId" element={
            <ProtectedRoute>
              <LessonDetail />
            </ProtectedRoute>
          } />
          <Route path="/achievements" element={
            <ProtectedRoute>
              <Achievements />
            </ProtectedRoute>
          } />
          <Route path="/portfolio" element={
            <ProtectedRoute>
              <Portfolio />
            </ProtectedRoute>
          } />
          <Route path="/chat" element={
            <ProtectedRoute>
              <Chat />
            </ProtectedRoute>
          } />
          <Route path="/profile" element={
            <ProtectedRoute>
              <Profile />
            </ProtectedRoute>
          } />
          <Route path="/analytics" element={
            <ProtectedRoute>
              <Analytics />
            </ProtectedRoute>
          } />
          <Route path="/users" element={
            <ProtectedRoute>
              <Users />
            </ProtectedRoute>
          } />
          <Route path="/settings" element={
            <ProtectedRoute>
              <Settings />
            </ProtectedRoute>
          } />
          <Route path="/create-tutor" element={
            <ProtectedRoute>
              <CreateTutor />
            </ProtectedRoute>
          } />
          <Route path="/reports" element={
            <ProtectedRoute>
              <Reports />
            </ProtectedRoute>
          } />
          <Route path="/badges" element={
            <ProtectedRoute>
              <Badges />
            </ProtectedRoute>
          } />
          <Route path="/lessons/:courseId" element={
            <ProtectedRoute>
              <Lessons />
            </ProtectedRoute>
          } />
          <Route path="/tutor/course/:courseId" element={
            <ProtectedRoute>
              <TutorCourseDetail />
            </ProtectedRoute>
          } />
          <Route path="/portfolio/student/:studentId" element={<PublicPortfolio />} />
          <Route path="/portfolio/:studentId" element={<PublicPortfolio />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  </TooltipProvider>
);


export default App;
