import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive shadow-sm hover:shadow-md",
  {
    variants: {
      variant: {
        default: "border-2 border-primary/20 bg-primary text-primary-foreground hover:bg-primary/90 hover:border-primary/30 backdrop-blur-sm",
        destructive:
          "border-2 border-destructive/30 bg-destructive text-white hover:bg-destructive/90 hover:border-destructive/40 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40 dark:bg-destructive/60 backdrop-blur-sm",
        outline:
          "border-2 border-border hover:border-border/80 bg-background/90 hover:bg-accent hover:text-accent-foreground dark:bg-input/40 dark:border-input/60 dark:hover:bg-input/60 backdrop-blur-sm",
        secondary:
          "border-2 border-secondary/30 bg-secondary/90 text-secondary-foreground hover:bg-secondary/70 hover:border-secondary/40 backdrop-blur-sm",
        ghost:
          "border-2 border-transparent hover:border-accent/30 hover:bg-accent/90 hover:text-accent-foreground dark:hover:bg-accent/60 backdrop-blur-sm",
        link: "text-primary underline-offset-4 hover:underline border-2 border-transparent",
      },
      size: {
        default: "h-10 px-6 py-3.5 has-[>svg]:px-5",
        sm: "h-9 rounded-lg gap-1.5 px-5 py-2.5 has-[>svg]:px-4",
        lg: "h-11 rounded-lg px-8 py-5 has-[>svg]:px-6",
        icon: "size-10",
        "icon-sm": "size-9",
        "icon-lg": "size-11",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot : "button"

  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
