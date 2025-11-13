'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { z } from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { Loader2 } from 'lucide-react'

// Validation schema
const familyFormSchema = z.object({
  name: z
    .string()
    .min(1, 'Family name is required')
    .max(100, 'Family name must be less than 100 characters'),
  description: z
    .string()
    .max(500, 'Description must be less than 500 characters')
    .optional()
})

type FamilyFormData = z.infer<typeof familyFormSchema>

interface FamilyFormProps {
  mode: 'create' | 'edit'
  initialData?: {
    id: string
    name: string
    description?: string
  }
  onSuccess?: () => void
}

export function FamilyForm({ mode, initialData, onSuccess }: FamilyFormProps) {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const form = useForm<FamilyFormData>({
    resolver: zodResolver(familyFormSchema),
    defaultValues: {
      name: initialData?.name || '',
      description: initialData?.description || ''
    }
  })

  const onSubmit = async (data: FamilyFormData) => {
    try {
      setIsSubmitting(true)
      setError(null)

      const url = mode === 'create'
        ? '/api/families'
        : `/api/families/${initialData?.id}`

      const method = mode === 'create' ? 'POST' : 'PUT'

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || `Failed to ${mode} family`)
      }

      const result = await response.json()

      // Success! Show toast and handle navigation
      toast.success(
        mode === 'create'
          ? `Family "${result.family.name}" created successfully!`
          : `Family "${result.family.name}" updated successfully!`
      )

      if (onSuccess) {
        onSuccess()
      } else {
        // Default navigation behavior
        if (mode === 'create') {
          // Redirect to the new family's detail page
          router.push(`/admin/families/${result.family.id}`)
        } else {
          // Redirect back to families list
          router.push('/admin/families')
        }
      }

    } catch (err) {
      console.error(`Error ${mode}ing family:`, err)
      const errorMessage = err instanceof Error ? err.message : `Failed to ${mode} family`
      setError(errorMessage)
      toast.error(errorMessage)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleCancel = () => {
    if (mode === 'create') {
      router.push('/admin/families')
    } else {
      router.push(`/admin/families/${initialData?.id}`)
    }
  }

  return (
    <Card className="max-w-2xl">
      <CardHeader>
        <CardTitle>
          {mode === 'create' ? 'Create New Family' : 'Edit Family'}
        </CardTitle>
        <CardDescription>
          {mode === 'create'
            ? 'Create a new family to organize members and coordinate care.'
            : 'Update family information and details.'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Family Name */}
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Family Name *</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Enter family name (e.g., Smith Family, Johnson Care Group)"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    Choose a name that clearly identifies this family or care group.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Description */}
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Optional description of the family or care situation..."
                      className="resize-none"
                      rows={4}
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    Provide any additional context about this family&apos;s care needs or situation.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Error Message */}
            {error && (
              <div className="rounded-md bg-red-50 p-4 border border-red-200">
                <div className="text-sm text-red-800">
                  {error}
                </div>
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
              <Button
                type="submit"
                disabled={isSubmitting}
              >
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {mode === 'create' ? 'Create Family' : 'Save Changes'}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  )
}