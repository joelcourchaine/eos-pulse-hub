import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

interface Particle {
  id: number;
  x: number;
  y: number;
  color: string;
  size: number;
  rotation: number;
  delay: number;
  duration: number;
  shape: "circle" | "square" | "star";
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
  "#FCD34D", // Yellow
  "#F472B6", // Pink light
];

export const MiniConfetti = ({ className, onComplete }: MiniConfettiProps) => {
  const [particles, setParticles] = useState<Particle[]>([]);
  const [showGlow, setShowGlow] = useState(true);

  useEffect(() => {
    const newParticles: Particle[] = [];
    
    // First burst - main explosion (24 particles)
    for (let i = 0; i < 24; i++) {
      const angle = (i / 24) * 360;
      const distance = 35 + Math.random() * 30;
      const radians = (angle * Math.PI) / 180;

      newParticles.push({
        id: i,
        x: Math.cos(radians) * distance,
        y: Math.sin(radians) * distance,
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        size: 5 + Math.random() * 5,
        rotation: Math.random() * 720,
        delay: Math.random() * 0.1,
        duration: 0.6 + Math.random() * 0.3,
        shape: ["circle", "square", "star"][Math.floor(Math.random() * 3)] as "circle" | "square" | "star",
      });
    }

    // Second burst - inner sparkles (16 particles)
    for (let i = 0; i < 16; i++) {
      const angle = Math.random() * 360;
      const distance = 15 + Math.random() * 25;
      const radians = (angle * Math.PI) / 180;

      newParticles.push({
        id: 24 + i,
        x: Math.cos(radians) * distance,
        y: Math.sin(radians) * distance,
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        size: 3 + Math.random() * 4,
        rotation: Math.random() * 360,
        delay: 0.1 + Math.random() * 0.15,
        duration: 0.5 + Math.random() * 0.3,
        shape: "circle",
      });
    }

    // Third burst - outer ring (12 particles)
    for (let i = 0; i < 12; i++) {
      const angle = (i / 12) * 360 + 15;
      const distance = 50 + Math.random() * 20;
      const radians = (angle * Math.PI) / 180;

      newParticles.push({
        id: 40 + i,
        x: Math.cos(radians) * distance,
        y: Math.sin(radians) * distance,
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        size: 4 + Math.random() * 4,
        rotation: Math.random() * 540,
        delay: 0.15 + Math.random() * 0.1,
        duration: 0.7 + Math.random() * 0.3,
        shape: ["circle", "square"][Math.floor(Math.random() * 2)] as "circle" | "square",
      });
    }

    setParticles(newParticles);

    // Fade out glow
    const glowTimer = setTimeout(() => {
      setShowGlow(false);
    }, 300);

    // Trigger completion callback after animation
    const completeTimer = setTimeout(() => {
      onComplete?.();
    }, 900);

    return () => {
      clearTimeout(glowTimer);
      clearTimeout(completeTimer);
    };
  }, [onComplete]);

  const getShapeStyle = (shape: string, size: number) => {
    switch (shape) {
      case "star":
        return {
          clipPath: "polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%)",
          width: size * 1.2,
          height: size * 1.2,
        };
      case "square":
        return {
          borderRadius: "2px",
          width: size,
          height: size,
        };
      default:
        return {
          borderRadius: "50%",
          width: size,
          height: size,
        };
    }
  };

  return (
    <div className={cn("absolute inset-0 overflow-visible pointer-events-none z-50", className)}>
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
        {particles.map((particle) => (
          <div
            key={particle.id}
            className="absolute animate-celebration-particle"
            style={{
              ...getShapeStyle(particle.shape, particle.size),
              backgroundColor: particle.color,
              boxShadow: `0 0 ${particle.size * 2}px ${particle.color}`,
              // @ts-expect-error CSS custom properties
              "--particle-x": `${particle.x}px`,
              "--particle-y": `${particle.y}px`,
              "--particle-rotation": `${particle.rotation}deg`,
              animationDelay: `${particle.delay}s`,
              animationDuration: `${particle.duration}s`,
            }}
          />
        ))}
        
        {/* Center burst with expanding rings */}
        {showGlow && (
          <>
            <div 
              className="absolute w-4 h-4 -translate-x-1/2 -translate-y-1/2 rounded-full bg-yellow-300 animate-celebration-center"
              style={{
                boxShadow: "0 0 20px #FFD700, 0 0 40px #FFD700, 0 0 60px #FFA500",
              }}
            />
            <div 
              className="absolute w-8 h-8 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-yellow-400/60 animate-celebration-ring"
            />
            <div 
              className="absolute w-6 h-6 -translate-x-1/2 -translate-y-1/2 rounded-full border border-orange-400/40 animate-celebration-ring-delayed"
            />
          </>
        )}
      </div>
    </div>
  );
};
