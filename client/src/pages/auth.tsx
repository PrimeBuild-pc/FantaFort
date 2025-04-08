import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";

// Define the login schema
const loginSchema = z.object({
  username: z.string().min(1, { message: "Username is required" }),
  password: z.string().min(1, { message: "Password is required" })
});

// Define the register schema
const registerSchema = z.object({
  username: z.string(),
  password: z.string(),
  confirmPassword: z.string()
}).refine(data => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"]
});

type LoginFormValues = z.infer<typeof loginSchema>;
type RegisterFormValues = z.infer<typeof registerSchema>;

export default function Auth() {
  const [isLogin, setIsLogin] = useState(true);
  const { toast } = useToast();
  const [, navigate] = useLocation();
  
  // Login form
  const loginForm = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      username: "",
      password: ""
    }
  });
  
  // Register form
  const registerForm = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      username: "",
      password: "",
      confirmPassword: ""
    }
  });
  
  // Handle login submission
  const onLoginSubmit = async (data: LoginFormValues) => {
    try {
      const response = await apiRequest('POST', '/api/auth/login', data);
      
      if (response.ok) {
        toast({
          title: "Login Successful",
          description: "Welcome back to Fortnite Fantasy League!",
        });
        navigate("/");
      }
    } catch (error) {
      toast({
        title: "Login Failed",
        description: error instanceof Error ? error.message : "Please check your credentials and try again.",
        variant: "destructive",
      });
    }
  };
  
  // Handle register submission
  const onRegisterSubmit = async (data: RegisterFormValues) => {
    try {
      // Log form data for debugging
      console.log("Form data being submitted:", data);
      
      const { confirmPassword, ...registerData } = data;
      
      // Directly call backend without validation
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(registerData)
      });
      
      const responseData = await response.json();
      
      if (response.ok) {
        toast({
          title: "Registration Successful",
          description: "Your account has been created. Welcome to Fortnite Fantasy League!",
        });
        navigate("/");
      } else {
        toast({
          title: "Registration Failed",
          description: responseData.error || "Please try a different username.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Registration error:", error);
      toast({
        title: "Registration Failed",
        description: error instanceof Error ? error.message : "Please try a different username.",
        variant: "destructive",
      });
    }
  };
  
  const toggleForm = () => {
    setIsLogin(!isLogin);
  };

  return (
    <div className="container mx-auto px-4 py-16 flex justify-center">
      <Card className="w-full max-w-md relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-[#00F0B5] to-transparent"></div>
        
        <CardHeader>
          <div className="flex justify-center mb-4">
            <div className="h-16 w-16 bg-[#2D0E75] rounded-full flex items-center justify-center">
              <i className="fas fa-gamepad text-[#00F0B5] text-3xl"></i>
            </div>
          </div>
          <CardTitle className="text-center text-2xl font-burbank">
            {isLogin ? "LOGIN TO YOUR ACCOUNT" : "CREATE A NEW ACCOUNT"}
          </CardTitle>
          <CardDescription className="text-center">
            {isLogin 
              ? "Enter your credentials to access your fantasy team" 
              : "Join the Fortnite Fantasy League and start competing"
            }
          </CardDescription>
        </CardHeader>
        
        <CardContent>
          {isLogin ? (
            <Form {...loginForm}>
              <form onSubmit={loginForm.handleSubmit(onLoginSubmit)} className="space-y-4">
                <FormField
                  control={loginForm.control}
                  name="username"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Username</FormLabel>
                      <FormControl>
                        <Input 
                          {...field} 
                          placeholder="Enter your username" 
                          className="bg-[#1E1E1E] border-[#333333]"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={loginForm.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Password</FormLabel>
                      <FormControl>
                        <Input 
                          {...field} 
                          type="password" 
                          placeholder="Enter your password" 
                          className="bg-[#1E1E1E] border-[#333333]"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <Button type="submit" variant="fortnite" className="w-full mt-6">
                  Login
                </Button>
              </form>
            </Form>
          ) : (
            <div>
              <form onSubmit={(e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                const data = {
                  username: formData.get('username') as string,
                  password: formData.get('password') as string,
                  confirmPassword: formData.get('confirmPassword') as string
                };
                
                if (data.password !== data.confirmPassword) {
                  toast({
                    title: "Password Mismatch",
                    description: "Passwords do not match. Please try again.",
                    variant: "destructive"
                  });
                  return;
                }
                
                onRegisterSubmit(data);
              }} className="space-y-4">
                <div>
                  <Label htmlFor="username">Username</Label>
                  <Input 
                    id="username"
                    name="username"
                    placeholder="Choose a username" 
                    className="bg-[#1E1E1E] border-[#333333] mt-1"
                  />
                </div>
                
                <div>
                  <Label htmlFor="password">Password</Label>
                  <Input 
                    id="password"
                    name="password"
                    type="password" 
                    placeholder="Create a password" 
                    className="bg-[#1E1E1E] border-[#333333] mt-1"
                  />
                </div>
                
                <div>
                  <Label htmlFor="confirmPassword">Confirm Password</Label>
                  <Input 
                    id="confirmPassword"
                    name="confirmPassword"
                    type="password" 
                    placeholder="Confirm your password" 
                    className="bg-[#1E1E1E] border-[#333333] mt-1"
                  />
                </div>
                
                <Button type="submit" variant="fortnite" className="w-full mt-6">
                  Register
                </Button>
              </form>
            </div>
          )}
        </CardContent>
        
        <CardFooter className="flex flex-col">
          <div className="text-sm text-gray-400 text-center mt-4">
            {isLogin ? "Don't have an account yet?" : "Already have an account?"}
            <button 
              className="ml-2 text-[#00F0B5] hover:underline"
              onClick={toggleForm}
            >
              {isLogin ? "Register" : "Login"}
            </button>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}
