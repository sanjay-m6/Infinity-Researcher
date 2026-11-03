/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext } from "react";
import { cn } from "../../lib/utils";

interface FormFieldContextValue {
  id: string;
  error?: string;
  required?: boolean;
}

const FormFieldContext = createContext<FormFieldContextValue | undefined>(undefined);

export const useFormField = () => {
  const context = useContext(FormFieldContext);
  if (!context) {
    throw new Error("useFormField must be used within a FormField");
  }
  return context;
};

export interface FormFieldProps extends React.HTMLAttributes<HTMLDivElement> {
  name?: string;
  error?: string;
  required?: boolean;
}

export const FormField: React.FC<FormFieldProps> = ({
  name,
  error,
  required = false,
  className = "",
  children,
  id: customId,
  ...props
}) => {
  const generatedId = React.useId();
  const id = customId || (name ? `field-${name}` : `field-${generatedId}`);

  return (
    <FormFieldContext.Provider value={{ id, error, required }}>
      <div className={cn("space-y-1.5 w-full", className)} {...props}>
        {children}
      </div>
    </FormFieldContext.Provider>
  );
};

export default FormField;
