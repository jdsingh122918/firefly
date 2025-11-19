import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center justify-center rounded-full border px-2 py-0.5 text-xs font-medium w-fit whitespace-nowrap shrink-0 [&>svg]:size-3 gap-1 [&>svg]:pointer-events-none focus-visible:border-ring focus-visible:ring-ring/60 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive transition-[color,box-shadow] overflow-hidden",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary text-primary-foreground [a&]:hover:bg-primary/90",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground [a&]:hover:bg-secondary/90",
        destructive:
          "border-transparent bg-destructive text-white [a&]:hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40 dark:bg-destructive/60",
        outline:
          "text-foreground [a&]:hover:bg-accent [a&]:hover:text-accent-foreground",
        info:
          "border-transparent bg-[hsl(var(--status-info)/0.1)] text-[hsl(var(--status-info))] border-[hsl(var(--status-info)/0.3)] [a&]:hover:bg-[hsl(var(--status-info)/0.15)]",
        success:
          "border-transparent bg-[hsl(var(--status-success)/0.1)] text-[hsl(var(--status-success))] border-[hsl(var(--status-success)/0.3)] [a&]:hover:bg-[hsl(var(--status-success)/0.15)]",
        warning:
          "border-transparent bg-[hsl(var(--status-warning)/0.1)] text-[hsl(var(--status-warning))] border-[hsl(var(--status-warning)/0.3)] [a&]:hover:bg-[hsl(var(--status-warning)/0.15)]",
        pending:
          "border-transparent bg-[hsl(var(--status-pending)/0.1)] text-[hsl(var(--status-pending))] border-[hsl(var(--status-pending)/0.3)] [a&]:hover:bg-[hsl(var(--status-pending)/0.15)]",
        active:
          "border-transparent bg-[hsl(var(--status-active)/0.1)] text-[hsl(var(--status-active))] border-[hsl(var(--status-active)/0.3)] [a&]:hover:bg-[hsl(var(--status-active)/0.15)]",
        neutral:
          "border-transparent bg-[hsl(var(--status-neutral)/0.1)] text-[hsl(var(--status-neutral))] border-[hsl(var(--status-neutral)/0.3)] [a&]:hover:bg-[hsl(var(--status-neutral)/0.15)]",
        medical:
          "border-transparent bg-[hsl(var(--healthcare-medical)/0.1)] text-[hsl(var(--healthcare-medical))] border-[hsl(var(--healthcare-medical)/0.3)] [a&]:hover:bg-[hsl(var(--healthcare-medical)/0.15)]",
        mental:
          "border-transparent bg-[hsl(var(--healthcare-mental)/0.1)] text-[hsl(var(--healthcare-mental))] border-[hsl(var(--healthcare-mental)/0.3)] [a&]:hover:bg-[hsl(var(--healthcare-mental)/0.15)]",
        home:
          "border-transparent bg-[hsl(var(--healthcare-home)/0.1)] text-[hsl(var(--healthcare-home))] border-[hsl(var(--healthcare-home)/0.3)] [a&]:hover:bg-[hsl(var(--healthcare-home)/0.15)]",
        equipment:
          "border-transparent bg-[hsl(var(--healthcare-equipment)/0.1)] text-[hsl(var(--healthcare-equipment))] border-[hsl(var(--healthcare-equipment)/0.3)] [a&]:hover:bg-[hsl(var(--healthcare-equipment)/0.15)]",
        basic:
          "border-transparent bg-[hsl(var(--healthcare-basic)/0.1)] text-[hsl(var(--healthcare-basic))] border-[hsl(var(--healthcare-basic)/0.3)] [a&]:hover:bg-[hsl(var(--healthcare-basic)/0.15)]",
        financial:
          "border-transparent bg-[hsl(var(--healthcare-financial)/0.1)] text-[hsl(var(--healthcare-financial))] border-[hsl(var(--healthcare-financial)/0.3)] [a&]:hover:bg-[hsl(var(--healthcare-financial)/0.15)]",
        legal:
          "border-transparent bg-[hsl(var(--healthcare-legal)/0.1)] text-[hsl(var(--healthcare-legal))] border-[hsl(var(--healthcare-legal)/0.3)] [a&]:hover:bg-[hsl(var(--healthcare-legal)/0.15)]",
        education:
          "border-transparent bg-[hsl(var(--healthcare-education)/0.1)] text-[hsl(var(--healthcare-education))] border-[hsl(var(--healthcare-education)/0.3)] [a&]:hover:bg-[hsl(var(--healthcare-education)/0.15)]",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant,
  asChild = false,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "span"

  return (
    <Comp
      data-slot="badge"
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  )
}

export { Badge, badgeVariants }
