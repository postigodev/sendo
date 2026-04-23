import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center rounded-full text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/60 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        primary:
          "bg-[linear-gradient(90deg,rgba(31,184,205,1),rgba(78,219,183,1))] px-5 py-3 text-slate-950 shadow-[0_10px_40px_rgba(31,184,205,0.24)] hover:brightness-105",
        secondary:
          "border border-white/10 bg-white/[0.03] px-5 py-3 text-slate-100 hover:border-cyan-300/20 hover:bg-cyan-300/[0.04]",
        ghost:
          "px-0 py-0 text-cyan-100/80 hover:text-cyan-50"
      },
    },
    defaultVariants: {
      variant: "primary",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, ...props }, ref) => {
    return (
      <button
        className={cn(buttonVariants({ variant }), className)}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
