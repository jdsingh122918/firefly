'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useSignIn, useAuth } from '@clerk/nextjs'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from 'sonner'
import { Loader2, Mail } from 'lucide-react'

export default function SignInPage() {
  const { signIn, isLoaded, setActive } = useSignIn()
  const { userId, isSignedIn } = useAuth()
  const router = useRouter()

  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [step, setStep] = useState<'email' | 'verify'>('email')
  const [loading, setLoading] = useState(false)

  // Redirect already authenticated users
  useEffect(() => {
    console.log('🔍 Sign-in page auth check:', {
      isSignedIn,
      userId: userId ? 'present' : 'missing'
    });

    if (isSignedIn && userId) {
      console.log('🔄 Redirecting authenticated user to dashboard');
      router.push('/dashboard')
    }
  }, [isSignedIn, userId, router])

  // Don't render the form if user is already signed in
  if (isSignedIn) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="mx-auto flex w-full flex-col justify-center space-y-6 sm:w-[400px]">
          <div className="flex flex-col space-y-2 text-center">
            <Loader2 className="mx-auto h-6 w-6 animate-spin" />
            <h1 className="text-2xl font-semibold tracking-tight">
              Redirecting...
            </h1>
            <p className="text-sm text-muted-foreground">
              You&apos;re already signed in. Taking you to your dashboard.
            </p>
          </div>
        </div>
      </div>
    )
  }

  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!isLoaded || !signIn) return

    setLoading(true)

    try {
      // Start the sign-in process with email
      const signInAttempt = await signIn.create({
        identifier: email,
      })

      // Send the OTP code to the user
      const emailFactor = signInAttempt.supportedFirstFactors?.find(
        (factor) => factor.strategy === 'email_code'
      )

      if (!emailFactor?.emailAddressId) {
        throw new Error('Email verification not supported for this account')
      }

      await signInAttempt.prepareFirstFactor({
        strategy: 'email_code',
        emailAddressId: emailFactor.emailAddressId,
      })

      setStep('verify')
      toast.success('Verification code sent to your email')
    } catch (error: unknown) {
      console.error('Error sending code:', error)
      const errorMessage = (error as { errors?: Array<{ message?: string }> })?.errors?.[0]?.message || 'Failed to send verification code'
      toast.error(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!isLoaded || !signIn) return

    setLoading(true)

    try {
      // Verify the code
      const signInAttempt = await signIn.attemptFirstFactor({
        strategy: 'email_code',
        code,
      })

      if (signInAttempt.status === 'complete') {
        await setActive({ session: signInAttempt.createdSessionId })

        // Redirect to dashboard - middleware will handle role-based routing
        router.push('/dashboard')

        toast.success('Welcome to Firefly!')
      }
    } catch (error: unknown) {
      console.error('Error verifying code:', error)
      const errorMessage = (error as { errors?: Array<{ message?: string }> })?.errors?.[0]?.message || 'Invalid verification code'
      toast.error(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  if (step === 'email') {
    return (
      <Card>
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Welcome back</CardTitle>
          <CardDescription>
            Enter your email address to receive a verification code
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSendCode} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email address</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10"
                  required
                  autoFocus
                />
              </div>
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={!email || loading}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sending...
                </>
              ) : (
                'Send Verification Code'
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="text-center">
        <CardTitle className="text-2xl">Check your email</CardTitle>
        <CardDescription>
          Enter the 6-digit verification code sent to {email}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleVerifyCode} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="code">Verification code</Label>
            <Input
              id="code"
              type="text"
              placeholder="000000"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              className="text-center text-lg tracking-widest"
              maxLength={6}
              required
              autoFocus
            />
          </div>

          <Button
            type="submit"
            className="w-full"
            disabled={code.length !== 6 || loading}
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Verifying...
              </>
            ) : (
              'Verify & Sign In'
            )}
          </Button>

          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              setStep('email')
              setCode('')
              setEmail('')
            }}
            className="w-full"
          >
            Use different email
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}