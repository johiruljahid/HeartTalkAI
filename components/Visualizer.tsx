
import React, { useEffect, useRef } from 'react';
import { Mood } from '../types';

interface VisualizerProps {
  isActive: boolean;
  isSpeaking: boolean;
  amplitude: number;
  mood?: Mood;
}

const Visualizer: React.FC<VisualizerProps> = ({ isActive, isSpeaking, amplitude, mood = 'default' }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number>(0);
  const currentAmp = useRef(0);
  const rotationRef = useRef(0);

  const moodConfigs: Record<Mood, { primary: string, secondary: string, pulseScale: number, rotationSpeed: number }> = {
    happy: { primary: 'rgba(251, 191, 36, 0.4)', secondary: 'rgba(236, 72, 153, 0)', pulseScale: 80, rotationSpeed: 0.02 },
    romantic: { primary: 'rgba(225, 29, 72, 0.5)', secondary: 'rgba(159, 18, 57, 0)', pulseScale: 40, rotationSpeed: 0.005 },
    excited: { primary: 'rgba(236, 72, 153, 0.6)', secondary: 'rgba(168, 85, 247, 0)', pulseScale: 120, rotationSpeed: 0.05 },
    calm: { primary: 'rgba(34, 197, 94, 0.3)', secondary: 'rgba(13, 148, 136, 0)', pulseScale: 30, rotationSpeed: 0.002 },
    sad: { primary: 'rgba(59, 130, 246, 0.4)', secondary: 'rgba(30, 58, 138, 0)', pulseScale: 20, rotationSpeed: 0.001 },
    intense: { primary: 'rgba(249, 115, 22, 0.6)', secondary: 'rgba(154, 52, 18, 0)', pulseScale: 150, rotationSpeed: 0.08 },
    default: { primary: 'rgba(52, 211, 153, 0.3)', secondary: 'rgba(5, 150, 105, 0)', pulseScale: 60, rotationSpeed: 0.01 },
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Responsive Canvas Resizing
    const resizeCanvas = () => {
        const dpr = window.devicePixelRatio || 1;
        const rect = canvas.getBoundingClientRect();
        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;
        ctx.scale(dpr, dpr);
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    const animate = () => {
      // Re-get rect inside loop if scaling changes dynamically, or rely on resize listener
      const rect = canvas.getBoundingClientRect();
      
      currentAmp.current += (amplitude - currentAmp.current) * 0.15;
      const amp = isActive ? Math.max(0.05, currentAmp.current) : 0.02;
      const config = isSpeaking && mood === 'default' 
        ? { primary: 'rgba(236, 72, 153, 0.4)', secondary: 'rgba(168, 85, 247, 0)', pulseScale: 70, rotationSpeed: 0.02 }
        : moodConfigs[mood];

      ctx.clearRect(0, 0, rect.width, rect.height);
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;
      
      // Responsive Radius based on smaller dimension
      const minDim = Math.min(rect.width, rect.height);
      const baseRadius = minDim * 0.35;
      const radius = baseRadius + (amp * config.pulseScale);

      rotationRef.current += config.rotationSpeed;

      if (isActive) {
        const gradient = ctx.createRadialGradient(centerX, centerY, baseRadius * 0.5, centerX, centerY, radius + 30);
        gradient.addColorStop(0, config.primary);
        gradient.addColorStop(1, config.secondary);

        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
        ctx.fillStyle = gradient;
        ctx.fill();

        if (isSpeaking) {
          for (let i = 0; i < 2; i++) {
            const rippleRadius = radius + Math.sin(rotationRef.current + i) * 15;
            ctx.beginPath();
            ctx.arc(centerX, centerY, rippleRadius, 0, Math.PI * 2);
            ctx.strokeStyle = config.primary.replace('0.4', '0.1').replace('0.6', '0.1').replace('0.3', '0.1');
            ctx.lineWidth = 1;
            ctx.stroke();
          }
        }
      }

      ctx.beginPath();
      // Adjust stroke radius slightly for better visual
      ctx.arc(centerX, centerY, baseRadius + (amp * 10), 0, Math.PI * 2);
      ctx.strokeStyle = isActive 
        ? config.primary.replace('0.4', '0.6').replace('0.3', '0.5') 
        : 'rgba(255, 255, 255, 0.1)';
      ctx.lineWidth = 2;
      ctx.stroke();

      requestRef.current = requestAnimationFrame(animate);
    };

    requestRef.current = requestAnimationFrame(animate);

    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
      window.removeEventListener('resize', resizeCanvas);
    };
  }, [isActive, isSpeaking, amplitude, mood]);

  const getBorderColor = () => {
    if (!isActive) return 'border-white/10';
    if (mood === 'romantic') return 'border-rose-500 shadow-[0_0_40px_rgba(225,29,72,0.4)]';
    if (mood === 'excited') return 'border-pink-400 shadow-[0_0_40px_rgba(236,72,153,0.4)]';
    if (mood === 'happy') return 'border-amber-400 shadow-[0_0_40px_rgba(251,191,36,0.4)]';
    return isSpeaking ? 'border-pink-500 shadow-[0_0_40px_rgba(236,72,153,0.4)]' : 'border-emerald-400 shadow-[0_0_20px_rgba(52,211,153,0.2)]';
  };

  return (
    <div className="relative w-[300px] h-[300px] md:w-[400px] md:h-[400px] flex items-center justify-center">
       {/* Central Avatar Circle */}
       <div className={`
          absolute inset-0 m-auto w-[65%] h-[65%] rounded-full overflow-hidden 
          border-4 z-10 transition-all duration-700
          ${getBorderColor()}
          ${isActive ? 'scale-105' : 'grayscale-[0.3]'}
       `}>
          <img 
            src="https://images.unsplash.com/photo-1621784563330-caee0b138a00?q=80&w=800&auto=format&fit=crop" 
            alt="Riya" 
            className="w-full h-full object-cover animate-breathe opacity-95"
          />
          <div className={`absolute inset-0 bg-gradient-to-t from-black/20 to-transparent pointer-events-none`}></div>
       </div>
       {/* Canvas Layer for Glow/Ripples */}
       <canvas ref={canvasRef} className="absolute inset-0 w-full h-full z-0" />
    </div>
  );
};

export default Visualizer;
