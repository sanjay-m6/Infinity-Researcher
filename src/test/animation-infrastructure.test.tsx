import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import {
  motionDuration,
  motionEase,
  motionDistance,
  motionSpring,
  transitionFast,
  transitionNormal,
  transitionEnter,
  transitionExit,
  reducedMotionTransition,
  createTransition,
  fadeVariants,
  subtleEntranceVariants,
  horizontalEntranceVariants,
  dropdownVariants,
  modalContentVariants,
  modalBackdropVariants,
  staggerContainerVariants,
  staggerItemVariants,
  reducedMotionVariants,
  getAnimationPreset,
  presetReducedMotion,
  isReducedMotionPreferred,
  safeTransition,
  safeVariants,
} from "../lib/animations";
import {
  AnimatedContainer,
  FadeIn,
  StaggerContainer,
  StaggerItem,
  AnimatedPresence,
  ReducedMotionProvider,
} from "../components/animation";

describe("Phase 4 — Motion Infrastructure & Animation Architecture", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("1. Centralized Motion Tokens", () => {
    it("defines conservative, desktop-optimized duration tokens", () => {
      expect(motionDuration.instant).toBe(0);
      expect(motionDuration.fast).toBe(0.12);
      expect(motionDuration.normal).toBe(0.18);
      expect(motionDuration.moderate).toBe(0.24);
      expect(motionDuration.slow).toBe(0.3);
    });

    it("defines standard cubic bezier easing curves", () => {
      expect(motionEase.standard).toEqual([0.2, 0, 0, 1]);
      expect(motionEase.enter).toEqual([0, 0, 0.2, 1]);
      expect(motionEase.exit).toEqual([0.4, 0, 1, 1]);
      expect(motionEase.emphasized).toEqual([0.2, 0, 0, 1]);
    });

    it("defines restrained spatial distance tokens", () => {
      expect(motionDistance.xs).toBe(2);
      expect(motionDistance.sm).toBe(4);
      expect(motionDistance.md).toBe(6);
      expect(motionDistance.lg).toBe(12);
      expect(motionDistance.xl).toBe(20);
    });

    it("defines snappy and gentle spring configurations", () => {
      expect(motionSpring.snappy.type).toBe("spring");
      expect(motionSpring.snappy.stiffness).toBe(400);
      expect(motionSpring.gentle.type).toBe("spring");
      expect(motionSpring.gentle.stiffness).toBe(260);
    });
  });

  describe("2. Transition Helpers & Preset Resolution", () => {
    it("exports standard transition objects aligned with tokens", () => {
      expect(transitionFast.duration).toBe(0.12);
      expect(transitionNormal.duration).toBe(0.18);
      expect(transitionEnter.ease).toEqual([0, 0, 0.2, 1]);
      expect(transitionExit.ease).toEqual([0.4, 0, 1, 1]);
      expect(reducedMotionTransition.duration).toBe(0);
    });

    it("creates custom transitions with defaults", () => {
      const custom = createTransition({ duration: 0.25, delay: 0.1 });
      expect(custom.duration).toBe(0.25);
      expect(custom.delay).toBe(0.1);
      expect(custom.ease).toEqual([0.2, 0, 0, 1]);
    });

    it("resolves animation presets by name", () => {
      const fadePreset = getAnimationPreset("fade", false);
      expect(fadePreset.initial).toBe("hidden");
      expect(fadePreset.animate).toBe("visible");
      expect(fadePreset.variants).toBe(fadeVariants);

      const subtlePreset = getAnimationPreset("subtleEntrance", false);
      expect(subtlePreset.variants).toBe(subtleEntranceVariants);
    });

    it("substitutes reducedMotion preset when prefersReducedMotion is true", () => {
      const preset = getAnimationPreset("modalContent", true);
      expect(preset).toEqual(presetReducedMotion);
      expect(preset.variants).toBe(reducedMotionVariants);
    });
  });

  describe("3. Animation Variants & Accessibility", () => {
    it("ensures subtle entrance uses 6px distance token and zero layout thrashing", () => {
      const hidden = subtleEntranceVariants.hidden as { y: number; opacity: number };
      const visible = subtleEntranceVariants.visible as { y: number; opacity: number };
      expect(hidden.y).toBe(6);
      expect(hidden.opacity).toBe(0);
      expect(visible.y).toBe(0);
      expect(visible.opacity).toBe(1);
    });

    it("ensures reduced motion variants remove all spatial translation and scaling", () => {
      const hidden = reducedMotionVariants.hidden as { x: number; y: number; scale: number; opacity: number };
      const visible = reducedMotionVariants.visible as { x: number; y: number; scale: number; opacity: number };
      expect(hidden.x).toBe(0);
      expect(hidden.y).toBe(0);
      expect(hidden.scale).toBe(1);
      expect(hidden.opacity).toBe(0);
      expect(visible.x).toBe(0);
      expect(visible.y).toBe(0);
      expect(visible.scale).toBe(1);
      expect(visible.opacity).toBe(1);
    });

    it("ensures safeTransition strips durations when reduced motion is preferred", () => {
      const safe = safeTransition(transitionNormal, true);
      expect(safe.duration).toBe(0);

      const normal = safeTransition(transitionNormal, false);
      expect(normal.duration).toBe(0.18);
    });

    it("ensures safeVariants substitutes reduced variants when requested", () => {
      const safe = safeVariants(dropdownVariants, true);
      expect(safe).toBe(reducedMotionVariants);

      const standard = safeVariants(dropdownVariants, false);
      expect(standard).toBe(dropdownVariants);
    });

    it("safely queries isReducedMotionPreferred in the runtime environment", () => {
      const preferred = isReducedMotionPreferred();
      expect(typeof preferred).toBe("boolean");
    });

    it("confirms variants contain zero hardcoded colors (theme neutral)", () => {
      const allVariants = [
        fadeVariants,
        subtleEntranceVariants,
        horizontalEntranceVariants,
        dropdownVariants,
        modalContentVariants,
        modalBackdropVariants,
        staggerContainerVariants,
        staggerItemVariants,
      ];

      for (const v of allVariants) {
        const json = JSON.stringify(v);
        expect(json).not.toMatch(/#([0-9a-fA-F]{3,8})/);
        expect(json).not.toMatch(/rgb\(/);
      }
    });
  });

  describe("4. Reusable Motion Components", () => {
    it("renders AnimatedContainer with children, forwarded ref, and custom classes", () => {
      const testRef = React.createRef<HTMLDivElement>();
      render(
        <AnimatedContainer ref={testRef} className="test-container" data-testid="animated-box">
          <span>Research Content</span>
        </AnimatedContainer>
      );

      const box = screen.getByTestId("animated-box");
      expect(box).toBeInTheDocument();
      expect(box).toHaveClass("test-container");
      expect(screen.getByText("Research Content")).toBeInTheDocument();
      expect(testRef.current).toBeInstanceOf(HTMLDivElement);
    });

    it("renders FadeIn component with direction offsets and preserves content", () => {
      const testRef = React.createRef<HTMLDivElement>();
      render(
        <FadeIn ref={testRef} direction="up" distance={8} data-testid="fade-box">
          <p>Scholarly Abstract</p>
        </FadeIn>
      );

      const element = screen.getByTestId("fade-box");
      expect(element).toBeInTheDocument();
      expect(screen.getByText("Scholarly Abstract")).toBeInTheDocument();
      expect(testRef.current).toBeInstanceOf(HTMLDivElement);
    });

    it("renders StaggerContainer and StaggerItem cascade", () => {
      render(
        <StaggerContainer data-testid="stagger-list">
          <StaggerItem data-testid="item-1">Item 1</StaggerItem>
          <StaggerItem data-testid="item-2">Item 2</StaggerItem>
        </StaggerContainer>
      );

      expect(screen.getByTestId("stagger-list")).toBeInTheDocument();
      expect(screen.getByTestId("item-1")).toBeInTheDocument();
      expect(screen.getByTestId("item-2")).toBeInTheDocument();
    });

    it("renders AnimatedPresence and passes through children", () => {
      render(
        <AnimatedPresence>
          <div data-testid="presence-child">Active View</div>
        </AnimatedPresence>
      );

      expect(screen.getByTestId("presence-child")).toBeInTheDocument();
    });

    it("renders ReducedMotionProvider and configures policy without throwing", () => {
      render(
        <ReducedMotionProvider reducedMotion="always">
          <div data-testid="motion-configured">Accessible Child</div>
        </ReducedMotionProvider>
      );

      expect(screen.getByTestId("motion-configured")).toBeInTheDocument();
    });
  });
});
