import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { Trophy } from "lucide-react";

interface Particle {
  id: number;
  x: number;
  y: number;
  color: string;
  delay: number;
  duration: number;
  size: number;
}

interface FireworksProps {
  className?: string;
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

export const Fireworks = ({ className }: FireworksProps) => {
  const [particles, setParticles] = useState<Particle[]>([]);
  const [animationComplete, setAnimationComplete] = useState(false);

  useEffect(() => {
    // Generate particles for the fireworks effect
    const newParticles: Particle[] = [];
    const particleCount = 24;

    for (let i = 0; i < particleCount; i++) {
      const angle = (i / particleCount) * 360;
      const distance = 30 + Math.random() * 20;
      const radians = (angle * Math.PI) / 180;
      
      newParticles.push({
        id: i,
        x: Math.cos(radians) * distance,
        y: Math.sin(radians) * distance,
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        delay: Math.random() * 0.3,
        duration: 0.8 + Math.random() * 0.4,
        size: 3 + Math.random() * 3,
      });
    }

    // Add some extra sparkles
    for (let i = 0; i < 12; i++) {
      const angle = Math.random() * 360;
      const distance = 15 + Math.random() * 35;
      const radians = (angle * Math.PI) / 180;
      
      newParticles.push({
        id: particleCount + i,
        x: Math.cos(radians) * distance,
        y: Math.sin(radians) * distance,
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        delay: Math.random() * 0.5,
        duration: 0.6 + Math.random() * 0.6,
        size: 2 + Math.random() * 2,
      });
    }

    setParticles(newParticles);

    // Mark animation as complete after longest animation
    const timer = setTimeout(() => {
      setAnimationComplete(true);
    }, 1500);

    return () => clearTimeout(timer);
  }, []);

  return (
    <div className={cn("absolute inset-0 overflow-hidden pointer-events-none", className)}>
      {/* Fireworks animation */}
      {!animationComplete && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
          {particles.map((particle) => (
            <div
              key={particle.id}
              className="absolute rounded-full animate-firework-particle"
              style={{
                width: particle.size,
                height: particle.size,
                backgroundColor: particle.color,
                boxShadow: `0 0 ${particle.size * 2}px ${particle.color}`,
                "--particle-x": `${particle.x}px`,
                "--particle-y": `${particle.y}px`,
                animationDelay: `${particle.delay}s`,
                animationDuration: `${particle.duration}s`,
              } as React.CSSProperties}
            />
          ))}
          {/* Center burst */}
          <div 
            className="absolute w-4 h-4 -translate-x-1/2 -translate-y-1/2 rounded-full bg-yellow-300 animate-firework-center"
            style={{
              boxShadow: "0 0 20px #FFD700, 0 0 40px #FFD700",
            }}
          />
        </div>
      )}

      {/* Persistent celebration indicator */}
      <div className="absolute top-2 right-2 flex items-center gap-1.5 bg-gradient-to-r from-yellow-500/20 to-amber-500/20 border border-yellow-500/30 rounded-full px-2.5 py-1 animate-pulse">
        <Trophy className="h-3.5 w-3.5 text-yellow-500" />
        <span className="text-xs font-semibold text-yellow-600 dark:text-yellow-400">Complete!</span>
      </div>

      {/* Subtle corner glow effect */}
      <div className="absolute -top-10 -right-10 w-32 h-32 bg-gradient-to-br from-yellow-400/20 to-transparent rounded-full blur-2xl" />
    </div>
  );
};
