-- Create trigger to notify admins when new users sign up
CREATE OR REPLACE FUNCTION public.notify_admins_on_user_signup()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.notifications (recipient_role, type, title, message, data)
  VALUES (
    'admin',
    'user_signup',
    'New user signup',
    'A new user has signed up and requires approval',
    jsonb_build_object(
      'user_id', NEW.auth_user_id,
      'user_name', NEW.name,
      'user_email', NEW.email
    )
  );
  RETURN NEW;
END;
$function$;

-- Create trigger for new user signups
CREATE TRIGGER on_user_signup
  AFTER INSERT ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_admins_on_user_signup();