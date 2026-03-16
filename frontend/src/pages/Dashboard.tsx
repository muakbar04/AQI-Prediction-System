import React, { useState, useMemo, useEffect, useRef } from 'react';
import { RefreshCw, Wind, AlertTriangle, CheckCircle, Info, Calendar, Activity, Thermometer, Gauge } from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, BarChart, Bar, AreaChart, Area, Cell,
  ReferenceLine,
} from 'recharts';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format, parseISO } from 'date-fns';
import { api } from '../api/api';
import { AqiCard } from '../components/AqiCard.tsx';

/* ─── Types ───────────────────────────────────────────────── */
interface CurrentData { timestamp: string; pm25: number; pm25_diff: number; aqi: number; temp: number; wind: number; }
interface HistoryItem { timestamp: string; pm25: number; aqi: number; }
interface ForecastItem { timestamp: string; forecastAqi: number; }
interface ShapItem { feature: string; impact: number; }
interface DashboardData { current: CurrentData; history: HistoryItem[]; }

/* ─── AQI colour scale ────────────────────────────────────── */
const getAqiColor = (aqi: number) => {
  if (aqi <= 50)  return { color: '#00e676', label: 'Good',                          bg: 'rgba(0,230,118,0.06)',  border: 'rgba(0,230,118,0.25)' };
  if (aqi <= 100) return { color: '#ffea00', label: 'Moderate',                      bg: 'rgba(255,234,0,0.06)',  border: 'rgba(255,234,0,0.25)' };
  if (aqi <= 150) return { color: '#ff9100', label: 'Sensitive Groups',              bg: 'rgba(255,145,0,0.06)',  border: 'rgba(255,145,0,0.25)' };
  if (aqi <= 200) return { color: '#ff3d00', label: 'Unhealthy',                     bg: 'rgba(255,61,0,0.06)',   border: 'rgba(255,61,0,0.25)' };
  if (aqi <= 300) return { color: '#d500f9', label: 'Very Unhealthy',                bg: 'rgba(213,0,249,0.06)',  border: 'rgba(213,0,249,0.25)' };
  return           { color: '#ff1744', label: 'Hazardous',                           bg: 'rgba(255,23,68,0.06)',  border: 'rgba(255,23,68,0.25)' };
};

/* ─── Animated AQI Gauge ──────────────────────────────────── */
const AqiGauge: React.FC<{ aqi: number }> = ({ aqi }) => {
  const { color } = getAqiColor(aqi);
  const radius = 80;
  const stroke = 10;
  const circumference = Math.PI * radius; // half-circle
  const pct = Math.min(aqi / 300, 1);
  const offset = circumference * (1 - pct);

  return (
    <div className="relative flex items-center justify-center" style={{ width: 200, height: 110 }}>
      <svg width="200" height="110" viewBox="0 0 200 110" overflow="visible">
        {/* Track */}
        <path
          d={`M ${stroke / 2} 100 A ${radius} ${radius} 0 0 1 ${200 - stroke / 2} 100`}
          fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={stroke} strokeLinecap="round"
        />
        {/* Colored arc */}
        <path
          d={`M ${stroke / 2} 100 A ${radius} ${radius} 0 0 1 ${200 - stroke / 2} 100`}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{
            filter: `drop-shadow(0 0 8px ${color}cc)`,
            transition: 'stroke-dashoffset 1.2s cubic-bezier(0.16,1,0.3,1)',
          }}
        />
        {/* Tick marks */}
        {[0, 50, 100, 150, 200, 250, 300].map(tick => {
          const angle = (tick / 300) * Math.PI - Math.PI;
          const cx = 100 + radius * Math.cos(angle);
          const cy = 100 + radius * Math.sin(angle);
          return <circle key={tick} cx={cx} cy={cy} r={2} fill="rgba(255,255,255,0.2)" />;
        })}
      </svg>
      <div className="absolute bottom-0 flex flex-col items-center">
        <span className="font-black text-5xl leading-none" style={{ color, textShadow: `0 0 24px ${color}80`, letterSpacing: '-0.04em' }}>
          {Math.round(aqi)}
        </span>
        <span className="text-[10px] uppercase tracking-[0.3em] mt-1" style={{ color: 'rgba(148,163,184,0.6)' }}>AQI</span>
      </div>
    </div>
  );
};

/* ─── Particle grid background ───────────────────────────── */
const ParticleGrid: React.FC = () => (
  <div className="fixed inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 0 }}>
    <div
      className="absolute inset-0"
      style={{
        backgroundImage: `
          radial-gradient(circle at 20% 20%, rgba(0,229,255,0.04) 0%, transparent 50%),
          radial-gradient(circle at 80% 80%, rgba(100,0,255,0.04) 0%, transparent 50%),
          radial-gradient(circle at 50% 50%, rgba(0,230,118,0.02) 0%, transparent 70%)
        `,
      }}
    />
    {/* Dot matrix */}
    <div
      className="absolute inset-0"
      style={{
        backgroundImage: 'radial-gradient(rgba(255,255,255,0.04) 1px, transparent 1px)',
        backgroundSize: '32px 32px',
      }}
    />
    {/* Horizontal scan line animation */}
    <div
      className="absolute left-0 right-0 h-px"
      style={{
        background: 'linear-gradient(90deg, transparent, rgba(0,229,255,0.15), transparent)',
        animation: 'scanline 8s linear infinite',
        top: 0,
      }}
    />
    <style>{`
      @keyframes scanline {
        0%   { top: 0%; opacity: 0; }
        5%   { opacity: 1; }
        95%  { opacity: 1; }
        100% { top: 100%; opacity: 0; }
      }
      @keyframes pulse-glow {
        0%, 100% { opacity: 0.5; }
        50%       { opacity: 1; }
      }
      @keyframes float-up {
        0%   { opacity: 0; transform: translateY(20px); }
        100% { opacity: 1; transform: translateY(0); }
      }
      @keyframes spin-slow { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      @keyframes data-stream {
        0%   { opacity: 0; transform: translateX(-10px); }
        100% { opacity: 1; transform: translateX(0); }
      }
    `}</style>
  </div>
);

/* ─── Custom tooltip ─────────────────────────────────────── */
const ChartTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: 'rgba(2,10,24,0.95)',
      border: '1px solid rgba(0,229,255,0.2)',
      borderRadius: 12,
      padding: '12px 16px',
      boxShadow: '0 0 20px rgba(0,229,255,0.1)',
      backdropFilter: 'blur(12px)',
    }}>
      <p style={{ color: 'rgba(148,163,184,0.7)', fontSize: 11, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
        {label ? format(parseISO(label as string), 'EEE, MMM d · HH:mm') : ''}
      </p>
      {payload.map((p: any, i: number) => (
        <p key={i} style={{ color: p.color, fontSize: 14, fontWeight: 700 }}>
          {p.name}: <span style={{ color: 'white' }}>{typeof p.value === 'number' ? p.value.toFixed(1) : p.value}</span>
        </p>
      ))}
    </div>
  );
};

/* ─── Main Dashboard ─────────────────────────────────────── */
export const Dashboard = () => {
  const [activeTab, setActiveTab] = useState<'history' | 'forecast' | 'explain'>('history');
  const queryClient = useQueryClient();

  const { data: historyData, isLoading: historyLoading, isError: historyError } = useQuery<DashboardData>({
    queryKey: ['history'],
    queryFn: api.getCurrentAndHistory,
  });

  const { data: forecastData, isLoading: forecastLoading } = useQuery<ForecastItem[]>({
    queryKey: ['forecast'],
    queryFn: api.getForecast,
    enabled: activeTab === 'forecast',
  });

  const { data: explainData, isLoading: explainLoading } = useQuery<ShapItem[]>({
    queryKey: ['explain'],
    queryFn: api.getExplainability,
    enabled: activeTab === 'explain',
  });

  const refreshMutation = useMutation({
    mutationFn: api.refreshData,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['history'] });
      queryClient.invalidateQueries({ queryKey: ['forecast'] });
      queryClient.invalidateQueries({ queryKey: ['explain'] });
    },
  });

  const peakInfo = useMemo(() => {
    if (!forecastData?.length) return null;
    const peak = [...forecastData].sort((a, b) => b.forecastAqi - a.forecastAqi)[0];
    return { aqi: peak.forecastAqi, time: format(parseISO(peak.timestamp), "EEEE 'at' h:mm a"), ...getAqiColor(peak.forecastAqi) };
  }, [forecastData]);

  const dailyAverages = useMemo(() => {
    if (!forecastData) return [];
    const groups: Record<string, { sum: number; count: number }> = {};
    forecastData.forEach(item => {
      const dk = format(parseISO(item.timestamp), 'yyyy-MM-dd');
      if (!groups[dk]) groups[dk] = { sum: 0, count: 0 };
      groups[dk].sum += item.forecastAqi;
      groups[dk].count += 1;
    });
    return Object.entries(groups).map(([date, d]) => ({
      date: format(parseISO(date), 'EEE, MMM dd'),
      avgAqi: Math.round(d.sum / d.count),
    }));
  }, [forecastData]);

  /* ── Loading ── */
  if (historyLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#020a18' }}>
        <ParticleGrid />
        <div className="relative text-center z-10">
          <div className="relative mx-auto mb-8" style={{ width: 80, height: 80 }}>
            <div className="absolute inset-0 rounded-full" style={{ border: '2px solid rgba(0,229,255,0.15)' }} />
            <div className="absolute inset-0 rounded-full" style={{ border: '2px solid transparent', borderTopColor: '#00e5ff', animation: 'spin-slow 1.2s linear infinite' }} />
            <div className="absolute inset-3 rounded-full flex items-center justify-center" style={{ background: 'rgba(0,229,255,0.08)' }}>
              <Wind size={24} style={{ color: '#00e5ff' }} />
            </div>
          </div>
          <h2 className="text-2xl font-black tracking-tight text-white mb-2">INITIALIZING</h2>
          <p style={{ color: 'rgba(148,163,184,0.5)', fontSize: 12, letterSpacing: '0.3em', textTransform: 'uppercase' }}>Karachi AQI Engine</p>
        </div>
      </div>
    );
  }

  /* ── Error ── */
  if (historyError || !historyData) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#020a18' }}>
        <ParticleGrid />
        <div className="relative z-10 text-center p-12 rounded-3xl max-w-md" style={{ background: 'rgba(255,23,68,0.05)', border: '1px solid rgba(255,23,68,0.2)' }}>
          <AlertTriangle size={48} style={{ color: '#ff1744', margin: '0 auto 20px' }} />
          <h2 className="text-2xl font-black text-white mb-3">CONNECTION LOST</h2>
          <p style={{ color: 'rgba(148,163,184,0.6)', lineHeight: 1.8, marginBottom: 24, fontSize: 14 }}>
            Unable to reach the AQI engine at <span style={{ color: '#00e5ff' }}>{import.meta.env.VITE_API_URL || 'localhost:8000'}</span>
          </p>
          <button
            onClick={() => window.location.reload()}
            className="w-full font-bold py-3 rounded-xl transition-all"
            style={{ background: 'rgba(255,23,68,0.15)', color: '#ff1744', border: '1px solid rgba(255,23,68,0.3)', letterSpacing: '0.1em', fontSize: 13 }}
          >
            RETRY CONNECTION
          </button>
        </div>
      </div>
    );
  }

  const { current, history } = historyData;
  const aqiInfo = getAqiColor(current.aqi);

  // --- ADD THIS NEW BLOCK ---
  // Calculates if the latest data is from the current hour
  const isDataFresh = useMemo(() => {
    if (!current?.timestamp) return false;
    const latestTime = parseISO(current.timestamp).getTime();
    const now = new Date().getTime();
    const diffMinutes = (now - latestTime) / (1000 * 60);
    
    // If the data is less than 60 minutes old, it's fresh
    return diffMinutes < 60 && diffMinutes >= 0;
  }, [current]);
  // --------------------------

  return (
    <div style={{ minHeight: '100vh', background: '#020a18', color: '#e2e8f0', fontFamily: "'DM Mono', 'JetBrains Mono', 'Fira Code', monospace" }}>
      <ParticleGrid />

      {/* ── Sticky Header ── */}
      <header
        className="sticky top-0 z-50"
        style={{
          background: 'rgba(2,10,24,0.85)',
          borderBottom: '1px solid rgba(0,229,255,0.1)',
          backdropFilter: 'blur(20px)',
        }}
      >
        <div className="max-w-7xl mx-auto px-6 py-4 flex flex-col md:flex-row justify-between items-center gap-4">
          {/* Brand */}
          <div className="flex items-center gap-4">
            <div className="relative">
              <div
                className="absolute inset-0 rounded-xl"
                style={{ background: 'rgba(0,229,255,0.2)', filter: 'blur(8px)', animation: 'pulse-glow 3s ease-in-out infinite' }}
              />
              <div
                className="relative flex items-center justify-center rounded-xl p-2.5"
                style={{ background: 'rgba(0,229,255,0.1)', border: '1px solid rgba(0,229,255,0.25)' }}
              >
                <Wind size={22} style={{ color: '#00e5ff' }} />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-lg font-black tracking-widest text-white uppercase">Karachi AQI</h1>
                <span
                  className="text-[9px] font-bold px-2 py-0.5 rounded uppercase tracking-widest"
                  style={{ background: 'rgba(0,230,118,0.1)', color: '#00e676', border: '1px solid rgba(0,230,118,0.3)' }}
                >
                  ● Live
                </span>
              </div>
              <p style={{ color: 'rgba(148,163,184,0.45)', fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase', marginTop: 2 }}>
                XGBoost · ML Prediction Engine
              </p>
            </div>
          </div>

          {/* Right controls */}
          <div className="flex items-center gap-4">
            {/* Current AQI badge in header */}
            <div
              className="hidden md:flex items-center gap-2 px-4 py-2 rounded-xl"
              style={{
                background: `${aqiInfo.bg}`,
                border: `1px solid ${aqiInfo.border}`,
              }}
            >
              <span style={{ color: aqiInfo.color, fontWeight: 900, fontSize: 18, textShadow: `0 0 12px ${aqiInfo.color}80` }}>
                {Math.round(current.aqi)}
              </span>
              <span style={{ color: 'rgba(148,163,184,0.6)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                {aqiInfo.label}
              </span>
            </div>

            <button
              onClick={() => {
                if (isDataFresh) return; // Failsafe
                refreshMutation.mutate();
              }}
              disabled={refreshMutation.isPending || isDataFresh}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all ${
                isDataFresh ? 'cursor-not-allowed' : 'cursor-pointer'
              }`}
              style={{
                background: isDataFresh ? 'rgba(0,230,118,0.06)' : 'rgba(0,229,255,0.06)',
                border: isDataFresh ? '1px solid rgba(0,230,118,0.2)' : '1px solid rgba(0,229,255,0.2)',
                color: isDataFresh ? '#00e676' : 'rgba(0,229,255,0.8)',
                fontSize: 12,
                fontWeight: 700,
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
              }}
              onMouseEnter={e => { 
                if (!isDataFresh) e.currentTarget.style.background = 'rgba(0,229,255,0.12)'; 
              }}
              onMouseLeave={e => { 
                if (!isDataFresh) e.currentTarget.style.background = 'rgba(0,229,255,0.06)'; 
              }}
            >
              {isDataFresh ? (
                <CheckCircle size={14} />
              ) : (
                <RefreshCw size={14} className={refreshMutation.isPending ? 'animate-spin' : ''} />
              )}
              {refreshMutation.isPending ? 'Syncing...' : isDataFresh ? 'Up to date' : 'Refresh'}
            </button>
          </div>
        </div>
      </header>

      <main className="relative z-10 max-w-7xl mx-auto px-6 py-10 space-y-10">

        {/* ── Hero Section ── */}
        <section className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Large AQI Gauge */}
          <div
            className="lg:col-span-2 flex flex-col items-center justify-center rounded-3xl p-8"
            style={{
              background: 'linear-gradient(135deg, rgba(6,18,36,0.95), rgba(2,10,24,0.98))',
              border: `1px solid ${aqiInfo.border}`,
              boxShadow: `0 0 40px ${aqiInfo.color}15, inset 0 0 60px rgba(0,0,0,0.3)`,
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            {/* Corner decoration */}
            <div className="absolute top-0 left-0 w-20 h-20" style={{ borderTop: `1px solid ${aqiInfo.color}30`, borderLeft: `1px solid ${aqiInfo.color}30`, borderTopLeftRadius: 24 }} />
            <div className="absolute bottom-0 right-0 w-20 h-20" style={{ borderBottom: `1px solid ${aqiInfo.color}30`, borderRight: `1px solid ${aqiInfo.color}30`, borderBottomRightRadius: 24 }} />

            <p style={{ color: 'rgba(148,163,184,0.4)', fontSize: 9, letterSpacing: '0.4em', textTransform: 'uppercase', marginBottom: 24 }}>
              Real-Time Index
            </p>
            <AqiGauge aqi={current.aqi} />
            <div
              className="mt-6 px-5 py-2 rounded-full font-black text-sm uppercase tracking-widest"
              style={{
                background: `${aqiInfo.bg}`,
                color: aqiInfo.color,
                border: `1px solid ${aqiInfo.border}`,
                textShadow: `0 0 12px ${aqiInfo.color}60`,
                boxShadow: `0 0 20px ${aqiInfo.color}15`,
              }}
            >
              {aqiInfo.label}
            </div>

            <p style={{ color: 'rgba(148,163,184,0.3)', fontSize: 10, letterSpacing: '0.3em', textTransform: 'uppercase', marginTop: 16 }}>
              Karachi · {format(new Date(), 'HH:mm zzz')}
            </p>
          </div>

          {/* KPI Cards */}
          <div className="lg:col-span-3 grid grid-cols-2 gap-4">
            <AqiCard
              title="PM2.5"
              value={`${current.pm25.toFixed(1)}`}
              subtitle="µg/m³ · Fine Particles"
              colorCode="#00e5ff"
              trend={current.pm25_diff}
              icon={<Activity size={14} />}
            />
            <AqiCard
              title="AQI Score"
              value={Math.round(current.aqi)}
              subtitle={aqiInfo.label}
              colorCode={aqiInfo.color}
              icon={<Gauge size={14} />}
            />
            <AqiCard
              title="Temperature"
              value={`${current.temp}°C`}
              subtitle="Ambient · Karachi"
              colorCode="#ff9100"
              icon={<Thermometer size={14} />}
            />
            <AqiCard
              title="Wind Speed"
              value={`${current.wind} km/h`}
              subtitle="Dispersion Rate"
              colorCode="#a78bfa"
              icon={<Wind size={14} />}
            />
          </div>
        </section>

        {/* ── Analysis Hub ── */}
        <div
          className="rounded-3xl overflow-hidden"
          style={{
            background: 'rgba(6,18,36,0.6)',
            border: '1px solid rgba(0,229,255,0.08)',
            backdropFilter: 'blur(16px)',
            boxShadow: '0 24px 80px rgba(0,0,0,0.4)',
          }}
        >
          {/* Tab bar */}
          <div className="flex p-2 gap-2" style={{ borderBottom: '1px solid rgba(0,229,255,0.06)', background: 'rgba(2,10,24,0.6)' }}>
            {(['history', 'forecast', 'explain'] as const).map((tab) => {
              const isActive = activeTab === tab;
              const labels: Record<string, string> = { history: '↗ History', forecast: '◈ 72h Forecast', explain: '⬡ Model Insights' };
              return (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className="flex-1 py-3 px-4 rounded-xl font-bold transition-all"
                  style={{
                    background: isActive ? 'rgba(0,229,255,0.1)' : 'transparent',
                    color: isActive ? '#00e5ff' : 'rgba(148,163,184,0.4)',
                    border: isActive ? '1px solid rgba(0,229,255,0.25)' : '1px solid transparent',
                    fontSize: 11,
                    letterSpacing: '0.15em',
                    textTransform: 'uppercase',
                    textShadow: isActive ? '0 0 12px rgba(0,229,255,0.5)' : 'none',
                    boxShadow: isActive ? '0 0 20px rgba(0,229,255,0.05)' : 'none',
                    transition: 'all 0.25s ease',
                  }}
                  onMouseEnter={e => { if (!isActive) e.currentTarget.style.color = 'rgba(148,163,184,0.8)'; }}
                  onMouseLeave={e => { if (!isActive) e.currentTarget.style.color = 'rgba(148,163,184,0.4)'; }}
                >
                  {labels[tab]}
                </button>
              );
            })}
          </div>

          <div className="p-8">

            {/* ── History Tab ── */}
            {activeTab === 'history' && (
              <div style={{ animation: 'data-stream 0.4s ease forwards' }}>
                <div className="flex justify-between items-end mb-8">
                  <div>
                    <h3 className="text-xl font-black text-white tracking-tight">Historical Air Quality</h3>
                    <p style={{ color: 'rgba(148,163,184,0.5)', fontSize: 12, marginTop: 4, letterSpacing: '0.1em' }}>
                      Last 7 days of verified readings
                    </p>
                  </div>
                  <div className="flex items-center gap-4 text-xs" style={{ color: 'rgba(148,163,184,0.4)', letterSpacing: '0.1em' }}>
                    <span className="flex items-center gap-2">
                      <span className="inline-block w-6 h-0.5 rounded" style={{ background: '#00e5ff' }} /> AQI
                    </span>
                    <span className="flex items-center gap-2">
                      <span className="inline-block w-6 h-0.5 rounded" style={{ background: '#00e676' }} /> PM2.5
                    </span>
                  </div>
                </div>
                <div style={{ height: 420 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={history} margin={{ top: 10, right: 0, left: -10, bottom: 0 }}>
                      <defs>
                        <linearGradient id="aqiGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#00e5ff" stopOpacity={0.25} />
                          <stop offset="100%" stopColor="#00e5ff" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="pmGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#00e676" stopOpacity={0.2} />
                          <stop offset="100%" stopColor="#00e676" stopOpacity={0} />
                        </linearGradient>
                        <filter id="glow">
                          <feGaussianBlur stdDeviation="3" result="coloredBlur" />
                          <feMerge><feMergeNode in="coloredBlur" /><feMergeNode in="SourceGraphic" /></feMerge>
                        </filter>
                      </defs>
                      <CartesianGrid strokeDasharray="1 4" stroke="rgba(255,255,255,0.04)" vertical={false} />
                      <XAxis
                        dataKey="timestamp"
                        stroke="transparent"
                        tick={{ fill: 'rgba(148,163,184,0.35)', fontSize: 10, fontFamily: 'inherit' }}
                        tickFormatter={(v) => format(parseISO(v), 'MMM d')}
                        minTickGap={40}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        stroke="transparent"
                        tick={{ fill: 'rgba(148,163,184,0.35)', fontSize: 10, fontFamily: 'inherit' }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <Tooltip content={<ChartTooltip />} />
                      <Area type="monotone" dataKey="aqi" stroke="#00e5ff" strokeWidth={2.5} fill="url(#aqiGrad)" name="AQI" dot={false} />
                      <Area type="monotone" dataKey="pm25" stroke="#00e676" strokeWidth={1.5} fill="url(#pmGrad)" name="PM2.5" dot={false} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* ── Forecast Tab ── */}
            {activeTab === 'forecast' && (
              <div style={{ animation: 'data-stream 0.4s ease forwards' }}>
                {forecastLoading ? (
                  <div style={{ height: 450 }} className="flex flex-col items-center justify-center gap-4">
                    <div className="relative w-12 h-12">
                      <div className="absolute inset-0 rounded-full" style={{ border: '2px solid rgba(255,145,0,0.15)' }} />
                      <div className="absolute inset-0 rounded-full" style={{ border: '2px solid transparent', borderTopColor: '#ff9100', animation: 'spin-slow 1s linear infinite' }} />
                    </div>
                    <p style={{ color: 'rgba(148,163,184,0.4)', fontSize: 11, letterSpacing: '0.3em', textTransform: 'uppercase' }}>
                      Simulating future scenarios
                    </p>
                  </div>
                ) : (
                  <>
                    {/* Peak alert */}
                    {peakInfo && (
                      <div
                        className="p-5 rounded-2xl mb-8 flex items-start gap-5"
                        style={{
                          background: peakInfo.bg,
                          border: `1px solid ${peakInfo.border}`,
                          boxShadow: `0 0 30px ${peakInfo.color}08`,
                          animation: 'data-stream 0.5s ease forwards',
                        }}
                      >
                        <div
                          className="p-2.5 rounded-xl shrink-0"
                          style={{ background: 'rgba(2,10,24,0.8)', border: `1px solid ${peakInfo.border}` }}
                        >
                          {peakInfo.aqi >= 100
                            ? <AlertTriangle size={18} style={{ color: peakInfo.color }} />
                            : <CheckCircle size={18} style={{ color: peakInfo.color }} />}
                        </div>
                        <div>
                          <h4 className="font-black text-white text-sm uppercase tracking-wider flex items-center gap-3">
                            Forecast Peak: <span style={{ color: peakInfo.color }}>{Math.round(peakInfo.aqi)} AQI</span>
                            <span
                              className="text-xs font-bold px-2 py-0.5 rounded-full"
                              style={{ background: 'rgba(2,10,24,0.8)', color: peakInfo.color, border: `1px solid ${peakInfo.border}` }}
                            >
                              {peakInfo.label}
                            </span>
                          </h4>
                          <p style={{ color: 'rgba(148,163,184,0.6)', fontSize: 12, marginTop: 6, lineHeight: 1.7 }}>
                            {peakInfo.aqi >= 150
                              ? `🚨 High pollution risk on ${peakInfo.time} — outdoor activities not recommended.`
                              : peakInfo.aqi >= 100
                                ? `⚠️ Elevated levels expected around ${peakInfo.time}. Sensitive groups take precautions.`
                                : `✅ Air quality expected to stay healthy, peaking on ${peakInfo.time}.`}
                          </p>
                        </div>
                      </div>
                    )}

                    <h3 className="text-sm font-black uppercase tracking-widest mb-6" style={{ color: 'rgba(148,163,184,0.4)' }}>
                      ◈ AI Forecast Trajectory
                    </h3>
                    <div style={{ height: 360 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={forecastData} margin={{ top: 10, right: 0, left: -10, bottom: 0 }}>
                          <defs>
                            <filter id="orange-glow">
                              <feGaussianBlur stdDeviation="4" result="coloredBlur" />
                              <feMerge><feMergeNode in="coloredBlur" /><feMergeNode in="SourceGraphic" /></feMerge>
                            </filter>
                          </defs>
                          <CartesianGrid strokeDasharray="1 4" stroke="rgba(255,255,255,0.04)" vertical={false} />
                          <XAxis
                            dataKey="timestamp"
                            stroke="transparent"
                            tick={{ fill: 'rgba(148,163,184,0.35)', fontSize: 10, fontFamily: 'inherit' }}
                            tickFormatter={(v) => format(parseISO(v), 'EEE, p')}
                            minTickGap={30}
                            axisLine={false}
                            tickLine={false}
                          />
                          <YAxis
                            stroke="transparent"
                            tick={{ fill: 'rgba(148,163,184,0.35)', fontSize: 10, fontFamily: 'inherit' }}
                            axisLine={false}
                            tickLine={false}
                            domain={['auto', 'auto']}
                          />
                          <Tooltip content={<ChartTooltip />} />
                          <ReferenceLine y={100} stroke="rgba(255,145,0,0.2)" strokeDasharray="4 4" label={{ value: 'Moderate', fill: 'rgba(255,145,0,0.4)', fontSize: 9 }} />
                          <ReferenceLine y={150} stroke="rgba(255,61,0,0.2)" strokeDasharray="4 4" label={{ value: 'Unhealthy', fill: 'rgba(255,61,0,0.4)', fontSize: 9 }} />
                          <Line
                            type="monotone"
                            dataKey="forecastAqi"
                            stroke="#ff9100"
                            strokeWidth={3}
                            strokeDasharray="6 3"
                            name="Predicted AQI"
                            dot={{ r: 3, fill: '#ff9100', strokeWidth: 0 }}
                            activeDot={{ r: 7, fill: '#ff9100', strokeWidth: 0, style: { filter: 'drop-shadow(0 0 6px #ff9100)' } }}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>

                    {/* Daily breakdown */}
                    <div className="mt-8 pt-6" style={{ borderTop: '1px solid rgba(0,229,255,0.06)' }}>
                      <p className="text-xs font-black uppercase tracking-[0.3em] mb-5 flex items-center gap-2" style={{ color: 'rgba(148,163,184,0.35)' }}>
                        <Calendar size={12} /> Daily Averages
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        {dailyAverages.map((day, idx) => {
                          const info = getAqiColor(day.avgAqi);
                          return (
                            <div
                              key={idx}
                              className="flex items-center justify-between p-5 rounded-2xl"
                              style={{
                                background: info.bg,
                                border: `1px solid ${info.border}`,
                                boxShadow: `0 0 20px ${info.color}08`,
                                transition: 'all 0.2s ease',
                              }}
                              onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; }}
                              onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; }}
                            >
                              <div>
                                <p style={{ color: 'rgba(148,163,184,0.5)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.15em', fontWeight: 700 }}>
                                  {day.date}
                                </p>
                                <p style={{ color: info.color, fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.2em', marginTop: 4, fontWeight: 700 }}>
                                  {info.label}
                                </p>
                              </div>
                              <div className="text-right">
                                <span
                                  className="font-black"
                                  style={{ color: info.color, fontSize: 28, textShadow: `0 0 16px ${info.color}60`, letterSpacing: '-0.03em' }}
                                >
                                  {day.avgAqi}
                                </span>
                                <span style={{ display: 'block', color: 'rgba(148,163,184,0.35)', fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.2em' }}>
                                  Avg AQI
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* ── Explain Tab ── */}
            {activeTab === 'explain' && (
              <div style={{ animation: 'data-stream 0.4s ease forwards' }}>
                <div className="mb-8">
                  <h3 className="text-xl font-black text-white tracking-tight">Model Explainability</h3>
                  <p style={{ color: 'rgba(148,163,184,0.5)', fontSize: 12, marginTop: 4, letterSpacing: '0.05em' }}>
                    SHAP values showing each feature's impact on the prediction
                  </p>
                </div>

                {explainLoading ? (
                  <div style={{ height: 450 }} className="flex items-center justify-center">
                    <div className="relative w-10 h-10">
                      <div className="absolute inset-0 rounded-full" style={{ border: '2px solid rgba(167,139,250,0.15)' }} />
                      <div className="absolute inset-0 rounded-full" style={{ border: '2px solid transparent', borderTopColor: '#a78bfa', animation: 'spin-slow 1s linear infinite' }} />
                    </div>
                  </div>
                ) : (
                  <div style={{ height: 500 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart layout="vertical" data={explainData} margin={{ left: 150, right: 20 }}>
                        <CartesianGrid strokeDasharray="1 4" stroke="rgba(255,255,255,0.04)" horizontal={false} />
                        <XAxis
                          type="number"
                          stroke="transparent"
                          tick={{ fill: 'rgba(148,163,184,0.35)', fontSize: 10, fontFamily: 'inherit' }}
                          axisLine={false}
                          tickLine={false}
                        />
                        <YAxis
                          dataKey="feature"
                          type="category"
                          stroke="transparent"
                          width={140}
                          tick={{ fill: 'rgba(148,163,184,0.6)', fontSize: 11, fontFamily: 'inherit' }}
                          axisLine={false}
                          tickLine={false}
                        />
                        <Tooltip
                          content={({ active, payload }) => {
                            if (!active || !payload?.length) return null;
                            const val = payload[0].value as number;
                            return (
                              <div style={{ background: 'rgba(2,10,24,0.95)', border: `1px solid ${val > 0 ? 'rgba(0,229,255,0.2)' : 'rgba(255,61,0,0.2)'}`, borderRadius: 12, padding: '10px 14px', boxShadow: '0 10px 30px rgba(0,0,0,0.5)' }}>
                                <p style={{ color: val > 0 ? '#00e5ff' : '#ff3d00', fontWeight: 700, fontSize: 14 }}>
                                  {val > 0 ? '+' : ''}{val.toFixed(3)}
                                </p>
                                <p style={{ color: 'rgba(148,163,184,0.5)', fontSize: 10, marginTop: 4 }}>
                                  {val > 0 ? 'Increasing AQI' : 'Decreasing AQI'}
                                </p>
                              </div>
                            );
                          }}
                          cursor={{ fill: 'rgba(255,255,255,0.02)' }}
                        />
                        <ReferenceLine x={0} stroke="rgba(255,255,255,0.08)" />
                        <Bar dataKey="impact" radius={[0, 4, 4, 0]} maxBarSize={20}>
                          {explainData?.map((entry, index) => (
                            <Cell
                              key={`cell-${index}`}
                              fill={entry.impact > 0 ? '#00e5ff' : '#ff3d00'}
                              style={{ filter: `drop-shadow(0 0 4px ${entry.impact > 0 ? '#00e5ffaa' : '#ff3d00aa'})` }}
                            />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}

                <div
                  className="p-5 rounded-2xl flex items-start gap-4 mt-4"
                  style={{ background: 'rgba(0,229,255,0.04)', border: '1px solid rgba(0,229,255,0.12)' }}
                >
                  <Info size={16} style={{ color: 'rgba(0,229,255,0.5)', flexShrink: 0, marginTop: 2 }} />
                  <p style={{ color: 'rgba(148,163,184,0.5)', fontSize: 11, lineHeight: 1.8, letterSpacing: '0.03em' }}>
                    SHAP (SHapley Additive exPlanations) values quantify each feature's contribution to the prediction.
                    <span style={{ color: '#00e5ff' }}> Cyan bars</span> push AQI higher (worsening air quality),
                    while <span style={{ color: '#ff3d00' }}>red bars</span> indicate factors improving it.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Footer ── */}
        <footer
          className="flex flex-col sm:flex-row justify-between items-center gap-4 pb-12"
          style={{ borderTop: '1px solid rgba(0,229,255,0.06)', paddingTop: 24 }}
        >
          <p style={{ color: 'rgba(148,163,184,0.2)', fontSize: 10, letterSpacing: '0.25em', textTransform: 'uppercase' }}>
            © 2026 Pearls AQI Predictor · Karachi Hub
          </p>
          <div className="flex items-center gap-6" style={{ color: 'rgba(148,163,184,0.3)', fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase' }}>
            <span className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: '#00e676', boxShadow: '0 0 6px #00e676' }} />
              System Active
            </span>
            <span className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: '#00e5ff', boxShadow: '0 0 6px #00e5ff' }} />
              Database Synced
            </span>
          </div>
        </footer>
      </main>
    </div>
  );
};