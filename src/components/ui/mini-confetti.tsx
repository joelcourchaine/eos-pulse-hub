import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

interface Particle {
  id: number;
  x: number;
  y: number;
  color: string;
  size: number;
  rotation: number;
}

interface MiniConfettiProps {
  className?: string;
  onComplete?: () => void;
}

const COLORS = [
  "#FFD700", // Gold
  "#FF6B6B", // Coral
  "#4ECDC4", // Teal
  "#A855F7", // Purple
  "#F97316", // Orange
  "#22C55E", // Green
  "#3B82F6", // Blue
  "#EC4899", // Pink
];

export const MiniConfetti = ({ className, onComplete }: MiniConfettiProps) => {
  const [particles, setParticles] = useState<Particle[]>([]);

  useEffect(() => {
    // Generate particles for the mini confetti burst
    const newParticles: Particle[] = [];
    const particleCount = 16;

    for (let i = 0; i < particleCount; i++) {
      const angle = (i / particleCount) * 360;
      const distance = 20 + Math.random() * 25;
      const radians = (angle * Math.PI) / 180;

      newParticles.push({
        id: i,
        x: Math.cos(radians) * distance,
        y: Math.sin(radians) * distance,
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        size: 4 + Math.random() * 4,
        rotation: Math.random() * 360,
      });
    }

    setParticles(newParticles);

    // Trigger completion callback after animation
    const timer = setTimeout(() => {
      onComplete?.();
    }, 400);

    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <div className={cn("absolute inset-0 overflow-visible pointer-events-none z-50", className)}>
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
        {particles.map((particle) => (
          <div
            key={particle.id}
            className="absolute animate-mini-confetti"
            style={{
              width: particle.size,
              height: particle.size,
              backgroundColor: particle.color,
              borderRadius: Math.random() > 0.5 ? "50%" : "2px",
              boxShadow: `0 0 ${particle.size}px ${particle.color}40`,
              "--particle-x": `${particle.x}px`,
              "--particle-y": `${particle.y}px`,
              "--particle-rotation": `${particle.rotation}deg`,
            } as React.CSSProperties}
          />
        ))}
        {/* Center flash */}
        <div 
          className="absolute w-3 h-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-yellow-400 animate-confetti-center"
          style={{
            boxShadow: "0 0 12px #FFD700, 0 0 24px #FFD700",
          }}
        />
      </div>
    </div>
  );
};
