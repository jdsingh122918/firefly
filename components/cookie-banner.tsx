"use client"

import { useState, useEffect } from "react"
import { X, Cookie } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface CookieBannerProps {
  className?: string
}

const COOKIE_CONSENT_KEY = "firefly_cookie_consent"
const COOKIE_CONSENT_EXPIRY = 365 * 24 * 60 * 60 * 1000 // 1 year in milliseconds

export function CookieBanner({ className }: CookieBannerProps) {
  const [isVisible, setIsVisible] = useState(false)
  const [isAnimating, setIsAnimating] = useState(false)

  useEffect(() => {
    // Check if user has already consented
    const consent = localStorage.getItem(COOKIE_CONSENT_KEY)

    if (consent) {
      try {
        const { timestamp } = JSON.parse(consent)
        const now = Date.now()

        // Check if consent is still valid (not expired)
        if (now - timestamp < COOKIE_CONSENT_EXPIRY) {
          return // Don't show banner if consent is valid
        }
      } catch (error) {
        // Invalid stored data, clear it
        localStorage.removeItem(COOKIE_CONSENT_KEY)
      }
    }

    // Show banner after a small delay for better UX
    const timer = setTimeout(() => {
      setIsVisible(true)
      setIsAnimating(true)
    }, 1000)

    return () => clearTimeout(timer)
  }, [])

  const handleAccept = () => {
    // Store consent with timestamp
    const consent = {
      accepted: true,
      timestamp: Date.now()
    }

    localStorage.setItem(COOKIE_CONSENT_KEY, JSON.stringify(consent))

    // Animate out
    setIsAnimating(false)
    setTimeout(() => setIsVisible(false), 300)
  }

  const handleDismiss = () => {
    // Store dismissal (not acceptance) with shorter expiry
    const dismissal = {
      dismissed: true,
      timestamp: Date.now()
    }

    localStorage.setItem(COOKIE_CONSENT_KEY, JSON.stringify(dismissal))

    // Animate out
    setIsAnimating(false)
    setTimeout(() => setIsVisible(false), 300)
  }

  if (!isVisible) {
    return null
  }

  return (
    <div
      className={cn(
        "fixed bottom-0 left-0 right-0 z-50 p-4 transition-transform duration-300 ease-in-out",
        isAnimating ? "translate-y-0" : "translate-y-full",
        className
      )}
    >
      <div className="mx-auto max-w-7xl">
        <div className="backdrop-blur-sm bg-background/95 border-2 border-border/50 rounded-lg shadow-lg p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            {/* Cookie icon and message */}
            <div className="flex items-start gap-3 flex-1">
              <Cookie className="h-6 w-6 text-primary shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="text-sm font-medium">
                  We use cookies to enhance your experience
                </p>
                <p className="text-xs text-muted-foreground">
                  This website uses functional cookies to provide basic features like theme preferences and site navigation. No personal data is collected or shared.
                </p>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-2 shrink-0">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleDismiss}
                className="h-8 text-xs"
              >
                <X className="h-3 w-3 mr-1" />
                Dismiss
              </Button>
              <Button
                variant="default"
                size="sm"
                onClick={handleAccept}
                className="h-8 text-xs"
              >
                Accept Cookies
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// Utility function to check if user has consented to cookies
export function hasCookieConsent(): boolean {
  if (typeof window === 'undefined') return false

  try {
    const consent = localStorage.getItem(COOKIE_CONSENT_KEY)
    if (!consent) return false

    const { accepted, timestamp } = JSON.parse(consent)
    const now = Date.now()

    // Check if consent is still valid and was accepted (not just dismissed)
    return accepted && (now - timestamp < COOKIE_CONSENT_EXPIRY)
  } catch {
    return false
  }
}