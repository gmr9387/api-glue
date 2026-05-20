// Runtime simulation store — drives "the app feels alive" behavior.
// Tick-driven: every ~2s it perturbs latency, throughput, queue depth,
// progresses runs, occasionally opens/closes incidents, emits ticker events.

import { create } from 'zustand';
import {
  demoConnectorHealth,
  demoIncidents,
  demoAIDecisions,
  type DemoConnectorHealth,
  type DemoIncident,
  type DemoAIDecision,
} from '@/lib/demoData';

export interface TickerEvent {
  id: string;
  ts: number;
  severity: 'info' | 'success' | 'warn' | 'error';
  source: string;
  message: string;
}

interface RuntimeState {
  running: boolean;
  tick: number;
  startedAt: number;

  queueDepth: number;
  retryQueue: number;
  activeRuns: number;
  slaAtRisk: number;

  connectorHealth: DemoConnectorHealth[];
  incidents: DemoIncident[];
  aiDecisions: DemoAIDecision[];
  ticker: TickerEvent[];

  // Heatmap: per-hour activity intensity 0..1 for last 24h
  heatmap: number[];

  start: () => void;
  stop: () => void;
  doTick: () => void;
  seed: () => void;
  resetTicker: () => void;
}

const clamp = (v: number, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, v));
const jitter = (v: number, amt: number) => v + (Math.random() - 0.5) * amt;

let interval: ReturnType<typeof setInterval> | null = null;

export const useRuntimeStore = create<RuntimeState>((set, get) => ({
  running: false,
  tick: 0,
  startedAt: Date.now(),
  queueDepth: 12,
  retryQueue: 3,
  activeRuns: 4,
  slaAtRisk: 1,
  connectorHealth: demoConnectorHealth,
  incidents: demoIncidents,
  aiDecisions: demoAIDecisions,
  ticker: [],
  heatmap: Array.from({ length: 24 }, (_, i) => clamp(0.3 + Math.sin(i / 3) * 0.3 + Math.random() * 0.3)),

  seed: () => set({
    connectorHealth: demoConnectorHealth,
    incidents: demoIncidents,
    aiDecisions: demoAIDecisions,
    startedAt: Date.now(),
  }),

  start: () => {
    if (interval) return;
    set({ running: true, startedAt: Date.now() });
    interval = setInterval(() => get().doTick(), 2200);
  },
  stop: () => {
    if (interval) { clearInterval(interval); interval = null; }
    set({ running: false });
  },

  resetTicker: () => set({ ticker: [] }),

  doTick: () => {
    const s = get();
    const tick = s.tick + 1;

    // Evolve connector telemetry
    const health = s.connectorHealth.map(h => {
      if (h.status === 'down') {
        // small chance to recover
        if (Math.random() < 0.04) {
          return { ...h, status: 'retrying' as const, latencyMs: 800, throughputRpm: 10,
            latencySeries: [...h.latencySeries.slice(1), 800],
            throughputSeries: [...h.throughputSeries.slice(1), 10] };
        }
        return { ...h, latencySeries: [...h.latencySeries.slice(1), h.latencySeries.at(-1) ?? 900],
          throughputSeries: [...h.throughputSeries.slice(1), 0] };
      }
      const baseLat = h.latencyMs ?? 300;
      const next = Math.max(40, Math.round(jitter(baseLat, baseLat * 0.18)));
      const baseThru = h.throughputRpm || 50;
      const nextThru = Math.max(0, Math.round(jitter(baseThru, baseThru * 0.22)));
      const failureDrift = clamp(h.failureRate + (Math.random() - 0.55) * 0.02);
      let status: DemoConnectorHealth['status'] = h.status;
      if (failureDrift > 0.4) status = 'degraded';
      else if (failureDrift > 0.15 && status === 'healthy') status = 'degraded';
      else if (failureDrift < 0.05) status = 'healthy';
      return {
        ...h, latencyMs: next, throughputRpm: nextThru,
        failureRate: failureDrift, status,
        latencySeries: [...h.latencySeries.slice(1), next],
        throughputSeries: [...h.throughputSeries.slice(1), nextThru],
        lastSuccessfulExecution: nextThru > 0 ? new Date().toISOString() : h.lastSuccessfulExecution,
      };
    });

    // Queue + activity drift
    const queueDepth = Math.max(0, Math.round(jitter(s.queueDepth, 4)));
    const retryQueue = Math.max(0, Math.round(jitter(s.retryQueue, 1.5)));
    const activeRuns = Math.max(0, Math.round(jitter(s.activeRuns, 2)));
    const slaAtRisk = Math.max(0, Math.min(activeRuns, Math.round(jitter(s.slaAtRisk, 0.8))));

    // Occasional ticker emission
    const newTicker: TickerEvent[] = [...s.ticker];
    if (Math.random() < 0.85) {
      const c = health[Math.floor(Math.random() * health.length)];
      const choices: TickerEvent[] = [
        { id: crypto.randomUUID(), ts: Date.now(), severity: 'success', source: c.connector, message: `executed ${c.throughputRpm} rpm · ${c.latencyMs ?? '—'}ms p50` },
        { id: crypto.randomUUID(), ts: Date.now(), severity: 'info', source: 'scheduler', message: `queue depth ${queueDepth} · ${activeRuns} active` },
        { id: crypto.randomUUID(), ts: Date.now(), severity: c.status === 'degraded' ? 'warn' : 'info', source: c.connector, message: c.status === 'degraded' ? `latency drift ${c.latencyMs}ms` : `health.${c.status}` },
      ];
      if (c.status === 'down') {
        choices.push({ id: crypto.randomUUID(), ts: Date.now(), severity: 'error', source: c.connector, message: 'circuit-breaker open · backoff 2s' });
      }
      newTicker.unshift(choices[Math.floor(Math.random() * choices.length)]);
    }

    // AI decision occasional
    let aiDecisions = s.aiDecisions;
    if (Math.random() < 0.12) {
      const conf = clamp(0.5 + Math.random() * 0.5);
      const escalated = conf < 0.78;
      const dec: DemoAIDecision = {
        id: crypto.randomUUID(),
        workflowId: 'wf-runtime',
        ts: new Date().toISOString(),
        model: ['openai/gpt-5-mini', 'google/gemini-2.5-flash', 'openai/gpt-5'][Math.floor(Math.random() * 3)],
        prompt: 'Route incoming event to handler',
        decision: escalated ? 'escalate-to-human' : 'auto-resolve',
        confidence: conf,
        escalated,
        reasoning: escalated ? 'Confidence below 0.78 threshold.' : 'High-confidence routing match.',
        risk: conf > 0.85 ? 'low' : conf > 0.7 ? 'medium' : 'high',
      };
      aiDecisions = [dec, ...aiDecisions].slice(0, 40);
      newTicker.unshift({ id: crypto.randomUUID(), ts: Date.now(), severity: escalated ? 'warn' : 'success', source: 'decision-weaver', message: `${dec.decision} · conf ${(conf * 100).toFixed(0)}%` });
    }

    // Heatmap shift (rotates every ~12 ticks)
    let heatmap = s.heatmap;
    if (tick % 12 === 0) {
      heatmap = [...s.heatmap.slice(1), clamp(0.3 + Math.random() * 0.5)];
    }

    set({
      tick, connectorHealth: health, queueDepth, retryQueue, activeRuns, slaAtRisk,
      ticker: newTicker.slice(0, 60), aiDecisions, heatmap,
    });
  },
}));

// React hook to ensure the engine is running while mounted
export function useRuntimeEngine() {
  const start = useRuntimeStore(s => s.start);
  const stop = useRuntimeStore(s => s.stop);
  if (typeof window !== 'undefined' && !useRuntimeStore.getState().running) {
    start();
  }
  return { start, stop };
}
