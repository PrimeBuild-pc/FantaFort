import { ComponentType } from "react";
import { Route, useLocation } from "wouter";
import { useSupabaseAuth } from "@/hooks/use-supabase-auth";

interface ProtectedRouteProps {
  component: ComponentType<any>;
  path: string;
}

export function SupabaseProtectedRoute({ component: Component, path, ...rest }: ProtectedRouteProps) {
  const { user, isLoading } = useSupabaseAuth();
  const [, setLocation] = useLocation();

  return (
    <Route
      path={path}
      {...rest}
      component={(props: any) => {
        // If still loading, show a loading indicator
        if (isLoading) {
          return (
            <div className="flex items-center justify-center h-screen">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
            </div>
          );
        }

        // If not authenticated, redirect to login
        if (!user) {
          setLocation("/auth");
          return null;
        }

        // If authenticated, render the component
        return <Component {...props} />;
      }}
    />
  );
}
