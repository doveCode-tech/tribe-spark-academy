-- Update the admin account
UPDATE public.users 
SET 
  role = 'admin',
  approved = true,
  name = 'System Administrator'
WHERE email = 'stemtribe01@gmail.com';