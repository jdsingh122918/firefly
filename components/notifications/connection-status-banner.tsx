"use client";

import { useState, useEffect } from "react";
import { Wifi, WifiOff, RefreshCw, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ConnectionState } from "@/hooks/use-notifications";

interface ConnectionStatusBannerProps {
  connectionState: ConnectionState;
  lastRefreshedAt: Date | null;
  isRefreshing?: boolean;
  error?: string | null;
  onReconnect?: () => void;
  onRefresh?: () => void;
  className?: string;
  showAlways?: boolean;
}

export function ConnectionStatusBanner({
  connectionState,
  lastRefreshedAt,
  isRefreshing = false,
  error,
  onReconnect,
  onRefresh,
  className,
  showAlways = false,
}: ConnectionStatusBannerProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [lastRefreshTimeAgo, setLastRefreshTimeAgo] = useState<string | null>(null);

  // Update the "time ago" display every 10 seconds
  useEffect(() => {
    const updateTimeAgo = () => {
      if (!lastRefreshedAt) {
        setLastRefreshTimeAgo(null);
        return;
      }

      const seconds = Math.floor((Date.now() - lastRefreshedAt.getTime()) / 1000);

      if (seconds < 60) {
        setLastRefreshTimeAgo("just now");
      } else if (seconds < 3600) {
        const minutes = Math.floor(seconds / 60);
        setLastRefreshTimeAgo(`${minutes}m ago`);
      } else {
        const hours = Math.floor(seconds / 3600);
        setLastRefreshTimeAgo(`${hours}h ago`);
      }
    };

    updateTimeAgo();
    const interval = setInterval(updateTimeAgo, 10000);
    return () => clearInterval(interval);
  }, [lastRefreshedAt]);

  // Determine visibility based on connection state
  useEffect(() => {
    if (showAlways) {
      setIsVisible(true);
      return;
    }

    // Show banner for non-connected states
    if (connectionState === 'disconnected' || connectionState === 'reconnecting' || connectionState === 'polling') {
      setIsVisible(true);
    } else if (connectionState === 'connected') {
      // Hide after a delay when connected
      const timeout = setTimeout(() => setIsVisible(false), 3000);
      return () => clearTimeout(timeout);
    }
  }, [connectionState, showAlways]);

  if (!isVisible && !showAlways) {
    return null;
  }

  const getStatusConfig = () => {
    switch (connectionState) {
      case 'connected':
        return {
          icon: <Wifi className="h-4 w-4" />,
          text: "Real-time connected",
          bgColor: "bg-green-500/10 border-green-500/20",
          textColor: "text-green-700 dark:text-green-400",
          iconColor: "text-green-500",
        };
      case 'reconnecting':
        return {
          icon: <RefreshCw className="h-4 w-4 animate-spin" />,
          text: "Reconnecting...",
          bgColor: "bg-yellow-500/10 border-yellow-500/20",
          textColor: "text-yellow-700 dark:text-yellow-400",
          iconColor: "text-yellow-500",
        };
      case 'polling':
        return {
          icon: <RefreshCw className="h-4 w-4" />,
          text: "Using polling mode",
          bgColor: "bg-blue-500/10 border-blue-500/20",
          textColor: "text-blue-700 dark:text-blue-400",
          iconColor: "text-blue-500",
        };
      case 'disconnected':
      default:
        return {
          icon: <WifiOff className="h-4 w-4" />,
          text: "Disconnected",
          bgColor: "bg-red-500/10 border-red-500/20",
          textColor: "text-red-700 dark:text-red-400",
          iconColor: "text-red-500",
        };
    }
  };

  const config = getStatusConfig();

  return (
    <div
      className={cn(
        "flex items-center justify-between gap-2 px-3 py-2 rounded-lg border text-sm",
        config.bgColor,
        config.textColor,
        className
      )}
    >
      <div className="flex items-center gap-2">
        <span className={config.iconColor}>{config.icon}</span>
        <span className="font-medium">{config.text}</span>
        {lastRefreshTimeAgo && (
          <span className="text-xs opacity-70">
            (updated {lastRefreshTimeAgo})
          </span>
        )}
        {error && connectionState !== 'connected' && (
          <span className="flex items-center gap-1 text-xs opacity-70">
            <AlertCircle className="h-3 w-3" />
            {error}
          </span>
        )}
      </div>
      <div className="flex items-center gap-2">
        {connectionState !== 'connected' && connectionState !== 'reconnecting' && onReconnect && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onReconnect}
            className={cn("h-7 px-2 text-xs", config.textColor)}
          >
            <Wifi className="h-3 w-3 mr-1" />
            Reconnect
          </Button>
        )}
        {onRefresh && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onRefresh}
            disabled={isRefreshing}
            className={cn("h-7 px-2 text-xs", config.textColor)}
          >
            <RefreshCw className={cn("h-3 w-3 mr-1", isRefreshing && "animate-spin")} />
            Refresh
          </Button>
        )}
      </div>
    </div>
  );
}

// Minimal inline status indicator for compact spaces
export function ConnectionStatusIndicator({
  connectionState,
  className,
}: {
  connectionState: ConnectionState;
  className?: string;
}) {
  const getIndicatorConfig = () => {
    switch (connectionState) {
      case 'connected':
        return {
          color: "bg-green-500",
          pulse: false,
          title: "Real-time notifications connected",
        };
      case 'reconnecting':
        return {
          color: "bg-yellow-500",
          pulse: true,
          title: "Reconnecting to real-time notifications...",
        };
      case 'polling':
        return {
          color: "bg-blue-500",
          pulse: false,
          title: "Using polling for notifications",
        };
      case 'disconnected':
      default:
        return {
          color: "bg-red-500",
          pulse: true,
          title: "Disconnected from real-time notifications",
        };
    }
  };

  const config = getIndicatorConfig();

  return (
    <span
      className={cn(
        "relative inline-flex h-2 w-2 rounded-full",
        config.color,
        className
      )}
      title={config.title}
    >
      {config.pulse && (
        <span
          className={cn(
            "animate-ping absolute inline-flex h-full w-full rounded-full opacity-75",
            config.color
          )}
        />
      )}
    </span>
  );
}
