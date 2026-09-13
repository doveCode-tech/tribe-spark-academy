import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface NotificationRequest {
  projectId?: string;
  courseId: string;
  studentId: string;
  projectTitle: string;
  lessonId?: string;
  description?: string;
  codeContent?: string;
  editorType?: string;
  link?: string;
  filePath?: string;
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

    const body: NotificationRequest = await req.json();
    const { courseId, studentId, projectTitle, lessonId, description, codeContent, editorType, link, filePath } = body;
    let projectId = body.projectId;

    console.log('Project submission request:', { projectId, courseId, studentId, projectTitle });

    // Look up student row to obtain users.id and auth_user_id
    const { data: student } = await supabase
      .from('users')
      .select('id, auth_user_id, name, email')
      .or(`auth_user_id.eq.${studentId},id.eq.${studentId}`)
      .maybeSingle();

    const studentName = student?.name || student?.email || 'A student';
    const userDbId = student?.id || studentId;
    const userAuthId = student?.auth_user_id || studentId;

    // If projectId is not provided, upsert project using service role key
    if (!projectId) {
      let existingQuery = supabase
        .from('projects')
        .select('id')
        .eq('course_id', courseId);

      if (lessonId) {
        existingQuery = existingQuery.eq('lesson_id', lessonId);
      }

      const { data: existingRows } = await existingQuery
        .or(`student_id.eq.${userDbId},student_id.eq.${userAuthId}`);

      const existing = existingRows?.[0];

      if (existing?.id) {
        projectId = existing.id;
        await supabase
          .from('projects')
          .update({
            title: projectTitle || 'Project submission',
            description: description || null,
            code_content: codeContent || null,
            editor_type: editorType || null,
            link: link || null,
            file_path: filePath || null,
            review_status: 'submitted',
            submitted_at: new Date().toISOString(),
          })
          .eq('id', existing.id);
      } else {
        // Try inserting with userDbId first (satisfies FK on public.users)
        const { data: inserted, error: iErr } = await supabase
          .from('projects')
          .insert({
            course_id: courseId,
            lesson_id: lessonId || null,
            student_id: userDbId,
            title: projectTitle || 'Project submission',
            description: description || null,
            code_content: codeContent || null,
            editor_type: editorType || null,
            link: link || null,
            file_path: filePath || null,
            review_status: 'submitted',
            submitted_at: new Date().toISOString(),
          })
          .select('id')
          .maybeSingle();

        if (iErr) {
          // Fallback to userAuthId if FK constraint targets auth.users
          const { data: insertedAuth } = await supabase
            .from('projects')
            .insert({
              course_id: courseId,
              lesson_id: lessonId || null,
              student_id: userAuthId,
              title: projectTitle || 'Project submission',
              description: description || null,
              code_content: codeContent || null,
              editor_type: editorType || null,
              link: link || null,
              file_path: filePath || null,
              review_status: 'submitted',
              submitted_at: new Date().toISOString(),
            })
            .select('id')
            .maybeSingle();
          projectId = insertedAuth?.id;
        } else {
          projectId = inserted?.id;
        }
      }
    }

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
      JSON.stringify({ success: true, message: 'Project submitted and notifications sent', projectId }),
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