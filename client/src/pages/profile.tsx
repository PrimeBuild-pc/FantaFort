import { useState } from 'react';
import { useSupabaseAuth } from '@/hooks/use-supabase-auth';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

// Profile form schema
const profileFormSchema = z.object({
  username: z.string().min(3, 'Username must be at least 3 characters').max(20, 'Username cannot exceed 20 characters'),
  bio: z.string().max(160, 'Bio cannot exceed 160 characters').optional(),
  avatarUrl: z.string().url('Please enter a valid URL').optional().or(z.literal('')),
});

type ProfileFormValues = z.infer<typeof profileFormSchema>;

// Security form schema
const securityFormSchema = z.object({
  currentPassword: z.string().min(6, 'Password must be at least 6 characters'),
  newPassword: z.string().min(6, 'Password must be at least 6 characters'),
  confirmPassword: z.string().min(6, 'Password must be at least 6 characters'),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});

type SecurityFormValues = z.infer<typeof securityFormSchema>;

export default function ProfilePage() {
  const { user, updateProfile, updatePassword } = useSupabaseAuth();
  const [activeTab, setActiveTab] = useState<string>('profile');
  const [isUpdating, setIsUpdating] = useState(false);

  // Get default values for profile form
  const getDefaultProfileValues = (): ProfileFormValues => {
    if (!user) {
      return {
        username: '',
        bio: '',
        avatarUrl: '',
      };
    }

    return {
      username: user.user_metadata?.username || '',
      bio: user.user_metadata?.bio || '',
      avatarUrl: user.user_metadata?.avatar_url || '',
    };
  };

  // Profile form
  const profileForm = useForm<ProfileFormValues>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: getDefaultProfileValues(),
  });

  // Security form
  const securityForm = useForm<SecurityFormValues>({
    resolver: zodResolver(securityFormSchema),
    defaultValues: {
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    },
  });

  // Handle profile form submission
  const onProfileSubmit = async (data: ProfileFormValues) => {
    if (!user) return;

    setIsUpdating(true);
    try {
      await updateProfile({
        username: data.username,
        bio: data.bio || '',
        avatar_url: data.avatarUrl || '',
      });
      toast.success('Profile updated successfully');
    } catch (error) {
      console.error('Error updating profile:', error);
      toast.error('Failed to update profile');
    } finally {
      setIsUpdating(false);
    }
  };

  // Handle security form submission
  const onSecuritySubmit = async (data: SecurityFormValues) => {
    if (!user) return;

    setIsUpdating(true);
    try {
      await updatePassword(data.currentPassword, data.newPassword);
      securityForm.reset({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      });
      toast.success('Password updated successfully');
    } catch (error) {
      console.error('Error updating password:', error);
      toast.error('Failed to update password');
    } finally {
      setIsUpdating(false);
    }
  };

  // Get initials for avatar fallback
  const getInitials = () => {
    if (!user?.user_metadata?.username) return 'U';
    return user.user_metadata.username.substring(0, 2).toUpperCase();
  };

  if (!user) {
    return (
      <div className="container mx-auto py-10">
        <Card>
          <CardHeader>
            <CardTitle>Profile</CardTitle>
            <CardDescription>You need to be logged in to view your profile.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-10">
      <div className="flex flex-col space-y-6">
        <div className="flex items-center space-x-4">
          <Avatar className="h-16 w-16">
            <AvatarImage src={user.user_metadata?.avatar_url} alt={user.user_metadata?.username || 'User'} />
            <AvatarFallback className="text-lg">{getInitials()}</AvatarFallback>
          </Avatar>
          <div>
            <h1 className="text-2xl font-bold">{user.user_metadata?.username || 'User'}</h1>
            <p className="text-muted-foreground">{user.email}</p>
          </div>
        </div>

        <Tabs defaultValue="profile" value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="profile">Profile</TabsTrigger>
            <TabsTrigger value="security">Security</TabsTrigger>
          </TabsList>

          <TabsContent value="profile">
            <Card>
              <CardHeader>
                <CardTitle>Profile Information</CardTitle>
                <CardDescription>Update your profile information.</CardDescription>
              </CardHeader>
              <CardContent>
                <Form {...profileForm}>
                  <form onSubmit={profileForm.handleSubmit(onProfileSubmit)} className="space-y-6">
                    <FormField
                      control={profileForm.control}
                      name="username"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Username</FormLabel>
                          <FormControl>
                            <Input placeholder="Enter your username" {...field} />
                          </FormControl>
                          <FormDescription>
                            This is your public display name.
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={profileForm.control}
                      name="bio"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Bio</FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder="Tell us a little bit about yourself"
                              className="resize-none"
                              {...field}
                            />
                          </FormControl>
                          <FormDescription>
                            Brief description for your profile. Max 160 characters.
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={profileForm.control}
                      name="avatarUrl"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Avatar URL</FormLabel>
                          <FormControl>
                            <Input placeholder="https://example.com/avatar.jpg" {...field} />
                          </FormControl>
                          <FormDescription>
                            URL to your profile picture.
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <Button type="submit" disabled={isUpdating}>
                      {isUpdating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Update Profile
                    </Button>
                  </form>
                </Form>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="security">
            <Card>
              <CardHeader>
                <CardTitle>Security</CardTitle>
                <CardDescription>Update your password.</CardDescription>
              </CardHeader>
              <CardContent>
                <Form {...securityForm}>
                  <form onSubmit={securityForm.handleSubmit(onSecuritySubmit)} className="space-y-6">
                    <FormField
                      control={securityForm.control}
                      name="currentPassword"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Current Password</FormLabel>
                          <FormControl>
                            <Input type="password" placeholder="Enter your current password" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={securityForm.control}
                      name="newPassword"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>New Password</FormLabel>
                          <FormControl>
                            <Input type="password" placeholder="Enter your new password" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={securityForm.control}
                      name="confirmPassword"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Confirm Password</FormLabel>
                          <FormControl>
                            <Input type="password" placeholder="Confirm your new password" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <Button type="submit" disabled={isUpdating}>
                      {isUpdating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Update Password
                    </Button>
                  </form>
                </Form>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
