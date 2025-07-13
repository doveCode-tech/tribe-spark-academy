-- Update admin user with proper name
UPDATE public.users
SET 
  first_name = 'Admin',
  last_name = 'STEMTribe'
WHERE email = 'stemtribe01@gmail.com';