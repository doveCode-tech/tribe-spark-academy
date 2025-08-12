-- 1) Storage buckets for lesson videos and project submissions
insert into storage.buckets (id, name, public)
values ('lesson-videos','lesson-videos', true)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('project-submissions','project-submissions', false)
on conflict (id) do nothing;

-- 1a) Storage policies for lesson-videos
-- Remove existing policies with same names if any to avoid conflicts
drop policy if exists "Lesson videos publicly accessible" on storage.objects;
drop policy if exists "Tutors/Admins can upload lesson videos" on storage.objects;
drop policy if exists "Tutors/Admins can manage lesson videos" on storage.objects;
drop policy if exists "Tutors/Admins can delete lesson videos" on storage.objects;

create policy "Lesson videos publicly accessible"
on storage.objects
for select
using (bucket_id = 'lesson-videos');

create policy "Tutors/Admins can upload lesson videos"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'lesson-videos' and exists (
    select 1 from public.users u
    where u.auth_user_id = auth.uid() and u.role in ('tutor','admin')
  )
);

create policy "Tutors/Admins can manage lesson videos"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'lesson-videos' and exists (
    select 1 from public.users u
    where u.auth_user_id = auth.uid() and u.role in ('tutor','admin')
  )
)
with check (
  bucket_id = 'lesson-videos' and exists (
    select 1 from public.users u
    where u.auth_user_id = auth.uid() and u.role in ('tutor','admin')
  )
);

create policy "Tutors/Admins can delete lesson videos"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'lesson-videos' and exists (
    select 1 from public.users u
    where u.auth_user_id = auth.uid() and u.role in ('tutor','admin')
  )
);

-- 1b) Storage policies for project-submissions
-- Files are expected to be stored under the path: <course_id>/<student_id>/<filename>

drop policy if exists "Students can upload own project files" on storage.objects;
drop policy if exists "Students can view own project files" on storage.objects;
drop policy if exists "Admins/Tutors can view project submissions" on storage.objects;

create policy "Students can upload own project files"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'project-submissions'
  and (storage.foldername(name))[2] = auth.uid()::text
);

create policy "Students can view own project files"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'project-submissions'
  and (storage.foldername(name))[2] = auth.uid()::text
);

create policy "Admins/Tutors can view project submissions"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'project-submissions' and (
    public.is_admin(auth.uid()) or exists (
      select 1 from public.users u where u.auth_user_id = auth.uid() and u.role = 'tutor'
    )
  )
);

-- 2) Projects table: add file_path to store uploaded file reference
alter table public.projects add column if not exists file_path text;

-- Helpful index for analytics queries
create index if not exists idx_projects_course_submitted_at on public.projects (course_id, submitted_at desc);

-- 2a) RLS policy to allow admins and tutors to view project submissions
-- (students already can view their own via existing policy)
drop policy if exists "Admins/Tutors can view projects" on public.projects;
create policy "Admins/Tutors can view projects"
on public.projects
for select
to authenticated
using (
  public.is_admin(auth.uid()) OR EXISTS (
    SELECT 1 FROM public.course_tutors ct
    WHERE ct.course_id = projects.course_id AND ct.tutor_id = auth.uid()
  )
);

-- 3) Automatically approve users in public.users when their email is confirmed in auth.users
create or replace function public.approve_user_on_email_confirm()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if NEW.email_confirmed_at is not null and (OLD.email_confirmed_at is distinct from NEW.email_confirmed_at) then
    update public.users set approved = true where auth_user_id = NEW.id;
  end if;
  return NEW;
end;
$$;

drop trigger if exists on_auth_user_confirmed on auth.users;
create trigger on_auth_user_confirmed
after update of email_confirmed_at on auth.users
for each row
execute function public.approve_user_on_email_confirm();

-- 3a) Optional RPC for manual admin approval from UI
create or replace function public.admin_approve_user(_auth_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin(auth.uid()) then
    raise exception 'Not authorized';
  end if;
  update public.users set approved = true where auth_user_id = _auth_user_id;
end;
$$;