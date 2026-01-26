
import React, { useEffect, useRef } from 'react';
import { Mood, UserGender } from '../types';

interface VisualizerProps {
  isActive: boolean;
  isSpeaking: boolean;
  amplitude: number;
  mood?: Mood;
  userGender?: UserGender;
}

const Visualizer: React.FC<VisualizerProps> = ({ isActive, isSpeaking, amplitude, mood = 'default', userGender = 'male' }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number>(0);
  const currentAmp = useRef(0);
  const rotationRef = useRef(0);

  // Avatar URLs
  const RIYA_IMG = "https://images.unsplash.com/photo-1621784563330-caee0b138a00?q=80&w=800&auto=format&fit=crop";
  // Updated Smart Bangladeshi Male Avatar for Rian
  const RIAN_IMG = "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?q=80&w=800&auto=format&fit=crop";
  
  const partnerAvatar = userGender === 'male' ? RIYA_IMG : RIAN_IMG;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

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
      const rect = canvas.getBoundingClientRect();
      ctx.clearRect(0, 0, rect.width, rect.height);
      
      // Prevent rapid flickering with smoother dampening
      currentAmp.current += (amplitude - currentAmp.current) * 0.12;
      const amp = isActive ? Math.max(0.01, currentAmp.current) : 0;
      
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;
      const baseRadius = Math.min(rect.width, rect.height) * 0.35;
      const radius = baseRadius + (amp * 90);

      rotationRef.current += 0.015;

      if (isActive) {
        // Aesthetic Glow Effect
        const gradient = ctx.createRadialGradient(centerX, centerY, baseRadius * 0.7, centerX, centerY, radius + 40);
        gradient.addColorStop(0, isSpeaking ? 'rgba(236, 72, 153, 0.25)' : 'rgba(52, 211, 153, 0.15)');
        gradient.addColorStop(1, 'rgba(0,0,0,0)');

        ctx.beginPath();
        ctx.arc(centerX, centerY, radius + 30, 0, Math.PI * 2);
        ctx.fillStyle = gradient;
        ctx.fill();

        // Stable Orbiting Rings
        for(let i=0; i<2; i++) {
          ctx.beginPath();
          ctx.arc(centerX, centerY, baseRadius + (i * 15) + (amp * 40), 0, Math.PI * 2);
          ctx.strokeStyle = isSpeaking ? `rgba(236, 72, 153, ${0.2 - i*0.1})` : `rgba(52, 211, 153, ${0.12 - i*0.06})`;
          ctx.lineWidth = 2;
          ctx.stroke();
        }
      }

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
    return isSpeaking ? 'border-pink-500 shadow-[0_0_40px_rgba(236,72,153,0.4)]' : 'border-emerald-500 shadow-[0_0_20px_rgba(16,185,129,0.2)]';
  };

  return (
    <div className="relative w-72 h-72 md:w-96 md:h-96 flex items-center justify-center transition-transform duration-700">
       <div className={`
          absolute inset-0 m-auto w-[66%] h-[66%] rounded-full overflow-hidden 
          border-[4px] z-10 transition-all duration-1000 ease-out
          ${getBorderColor()}
          ${isActive ? 'scale-105' : 'scale-100 grayscale-[0.2]'}
       `}>
          <img 
            src={partnerAvatar} 
            alt="Companion Avatar" 
            className="w-full h-full object-cover animate-breathe"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent pointer-events-none"></div>
       </div>
       <canvas ref={canvasRef} className="absolute inset-0 w-full h-full z-0" />
    </div>
  );
};

export default Visualizer;
