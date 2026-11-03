import React, { createContext, useContext, useEffect, useRef, forwardRef, useState } from "react";
import { motion, AnimatePresence, HTMLMotionProps } from "motion/react";
import { cn } from "../../lib/utils";
import { dropdownVariants } from "../../lib/animations/variants";
import { useReducedMotionPreference } from "../../hooks/use-reduced-motion-preference";

interface DropdownMenuContextValue {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const DropdownMenuContext = createContext<DropdownMenuContextValue | undefined>(undefined);

export interface DropdownMenuProps {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: React.ReactNode;
}

export const DropdownMenu: React.FC<DropdownMenuProps> = ({
  open: controlledOpen,
  defaultOpen = false,
  onOpenChange,
  children,
}) => {
  const [internalOpen, setInternalOpen] = useState(defaultOpen);
  const isOpen = controlledOpen !== undefined ? controlledOpen : internalOpen;

  const handleOpenChange = (val: boolean) => {
    if (controlledOpen === undefined) {
      setInternalOpen(val);
    }
    onOpenChange?.(val);
  };

  return (
    <DropdownMenuContext.Provider value={{ open: isOpen, onOpenChange: handleOpenChange }}>
      <div className="relative inline-block text-left">{children}</div>
    </DropdownMenuContext.Provider>
  );
};

export const DropdownMenuTrigger = forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement>
>(({ onClick, ...props }, ref) => {
  const context = useContext(DropdownMenuContext);
  if (!context) throw new Error("DropdownMenuTrigger must be used within DropdownMenu");

  return (
    <button
      ref={ref}
      type="button"
      aria-haspopup="menu"
      aria-expanded={context.open}
      onClick={(e) => {
        onClick?.(e);
        context.onOpenChange(!context.open);
      }}
      {...props}
    />
  );
});
DropdownMenuTrigger.displayName = "DropdownMenuTrigger";

export interface DropdownMenuContentProps extends Omit<HTMLMotionProps<"div">, "children"> {
  align?: "left" | "right" | "center";
  children?: React.ReactNode;
}

export const DropdownMenuContent = forwardRef<HTMLDivElement, DropdownMenuContentProps>(
  ({ align = "left", className = "", children, ...props }, ref) => {
    const context = useContext(DropdownMenuContext);
    if (!context) throw new Error("DropdownMenuContent must be used within DropdownMenu");
    const { open, onOpenChange } = context;
    const contentRef = useRef<HTMLDivElement>(null);
    const prefersReducedMotion = useReducedMotionPreference();

    useEffect(() => {
      if (!open) return;

      const handleClickOutside = (e: MouseEvent) => {
        if (contentRef.current && !contentRef.current.contains(e.target as Node)) {
          onOpenChange(false);
        }
      };

      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === "Escape") {
          onOpenChange(false);
        }
      };

      document.addEventListener("mousedown", handleClickOutside);
      window.addEventListener("keydown", handleKeyDown);
      return () => {
        document.removeEventListener("mousedown", handleClickOutside);
        window.removeEventListener("keydown", handleKeyDown);
      };
    }, [open, onOpenChange]);

    const alignStyles = {
      left: "left-0",
      right: "right-0",
      center: "left-1/2 -translate-x-1/2",
    }[align];

    return (
      <AnimatePresence>
        {open && (
          <motion.div
            ref={(node) => {
              contentRef.current = node;
              if (typeof ref === "function") ref(node);
              else if (ref) ref.current = node;
            }}
            role="menu"
            aria-orientation="vertical"
            initial={prefersReducedMotion ? { opacity: 0 } : "hidden"}
            animate={prefersReducedMotion ? { opacity: 1 } : "visible"}
            exit={prefersReducedMotion ? { opacity: 0 } : "exit"}
            variants={prefersReducedMotion ? undefined : dropdownVariants}
            className={cn(
              "absolute z-50 mt-1 min-w-[10rem] overflow-hidden rounded-lg border border-border bg-popover p-1 text-popover-foreground shadow-lg backdrop-blur-xs",
              alignStyles,
              className
            )}
            {...props}
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    );
  }
);
DropdownMenuContent.displayName = "DropdownMenuContent";

export interface DropdownMenuItemProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  inset?: boolean;
}

export const DropdownMenuItem = forwardRef<HTMLButtonElement, DropdownMenuItemProps>(
  ({ className = "", inset = false, disabled = false, onClick, children, ...props }, ref) => {
    const context = useContext(DropdownMenuContext);

    const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
      if (disabled) return;
      onClick?.(e);
      context?.onOpenChange(false);
    };

    return (
      <button
        ref={ref}
        type="button"
        role="menuitem"
        disabled={disabled}
        onClick={handleClick}
        className={cn(
          "relative flex w-full cursor-pointer select-none items-center rounded-xs px-2.5 py-1.5 text-xs font-medium text-foreground outline-none transition-colors",
          "hover:bg-accent hover:text-accent-foreground focus-visible:bg-accent focus-visible:text-accent-foreground",
          "disabled:pointer-events-none disabled:opacity-50",
          inset && "pl-8",
          className
        )}
        {...props}
      >
        {children}
      </button>
    );
  }
);
DropdownMenuItem.displayName = "DropdownMenuItem";

export const DropdownMenuLabel: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  className = "",
  ...props
}) => (
  <div
    className={cn("px-2.5 py-1.5 text-[11px] font-semibold text-muted-foreground", className)}
    {...props}
  />
);

export const DropdownMenuSeparator: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  className = "",
  ...props
}) => (
  <div className={cn("-mx-1 my-1 h-[1px] bg-border", className)} {...props} />
);
