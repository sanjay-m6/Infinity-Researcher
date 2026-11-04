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

export function HoleBackground({
  strokeColor = "#737373",
  numberOfLines = 50,
  numberOfDiscs = 50,
  particleRGBColor = [255, 255, 255],
  className,
  children,
  ...props
}: HoleBackgroundProps) {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const [particleR, particleG, particleB] = particleRGBColor;

  const inView = useSafeInView(canvasRef);
  const pageVisible = usePageVisible();
  const reduceMotion = useReducedMotion();
  const playing = Boolean(inView && pageVisible && !reduceMotion);

  const stateRef = React.useRef<any>({
    discs: [] as any[],
    lines: [] as any[],
    particles: [] as any[],
    clip: {},
    startDisc: {},
    endDisc: {},
    rect: { width: 0, height: 0 },
    render: { width: 0, height: 0, dpi: 1 },
    particleArea: {},
    linesCanvas: null,
  });

  const linear = (p: number) => p;
  const easeInExpo = (p: number) => (p === 0 ? 0 : Math.pow(2, 10 * (p - 1)));

  const tweenValue = React.useCallback(
    (start: number, end: number, p: number, ease: "inExpo" | null = null) => {
      const delta = end - start;
      const easeFn = ease === "inExpo" ? easeInExpo : linear;
      return start + delta * easeFn(p);
    },
    []
  );

  const tweenDisc = React.useCallback(
    (disc: any) => {
      const { startDisc, endDisc } = stateRef.current;
      disc.x = tweenValue(startDisc.x, endDisc.x, disc.p);
      disc.y = tweenValue(startDisc.y, endDisc.y, disc.p, "inExpo");
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
    stateRef.current.startDisc = {
      x: width * 0.5,
      y: height * 0.45,
      w: Math.max(0, width * 0.75),
      h: Math.max(0, height * 0.7),
    };
    stateRef.current.endDisc = {
      x: width * 0.5,
      y: height * 0.95,
      w: 0,
      h: 0,
    };
    let prevBottom = height;
    stateRef.current.clip = {};
    for (let i = 0; i < numberOfDiscs; i++) {
      const p = i / numberOfDiscs;
      const disc = { p, x: 0, y: 0, w: 0, h: 0 };
      tweenDisc(disc);
      const bottom = disc.y + disc.h;
      if (bottom <= prevBottom) {
        stateRef.current.clip = { disc: { ...disc }, i };
      }
      prevBottom = bottom;
      stateRef.current.discs.push(disc);
    }
    if (!stateRef.current.clip.disc) {
      stateRef.current.clip = { disc: { ...stateRef.current.startDisc }, i: 0 };
    }

    if (typeof Path2D !== "undefined") {
      const clipPath = new Path2D();
      const disc = stateRef.current.clip.disc;
      clipPath.ellipse(
        disc.x,
        disc.y,
        Math.max(0, disc.w),
        Math.max(0, disc.h),
        0,
        0,
        Math.PI * 2
      );
      clipPath.rect(disc.x - disc.w, 0, disc.w * 2, disc.y);
      stateRef.current.clip.path = clipPath;
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

    const clipPath = stateRef.current.clip?.path;

    stateRef.current.lines.forEach((line: any) => {
      ctx.save();
      let lineIsIn = false;
      line.forEach((p1: any, j: number) => {
        if (j === 0) return;
        const p0 = line[j - 1];
        if (
          !lineIsIn &&
          clipPath &&
          (ctx.isPointInPath(clipPath, p1.x * dpi, p1.y * dpi) ||
            ctx.isPointInStroke(clipPath, p1.x * dpi, p1.y * dpi))
        ) {
          lineIsIn = true;
        } else if (lineIsIn && clipPath) {
          ctx.clip(clipPath);
        }
        ctx.beginPath();
        ctx.moveTo(p0.x, p0.y);
        ctx.lineTo(p1.x, p1.y);
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.closePath();
      });
      ctx.restore();
    });
    stateRef.current.linesCanvas = offCanvas;
  }, [numberOfLines, strokeColor]);

  const initParticle = React.useCallback(
    (start: boolean = false) => {
      const area = stateRef.current.particleArea || {};
      const sx = (area.sx || 0) + (area.sw || 0) * Math.random();
      const ex = (area.ex || 0) + (area.ew || 0) * Math.random();
      const dx = ex - sx;
      const y = start ? (area.h || 0) * Math.random() : area.h || 0;
      const r = 0.5 + Math.random() * 4;
      const vy = 0.5 + Math.random();
      return {
        x: sx,
        sx,
        dx,
        y,
        vy,
        p: 0,
        r,
        c: `rgba(${particleR}, ${particleG}, ${particleB}, ${Math.random() * 0.8 + 0.2})`,
      };
    },
    [particleR, particleG, particleB]
  );

  const setParticles = React.useCallback(() => {
    const { width, height } = stateRef.current.rect;
    if (width <= 0 || height <= 0) return;

    stateRef.current.particles = [];
    const disc = stateRef.current.clip?.disc || { w: width * 0.5 };
    stateRef.current.particleArea = {
      sw: disc.w * 0.5,
      ew: disc.w * 2,
      h: height * 0.85,
    };
    stateRef.current.particleArea.sx =
      (width - stateRef.current.particleArea.sw) / 2;
    stateRef.current.particleArea.ex =
      (width - stateRef.current.particleArea.ew) / 2;
    const totalParticles = 100;
    for (let i = 0; i < totalParticles; i++) {
      stateRef.current.particles.push(initParticle(true));
    }
  }, [initParticle]);

  const drawDiscs = React.useCallback(
    (ctx: CanvasRenderingContext2D) => {
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = 2;
      const outerDisc = stateRef.current.startDisc;
      if (outerDisc?.w > 0 && outerDisc?.h > 0) {
        ctx.beginPath();
        ctx.ellipse(
          outerDisc.x,
          outerDisc.y,
          outerDisc.w,
          outerDisc.h,
          0,
          0,
          Math.PI * 2
        );
        ctx.stroke();
        ctx.closePath();
      }
      const clipPath = stateRef.current.clip?.path;
      const clipDiscW = stateRef.current.clip?.disc?.w || 0;

      stateRef.current.discs.forEach((disc: any, i: number) => {
        if (i % 5 !== 0) return;
        if (disc.w <= 0 || disc.h <= 0) return;

        if (clipPath && disc.w < clipDiscW - 5) {
          ctx.save();
          ctx.clip(clipPath);
        }
        ctx.beginPath();
        ctx.ellipse(disc.x, disc.y, disc.w, disc.h, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.closePath();
        if (clipPath && disc.w < clipDiscW - 5) {
          ctx.restore();
        }
      });
    },
    [strokeColor]
  );

  const drawLines = React.useCallback((ctx: CanvasRenderingContext2D) => {
    if (stateRef.current.linesCanvas) {
      const { width, height } = stateRef.current.rect;
      ctx.drawImage(stateRef.current.linesCanvas, 0, 0, width, height);
    }
  }, []);

  const drawParticles = React.useCallback((ctx: CanvasRenderingContext2D) => {
    const clipPath = stateRef.current.clip?.path;
    ctx.save();
    if (clipPath) {
      ctx.clip(clipPath);
    }
    stateRef.current.particles.forEach((particle: any) => {
      ctx.fillStyle = particle.c;
      ctx.beginPath();
      ctx.rect(particle.x, particle.y, particle.r, particle.r);
      ctx.closePath();
      ctx.fill();
    });
    ctx.restore();
  }, []);

  const moveDiscs = React.useCallback(() => {
    stateRef.current.discs.forEach((disc: any) => {
      disc.p = (disc.p + 0.001) % 1;
      tweenDisc(disc);
    });
  }, [tweenDisc]);

  const moveParticles = React.useCallback(() => {
    const areaH = stateRef.current.particleArea?.h || 1;
    stateRef.current.particles.forEach((particle: any, idx: number) => {
      particle.p = 1 - particle.y / areaH;
      particle.x = particle.sx + particle.dx * particle.p;
      particle.y -= particle.vy;
      if (particle.y < 0) {
        stateRef.current.particles[idx] = initParticle();
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
        "relative size-full overflow-hidden",
        "before:pointer-events-none after:pointer-events-none",
        'before:content-[""] before:absolute before:top-1/2 before:left-1/2 before:block before:size-[140%] before:[background:radial-gradient(ellipse_at_50%_55%,transparent_10%,#f8fafc_50%)] dark:before:[background:radial-gradient(ellipse_at_50%_55%,transparent_10%,#070b12_50%)] before:[transform:translate3d(-50%,-50%,0)]',
        'after:content-[""] after:absolute after:z-[5] after:top-1/2 after:left-1/2 after:block after:size-full after:[background:radial-gradient(ellipse_at_50%_75%,#6366f1_20%,transparent_75%)] after:[transform:translate3d(-50%,-50%,0)] after:mix-blend-overlay',
        className
      )}
      {...props}
    >
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 block size-full opacity-25 dark:opacity-35"
      />
      <motion.div
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute top-[-71.5%] left-1/2 z-[3] w-[35%] h-[140%] rounded-b-full blur-3xl opacity-40 dark:opacity-75 mix-blend-multiply dark:mix-blend-plus-lighter [transform:translate3d(-50%,0,0)] [background-position:0%_100%] [background-size:100%_200%]",
          "[background:linear-gradient(20deg,#6366f1,#8b5cf6_16.5%,#ec4899_33%,#ec489940_49.5%,#6366f1_66%,#3b82f6_85.5%,#8b5cf6_100%)_0_100%_/_100%_200%] dark:[background:linear-gradient(20deg,#00f8f1,#ffbd1e20_16.5%,#fe848f_33%,#fe848f20_49.5%,#00f8f1_66%,#00f8f160_85.5%,#ffbd1e_100%)_0_100%_/_100%_200%]"
        )}
        animate={{ backgroundPosition: playing ? "0% 300%" : "0% 100%" }}
        transition={
          playing
            ? { duration: 5, ease: "linear", repeat: Infinity }
            : { duration: 0 }
        }
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute top-0 left-0 z-[7] size-full dark:[background:repeating-linear-gradient(transparent,transparent_1px,white_1px,white_2px)] mix-blend-overlay opacity-20"
      />
      {children}
    </div>
  );
}
