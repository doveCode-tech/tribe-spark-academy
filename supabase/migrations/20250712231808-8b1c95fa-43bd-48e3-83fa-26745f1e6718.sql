-- Create the first admin user
-- Replace 'admin@stemtribe.com' with your desired admin email
-- Replace 'your-secure-password' with your desired password

-- First, we need to insert into auth.users (this is normally done by Supabase Auth)
-- But we can create an admin user manually by updating an existing user

-- Step 1: Sign up normally as a student first with your admin email
-- Step 2: Then run this SQL to promote that user to admin:

-- Update the user role to admin and approve them
UPDATE public.users 
SET 
  role = 'admin',
  approved = true,
  name = 'System Administrator'
WHERE email = 'admin@stemtribe.com';  -- Replace with your email

-- If you want to create a default admin account, you can also do:
-- (Only run this if you haven't signed up with the admin email yet)

INSERT INTO public.users (
  auth_user_id,
  email, 
  name, 
  role, 
  approved
) 
SELECT 
  id,
  'admin@stemtribe.com',  -- Replace with your desired admin email
  'System Administrator',
  'admin',
  true
FROM auth.users 
WHERE email = 'admin@stemtribe.com'  -- This will only work if you signed up first
AND NOT EXISTS (
  SELECT 1 FROM public.users WHERE email = 'admin@stemtribe.com'
);