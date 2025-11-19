"use client"

import { useState } from "react"
import { MessageSquare } from "lucide-react"
import { Button } from "@/components/ui/button"
import { FeedbackDialog } from "./feedback-dialog"

export function FeedbackButton() {
  const [open, setOpen] = useState(false)

  return (
    <>
      {/* Floating Feedback Button */}
      <div className="fixed bottom-6 right-6 z-50">
        <Button
          onClick={() => setOpen(true)}
          size="lg"
          className="
            rounded-full shadow-lg backdrop-blur-sm
            bg-primary/90 hover:bg-primary
            border-2 border-primary/20 hover:border-primary/30
            transition-all duration-200
            min-h-[56px] min-w-[56px]
          "
        >
          <MessageSquare className="h-6 w-6" />
          <span className="sr-only">Send Feedback</span>
        </Button>
      </div>

      {/* Feedback Dialog */}
      <FeedbackDialog open={open} onOpenChange={setOpen} />
    </>
  )
}