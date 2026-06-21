"use client";

import { useEffect, useRef } from "react";

type Particle = {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
};

const PARTICLE_COUNT = 72;
const CONNECT_DISTANCE = 140;
const DEPTH = 420;

function createParticles(width: number, height: number): Particle[] {
  return Array.from({ length: PARTICLE_COUNT }, () => ({
    x: (Math.random() - 0.5) * width,
    y: (Math.random() - 0.5) * height,
    z: Math.random() * DEPTH,
    vx: (Math.random() - 0.5) * 0.35,
    vy: (Math.random() - 0.5) * 0.35,
    vz: (Math.random() - 0.5) * 0.6,
  }));
}

/** Animated wireframe field — Three.js homepage energy, zero WebGL deps. */
export function LoginScene() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let frame = 0;
    let particles: Particle[] = [];
    let width = 0;
    let height = 0;
    let pointerX = 0;
    let pointerY = 0;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = canvas.clientWidth;
      height = canvas.clientHeight;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (particles.length === 0) {
        particles = createParticles(width, height);
      }
    };

    const onPointerMove = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      pointerX = (e.clientX - rect.left - width / 2) * 0.02;
      pointerY = (e.clientY - rect.top - height / 2) * 0.02;
    };

    const project = (p: Particle) => {
      const focal = 380;
      const scale = focal / (focal + p.z);
      return {
        x: width / 2 + (p.x + pointerX * 8) * scale,
        y: height / 2 + (p.y + pointerY * 8) * scale,
        scale,
      };
    };

    const tick = () => {
      frame += 1;
      ctx.fillStyle = "rgba(4, 4, 6, 0.28)";
      ctx.fillRect(0, 0, width, height);

      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        p.z += p.vz;

        if (p.x < -width * 0.6 || p.x > width * 0.6) p.vx *= -1;
        if (p.y < -height * 0.6 || p.y > height * 0.6) p.vy *= -1;
        if (p.z < 0 || p.z > DEPTH) p.vz *= -1;
      }

      const projected = particles.map((p) => ({ p, ...project(p) }));

      for (let i = 0; i < projected.length; i++) {
        for (let j = i + 1; j < projected.length; j++) {
          const a = projected[i];
          const b = projected[j];
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const dist = Math.hypot(dx, dy);
          if (dist > CONNECT_DISTANCE) continue;

          const alpha = (1 - dist / CONNECT_DISTANCE) * 0.22 * a.scale;
          ctx.strokeStyle = `rgba(255, 255, 255, ${alpha})`;
          ctx.lineWidth = 0.6;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
        }
      }

      for (const { p, x, y, scale } of projected) {
        const r = 1.2 + scale * 1.4;
        const glow = 0.35 + scale * 0.45;
        ctx.fillStyle = `rgba(255, 255, 255, ${glow})`;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
      }

      const pulse = 0.04 + Math.sin(frame * 0.02) * 0.015;
      const grad = ctx.createRadialGradient(
        width * 0.72,
        height * 0.28,
        0,
        width * 0.72,
        height * 0.28,
        width * 0.45,
      );
      grad.addColorStop(0, `rgba(120, 200, 255, ${pulse})`);
      grad.addColorStop(0.45, "rgba(80, 120, 255, 0.04)");
      grad.addColorStop(1, "transparent");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, height);

      requestAnimationFrame(tick);
    };

    resize();
    window.addEventListener("resize", resize);
    window.addEventListener("pointermove", onPointerMove);
    const raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", onPointerMove);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="login-scene"
      aria-hidden
    />
  );
}
