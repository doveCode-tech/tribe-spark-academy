import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface NotificationRequest {
  projectId: string;
  courseId: string;
  studentId: string;
  projectTitle: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { projectId, courseId, studentId, projectTitle }: NotificationRequest = await req.json();

    console.log('Notifying about project submission:', { projectId, courseId, studentId, projectTitle });

    // Get student name
    const { data: student } = await supabase
      .from('users')
      .select('name, email')
      .eq('auth_user_id', studentId)
      .single();

    const studentName = student?.name || student?.email || 'A student';

    // Get course title
    const { data: course } = await supabase
      .from('courses')
      .select('title')
      .eq('id', courseId)
      .single();

    const courseTitle = course?.title || 'a course';

    // Notify all admins
    const { data: admins } = await supabase
      .from('users')
      .select('auth_user_id')
      .eq('role', 'admin');

    if (admins && admins.length > 0) {
      const adminNotifications = admins.map(admin => ({
        recipient_user_id: admin.auth_user_id,
        type: 'project_submission',
        title: 'New Project Submission',
        message: `${studentName} submitted "${projectTitle}" for ${courseTitle}`,
        data: {
          project_id: projectId,
          course_id: courseId,
          student_id: studentId,
        }
      }));

      const { error: adminNotifError } = await supabase
        .from('notifications')
        .insert(adminNotifications);

      if (adminNotifError) {
        console.error('Error creating admin notifications:', adminNotifError);
      } else {
        console.log(`Created ${adminNotifications.length} admin notifications`);
      }
    }

    // Notify assigned tutors for this course
    const { data: courseTutors } = await supabase
      .from('course_tutors')
      .select('tutor_id')
      .eq('course_id', courseId);

    if (courseTutors && courseTutors.length > 0) {
      const tutorNotifications = courseTutors.map(ct => ({
        recipient_user_id: ct.tutor_id,
        type: 'project_submission',
        title: 'New Project Submission',
        message: `${studentName} submitted "${projectTitle}" for ${courseTitle}`,
        data: {
          project_id: projectId,
          course_id: courseId,
          student_id: studentId,
        }
      }));

      const { error: tutorNotifError } = await supabase
        .from('notifications')
        .insert(tutorNotifications);

      if (tutorNotifError) {
        console.error('Error creating tutor notifications:', tutorNotifError);
      } else {
        console.log(`Created ${tutorNotifications.length} tutor notifications`);
      }
    }

    return new Response(
      JSON.stringify({ success: true, message: 'Notifications sent' }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error('Error in notify-project-submission:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      }
    );
  }
};

serve(handler);