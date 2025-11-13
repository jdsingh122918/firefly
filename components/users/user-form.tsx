"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Loader2, Mail, User, UserCheck, Users } from "lucide-react";

// Validation schema
const userFormSchema = z.object({
  email: z
    .string()
    .email("Please enter a valid email address")
    .min(1, "Email is required"),
  firstName: z
    .string()
    .max(50, "First name must be less than 50 characters")
    .optional(),
  lastName: z
    .string()
    .max(50, "Last name must be less than 50 characters")
    .optional(),
  role: z.enum(
    ["ADMIN", "VOLUNTEER", "MEMBER"] as const,
    "Please select a valid role"
  ),
  familyId: z.string().optional(),
  phoneNumber: z
    .string()
    .max(20, "Phone number must be less than 20 characters")
    .optional(),
});

type UserFormData = z.infer<typeof userFormSchema>;

interface Family {
  id: string;
  name: string;
}

interface UserFormProps {
  mode: "create" | "edit";
  initialData?: {
    id: string;
    email: string;
    firstName?: string;
    lastName?: string;
    role: string;
    familyId?: string;
    phoneNumber?: string;
  };
  onSuccess?: () => void;
}

export function UserForm({ mode, initialData, onSuccess }: UserFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [families, setFamilies] = useState<Family[]>([]);
  const [loadingFamilies, setLoadingFamilies] = useState(true);

  const form = useForm<UserFormData>({
    resolver: zodResolver(userFormSchema),
    defaultValues: {
      email: initialData?.email || "",
      firstName: initialData?.firstName || "",
      lastName: initialData?.lastName || "",
      role: (initialData?.role || "MEMBER") as "ADMIN" | "VOLUNTEER" | "MEMBER",
      familyId: initialData?.familyId || "",
      phoneNumber: initialData?.phoneNumber || "",
    },
  });

  // Fetch available families
  useEffect(() => {
    const fetchFamilies = async () => {
      try {
        const response = await fetch("/api/families");
        if (response.ok) {
          const data = await response.json();
          setFamilies(data.families || []);
        }
      } catch (err) {
        console.error("Error fetching families:", err);
      } finally {
        setLoadingFamilies(false);
      }
    };

    fetchFamilies();
  }, []);

  const onSubmit = async (data: UserFormData) => {
    try {
      setIsSubmitting(true);
      setError(null);

      // Clean up the data - remove empty strings
      const cleanData = {
        email: data.email,
        firstName: data.firstName || undefined,
        lastName: data.lastName || undefined,
        role: data.role,
        familyId: data.familyId || undefined,
        phoneNumber: data.phoneNumber || undefined,
      };

      const url =
        mode === "create" ? "/api/users" : `/api/users/${initialData?.id}`;

      const method = mode === "create" ? "POST" : "PUT";

      console.log(`${mode}ing user with data:`, cleanData);

      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(cleanData),
      });

      const result = await response.json();

      if (!response.ok) {
        // Handle validation errors
        if (result.details) {
          const fieldErrors = result.details as Array<{
            field: string;
            message: string;
          }>;
          fieldErrors.forEach((error) => {
            form.setError(error.field as keyof UserFormData, {
              message: error.message,
            });
          });
          const errorMessage = "Please fix the validation errors above";
          setError(errorMessage);
          toast.error(errorMessage);
        } else {
          const errorMessage = result.error || `Failed to ${mode} user`;
          setError(errorMessage);
          toast.error(errorMessage);
          throw new Error(errorMessage);
        }
        return;
      }

      // Success! Show toast and handle navigation
      const successMessage =
        mode === "create"
          ? `User "${result.user.name}" created successfully! They will receive an invitation email.`
          : `User "${result.user.name}" updated successfully!`;

      toast.success(successMessage);

      if (onSuccess) {
        onSuccess();
      } else {
        // Default navigation behavior
        if (mode === "create") {
          // Redirect to user list
          router.push("/admin/users");
        } else {
          // Redirect back to user detail page
          router.push(`/admin/users/${initialData?.id}`);
        }
      }
    } catch (err) {
      console.error(`Error ${mode}ing user:`, err);
      const errorMessage =
        err instanceof Error ? err.message : `Failed to ${mode} user`;
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    if (mode === "create") {
      router.push("/admin/users");
    } else {
      router.push(`/admin/users/${initialData?.id}`);
    }
  };

  const getRoleDescription = (role: string) => {
    switch (role) {
      case "ADMIN":
        return "Full system access - can manage all users and families";
      case "VOLUNTEER":
        return "Can manage families and create member users";
      case "MEMBER":
        return "Basic access - can view their family information";
      default:
        return "Select a role to see description";
    }
  };

  const selectedRole = form.watch("role");

  return (
    <Card className="max-w-2xl">
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          {mode === "create" ? (
            <User className="h-5 w-5" />
          ) : (
            <UserCheck className="h-5 w-5" />
          )}
          <span>{mode === "create" ? "Create New User" : "Edit User"}</span>
        </CardTitle>
        <CardDescription>
          {mode === "create"
            ? "Create a new user account. They will receive an invitation email to access the platform."
            : "Update user information and settings."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Email */}
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email Address *</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="user@example.com"
                        className="pl-10"
                        disabled={mode === "edit"} // Can't change email after creation
                        {...field}
                      />
                    </div>
                  </FormControl>
                  <FormDescription>
                    {mode === "create"
                      ? "The user will receive an invitation at this email address."
                      : "Email address cannot be changed after account creation."}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Name Fields */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="firstName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>First Name</FormLabel>
                    <FormControl>
                      <Input placeholder="John" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="lastName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Last Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Doe" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Role */}
            <FormField
              control={form.control}
              name="role"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Role *</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a role" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="ADMIN">Administrator</SelectItem>
                      <SelectItem value="VOLUNTEER">Volunteer</SelectItem>
                      <SelectItem value="MEMBER">Member</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    {getRoleDescription(selectedRole)}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Family Assignment */}
            <FormField
              control={form.control}
              name="familyId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Family Assignment</FormLabel>
                  <Select
                    onValueChange={(value) => {
                      // Convert "none" to undefined for form submission
                      field.onChange(value === "none" ? undefined : value);
                    }}
                    defaultValue={field.value || "none"}
                    value={field.value || "none"}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a family (optional)" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="none">No family assigned</SelectItem>
                      {loadingFamilies ? (
                        <SelectItem value="loading" disabled>
                          Loading families...
                        </SelectItem>
                      ) : families.length === 0 ? (
                        <SelectItem value="empty" disabled>
                          No families available
                        </SelectItem>
                      ) : (
                        families.map((family) => (
                          <SelectItem key={family.id} value={family.id}>
                            {family.name}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    Assign the user to a family group. This can be changed
                    later.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Phone Number */}
            <FormField
              control={form.control}
              name="phoneNumber"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Phone Number</FormLabel>
                  <FormControl>
                    <Input placeholder="+1 (555) 123-4567" {...field} />
                  </FormControl>
                  <FormDescription>
                    Optional contact phone number for the user.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Error Message */}
            {error && (
              <div className="rounded-md bg-red-50 p-4 border border-red-200">
                <div className="text-sm text-red-800">{error}</div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex justify-end space-x-4">
              <Button
                type="button"
                variant="outline"
                onClick={handleCancel}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                {mode === "create" ? "Create User" : "Save Changes"}
              </Button>
            </div>

            {/* Additional info for create mode */}
            {mode === "create" && (
              <div className="bg-blue-50 p-4 rounded-md border border-blue-200">
                <div className="text-sm text-blue-800">
                  <Users className="inline h-4 w-4 mr-2" />
                  <strong>What happens next:</strong>
                  <ol className="list-decimal list-inside mt-2 space-y-1 ml-6">
                    <li>User account will be created in the system</li>
                    <li>
                      User will receive a welcome email when they first sign in
                    </li>
                    <li>
                      They can access the platform using their email address
                    </li>
                    <li>
                      You can manage their role and family assignment later
                    </li>
                  </ol>
                </div>
              </div>
            )}
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
