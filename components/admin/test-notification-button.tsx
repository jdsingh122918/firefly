"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Bell, Loader2 } from "lucide-react";
import { toast } from "sonner";

export function TestNotificationButton() {
  const [isLoading, setIsLoading] = useState(false);

  const handleTestNotification = async () => {
    setIsLoading(true);

    try {
      const response = await fetch("/api/admin/test-notification", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });

      const result = await response.json();

      if (response.ok) {
        toast.success("Test Notification Sent", {
          description: "Notification created successfully. Check the notification banner above!",
        });
        console.log("🔔 Test notification result:", result);
      } else {
        throw new Error(result.error || "Failed to create test notification");
      }
    } catch (error) {
      console.error("❌ Test notification failed:", error);
      toast.error("Test Failed", {
        description: error instanceof Error ? error.message : "Unknown error occurred",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Button
      onClick={handleTestNotification}
      disabled={isLoading}
      className="w-full sm:w-auto"
    >
      {isLoading ? (
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      ) : (
        <Bell className="mr-2 h-4 w-4" />
      )}
      {isLoading ? "Sending..." : "Test Notification"}
    </Button>
  );
}