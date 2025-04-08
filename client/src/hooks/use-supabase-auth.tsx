import { createContext, ReactNode, useContext, useEffect, useState } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase-client";
import { useToast } from "@/hooks/use-toast";

type ProfileUpdateData = {
  username?: string;
  bio?: string;
  avatar_url?: string;
};

type AuthContextType = {
  session: Session | null;
  user: User | null;
  isLoading: boolean;
  signUp: (email: string, password: string, username: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  updateProfile: (data: ProfileUpdateData) => Promise<void>;
  updatePassword: (currentPassword: string, newPassword: string) => Promise<void>;
};

export const SupabaseAuthContext = createContext<AuthContextType | null>(null);

export function SupabaseAuthProvider({ children }: { children: ReactNode }) {
  const { toast } = useToast();
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setIsLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      setIsLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const signUp = async (email: string, password: string, username: string) => {
    try {
      setIsLoading(true);
      console.log('Starting signup process with:', { email, username });

      // Sign up with Supabase Auth
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            username,
            coins: 2500, // Default starting coins
          },
          // Disable email confirmation for now to simplify testing
          emailRedirectTo: window.location.origin,
        },
      });

      console.log('Supabase auth signup response:', data);

      if (error) {
        console.error('Supabase auth signup error:', error);
        throw error;
      }

      // Skip creating a profile for now - we'll let Supabase handle the auth
      // and create the profile later if needed

      toast({
        title: "Registration successful",
        description: data.user ? "Account created successfully!" : "Please check your email to confirm your account",
        variant: "default",
      });

      return data;
    } catch (error: any) {
      console.error('Registration error:', error);
      toast({
        title: "Registration failed",
        description: error.message || "An error occurred during registration",
        variant: "destructive",
      });
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      setIsLoading(true);
      console.log('Starting signin process with:', { email });

      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      console.log('Supabase auth signin response:', data);

      if (error) {
        console.error('Supabase auth signin error:', error);
        throw error;
      }

      toast({
        title: "Login successful",
        description: "Welcome back!",
        variant: "default",
      });

      return data;
    } catch (error: any) {
      console.error('Login error:', error);
      toast({
        title: "Login failed",
        description: error.message || "Invalid email or password",
        variant: "destructive",
      });
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const signOut = async () => {
    try {
      setIsLoading(true);

      const { error } = await supabase.auth.signOut();

      if (error) throw error;

      toast({
        title: "Logged out",
        description: "You have been successfully logged out",
        variant: "default",
      });
    } catch (error: any) {
      toast({
        title: "Logout failed",
        description: error.message || "An error occurred during logout",
        variant: "destructive",
      });
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const updateProfile = async (data: ProfileUpdateData) => {
    try {
      setIsLoading(true);
      console.log('Updating profile with:', data);

      if (!user) {
        throw new Error('User not authenticated');
      }

      // Update user metadata
      const { error } = await supabase.auth.updateUser({
        data: {
          ...user.user_metadata,
          ...data
        }
      });

      if (error) {
        console.error('Profile update error:', error);
        throw error;
      }

      toast({
        title: "Profile updated",
        description: "Your profile has been successfully updated",
        variant: "default",
      });
    } catch (error: any) {
      console.error('Profile update error:', error);
      toast({
        title: "Profile update failed",
        description: error.message || "An error occurred while updating your profile",
        variant: "destructive",
      });
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const updatePassword = async (currentPassword: string, newPassword: string) => {
    try {
      setIsLoading(true);

      if (!user || !user.email) {
        throw new Error('User not authenticated');
      }

      // First verify the current password by signing in
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: currentPassword,
      });

      if (signInError) {
        console.error('Password verification error:', signInError);
        throw new Error('Current password is incorrect');
      }

      // Update the password
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (error) {
        console.error('Password update error:', error);
        throw error;
      }

      toast({
        title: "Password updated",
        description: "Your password has been successfully updated",
        variant: "default",
      });
    } catch (error: any) {
      console.error('Password update error:', error);
      toast({
        title: "Password update failed",
        description: error.message || "An error occurred while updating your password",
        variant: "destructive",
      });
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SupabaseAuthContext.Provider
      value={{
        session,
        user,
        isLoading,
        signUp,
        signIn,
        signOut,
        updateProfile,
        updatePassword,
      }}
    >
      {children}
    </SupabaseAuthContext.Provider>
  );
}

export function useSupabaseAuth() {
  const context = useContext(SupabaseAuthContext);
  if (!context) {
    throw new Error("useSupabaseAuth must be used within a SupabaseAuthProvider");
  }
  return context;
}
