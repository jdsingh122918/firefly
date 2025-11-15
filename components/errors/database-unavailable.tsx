"use client";

import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  Database,
  RefreshCw,
  AlertTriangle,
  Clock,
  CheckCircle,
  ExternalLink,
  Home,
  ArrowLeft
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";
import type { DatabaseHealthStatus } from "@/lib/db/database-health";

interface DatabaseUnavailableProps {
  error?: string;
  errorType?: DatabaseHealthStatus['errorType'];
  retryAfter?: number;
  showRetry?: boolean;
  onRetry?: () => void;
  className?: string;
}

export function DatabaseUnavailable({
  error,
  errorType = 'CONNECTION',
  retryAfter = 30,
  showRetry = true,
  onRetry,
  className
}: DatabaseUnavailableProps) {
  const router = useRouter();
  const [countdown, setCountdown] = useState(retryAfter);
  const [isRetrying, setIsRetrying] = useState(false);

  // Countdown timer for auto-retry
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(prev => prev - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  // Auto-retry when countdown reaches 0
  useEffect(() => {
    if (countdown === 0 && showRetry) {
      handleRetry();
    }
  }, [countdown, showRetry]);

  const handleRetry = async () => {
    setIsRetrying(true);
    try {
      if (onRetry) {
        await onRetry();
      } else {
        // Default retry: reload the page
        window.location.reload();
      }
    } catch (err) {
      console.error('Retry failed:', err);
      setCountdown(retryAfter); // Reset countdown
    } finally {
      setIsRetrying(false);
    }
  };

  const getErrorDetails = () => {
    switch (errorType) {
      case 'CONNECTION':
        return {
          title: "Database Connection Lost",
          description: "Unable to connect to the database server.",
          icon: <Database className="h-8 w-8 text-red-500" />,
          color: "red",
          suggestions: [
            "Check your internet connection",
            "The database server may be temporarily down",
            "Try refreshing the page"
          ]
        };
      case 'TIMEOUT':
        return {
          title: "Database Response Timeout",
          description: "The database is responding slowly or not at all.",
          icon: <Clock className="h-8 w-8 text-orange-500" />,
          color: "orange",
          suggestions: [
            "The database may be under heavy load",
            "Wait a few moments and try again",
            "Check your internet connection speed"
          ]
        };
      case 'AUTH':
        return {
          title: "Database Authentication Error",
          description: "Unable to authenticate with the database.",
          icon: <AlertTriangle className="h-8 w-8 text-amber-500" />,
          color: "amber",
          suggestions: [
            "Contact your system administrator",
            "This may require manual intervention",
            "Check if your account has proper permissions"
          ]
        };
      default:
        return {
          title: "Database Unavailable",
          description: "The database service is currently unavailable.",
          icon: <Database className="h-8 w-8 text-gray-500" />,
          color: "gray",
          suggestions: [
            "This is usually temporary",
            "Try again in a few moments",
            "Contact support if the issue persists"
          ]
        };
    }
  };

  const errorDetails = getErrorDetails();

  return (
    <div className={cn("min-h-screen flex items-center justify-center p-4 bg-gray-50", className)}>
      <div className="max-w-2xl w-full space-y-6">
        {/* Main Error Card */}
        <Card className="text-center">
          <CardHeader className="space-y-4">
            <div className="flex justify-center">
              {errorDetails.icon}
            </div>
            <div>
              <CardTitle className="text-2xl">{errorDetails.title}</CardTitle>
              <CardDescription className="text-lg mt-2">
                {errorDetails.description}
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Error Status Badge */}
            <Badge
              variant="outline"
              className={cn(
                "px-3 py-1",
                errorDetails.color === "red" && "border-red-200 bg-red-50 text-red-700",
                errorDetails.color === "orange" && "border-orange-200 bg-orange-50 text-orange-700",
                errorDetails.color === "amber" && "border-amber-200 bg-amber-50 text-amber-700",
                errorDetails.color === "gray" && "border-gray-200 bg-gray-50 text-gray-700"
              )}
            >
              Service Temporarily Unavailable
            </Badge>

            {/* Countdown Timer */}
            {showRetry && countdown > 0 && (
              <Alert>
                <Clock className="h-4 w-4" />
                <AlertDescription>
                  Automatically retrying in <strong>{countdown} seconds</strong>...
                </AlertDescription>
              </Alert>
            )}

            {/* Action Buttons */}
            <div className="flex gap-3 justify-center">
              {showRetry && (
                <Button
                  onClick={handleRetry}
                  disabled={isRetrying}
                  className="min-h-[44px]"
                >
                  {isRetrying ? (
                    <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <RefreshCw className="h-4 w-4 mr-2" />
                  )}
                  {isRetrying ? 'Retrying...' : 'Retry Now'}
                </Button>
              )}

              <Button
                variant="outline"
                onClick={() => router.push('/')}
                className="min-h-[44px]"
              >
                <Home className="h-4 w-4 mr-2" />
                Go Home
              </Button>

              <Button
                variant="outline"
                onClick={() => router.back()}
                className="min-h-[44px]"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Go Back
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Troubleshooting Suggestions */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">What you can do</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {errorDetails.suggestions.map((suggestion, index) => (
                <li key={index} className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                  <span className="text-sm">{suggestion}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        {/* Technical Details (for debugging) */}
        {error && process.env.NODE_ENV === 'development' && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <AlertTriangle className="h-5 w-5" />
                Technical Details
                <Badge variant="outline">Development Only</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="text-xs bg-gray-100 p-3 rounded overflow-auto border">
                {error}
              </pre>
            </CardContent>
          </Card>
        )}

        {/* Status Page Link */}
        <Card>
          <CardContent className="pt-6">
            <div className="text-center text-sm text-muted-foreground">
              <p>
                Need help? Contact support or check our{" "}
                <Button variant="link" className="px-0 h-auto text-sm">
                  <ExternalLink className="h-3 w-3 mr-1" />
                  status page
                </Button>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}