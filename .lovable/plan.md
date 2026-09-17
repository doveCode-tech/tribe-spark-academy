# Tutor, Submission, Profile, and Permission Workflow

## Scope
Connect the existing workflow components without rebuilding the LMS or changing unrelated features.

## Implementation
1. Add the central submission and student profile routes, then update existing “View Submission” and student-name links to use them.
2. Replace the Tutor Dashboard’s inline grading widget with authorized course sections, counts, recent submissions, and links to `SubmissionDetailPage`.
3. Add server-enforced access helpers/RPCs and RLS updates for tutor-qualified or assigned courses, submissions, profiles, chat, and session reports.
4. Make `LessonGradingPage` role-aware: tutors get assignment review only, Ultimate Tutors get advanced grading, and Admins get settings plus advanced grading.
5. Preserve submission history during resubmission and route all review actions through the existing central detail page.
6. Restrict live chat to assigned tutor/student conversations, persist recipient-specific messages, and keep realtime updates.
7. Add an atomic session-report-and-end RPC and update the existing session dialog/dashboard to use it.
8. Verify with the project build, diagnostics, and targeted authenticated/public route checks where available.

## Technical details
- Reuse `SubmissionDetailPage`, `StudentProfilePage`, `TutorDashboard`, `TutorSessionDashboard`, and existing Supabase tables.
- Use a new migration with explicit public-table grants where applicable, security-definer RPCs with auth checks, and restrictive policies; no mock data.
- Keep existing UI styling and preserve the AI assistant and unrelated dashboard help controls.
