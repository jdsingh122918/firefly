'use client'

import React, { useState } from 'react'
import { useAuth } from '@clerk/nextjs'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { CalendarIcon, Clock, CheckCircle, Send } from 'lucide-react'
import { toast } from 'sonner'

const announcementSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200, 'Title must be less than 200 characters'),
  message: z.string().min(1, 'Message is required').max(1000, 'Message must be less than 1000 characters'),
  targetAudience: z.enum(['ALL', 'ADMIN', 'VOLUNTEER', 'MEMBER']),
  priority: z.enum(['low', 'medium', 'high', 'urgent']),
  isActionable: z.boolean(),
  actionUrl: z.string().url().optional().or(z.literal('')),
  expiresAt: z.string().optional(),
  isCalendarEvent: z.boolean(),
  eventDate: z.string().optional(),
  eventLocation: z.string().optional(),
})

type AnnouncementFormData = z.infer<typeof announcementSchema>

const targetAudienceOptions = [
  { value: 'ALL', label: 'All Users', description: 'Send to everyone on the platform' },
  { value: 'ADMIN', label: 'Administrators', description: 'Send to admin users only' },
  { value: 'VOLUNTEER', label: 'Volunteers', description: 'Send to volunteer users only' },
  { value: 'MEMBER', label: 'Members', description: 'Send to family member users only' },
]

const priorityOptions = [
  { value: 'low', label: 'Low', color: 'bg-gray-500' },
  { value: 'medium', label: 'Medium', color: 'bg-blue-500' },
  { value: 'high', label: 'High', color: 'bg-orange-500' },
  { value: 'urgent', label: 'Urgent', color: 'bg-red-500' },
]

export function AnnouncementForm() {
  const { getToken } = useAuth()
  const [isLoading, setIsLoading] = useState(false)
  const [lastSentAnnouncement, setLastSentAnnouncement] = useState<{
    title: string
    targetCount: number
    createdCount: number
  } | null>(null)

  const form = useForm<AnnouncementFormData>({
    resolver: zodResolver(announcementSchema),
    defaultValues: {
      title: '',
      message: '',
      targetAudience: 'ALL',
      priority: 'medium',
      isActionable: true,
      actionUrl: '',
      expiresAt: '',
      isCalendarEvent: false,
      eventDate: '',
      eventLocation: '',
    },
  })

  const watchIsCalendarEvent = form.watch('isCalendarEvent')
  const watchTargetAudience = form.watch('targetAudience')
  const watchPriority = form.watch('priority')

  const onSubmit = async (data: AnnouncementFormData) => {
    setIsLoading(true)

    try {
      const token = await getToken()

      // Prepare the request body
      const requestBody = {
        title: data.title,
        message: data.message,
        targetAudience: data.targetAudience,
        priority: data.priority,
        isActionable: data.isActionable,
        actionUrl: data.actionUrl || undefined,
        expiresAt: data.expiresAt || undefined,
        isCalendarEvent: data.isCalendarEvent,
        eventDate: data.eventDate || undefined,
        eventLocation: data.eventLocation || undefined,
      }

      const response = await fetch('/api/admin/announcements', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(requestBody),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to send announcement')
      }

      // Success!
      toast.success('Announcement sent successfully!', {
        description: `Sent to ${result.data.createdCount} users`,
      })

      setLastSentAnnouncement({
        title: data.title,
        targetCount: result.data.targetCount,
        createdCount: result.data.createdCount,
      })

      // Reset form
      form.reset()
    } catch (error) {
      console.error('Failed to send announcement:', error)
      toast.error('Failed to send announcement', {
        description: error instanceof Error ? error.message : 'Unknown error occurred',
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Main Form */}
      <div className="lg:col-span-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Send className="h-5 w-5" />
              Create Announcement
            </CardTitle>
            <CardDescription>
              Send system-wide announcements to users. All announcements will appear in the notification banner and bell.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                {/* Title */}
                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Title</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter announcement title..." {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Message */}
                <FormField
                  control={form.control}
                  name="message"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Message</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Enter announcement message..."
                          className="min-h-[120px]"
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        {field.value.length}/1000 characters
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Target Audience */}
                <FormField
                  control={form.control}
                  name="targetAudience"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Target Audience</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select target audience" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {targetAudienceOptions.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              <div>
                                <div className="font-medium">{option.label}</div>
                                <div className="text-sm text-muted-foreground">{option.description}</div>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Priority */}
                <FormField
                  control={form.control}
                  name="priority"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Priority Level</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select priority level" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {priorityOptions.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              <div className="flex items-center gap-2">
                                <div className={`w-2 h-2 rounded-full ${option.color}`} />
                                {option.label}
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Action Settings */}
                <div className="space-y-4">
                  <FormField
                    control={form.control}
                    name="isActionable"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                          <FormLabel className="text-base">Actionable Notification</FormLabel>
                          <FormDescription>
                            Include action buttons in the notification
                          </FormDescription>
                        </div>
                        <FormControl>
                          <Switch checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  {form.watch('isActionable') && (
                    <FormField
                      control={form.control}
                      name="actionUrl"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Action URL (Optional)</FormLabel>
                          <FormControl>
                            <Input placeholder="https://example.com/action" {...field} />
                          </FormControl>
                          <FormDescription>
                            URL to redirect users when they click the action button
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}
                </div>

                {/* Calendar Event Settings */}
                <div className="space-y-4">
                  <FormField
                    control={form.control}
                    name="isCalendarEvent"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                          <FormLabel className="text-base flex items-center gap-2">
                            <CalendarIcon className="h-4 w-4" />
                            Calendar Event
                          </FormLabel>
                          <FormDescription>
                            Include calendar event details and &quot;Add to Calendar&quot; action
                          </FormDescription>
                        </div>
                        <FormControl>
                          <Switch checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  {watchIsCalendarEvent && (
                    <>
                      <FormField
                        control={form.control}
                        name="eventDate"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Event Date & Time</FormLabel>
                            <FormControl>
                              <Input type="datetime-local" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="eventLocation"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Event Location (Optional)</FormLabel>
                            <FormControl>
                              <Input placeholder="Enter event location..." {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </>
                  )}
                </div>

                {/* Expiration */}
                <FormField
                  control={form.control}
                  name="expiresAt"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Expiration Date (Optional)</FormLabel>
                      <FormControl>
                        <Input type="datetime-local" {...field} />
                      </FormControl>
                      <FormDescription>
                        When this announcement should automatically expire
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Submit Button */}
                <Button type="submit" disabled={isLoading} className="w-full">
                  {isLoading ? (
                    <>
                      <Clock className="mr-2 h-4 w-4 animate-spin" />
                      Sending Announcement...
                    </>
                  ) : (
                    <>
                      <Send className="mr-2 h-4 w-4" />
                      Send Announcement
                    </>
                  )}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>

      {/* Sidebar Info */}
      <div className="space-y-6">
        {/* Preview */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Preview</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Badge variant="outline">
                  {watchTargetAudience?.toLowerCase() || 'all'}
                </Badge>
                <div className={`w-2 h-2 rounded-full ${priorityOptions.find(p => p.value === watchPriority)?.color || 'bg-blue-500'}`} />
              </div>
              <h4 className="font-medium">{form.watch('title') || 'Announcement Title'}</h4>
              <p className="text-sm text-muted-foreground">
                {form.watch('message') || 'Announcement message will appear here...'}
              </p>
              {watchIsCalendarEvent && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <CalendarIcon className="h-3 w-3" />
                  Calendar Event
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Last Sent */}
        {lastSentAnnouncement && (
          <Alert>
            <CheckCircle className="h-4 w-4" />
            <AlertDescription>
              Last sent: &quot;{lastSentAnnouncement.title}&quot; to {lastSentAnnouncement.createdCount} users
            </AlertDescription>
          </Alert>
        )}

        {/* Tips */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Tips</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>• Keep titles concise and descriptive</p>
            <p>• Use priority levels appropriately</p>
            <p>• Calendar events will show &quot;Add to Calendar&quot; buttons</p>
            <p>• Actionable notifications include interaction buttons</p>
            <p>• Announcements appear in the notification banner</p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}