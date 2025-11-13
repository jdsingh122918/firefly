"use client"

import React from "react"
import { Eye, Edit } from "lucide-react"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"

interface SharePermissionToggleProps {
  allowEditing: boolean
  onToggle: (value: boolean) => void
  disabled?: boolean
  className?: string
}

export function SharePermissionToggle({
  allowEditing,
  onToggle,
  disabled = false,
  className = ""
}: SharePermissionToggleProps) {
  return (
    <div className={`flex items-center justify-between p-4 border rounded-lg ${className}`}>
      <div className="flex items-center gap-3">
        {allowEditing ? (
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-orange-50">
            <Edit className="h-5 w-5 text-orange-600" />
          </div>
        ) : (
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-50">
            <Eye className="h-5 w-5 text-blue-600" />
          </div>
        )}
        <div>
          <Label className="text-base font-medium">
            {allowEditing ? "Edit Access" : "View Only"}
          </Label>
          <p className="text-sm text-muted-foreground">
            {allowEditing
              ? "Others can edit and modify this note"
              : "Others can only view this note"
            }
          </p>
        </div>
      </div>
      <Switch
        checked={allowEditing}
        onCheckedChange={onToggle}
        disabled={disabled}
        className="min-h-[44px] min-w-[44px] data-[state=checked]:bg-orange-600"
      />
    </div>
  )
}

// Alternative compact version for use in forms
export function CompactSharePermissionToggle({
  allowEditing,
  onToggle,
  disabled = false,
  className = ""
}: SharePermissionToggleProps) {
  return (
    <div className={`flex items-center justify-between ${className}`}>
      <div className="flex items-center gap-2">
        {allowEditing ? (
          <Edit className="h-4 w-4 text-orange-600" />
        ) : (
          <Eye className="h-4 w-4 text-blue-600" />
        )}
        <span className="text-sm font-medium">
          {allowEditing ? "Can Edit" : "View Only"}
        </span>
      </div>
      <Switch
        checked={allowEditing}
        onCheckedChange={onToggle}
        disabled={disabled}
        className="min-h-[44px] min-w-[44px]"
      />
    </div>
  )
}

// Helper component for permission description
export function SharePermissionDescription({ allowEditing }: { allowEditing: boolean }) {
  return (
    <div className="text-xs text-muted-foreground">
      {allowEditing ? (
        <span>
          ✓ Can edit content &nbsp;
          ✓ Can add attachments &nbsp;
          ✓ Can share with others
        </span>
      ) : (
        <span>
          ✓ Can view content &nbsp;
          ✗ Cannot edit &nbsp;
          ✗ Cannot share
        </span>
      )}
    </div>
  )
}