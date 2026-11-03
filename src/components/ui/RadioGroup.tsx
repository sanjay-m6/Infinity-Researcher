import React, { createContext, useContext, forwardRef } from "react";
import { cn } from "../../lib/utils";

interface RadioGroupContextValue {
  value: string;
  onValueChange: (value: string) => void;
  name?: string;
  disabled?: boolean;
}

const RadioGroupContext = createContext<RadioGroupContextValue | undefined>(undefined);

export interface RadioGroupProps extends React.HTMLAttributes<HTMLDivElement> {
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  name?: string;
  disabled?: boolean;
  orientation?: "horizontal" | "vertical";
}

export const RadioGroup = forwardRef<HTMLDivElement, RadioGroupProps>(
  (
    {
      value: controlledValue,
      defaultValue = "",
      onValueChange,
      name,
      disabled = false,
      orientation = "vertical",
      className = "",
      children,
      ...props
    },
    ref
  ) => {
    const [internalValue, setInternalValue] = React.useState(defaultValue);
    const activeValue = controlledValue !== undefined ? controlledValue : internalValue;

    const handleValueChange = (val: string) => {
      if (controlledValue === undefined) {
        setInternalValue(val);
      }
      onValueChange?.(val);
    };

    return (
      <RadioGroupContext.Provider
        value={{ value: activeValue, onValueChange: handleValueChange, name, disabled }}
      >
        <div
          ref={ref}
          role="radiogroup"
          aria-orientation={orientation}
          className={cn(
            "grid gap-2",
            orientation === "horizontal" && "grid-flow-col auto-cols-max",
            className
          )}
          {...props}
        >
          {children}
        </div>
      </RadioGroupContext.Provider>
    );
  }
);
RadioGroup.displayName = "RadioGroup";

export interface RadioGroupItemProps extends Omit<
  React.ButtonHTMLAttributes<HTMLButtonElement>,
  "onChange"
> {
  value: string;
  label?: string;
  description?: string;
}

export const RadioGroupItem = forwardRef<HTMLButtonElement, RadioGroupItemProps>(
  (
    {
      value,
      label,
      description,
      disabled = false,
      className = "",
      id: customId,
      ...props
    },
    ref
  ) => {
    const context = useContext(RadioGroupContext);
    if (!context) {
      throw new Error("RadioGroupItem must be used within a RadioGroup");
    }

    const generatedId = React.useId();
    const id = customId || `radio-${value}-${generatedId}`;
    const isChecked = context.value === value;
    const isDisabled = disabled || context.disabled;

    const handleClick = () => {
      if (!isDisabled) {
        context.onValueChange(value);
      }
    };

    return (
      <div className="flex items-start gap-2.5 select-none">
        <button
          ref={ref}
          type="button"
          role="radio"
          aria-checked={isChecked}
          aria-label={label}
          disabled={isDisabled}
          id={id}
          onClick={handleClick}
          className={cn(
            "aspect-square h-4 w-4 rounded-full border border-border bg-card text-primary transition-colors cursor-pointer",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background",
            "disabled:cursor-not-allowed disabled:opacity-50",
            isChecked && "border-primary bg-primary text-primary-foreground",
            className
          )}
          {...props}
        >
          {isChecked && (
            <span className="flex items-center justify-center">
              <span className="h-1.5 w-1.5 rounded-full bg-primary-foreground" />
            </span>
          )}
        </button>
        {(label || description) && (
          <div className="grid gap-0.5 leading-none">
            {label && (
              <label
                htmlFor={id}
                onClick={handleClick}
                className={cn(
                  "text-xs font-semibold text-foreground cursor-pointer select-none",
                  isDisabled && "opacity-50 cursor-not-allowed"
                )}
              >
                {label}
              </label>
            )}
            {description && (
              <p className="text-[11px] text-muted-foreground leading-normal">
                {description}
              </p>
            )}
          </div>
        )}
      </div>
    );
  }
);
RadioGroupItem.displayName = "RadioGroupItem";
