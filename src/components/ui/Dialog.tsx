import React, { createContext, useContext, useEffect, useRef, forwardRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { motion, AnimatePresence, HTMLMotionProps } from "motion/react";
import { cn } from "../../lib/utils";
import { modalBackdropVariants, modalContentVariants } from "../../lib/animations/variants";
import { useReducedMotionPreference } from "../../hooks/use-reduced-motion-preference";

interface DialogContextValue {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const DialogContext = createContext<DialogContextValue | undefined>(undefined);

export interface DialogProps {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: React.ReactNode;
}

export const Dialog: React.FC<DialogProps> = ({
  open: controlledOpen,
  defaultOpen = false,
  onOpenChange,
  children,
}) => {
  const [internalOpen, setInternalOpen] = React.useState(defaultOpen);
  const isOpen = controlledOpen !== undefined ? controlledOpen : internalOpen;

  const handleOpenChange = (val: boolean) => {
    if (controlledOpen === undefined) {
      setInternalOpen(val);
    }
    onOpenChange?.(val);
  };

  return (
    <DialogContext.Provider value={{ open: isOpen, onOpenChange: handleOpenChange }}>
      {children}
    </DialogContext.Provider>
  );
};

export const DialogTrigger = forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement>
>(({ onClick, ...props }, ref) => {
  const context = useContext(DialogContext);
  if (!context) throw new Error("DialogTrigger must be used within Dialog");

  return (
    <button
      ref={ref}
      type="button"
      onClick={(e) => {
        onClick?.(e);
        context.onOpenChange(true);
      }}
      {...props}
    />
  );
});
DialogTrigger.displayName = "DialogTrigger";

export interface DialogContentProps extends Omit<HTMLMotionProps<"div">, "children"> {
  children?: React.ReactNode;
  onClose?: () => void;
}

export const DialogContent = forwardRef<HTMLDivElement, DialogContentProps>(
  ({ className = "", children, onClose, ...props }, ref) => {
    const context = useContext(DialogContext);
    if (!context) throw new Error("DialogContent must be used within Dialog");
    const { open, onOpenChange } = context;
    const contentRef = useRef<HTMLDivElement>(null);
    const prefersReducedMotion = useReducedMotionPreference();

    const handleClose = useCallback(() => {
      onClose?.();
      onOpenChange(false);
    }, [onClose, onOpenChange]);

    useEffect(() => {
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === "Escape" && open) {
          handleClose();
        }
      };
      if (open) {
        window.addEventListener("keydown", handleKeyDown);
      }
      return () => window.removeEventListener("keydown", handleKeyDown);
    }, [open, handleClose]);

    if (typeof document === "undefined") return null;

    return createPortal(
      <AnimatePresence>
        {open && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
              initial="hidden"
              animate="visible"
              exit="exit"
              variants={modalBackdropVariants}
              onClick={handleClose}
              className="fixed inset-0 bg-black/60 backdrop-blur-xs"
            />

            {/* Modal Dialog Content */}
            <motion.div
              ref={(node) => {
                contentRef.current = node;
                if (typeof ref === "function") ref(node);
                else if (ref) ref.current = node;
              }}
              role="dialog"
              aria-modal="true"
              initial={prefersReducedMotion ? { opacity: 0 } : "hidden"}
              animate={prefersReducedMotion ? { opacity: 1 } : "visible"}
              exit={prefersReducedMotion ? { opacity: 0 } : "exit"}
              variants={prefersReducedMotion ? undefined : modalContentVariants}
              className={cn(
                "relative z-50 w-full max-w-lg rounded-xl border border-border bg-card p-6 text-card-foreground shadow-2xl",
                className
              )}
              {...props}
            >
              {children}
              <button
                type="button"
                onClick={handleClose}
                aria-label="Close dialog"
                className="absolute right-4 top-4 rounded-xs p-1 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <X className="h-4 w-4" />
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>,
      document.body
    );
  }
);
DialogContent.displayName = "DialogContent";

export const DialogHeader: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  className = "",
  ...props
}) => (
  <div className={cn("flex flex-col space-y-1.5 text-left mb-4", className)} {...props} />
);

export const DialogTitle = forwardRef<
  HTMLHeadingElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className = "", ...props }, ref) => (
  <h2
    ref={ref}
    className={cn("text-base font-bold text-foreground leading-none tracking-tight", className)}
    {...props}
  />
));
DialogTitle.displayName = "DialogTitle";

export const DialogDescription = forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className = "", ...props }, ref) => (
  <p
    ref={ref}
    className={cn("text-xs text-muted-foreground leading-relaxed", className)}
    {...props}
  />
));
DialogDescription.displayName = "DialogDescription";

export const DialogFooter: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  className = "",
  ...props
}) => (
  <div
    className={cn("flex items-center justify-end gap-2 pt-4 border-t border-border mt-4", className)}
    {...props}
  />
);
