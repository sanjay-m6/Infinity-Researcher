import React from "react";
import { AlertCircle } from "lucide-react";
import { cn } from "../../lib/utils";
import { useFormField } from "./FormField";

export interface ValidationMessageProps extends React.HTMLAttributes<HTMLParagraphElement> {
  message?: string;
}

export const ValidationMessage: React.FC<ValidationMessageProps> = ({
  message: customMessage,
  className = "",
  children,
  ...props
}) => {
  const { id, error } = useFormField();
  const displayMessage = customMessage || error || children;

  if (!displayMessage) return null;

  return (
    <p
      id={`${id}-error`}
      role="alert"
      className={cn(
        "flex items-center gap-1.5 text-xs text-destructive font-medium mt-1 animate-in fade-in duration-150",
        className
      )}
      {...props}
    >
      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
      <span>{displayMessage}</span>
    </p>
  );
};

export default ValidationMessage;
