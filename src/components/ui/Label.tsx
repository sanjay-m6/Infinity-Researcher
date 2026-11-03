import React, { forwardRef } from "react";
import { cn } from "../../lib/utils";

export interface LabelProps extends React.LabelHTMLAttributes<HTMLLabelElement> {
  required?: boolean;
}

export const Label = forwardRef<HTMLLabelElement, LabelProps>(
  ({ required = false, className = "", children, ...props }, ref) => (
    <label
      ref={ref}
      className={cn(
        "text-xs font-semibold text-foreground leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 select-none",
        className
      )}
      {...props}
    >
      {children}
      {required && <span className="ml-0.5 text-destructive">*</span>}
    </label>
  )
);

Label.displayName = "Label";
export default Label;
