import { useEffect, useMemo, useState } from 'react';
import { motion, useSpring, useTransform, type MotionValue } from 'motion/react';
import type { PerfilDetalheData } from '../pages/PerfilDetalhe';

type Mode = 'total' | 'perGame';
type SkillKey = keyof PerfilDetalheData;

interface Skill {
  key: SkillKey;
  label: string;
  color: string;
  /** Teto usado para normalizar 0–1 no modo total. */
  maxTotal: number;
  /** Teto usado no modo por partida. */
  maxPerGame: number;
}

/** Ordem define a posição no polígono (começa no topo, sentido horário). */
const SKILLS: Skill[] = [
  { key: 'points',        label: 'Ataque',  color: '#10b981', maxTotal: 500, maxPerGame: 30 },
  { key: 'assists',       label: 'Visão',   color: '#06b6d4', maxTotal: 200, maxPerGame: 10 },
  { key: 'clutch_points', label: 'Clutch',  color: '#f43f5e', maxTotal: 100, maxPerGame: 3  },
  { key: 'steals',        label: 'Pressão', color: '#8b5cf6', maxTotal: 100, maxPerGame: 5  },
  { key: 'blocks',        label: 'Muralha', color: '#3b82f6', maxTotal: 100, maxPerGame: 5  },
  { key: 'rebounds',      label: 'Rebote',  color: '#14b8a6', maxTotal: 200, maxPerGame: 10 },
  { key: 'wins',          label: 'Vitória', color: '#f59e0b', maxTotal: 1,   maxPerGame: 1  },
];

const VB_W = 400;
const VB_H = 360;
const CX = VB_W / 2;
const CY = VB_H / 2;
const RADIUS = 110;
const LABEL_OFFSET = 22;
const RINGS = 4;

/** Ângulo de cada eixo (topo = -PI/2, sentido horário). */
const ANGLES = SKILLS.map((_, i) => -Math.PI / 2 + (i * 2 * Math.PI) / SKILLS.length);

function polar(angleRad: number, r: number, cx = CX, cy = CY) {
  return { x: cx + r * Math.cos(angleRad), y: cy + r * Math.sin(angleRad) };
}

function normalizeSkill(data: PerfilDetalheData, s: Skill, mode: Mode): number {
  if (s.key === 'wins') {
    const wr = data.partidas > 0 ? data.wins / data.partidas : 0;
    return Math.max(0, Math.min(1, wr));
  }
  const partidas = Math.max(data.partidas || 0, 1);
  const raw = Number(data[s.key]) || 0;
  const scaled = mode === 'perGame' ? raw / partidas / s.maxPerGame : raw / s.maxTotal;
  return Math.max(0, Math.min(1, scaled));
}

interface Props {
  data: PerfilDetalheData;
  mode: Mode;
  darkMode: boolean;
}

export default function SkillsRadar({ data, mode, darkMode }: Props) {
  const [enabled, setEnabled] = useState<Record<SkillKey, boolean>>(() =>
    Object.fromEntries(SKILLS.map((s) => [s.key, true])) as Record<SkillKey, boolean>,
  );

  const targets = useMemo(
    () => SKILLS.map((s) => (enabled[s.key] ? normalizeSkill(data, s, mode) : 0)),
    [data, mode, enabled],
  );

  // 7 springs — quantidade fixa, casa com SKILLS[].
  const sp0 = useSpring(0, { stiffness: 110, damping: 16, mass: 0.9 });
  const sp1 = useSpring(0, { stiffness: 110, damping: 16, mass: 0.9 });
  const sp2 = useSpring(0, { stiffness: 110, damping: 16, mass: 0.9 });
  const sp3 = useSpring(0, { stiffness: 110, damping: 16, mass: 0.9 });
  const sp4 = useSpring(0, { stiffness: 110, damping: 16, mass: 0.9 });
  const sp5 = useSpring(0, { stiffness: 110, damping: 16, mass: 0.9 });
  const sp6 = useSpring(0, { stiffness: 110, damping: 16, mass: 0.9 });
  const springs: MotionValue<number>[] = [sp0, sp1, sp2, sp3, sp4, sp5, sp6];

  useEffect(() => {
    springs.forEach((s, i) => s.set(targets[i] ?? 0));
  }, [targets, springs]);

  const pointsMV = useTransform(springs, (vals) => {
    const arr = vals as number[];
    return arr
      .map((v, i) => {
        const { x, y } = polar(ANGLES[i], v * RADIUS);
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(' ');
  });

  const grid = darkMode ? '#1e293b' : '#e2e8f0';
  const axisColor = darkMode ? '#334155' : '#cbd5e1';
  const labelOn = darkMode ? '#cbd5e1' : '#475569';
  const labelOff = darkMode ? '#475569' : '#cbd5e1';
  const accent = '#10b981';
  const accentFaint = 'rgba(16,185,129,0.22)';

  const toggleAll = (value: boolean) =>
    setEnabled(
      Object.fromEntries(SKILLS.map((s) => [s.key, value])) as Record<SkillKey, boolean>,
    );
  const toggle = (k: SkillKey) => setEnabled((prev) => ({ ...prev, [k]: !prev[k] }));

  const selectedCount = SKILLS.filter((s) => enabled[s.key]).length;

  return (
    <div className="w-full">
      {/* Controles — chips por skill */}
      <div className="flex flex-wrap gap-1.5 mb-3 items-center">
        {SKILLS.map((s) => {
          const on = enabled[s.key];
          return (
            <button
              key={s.key}
              type="button"
              onClick={() => toggle(s.key)}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border transition-all ${
                on
                  ? darkMode
                    ? 'bg-slate-800 border-slate-700 text-white'
                    : 'bg-white border-slate-300 text-slate-800'
                  : darkMode
                    ? 'bg-transparent border-slate-800 text-slate-500 hover:text-slate-300'
                    : 'bg-transparent border-slate-200 text-slate-400 hover:text-slate-600'
              }`}
              aria-pressed={on}
            >
              <span
                className="w-2 h-2 rounded-full"
                style={{ background: on ? s.color : 'transparent', outline: `1.5px solid ${s.color}` }}
              />
              {s.label}
            </button>
          );
        })}

        <div className="flex-1" />
        <button
          type="button"
          onClick={() => toggleAll(selectedCount === SKILLS.length ? false : true)}
          className={`text-[11px] font-semibold px-2 py-1 rounded-md transition-colors ${
            darkMode ? 'text-slate-400 hover:text-white hover:bg-slate-800' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'
          }`}
        >
          {selectedCount === SKILLS.length ? 'Limpar' : 'Tudo'}
        </button>
      </div>

      <div className="relative w-full flex items-center justify-center">
        {/* Glow de fundo */}
        <div aria-hidden className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div
            className="w-[260px] h-[260px] rounded-full blur-3xl"
            style={{ background: 'radial-gradient(circle, rgba(16,185,129,0.15), transparent 70%)' }}
          />
        </div>

        <svg
          viewBox={`0 0 ${VB_W} ${VB_H}`}
          className="relative w-full max-w-[420px] h-auto"
          role="img"
          aria-label="Radar de habilidades do atleta"
        >
          {/* Anéis */}
          {Array.from({ length: RINGS }, (_, i) => {
            const r = RADIUS * ((i + 1) / RINGS);
            const ringPts = SKILLS.map((_, j) => polar(ANGLES[j], r))
              .map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`)
              .join(' ');
            return (
              <polygon
                key={i}
                points={ringPts}
                fill="none"
                stroke={grid}
                strokeWidth={1}
                strokeOpacity={0.7}
              />
            );
          })}

          {/* Eixos */}
          {SKILLS.map((_, i) => {
            const p = polar(ANGLES[i], RADIUS);
            return (
              <line
                key={i}
                x1={CX}
                y1={CY}
                x2={p.x}
                y2={p.y}
                stroke={axisColor}
                strokeWidth={1}
                strokeOpacity={enabled[SKILLS[i].key] ? 0.65 : 0.25}
              />
            );
          })}

          {/* Polígono animado */}
          <motion.polygon
            points={pointsMV as unknown as string}
            fill={accentFaint}
            stroke={accent}
            strokeWidth={2}
            strokeLinejoin="round"
            style={{ filter: `drop-shadow(0 0 6px ${accent}80)` }}
          />

          {/* Vértices */}
          {springs.map((sp, i) => (
            <Vertex key={i} spring={sp} axisIdx={i} color={accent} />
          ))}

          {/* Labels */}
          {SKILLS.map((s, i) => {
            const p = polar(ANGLES[i], RADIUS + LABEL_OFFSET);
            const cos = Math.cos(ANGLES[i]);
            const anchor = Math.abs(cos) < 0.25 ? 'middle' : cos > 0 ? 'start' : 'end';
            const on = enabled[s.key];
            return (
              <text
                key={s.key}
                x={p.x}
                y={p.y}
                textAnchor={anchor}
                dominantBaseline="middle"
                fontSize={12}
                fontWeight={700}
                fill={on ? labelOn : labelOff}
                style={{ cursor: 'pointer', transition: 'fill 180ms ease' }}
                onClick={() => toggle(s.key)}
              >
                {s.label}
              </text>
            );
          })}

          {/* Centro */}
          <circle cx={CX} cy={CY} r={2.5} fill={accent} />
        </svg>
      </div>
    </div>
  );
}

function Vertex({
  spring,
  axisIdx,
  color,
}: {
  spring: MotionValue<number>;
  axisIdx: number;
  color: string;
}) {
  const cx = useTransform(spring, (v) => CX + v * RADIUS * Math.cos(ANGLES[axisIdx]));
  const cy = useTransform(spring, (v) => CY + v * RADIUS * Math.sin(ANGLES[axisIdx]));
  const opacity = useTransform(spring, (v) => (v < 0.001 ? 0 : 1));
  return <motion.circle cx={cx} cy={cy} r={3.5} fill={color} style={{ opacity }} />;
}
