import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  userProfile: any | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signUp: (email: string, password: string, name: string, additionalData?: { phone?: string; city?: string; country?: string }) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [userProfile, setUserProfile] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchUserProfile = async (userId: string) => {
    try {
      console.log('Fetching profile for user ID:', userId);
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('auth_user_id', userId)
        .maybeSingle();

      if (error) {
        console.error('Error fetching user profile:', error);
        return null;
      }

      console.log('Fetched user profile:', data);
      return data;
    } catch (error) {
      console.error('Error fetching user profile:', error);
      return null;
    }
  };

  const refreshProfile = async () => {
    if (user) {
      const profile = await fetchUserProfile(user.id);
      setUserProfile(profile);
    }
  };

  useEffect(() => {
    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        
        if (session?.user) {
          // Fetch user profile after auth state change
          setTimeout(async () => {
            let profile = await fetchUserProfile(session.user.id);

            // If no profile exists yet, create a student profile for the user
            if (!profile) {
              const meta = session.user.user_metadata || {};
              const fullName = meta.name || `${meta.first_name || ''} ${meta.last_name || ''}`.trim();
              
              try {
                const insertRes = await supabase
                  .from('users')
                  .insert({
                    auth_user_id: session.user.id,
                    role: 'student',
                    name: fullName || session.user.email,
                    email: session.user.email,
                    first_name: meta.first_name || '',
                    last_name: meta.last_name || '',
                    phone: meta.phone || '',
                    city: meta.city || '',
                    country: meta.country || '',
                    approved: false, // Requires admin approval
                  })
                  .select('*')
                  .maybeSingle();
                
                if (!insertRes.error) {
                  profile = insertRes.data;
                } else {
                  console.error('Error creating user profile:', insertRes.error);
                }
              } catch (profileError) {
                console.error('Error creating user profile:', profileError);
              }
            }

            // Note: Users now require manual admin approval

            setUserProfile(profile);
            setLoading(false);

            // Show welcome message only on login event
            if (event === 'SIGNED_IN') {
              const displayName = profile?.first_name 
                ? `${profile.first_name}${profile.last_name ? ` ${profile.last_name}` : ''}`
                : (profile?.name || session.user.user_metadata?.name || session.user.email);

              toast({
                title: `Welcome back, ${displayName}! 🚀`,
                description: 'Successfully logged in.',
              });
            }
          }, 0);
        } else {
          setUserProfile(null);
          setLoading(false);
        }
      }
    );

    // Check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      
      if (session?.user) {
        fetchUserProfile(session.user.id).then((profile) => {
          setUserProfile(profile);
          setLoading(false);
        });
      } else {
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        toast({
          title: "Login Failed",
          description: error.message,
          variant: "destructive",
        });
      } else {
        // We'll show the welcome message after the profile is loaded
        // This is handled in the auth state change listener
      }

      return { error };
    } catch (error: any) {
      toast({
        title: "Login Failed",
        description: "An unexpected error occurred.",
        variant: "destructive",
      });
      return { error };
    }
  };

  const signUp = async (email: string, password: string, fullName: string, additionalData?: { phone?: string; city?: string; country?: string }) => {
    try {
      // Use proper redirect URL - check if in localhost
      const redirectUrl = window.location.origin.includes('localhost') 
        ? 'https://twblstwtdemcufoknmgy.supabase.co/' 
        : `${window.location.origin}/`;
      
      // Split full name into first and last name
      const nameParts = fullName.trim().split(' ');
      const firstName = nameParts[0] || '';
      const lastName = nameParts.slice(1).join(' ') || '';
      
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: redirectUrl,
          data: {
            name: fullName,
            first_name: firstName,
            last_name: lastName,
            phone: additionalData?.phone || '',
            city: additionalData?.city || '',
            country: additionalData?.country || ''
          }
        }
      });

      if (error) {
        toast({
          title: "Signup Failed",
          description: error.message,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Account Created!",
          description: "Please check your email to verify your account.",
        });
      }

      return { error };
    } catch (error: any) {
      toast({
        title: "Signup Failed",
        description: "An unexpected error occurred.",
        variant: "destructive",
      });
      return { error };
    }
  };

  const signOut = async () => {
    try {
      await supabase.auth.signOut();
      toast({
        title: "Logged Out",
        description: "Successfully logged out.",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to log out.",
        variant: "destructive",
      });
    }
  };

  const value = {
    user,
    session,
    userProfile,
    loading,
    signIn,
    signUp,
    signOut,
    refreshProfile,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}