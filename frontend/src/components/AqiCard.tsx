import React from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface AqiCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  colorCode?: string;
  trend?: number;
  icon?: React.ReactNode;
}

export const AqiCard: React.FC<AqiCardProps> = ({ title, value, subtitle, colorCode, trend, icon }) => {
  const isUp = trend !== undefined && trend > 0.1;
  const isDown = trend !== undefined && trend < -0.1;
  const accentColor = colorCode || '#00e5ff';

  return (
    <div
      className="relative overflow-hidden rounded-2xl p-6 flex flex-col"
      style={{
        background: 'linear-gradient(135deg, rgba(6,18,36,0.95) 0%, rgba(2,10,24,0.98) 100%)',
        border: `1px solid ${accentColor}22`,
        boxShadow: `0 0 0 1px ${accentColor}11, 0 8px 32px rgba(0,0,0,0.4), inset 0 1px 0 ${accentColor}15`,
        transition: 'all 0.3s ease',
      }}
      onMouseEnter={e => {
        const el = e.currentTarget;
        el.style.borderColor = `${accentColor}55`;
        el.style.boxShadow = `0 0 0 1px ${accentColor}22, 0 12px 40px rgba(0,0,0,0.5), 0 0 30px ${accentColor}10, inset 0 1px 0 ${accentColor}25`;
        el.style.transform = 'translateY(-2px)';
      }}
      onMouseLeave={e => {
        const el = e.currentTarget;
        el.style.borderColor = `${accentColor}22`;
        el.style.boxShadow = `0 0 0 1px ${accentColor}11, 0 8px 32px rgba(0,0,0,0.4), inset 0 1px 0 ${accentColor}15`;
        el.style.transform = 'translateY(0)';
      }}
    >
      {/* Glow orb background */}
      <div
        className="absolute -top-8 -right-8 w-24 h-24 rounded-full pointer-events-none"
        style={{
          background: `radial-gradient(circle, ${accentColor}18 0%, transparent 70%)`,
          filter: 'blur(12px)',
        }}
      />

      {/* Scan line decoration */}
      <div
        className="absolute top-0 left-0 right-0 h-px"
        style={{ background: `linear-gradient(90deg, transparent, ${accentColor}40, transparent)` }}
      />

      <div className="flex items-center justify-between mb-3">
        <span
          className="text-[10px] font-bold uppercase tracking-[0.2em]"
          style={{ color: `${accentColor}99` }}
        >
          {title}
        </span>
        {icon && (
          <div style={{ color: `${accentColor}66` }}>{icon}</div>
        )}
      </div>

      <div className="flex items-baseline gap-1 mt-1">
        <span
          className="font-black leading-none"
          style={{
            color: accentColor,
            fontSize: 'clamp(1.8rem, 4vw, 2.8rem)',
            textShadow: `0 0 20px ${accentColor}60`,
            fontVariantNumeric: 'tabular-nums',
            letterSpacing: '-0.02em',
          }}
        >
          {value}
        </span>
      </div>

      <div className="flex items-center justify-between mt-4">
        {subtitle && (
          <span className="text-[11px] font-medium uppercase tracking-wider" style={{ color: 'rgba(148,163,184,0.6)' }}>
            {subtitle}
          </span>
        )}

        {trend !== undefined && (
          <div
            className="flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-lg ml-auto"
            style={{
              background: isUp ? 'rgba(239,68,68,0.1)' : isDown ? 'rgba(34,197,94,0.1)' : 'rgba(100,116,139,0.1)',
              color: isUp ? '#f87171' : isDown ? '#4ade80' : '#94a3b8',
              border: `1px solid ${isUp ? 'rgba(239,68,68,0.2)' : isDown ? 'rgba(34,197,94,0.2)' : 'rgba(100,116,139,0.2)'}`,
            }}
          >
            {isUp ? <TrendingUp size={12} strokeWidth={2.5} /> : isDown ? <TrendingDown size={12} strokeWidth={2.5} /> : <Minus size={12} strokeWidth={2.5} />}
            {isUp ? '+' : ''}{Math.abs(trend).toFixed(1)}
          </div>
        )}
      </div>
    </div>
  );
};