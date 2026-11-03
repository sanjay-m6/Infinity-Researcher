"use client"

import type React from "react"
import {
  FaApple,
  FaAws,
  FaDocker,
  FaGithub,
  FaGoogle,
  FaInstagram,
  FaLinkedin,
  FaNodeJs,
  FaReact,
  FaTwitter,
} from "react-icons/fa"
import {
  SiFacebook,
  SiNextdotjs,
  SiRedux,
  SiTypescript,
  SiVercel,
} from "react-icons/si"

import { cn } from "@/lib/utils"

export interface OrbitIcon {
  Icon: React.ComponentType<{ className?: string }>
  name?: string
  color?: string
}

export interface OrbitRotationProps extends React.HTMLAttributes<HTMLDivElement> {
  icons?: OrbitIcon[]
  orbitCount?: number
  orbitGap?: number
  centerIcon?: OrbitIcon
  className?: string
  size?: "sm" | "md" | "lg"
}

const defaultIcons: OrbitIcon[] = [
  { Icon: FaReact, name: "React" },
  { Icon: FaAws, name: "AWS" },
  { Icon: FaDocker, name: "Docker" },
  { Icon: FaNodeJs, name: "Node.js" },
  { Icon: SiNextdotjs, name: "Next.js" },
  { Icon: SiVercel, name: "Vercel" },
  { Icon: SiRedux, name: "Redux" },
  { Icon: SiTypescript, name: "TypeScript" },
  { Icon: FaGithub, name: "GitHub" },
  { Icon: FaTwitter, name: "Twitter" },
  { Icon: FaLinkedin, name: "LinkedIn" },
  { Icon: FaInstagram, name: "Instagram" },
  { Icon: FaGoogle, name: "Google" },
  { Icon: FaApple, name: "Apple" },
  { Icon: SiFacebook, name: "Facebook" },
]

const defaultCenterIcon: OrbitIcon = {
  Icon: FaReact,
  name: "React",
}

export function OrbitRotation({
  icons = defaultIcons,
  orbitCount = 3,
  orbitGap = 6,
  centerIcon = defaultCenterIcon,
  className,
  size = "md",
  ...props
}: OrbitRotationProps) {
  const iconsPerOrbit = Math.ceil(icons.length / orbitCount)

  const sizeClasses = {
    sm: "w-16 h-16",
    md: "w-24 h-24",
    lg: "w-32 h-32",
  }

  const iconSizeClasses = {
    sm: "w-6 h-6",
    md: "w-8 h-8",
    lg: "w-10 h-10",
  }

  return (
    <div
      className={cn("relative flex items-center justify-center select-none", className)}
      {...props}
    >
      <div className="relative flex items-center justify-center">
        {/* Center Icon */}
        <div
          className={cn(
            "bg-background/90 border-border/50 flex items-center justify-center rounded-full border shadow-xl backdrop-blur-sm z-10",
            sizeClasses[size]
          )}
        >
          <centerIcon.Icon className={cn(iconSizeClasses[size])} />
        </div>

        {/* Generate Orbits */}
        {[...Array(orbitCount)].map((_, orbitIdx) => {
          const orbitSize = `${8 + orbitGap * (orbitIdx + 1)}rem`
          const angleStep = (2 * Math.PI) / iconsPerOrbit
          const animationDuration = `${16 + orbitIdx * 8}s`

          return (
            <div
              key={orbitIdx}
              className="border-muted-foreground/30 absolute rounded-full border-2 border-dotted pointer-events-none"
              style={{
                width: orbitSize,
                height: orbitSize,
                animation: `orbit-spin ${animationDuration} linear infinite`,
              }}
            >
              {icons
                .slice(
                  orbitIdx * iconsPerOrbit,
                  orbitIdx * iconsPerOrbit + iconsPerOrbit
                )
                .map((iconConfig, iconIdx) => {
                  const angle = iconIdx * angleStep
                  const x = 50 + 50 * Math.cos(angle)
                  const y = 50 + 50 * Math.sin(angle)

                  return (
                    <div
                      key={iconIdx}
                      title={iconConfig.name}
                      className="bg-background/90 border-border/60 absolute rounded-full border p-1.5 shadow-md backdrop-blur-xs flex items-center justify-center transition-transform hover:scale-110 pointer-events-auto"
                      style={{
                        left: `${x}%`,
                        top: `${y}%`,
                        transform: "translate(-50%, -50%)",
                      }}
                    >
                      <iconConfig.Icon className={cn(iconSizeClasses[size])} />
                    </div>
                  )
                })}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default OrbitRotation

