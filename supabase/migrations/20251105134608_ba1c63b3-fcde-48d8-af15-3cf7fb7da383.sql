-- Add unique constraint to prevent duplicate active reports for same student+course
-- Drop existing constraint if it exists
DROP INDEX IF EXISTS idx_unique_active_report_per_student_course;

-- Create partial unique index for active reports (pending or approved status)
CREATE UNIQUE INDEX idx_unique_active_report_per_student_course 
ON reports (student_id, course_id, tutor_id) 
WHERE status IN ('pending_review', 'approved');