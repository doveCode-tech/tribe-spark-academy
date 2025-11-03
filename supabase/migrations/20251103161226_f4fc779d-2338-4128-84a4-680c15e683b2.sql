-- Add founder signature and logo to admin_settings if not exists
-- These will store the URLs for certificate generation

-- Function to automatically award milestone badges
CREATE OR REPLACE FUNCTION public.check_and_award_milestone_badges()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_course_id uuid;
  v_completed_lessons int;
  v_total_lessons int;
  v_badge record;
  v_course_title text;
BEGIN
  -- Get the course_id from the lesson
  SELECT l.course_id, c.title 
  INTO v_course_id, v_course_title
  FROM lessons l
  JOIN courses c ON c.id = l.course_id
  WHERE l.id = NEW.lesson_id;
  
  -- Only proceed if lesson was just completed
  IF NEW.completed = true AND (OLD.completed IS NULL OR OLD.completed = false) THEN
    -- Count completed lessons in this course for this student
    SELECT COUNT(*) INTO v_completed_lessons
    FROM lesson_progress lp
    JOIN lessons l ON l.id = lp.lesson_id
    WHERE l.course_id = v_course_id
      AND lp.student_id = NEW.student_id
      AND lp.completed = true;
    
    -- Get total lessons in course
    SELECT COUNT(*) INTO v_total_lessons
    FROM lessons
    WHERE course_id = v_course_id;
    
    -- Check for milestone badges that should be awarded
    FOR v_badge IN 
      SELECT b.id, b.name, b.criteria
      FROM badges b
      WHERE b.criteria->>'type' = 'milestone'
        AND b.criteria->>'course_id' = v_course_id::text
        AND (b.criteria->>'lesson_interval')::int > 0
        AND v_completed_lessons % (b.criteria->>'lesson_interval')::int = 0
        AND NOT EXISTS (
          SELECT 1 FROM student_badges sb
          WHERE sb.student_id = NEW.student_id
            AND sb.badge_id = b.id
        )
    LOOP
      -- Award the badge
      INSERT INTO student_badges (student_id, badge_id, awarded_by)
      VALUES (NEW.student_id, v_badge.id, NEW.student_id);
      
      -- Notify the student
      INSERT INTO notifications (recipient_user_id, type, title, message, data)
      VALUES (
        NEW.student_id,
        'badge_awarded',
        'New Badge Earned! 🏆',
        'Congratulations! You earned the "' || v_badge.name || '" badge for completing ' || v_completed_lessons || ' lessons in ' || v_course_title || '!',
        jsonb_build_object(
          'badge_id', v_badge.id,
          'course_id', v_course_id,
          'lessons_completed', v_completed_lessons
        )
      );
    END LOOP;
    
    -- Check for course completion badge
    IF v_completed_lessons = v_total_lessons THEN
      FOR v_badge IN
        SELECT b.id, b.name
        FROM badges b
        WHERE b.criteria->>'type' = 'course_completion'
          AND b.criteria->>'course_id' = v_course_id::text
          AND NOT EXISTS (
            SELECT 1 FROM student_badges sb
            WHERE sb.student_id = NEW.student_id
              AND sb.badge_id = b.id
          )
      LOOP
        -- Award course completion badge
        INSERT INTO student_badges (student_id, badge_id, awarded_by)
        VALUES (NEW.student_id, v_badge.id, NEW.student_id);
        
        -- Notify the student
        INSERT INTO notifications (recipient_user_id, type, title, message, data)
        VALUES (
          NEW.student_id,
          'badge_awarded',
          'Course Completed! 🎓',
          'Congratulations! You completed all lessons in ' || v_course_title || ' and earned the "' || v_badge.name || '" badge!',
          jsonb_build_object(
            'badge_id', v_badge.id,
            'course_id', v_course_id,
            'course_completed', true
          )
        );
      END LOOP;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger for automatic badge awarding
DROP TRIGGER IF EXISTS trigger_award_milestone_badges ON lesson_progress;
CREATE TRIGGER trigger_award_milestone_badges
  AFTER INSERT OR UPDATE ON lesson_progress
  FOR EACH ROW
  EXECUTE FUNCTION check_and_award_milestone_badges();

-- Function to automatically generate certificate when course fully completed
CREATE OR REPLACE FUNCTION public.auto_generate_certificate()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_course_id uuid;
  v_student_name text;
  v_course_title text;
  v_completed_lessons int;
  v_total_lessons int;
  v_has_project boolean;
  v_founder_name text;
BEGIN
  -- Get course info
  SELECT l.course_id INTO v_course_id
  FROM lessons l
  WHERE l.id = NEW.lesson_id;
  
  -- Only proceed if lesson was just completed
  IF NEW.completed = true AND (OLD.completed IS NULL OR OLD.completed = false) THEN
    -- Count completed lessons
    SELECT COUNT(*) INTO v_completed_lessons
    FROM lesson_progress lp
    JOIN lessons l ON l.id = lp.lesson_id
    WHERE l.course_id = v_course_id
      AND lp.student_id = NEW.student_id
      AND lp.completed = true;
    
    -- Get total lessons
    SELECT COUNT(*) INTO v_total_lessons
    FROM lessons
    WHERE course_id = v_course_id;
    
    -- Check if student submitted final project
    SELECT EXISTS(
      SELECT 1 FROM projects
      WHERE student_id = NEW.student_id
        AND course_id = v_course_id
        AND grade IS NOT NULL
    ) INTO v_has_project;
    
    -- If all lessons completed AND project submitted/graded, generate certificate
    IF v_completed_lessons = v_total_lessons AND v_has_project THEN
      -- Get student and course details
      SELECT u.first_name || ' ' || u.last_name, c.title
      INTO v_student_name, v_course_title
      FROM users u, courses c
      WHERE u.auth_user_id = NEW.student_id
        AND c.id = v_course_id;
      
      -- Get founder name from settings or use default
      SELECT setting_value->>'founder_name' INTO v_founder_name
      FROM admin_settings
      WHERE setting_key = 'certificate_settings';
      
      v_founder_name := COALESCE(v_founder_name, 'Akeju Samson');
      
      -- Check if certificate doesn't already exist
      IF NOT EXISTS (
        SELECT 1 FROM certificates
        WHERE student_id = NEW.student_id
          AND course_id = v_course_id
      ) THEN
        -- Generate certificate
        INSERT INTO certificates (
          student_id,
          course_id,
          student_name,
          course_title,
          founder_name,
          completion_date,
          certificate_data
        ) VALUES (
          NEW.student_id,
          v_course_id,
          v_student_name,
          v_course_title,
          v_founder_name,
          CURRENT_DATE,
          jsonb_build_object('auto_generated', true)
        );
        
        -- Notify student
        INSERT INTO notifications (recipient_user_id, type, title, message, data)
        VALUES (
          NEW.student_id,
          'certificate_issued',
          'Certificate Generated! 📜',
          'Congratulations! Your certificate for completing ' || v_course_title || ' is now available!',
          jsonb_build_object(
            'course_id', v_course_id,
            'course_title', v_course_title
          )
        );
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger for automatic certificate generation
DROP TRIGGER IF EXISTS trigger_auto_generate_certificate ON lesson_progress;
CREATE TRIGGER trigger_auto_generate_certificate
  AFTER INSERT OR UPDATE ON lesson_progress
  FOR EACH ROW
  EXECUTE FUNCTION auto_generate_certificate();

-- Enable realtime for student_badges table so badges appear instantly
ALTER TABLE student_badges REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE student_badges;