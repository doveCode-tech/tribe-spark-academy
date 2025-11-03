-- Function to award badges based on report grade
CREATE OR REPLACE FUNCTION public.award_badges_on_report_approval()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_badge_id uuid;
  v_badge_name text;
  v_course_title text;
BEGIN
  -- Only proceed if report was just approved
  IF NEW.status = 'approved' AND (OLD.status IS NULL OR OLD.status != 'approved') AND NEW.grade IS NOT NULL THEN
    
    -- Get course title
    SELECT title INTO v_course_title
    FROM courses
    WHERE id = NEW.course_id;
    
    -- Award "Excellent Performance" badge for grades 85-94
    IF NEW.grade >= 85 AND NEW.grade < 95 THEN
      SELECT id INTO v_badge_id
      FROM badges
      WHERE name = 'Excellent Performance'
      LIMIT 1;
      
      IF v_badge_id IS NOT NULL THEN
        INSERT INTO student_badges (student_id, badge_id, awarded_by)
        VALUES (NEW.student_id, v_badge_id, NEW.reviewed_by)
        ON CONFLICT (student_id, badge_id) DO NOTHING;
        
        -- Check if actually inserted (not duplicate)
        IF FOUND THEN
          INSERT INTO notifications (recipient_user_id, type, title, message, data)
          VALUES (
            NEW.student_id,
            'badge_awarded',
            'Excellent Performance! 🌟',
            'You earned the "Excellent Performance" badge for your excellent work in ' || COALESCE(v_course_title, 'your course') || '!',
            jsonb_build_object('badge_id', v_badge_id, 'report_id', NEW.id, 'grade', NEW.grade)
          );
        END IF;
      END IF;
    END IF;
    
    -- Award "Outstanding Project" badge for grades 95+
    IF NEW.grade >= 95 THEN
      SELECT id INTO v_badge_id
      FROM badges
      WHERE name = 'Outstanding Project'
      LIMIT 1;
      
      IF v_badge_id IS NOT NULL THEN
        INSERT INTO student_badges (student_id, badge_id, awarded_by)
        VALUES (NEW.student_id, v_badge_id, NEW.reviewed_by)
        ON CONFLICT (student_id, badge_id) DO NOTHING;
        
        IF FOUND THEN
          INSERT INTO notifications (recipient_user_id, type, title, message, data)
          VALUES (
            NEW.student_id,
            'badge_awarded',
            'Outstanding Work! 🏆',
            'You earned the "Outstanding Project" badge for exceptional performance in ' || COALESCE(v_course_title, 'your course') || '!',
            jsonb_build_object('badge_id', v_badge_id, 'report_id', NEW.id, 'grade', NEW.grade)
          );
        END IF;
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger for report-based badge awarding
DROP TRIGGER IF EXISTS trigger_award_badges_on_report ON reports;
CREATE TRIGGER trigger_award_badges_on_report
  AFTER INSERT OR UPDATE ON reports
  FOR EACH ROW
  EXECUTE FUNCTION award_badges_on_report_approval();