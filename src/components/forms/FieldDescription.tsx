import React from "react";
import { cn } from "../../lib/utils";
import { useFormField } from "./FormField";

export type FieldDescriptionProps = React.HTMLAttributes<HTMLParagraphElement>;

export const FieldDescription: React.FC<FieldDescriptionProps> = ({
  className = "",
  children,
  ...props
}) => {
  const { id } = useFormField();

  return (
    <p
      id={`${id}-desc`}
      className={cn("text-[11px] text-muted-foreground leading-relaxed", className)}
      {...props}
    >
      {children}
    </p>
  );
};

export default FieldDescription;
