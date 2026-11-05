/* eslint-disable @typescript-eslint/no-explicit-any */
import * as React from "react";
import { motion, useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";

export type HoleBackgroundProps = React.ComponentProps<"div"> & {
  strokeColor?: string;
  numberOfLines?: number;
  numberOfDiscs?: number;
  particleRGBColor?: [number, number, number];
};

function usePageVisible(): boolean {
  const [isVisible, setIsVisible] = React.useState<boolean>(
    typeof document !== "undefined" ? document.visibilityState === "visible" : true
  );

  React.useEffect(() => {
    if (typeof document === "undefined") return;
    const handleVisibilityChange = () => {
      setIsVisible(document.visibilityState === "visible");
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  return isVisible;
}

function useSafeInView(ref: React.RefObject<Element | null>): boolean {
  const [isInView, setIsInView] = React.useState<boolean>(true);

  React.useEffect(() => {
    if (typeof window === "undefined" || typeof IntersectionObserver === "undefined") {
      setIsInView(true);
      return;
    }
    const element = ref.current;
    if (!element) return;

    const observer = new IntersectionObserver(([entry]) => {
      if (entry) {
        setIsInView(entry.isIntersecting);
      }
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref]);

  return isInView;
}

function useIsDarkMode(): boolean {
  const [isDark, setIsDark] = React.useState<boolean>(() => {
    if (typeof document === "undefined") return false;
    return document.documentElement.classList.contains("dark");
  });

  React.useEffect(() => {
    if (typeof document === "undefined") return;
    const observer = new MutationObserver(() => {
      setIsDark(document.documentElement.classList.contains("dark"));
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });
    return () => observer.disconnect();
  }, []);

  return isDark;
}

export function HoleBackground({
  strokeColor,
  numberOfLines = 48,
  numberOfDiscs = 48,
  particleRGBColor,
  className,
  children,
  ...props
}: HoleBackgroundProps) {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const isDark = useIsDarkMode();

  const activeStrokeColor =
    strokeColor || (isDark ? "rgba(148, 163, 184, 0.35)" : "rgba(99, 102, 241, 0.22)");

  const [particleR, particleG, particleB] = particleRGBColor || (isDark ? [148, 163, 184] : [99, 102, 241]);

  const inView = useSafeInView(canvasRef);
  const pageVisible = usePageVisible();
  const reduceMotion = useReducedMotion();
  const playing = Boolean(inView && pageVisible && !reduceMotion);

  const stateRef = React.useRef<any>({
    discs: [] as any[],
    lines: [] as any[],
    particles: [] as any[],
    startDisc: {},
    endDisc: {},
    rect: { width: 0, height: 0 },
    render: { width: 0, height: 0, dpi: 1 },
    linesCanvas: null,
  });

  const linear = (p: number) => p;

  const tweenValue = React.useCallback(
    (start: number, end: number, p: number) => {
      const delta = end - start;
      return start + delta * linear(p);
    },
    []
  );

  const tweenDisc = React.useCallback(
    (disc: any) => {
      const { startDisc, endDisc } = stateRef.current;
      disc.x = tweenValue(startDisc.x, endDisc.x, disc.p);
      disc.y = tweenValue(startDisc.y, endDisc.y, disc.p);
      disc.w = Math.max(0, tweenValue(startDisc.w, endDisc.w, disc.p));
      disc.h = Math.max(0, tweenValue(startDisc.h, endDisc.h, disc.p));
    },
    [tweenValue]
  );

  const setSize = React.useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    stateRef.current.rect = { width: rect.width, height: rect.height };
    stateRef.current.render = {
      width: rect.width,
      height: rect.height,
      dpi: Math.min(typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1, 2),
    };
    canvas.width = Math.max(
      1,
      Math.round(stateRef.current.render.width * stateRef.current.render.dpi)
    );
    canvas.height = Math.max(
      1,
      Math.round(stateRef.current.render.height * stateRef.current.render.dpi)
    );
  }, []);

  const setDiscs = React.useCallback(() => {
    const { width, height } = stateRef.current.rect;
    if (width <= 0 || height <= 0) return;

    stateRef.current.discs = [];
    const maxDim = Math.max(width, height);

    // Spans comfortably past viewport bounds so the tunnel frames the entire screen
    stateRef.current.startDisc = {
      x: width * 0.5,
      y: height * 0.48,
      w: maxDim * 0.85,
      h: maxDim * 0.58,
    };
    // Converges inward towards the central horizon behind the content
    stateRef.current.endDisc = {
      x: width * 0.5,
      y: height * 0.48,
      w: maxDim * 0.04,
      h: maxDim * 0.027,
    };

    for (let i = 0; i < numberOfDiscs; i++) {
      const p = i / numberOfDiscs;
      const disc = { p, x: 0, y: 0, w: 0, h: 0 };
      tweenDisc(disc);
      stateRef.current.discs.push(disc);
    }
  }, [numberOfDiscs, tweenDisc]);

  const setLines = React.useCallback(() => {
    const { width, height } = stateRef.current.rect;
    if (width <= 0 || height <= 0) return;
    if (typeof document === "undefined") return;

    stateRef.current.lines = [];
    const linesAngle = (Math.PI * 2) / numberOfLines;
    for (let i = 0; i < numberOfLines; i++) {
      stateRef.current.lines.push([]);
    }
    stateRef.current.discs.forEach((disc: any) => {
      for (let i = 0; i < numberOfLines; i++) {
        const angle = i * linesAngle;
        const p = {
          x: disc.x + Math.cos(angle) * disc.w,
          y: disc.y + Math.sin(angle) * disc.h,
        };
        stateRef.current.lines[i].push(p);
      }
    });

    const { dpi } = stateRef.current.render;
    const offCanvas = document.createElement("canvas");
    offCanvas.width = Math.max(1, Math.round(width * dpi));
    offCanvas.height = Math.max(1, Math.round(height * dpi));
    const ctx = offCanvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(dpi, dpi);

    stateRef.current.lines.forEach((line: any) => {
      ctx.beginPath();
      line.forEach((p: any, j: number) => {
        if (j === 0) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
      });
      ctx.strokeStyle = activeStrokeColor;
      ctx.lineWidth = 1.25;
      ctx.stroke();
      ctx.closePath();
    });
    stateRef.current.linesCanvas = offCanvas;
  }, [numberOfLines, activeStrokeColor]);

  const initParticle = React.useCallback(
    (start: boolean = false) => {
      const { width, height } = stateRef.current.rect;
      const angle = Math.random() * Math.PI * 2;
      const speed = 0.4 + Math.random() * 1.2;
      const maxDist = Math.max(width, height) * 0.45;
      const rDist = start ? Math.random() * maxDist : Math.random() * 50;
      return {
        x: width * 0.5 + Math.cos(angle) * rDist,
        y: height * 0.48 + Math.sin(angle) * rDist,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 0.25,
        r: 0.8 + Math.random() * 2.2,
        alpha: 0.25 + Math.random() * 0.65,
        maxLife: 180 + Math.random() * 220,
        life: start ? Math.random() * 180 : 0,
      };
    },
    []
  );

  const setParticles = React.useCallback(() => {
    const { width, height } = stateRef.current.rect;
    if (width <= 0 || height <= 0) return;

    stateRef.current.particles = [];
    const totalParticles = 75;
    for (let i = 0; i < totalParticles; i++) {
      stateRef.current.particles.push(initParticle(true));
    }
  }, [initParticle]);

  const drawDiscs = React.useCallback(
    (ctx: CanvasRenderingContext2D) => {
      ctx.strokeStyle = activeStrokeColor;
      ctx.lineWidth = 1.25;

      stateRef.current.discs.forEach((disc: any, i: number) => {
        if (i % 4 !== 0) return; // Draw every 4th disc for clean spacing
        if (disc.w <= 0 || disc.h <= 0) return;

        ctx.beginPath();
        ctx.ellipse(disc.x, disc.y, disc.w, disc.h, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.closePath();
      });
    },
    [activeStrokeColor]
  );

  const drawLines = React.useCallback((ctx: CanvasRenderingContext2D) => {
    if (stateRef.current.linesCanvas) {
      const { width, height } = stateRef.current.rect;
      ctx.drawImage(stateRef.current.linesCanvas, 0, 0, width, height);
    }
  }, []);

  const drawParticles = React.useCallback(
    (ctx: CanvasRenderingContext2D) => {
      stateRef.current.particles.forEach((particle: any) => {
        const fade = Math.max(0, 1 - particle.life / particle.maxLife);
        ctx.fillStyle = `rgba(${particleR}, ${particleG}, ${particleB}, ${particle.alpha * fade})`;
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, particle.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.closePath();
      });
    },
    [particleR, particleG, particleB]
  );

  const moveDiscs = React.useCallback(() => {
    stateRef.current.discs.forEach((disc: any) => {
      disc.p = (disc.p + 0.0008) % 1;
      tweenDisc(disc);
    });
  }, [tweenDisc]);

  const moveParticles = React.useCallback(() => {
    stateRef.current.particles.forEach((p: any, idx: number) => {
      p.x += p.vx;
      p.y += p.vy;
      p.life++;
      if (p.life > p.maxLife) {
        stateRef.current.particles[idx] = initParticle(false);
      }
    });
  }, [initParticle]);

  const draw = React.useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.scale(stateRef.current.render.dpi, stateRef.current.render.dpi);
    drawDiscs(ctx);
    drawLines(ctx);
    drawParticles(ctx);
    ctx.restore();
  }, [drawDiscs, drawLines, drawParticles]);

  const init = React.useCallback(() => {
    setSize();
    setDiscs();
    setLines();
    setParticles();
  }, [setSize, setDiscs, setLines, setParticles]);

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleResize = () => {
      const rect = canvas.getBoundingClientRect();
      const { width, height, dpi } = stateRef.current.render;
      if (
        rect.width === width &&
        rect.height === height &&
        Math.min(window.devicePixelRatio || 1, 2) === dpi
      ) {
        return;
      }
      init();
      draw();
    };

    init();
    draw();

    if (typeof ResizeObserver !== "undefined") {
      const resizeObserver = new ResizeObserver(handleResize);
      resizeObserver.observe(canvas);
      return () => resizeObserver.disconnect();
    } else {
      window.addEventListener("resize", handleResize);
      return () => window.removeEventListener("resize", handleResize);
    }
  }, [init, draw]);

  React.useEffect(() => {
    if (!playing) return;
    let frameId = 0;
    const tick = () => {
      moveDiscs();
      moveParticles();
      draw();
      frameId = requestAnimationFrame(tick);
    };
    frameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameId);
  }, [playing, moveDiscs, moveParticles, draw]);

  return (
    <div
      data-slot="hole-background"
      className={cn(
        "relative size-full overflow-hidden select-none",
        "before:pointer-events-none after:pointer-events-none",
        // Smooth edge vignette that covers the ENTIRE background without cutoffs
        'before:content-[""] before:absolute before:inset-0 before:block before:size-full before:[background:radial-gradient(ellipse_at_50%_48%,transparent_35%,rgba(248,250,252,0.65)_75%,#f8fafc_100%)] dark:before:[background:radial-gradient(ellipse_at_50%_48%,transparent_35%,rgba(7,11,18,0.7)_75%,#070b12_100%)]',
        // Ambient soft bloom overlay
        'after:content-[""] after:absolute after:z-[5] after:inset-0 after:block after:size-full after:[background:radial-gradient(ellipse_at_50%_48%,rgba(99,102,241,0.12)_0%,transparent_65%)] after:mix-blend-overlay',
        className
      )}
      {...props}
    >
      {/* 2D Canvas Tunnel Grid */}
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 block size-full opacity-85 dark:opacity-80"
      />

      {/* Luminous Core Aurora rotating and pulsing in the center */}
      <motion.div
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute top-[48%] left-1/2 -translate-x-1/2 -translate-y-1/2 z-[3] w-[50%] h-[50%] rounded-full blur-[100px] opacity-40 dark:opacity-55 mix-blend-multiply dark:mix-blend-plus-lighter",
          "[background:radial-gradient(circle,rgba(99,102,241,0.7)_0%,rgba(168,85,247,0.45)_35%,rgba(236,72,153,0.25)_65%,transparent_80%)] dark:[background:radial-gradient(circle,rgba(0,248,241,0.55)_0%,rgba(139,92,246,0.45)_35%,rgba(254,132,143,0.3)_65%,transparent_80%)]"
        )}
        animate={{
          scale: playing ? [1, 1.12, 1] : 1,
          rotate: playing ? [0, 180, 360] : 0,
        }}
        transition={
          playing
            ? { duration: 16, ease: "linear", repeat: Infinity }
            : { duration: 0 }
        }
      />

      {children}
    </div>
  );
}
