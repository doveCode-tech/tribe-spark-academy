-- Secure the tutor workflow and make session completion atomic.

CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.users WHERE auth_user_id = auth.uid() LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.user_can_teach_course(_course_id uuid, _auth_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.users u
    WHERE u.auth_user_id = _auth_id
      AND (
        u.role = 'admin'
        OR EXISTS (
          SELECT 1 FROM public.course_tutors ct
          WHERE ct.course_id = _course_id AND ct.tutor_id = _auth_id
        )
        OR EXISTS (
          SELECT 1 FROM public.tutor_qualifications tq
          WHERE tq.course_id = _course_id AND tq.tutor_id = u.id
        )
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.student_has_tutor(_student_auth_id uuid, _tutor_auth_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.enrollments e
    JOIN public.course_tutors ct ON ct.course_id = e.course_id
    WHERE (e.student_id = _student_auth_id OR e.student_id IN (
      SELECT id FROM public.users WHERE auth_user_id = _student_auth_id
    ))
      AND ct.tutor_id = _tutor_auth_id
  );
$$;

CREATE POLICY "Teaching staff view authorized student profiles"
ON public.users FOR SELECT TO authenticated
USING (
  role = 'student'
  AND EXISTS (
    SELECT 1
    FROM public.enrollments e
    JOIN public.course_tutors ct ON ct.course_id = e.course_id
    WHERE (e.student_id = users.id OR e.student_id = users.auth_user_id)
      AND ct.tutor_id = auth.uid()
  )
  OR (
    public.current_user_role() = 'ultimate_tutor'
    AND EXISTS (
      SELECT 1
      FROM public.enrollments e
      JOIN public.tutor_qualifications tq ON tq.course_id = e.course_id
      WHERE (e.student_id = users.id OR e.student_id = users.auth_user_id)
        AND tq.tutor_id IN (SELECT id FROM public.users WHERE auth_user_id = auth.uid())
    )
  )
);
);

DROP POLICY IF EXISTS "Tutors and admins can view all lessons" ON public.lessons;
DROP POLICY IF EXISTS "Only tutors/admins can manage lessons" ON public.lessons;
CREATE POLICY "Teaching staff view authorized lessons"
ON public.lessons FOR SELECT TO authenticated
USING (
  public.user_can_teach_course(course_id)
  OR EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.auth_user_id = auth.uid() AND u.role = 'admin'
  )
);

CREATE POLICY "Teaching staff manage authorized lessons"
ON public.lessons FOR ALL TO authenticated
USING (public.user_can_teach_course(course_id))
WITH CHECK (public.user_can_teach_course(course_id));

-- Submissions: students see their own work; staff see only courses they teach.
DROP POLICY IF EXISTS "Student reads own projects" ON public.projects;
DROP POLICY IF EXISTS "Student updates own projects" ON public.projects;
DROP POLICY IF EXISTS "Allow student insert" ON public.projects;

CREATE POLICY "Students and authorized staff read projects"
ON public.projects FOR SELECT TO authenticated
USING (
  student_id = auth.uid()
  OR student_id IN (SELECT id FROM public.users WHERE auth_user_id = auth.uid())
  OR public.user_can_teach_course(course_id)
);

CREATE POLICY "Students submit projects"
ON public.projects FOR INSERT TO authenticated
WITH CHECK (
  student_id = auth.uid()
  OR student_id IN (SELECT id FROM public.users WHERE auth_user_id = auth.uid())
);

CREATE POLICY "Students and authorized staff update projects"
ON public.projects FOR UPDATE TO authenticated
USING (
  student_id = auth.uid()
  OR student_id IN (SELECT id FROM public.users WHERE auth_user_id = auth.uid())
  OR public.user_can_teach_course(course_id)
)
WITH CHECK (
  student_id = auth.uid()
  OR student_id IN (SELECT id FROM public.users WHERE auth_user_id = auth.uid())
  OR public.user_can_teach_course(course_id)
);

CREATE OR REPLACE FUNCTION public.preserve_project_submission_history()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.submitted_at IS DISTINCT FROM NEW.submitted_at
     OR OLD.code_content IS DISTINCT FROM NEW.code_content
     OR OLD.link IS DISTINCT FROM NEW.link THEN
    NEW.submission_history = COALESCE(OLD.submission_history, '[]'::jsonb) || jsonb_build_array(
      jsonb_build_object(
        'submitted_at', OLD.submitted_at,
        'title', OLD.title,
        'description', OLD.description,
        'link', OLD.link,
        'code_content', OLD.code_content,
        'file_path', OLD.file_path,
        'grade', OLD.grade,
        'feedback', OLD.feedback,
        'review_status', OLD.review_status
      )
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS projects_preserve_submission_history ON public.projects;
CREATE TRIGGER projects_preserve_submission_history
BEFORE UPDATE ON public.projects
FOR EACH ROW EXECUTE FUNCTION public.preserve_project_submission_history();

-- No broadcast-to-all-staff chat. A student can message only an assigned tutor.
DROP POLICY IF EXISTS "Users can read their messages and staff can read student chats" ON public.chat_messages;
DROP POLICY IF EXISTS "Users can send messages" ON public.chat_messages;

CREATE POLICY "Participants read authorized chat messages"
ON public.chat_messages FOR SELECT TO authenticated
USING (
  sender_id = auth.uid()
  OR recipient_id = auth.uid()
  OR public.current_user_role() = 'admin'
  OR (
    public.current_user_role() IN ('tutor', 'ultimate_tutor')
    AND (
      public.student_has_tutor(sender_id, auth.uid())
      OR public.student_has_tutor(recipient_id, auth.uid())
    )
  )
);

CREATE POLICY "Students message assigned tutors"
ON public.chat_messages FOR INSERT TO authenticated
WITH CHECK (
  sender_id = auth.uid()
  AND recipient_id IS NOT NULL
  AND (
    public.current_user_role() = 'admin'
    OR public.student_has_tutor(auth.uid(), recipient_id)
    OR (
      public.current_user_role() IN ('tutor', 'ultimate_tutor')
      AND public.student_has_tutor(recipient_id, auth.uid())
    )
  )
);

CREATE POLICY "Participants update chat messages"
ON public.chat_messages FOR UPDATE TO authenticated
USING (sender_id = auth.uid() OR recipient_id = auth.uid() OR public.current_user_role() = 'admin')
WITH CHECK (sender_id = auth.uid() OR recipient_id = auth.uid() OR public.current_user_role() = 'admin');

-- Qualifications are private staff-management data.
DROP POLICY IF EXISTS "Public or authenticated view qualifications" ON public.tutor_qualifications;
CREATE POLICY "Authorized users view qualifications"
ON public.tutor_qualifications FOR SELECT TO authenticated
USING (
  tutor_id IN (SELECT id FROM public.users WHERE auth_user_id = auth.uid())
  OR public.current_user_role() IN ('admin', 'ultimate_tutor')
);

-- Sessions and reports are visible only to participants or authorized management.
DROP POLICY IF EXISTS "Users can view relevant sessions" ON public.class_sessions;
CREATE POLICY "Participants view class sessions"
ON public.class_sessions FOR SELECT TO authenticated
USING (
  tutor_id IN (SELECT id FROM public.users WHERE auth_user_id = auth.uid())
  OR student_id IN (SELECT id FROM public.users WHERE auth_user_id = auth.uid())
  OR public.current_user_role() = 'admin'
  OR (public.current_user_role() = 'ultimate_tutor' AND public.user_can_teach_course(course_id))
  OR (status = 'available' AND public.current_user_role() IN ('tutor', 'ultimate_tutor'))
);

DROP POLICY IF EXISTS "Tutors can update assigned or claim available sessions" ON public.class_sessions;
CREATE POLICY "Assigned tutors update class sessions"
ON public.class_sessions FOR UPDATE TO authenticated
USING (
  tutor_id IN (SELECT id FROM public.users WHERE auth_user_id = auth.uid())
  OR (status = 'available' AND public.user_can_teach_course(course_id))
  OR public.current_user_role() = 'admin'
)
WITH CHECK (
  tutor_id IN (SELECT id FROM public.users WHERE auth_user_id = auth.uid())
  OR public.current_user_role() = 'admin'
);

DROP POLICY IF EXISTS "Users can view relevant session reports" ON public.session_reports;
CREATE POLICY "Participants view session reports"
ON public.session_reports FOR SELECT TO authenticated
USING (
  tutor_id IN (SELECT id FROM public.users WHERE auth_user_id = auth.uid())
  OR student_id IN (SELECT id FROM public.users WHERE auth_user_id = auth.uid())
  OR public.current_user_role() = 'admin'
  OR (public.current_user_role() = 'ultimate_tutor' AND public.user_can_teach_course(course_id))
);

DROP POLICY IF EXISTS "Tutors can insert session reports" ON public.session_reports;
DROP POLICY IF EXISTS "Tutors and admins can update session reports" ON public.session_reports;
CREATE POLICY "Assigned tutors manage session reports"
ON public.session_reports FOR ALL TO authenticated
USING (
  tutor_id IN (SELECT id FROM public.users WHERE auth_user_id = auth.uid())
  OR public.current_user_role() = 'admin'
  OR (public.current_user_role() = 'ultimate_tutor' AND public.user_can_teach_course(course_id))
)
WITH CHECK (
  tutor_id IN (SELECT id FROM public.users WHERE auth_user_id = auth.uid())
  OR public.current_user_role() = 'admin'
  OR (public.current_user_role() = 'ultimate_tutor' AND public.user_can_teach_course(course_id))
);

CREATE OR REPLACE FUNCTION public.submit_session_report_and_end_session(
  _session_id uuid,
  _report_data jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_session public.class_sessions%ROWTYPE;
  v_tutor public.users%ROWTYPE;
  v_report_id uuid;
BEGIN
  SELECT * INTO v_tutor FROM public.users WHERE auth_user_id = auth.uid() LIMIT 1;
  IF v_tutor.id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT * INTO v_session FROM public.class_sessions WHERE id = _session_id FOR UPDATE;
  IF v_session.id IS NULL THEN RAISE EXCEPTION 'Session not found'; END IF;
  IF v_tutor.role <> 'admin' AND v_session.tutor_id <> v_tutor.id THEN
    RAISE EXCEPTION 'You are not assigned to this session';
  END IF;
  IF COALESCE(trim(_report_data->>'topics_covered'), '') = '' THEN
    RAISE EXCEPTION 'Topics covered are required';
  END IF;

  INSERT INTO public.session_reports (
    session_id, tutor_id, student_id, course_id, attendance_status,
    topics_covered, student_performance, homework_assigned,
    notes_for_parents, internal_notes
  ) VALUES (
    v_session.id, v_tutor.id, v_session.student_id, v_session.course_id,
    COALESCE(_report_data->>'attendance_status', 'attended'),
    trim(_report_data->>'topics_covered'),
    COALESCE((_report_data->>'student_performance')::integer, 5),
    COALESCE(_report_data->>'homework_assigned', ''),
    COALESCE(_report_data->>'notes_for_parents', ''),
    COALESCE(_report_data->>'internal_notes', '')
  )
  RETURNING id INTO v_report_id;

  UPDATE public.class_sessions
  SET status = 'ended', actual_ended_at = now(), session_report_id = v_report_id
  WHERE id = v_session.id;

  INSERT INTO public.audit_logs(action_type, performed_by, target_type, target_id, details, status)
  VALUES ('end_session_with_report', v_tutor.id::text, 'class_session', v_session.id::text,
          jsonb_build_object('report_id', v_report_id), 'success');

  RETURN v_report_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_session_report_and_end_session(uuid, jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.require_session_report_before_end()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.status = 'ended' AND (
    NEW.session_report_id IS NULL
    OR NOT EXISTS (SELECT 1 FROM public.session_reports sr WHERE sr.id = NEW.session_report_id AND sr.session_id = NEW.id)
  ) THEN
    RAISE EXCEPTION 'A valid session report is required before ending a session';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS class_sessions_require_report ON public.class_sessions;
CREATE TRIGGER class_sessions_require_report
BEFORE UPDATE ON public.class_sessions
FOR EACH ROW EXECUTE FUNCTION public.require_session_report_before_end();
