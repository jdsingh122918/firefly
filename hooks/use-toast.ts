"use client";

import { toast as sonnerToast } from "sonner";

export interface ToastProps {
  title?: string;
  description?: string;
  variant?: "default" | "destructive" | "success";
}

export function useToast() {
  const toast = ({ title, description, variant = "default" }: ToastProps) => {
    const message = title || description || "";
    const fullMessage = title && description ? `${title}: ${description}` : message;

    switch (variant) {
      case "destructive":
        return sonnerToast.error(fullMessage);
      case "success":
        return sonnerToast.success(fullMessage);
      default:
        return sonnerToast(fullMessage);
    }
  };

  return {
    toast,
  };
}