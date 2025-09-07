-- First check existing constraints and add unique constraint if needed
ALTER TABLE enrollments ADD CONSTRAINT enrollments_student_course_unique UNIQUE (student_id, course_id);