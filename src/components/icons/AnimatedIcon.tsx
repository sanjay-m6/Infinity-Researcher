import { forwardRef } from "react";
import { motion, HTMLMotionProps } from "motion/react";
import { AnimatedIconProps } from "./iconTypes";
import { AppIcon } from "./AppIcon";
import { ICON_ANIMATION_TRANSITIONS } from "./iconConfig";
import { useReducedMotionPreference } from "../../hooks/use-reduced-motion-preference";
import { cn } from "../../lib/utils";

/**
 * Animated icon primitive powered by Motion for React.
 * Supports restrained micro-interactions (spin, pulse, hover-scale, tap-bounce, expand-chevron)
 * with strict reduced-motion safeguards and zero layout shifting.
 */
export const AnimatedIcon = forwardRef<HTMLSpanElement, AnimatedIconProps>(
  (
    {
      icon,
      size = "md",
      strokeWidth,
      animation = "none",
      isAnimating = true,
      isExpanded = false,
      chevronAngle = 180,
      trigger: _trigger,
      className,
      "aria-label": ariaLabel,
      title,
      ...props
    },
    ref
  ) => {
    const isReduced = useReducedMotionPreference();

    // If no animation requested, render static base icon
    if (animation === "none") {
      return (
        <AppIcon
          icon={icon}
          size={size}
          strokeWidth={strokeWidth}
          className={className}
          aria-label={ariaLabel}
          title={title}
          {...props}
        />
      );
    }

    let animateProps: HTMLMotionProps<"span"> = {};

    if (isReduced) {
      // Under reduced motion: instant state change without transitions or motion
      if (animation === "expand-chevron") {
        animateProps = {
          animate: { rotate: isExpanded ? chevronAngle : 0 },
          transition: { duration: 0 },
        };
      } else {
        animateProps = {
          animate: { rotate: 0, scale: 1, opacity: 1, x: 0 },
          transition: { duration: 0 },
        };
      }
    } else {
      switch (animation) {
        case "spin":
          animateProps = {
            animate: isAnimating ? { rotate: 360 } : { rotate: 0 },
            transition: isAnimating
              ? ICON_ANIMATION_TRANSITIONS.spin
              : { duration: 0.15 },
          };
          break;

        case "pulse":
          animateProps = {
            animate: isAnimating
              ? { opacity: [1, 0.45, 1], scale: [1, 0.96, 1] }
              : { opacity: 1, scale: 1 },
            transition: isAnimating
              ? ICON_ANIMATION_TRANSITIONS.pulse
              : { duration: 0.15 },
          };
          break;

        case "hover-scale":
          animateProps = {
            whileHover: { scale: 1.15 },
            transition: ICON_ANIMATION_TRANSITIONS.spring,
          };
          break;

        case "hover-rotate":
          animateProps = {
            whileHover: { rotate: 12 },
            transition: ICON_ANIMATION_TRANSITIONS.spring,
          };
          break;

        case "tap-bounce":
          animateProps = {
            whileTap: { scale: 0.88 },
            transition: ICON_ANIMATION_TRANSITIONS.snappy,
          };
          break;

        case "success-check":
          animateProps = {
            initial: { scale: 0.7, opacity: 0 },
            animate: { scale: 1, opacity: 1 },
            transition: ICON_ANIMATION_TRANSITIONS.spring,
          };
          break;

        case "error-shake":
          animateProps = {
            animate: isAnimating
              ? { x: [-2, 2, -2, 2, 0] }
              : { x: 0 },
            transition: { duration: 0.35, ease: "easeInOut" },
          };
          break;

        case "expand-chevron":
          animateProps = {
            animate: { rotate: isExpanded ? chevronAngle : 0 },
            transition: ICON_ANIMATION_TRANSITIONS.expand,
          };
          break;

        default:
          break;
      }
    }

    return (
      <motion.span
        ref={ref}
        className={cn("inline-flex items-center justify-center shrink-0 origin-center", className)}
        {...animateProps}
      >
        <AppIcon
          icon={icon}
          size={size}
          strokeWidth={strokeWidth}
          aria-label={ariaLabel}
          title={title}
          {...props}
        />
      </motion.span>
    );
  }
);

AnimatedIcon.displayName = "AnimatedIcon";
export default AnimatedIcon;
