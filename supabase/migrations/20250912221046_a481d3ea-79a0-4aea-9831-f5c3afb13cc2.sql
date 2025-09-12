-- Remove the trigger and function that's causing the signup failure
-- since this project uses a 'users' table instead of 'profiles'

-- Drop the trigger first
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Drop the function
DROP FUNCTION IF EXISTS public.handle_new_user();