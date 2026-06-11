export interface MoxaColumn {
  id: string;
  order: number;
  burnMinutes: number;
  isThermalBlocked: boolean;
  isGapWarning: boolean;
}

export interface Warning {
  type: 'thermal_block' | 'gap_abnormal';
  columnIds: [string, string];
  message: string;
}

export type ScheduleStatus = 'idle' | 'playing' | 'paused' | 'finished';

export interface ScheduleState {
  columns: MoxaColumn[];
  status: ScheduleStatus;
  gapMinutes: number;
  currentColumnIndex: number;
  elapsedSeconds: number;
  currentColumnElapsedSeconds: number;
  currentGapElapsedSeconds: number;
  inGap: boolean;
  warnings: Warning[];
  playbackSpeed: number;
}

const MIN_BURN = 15;
const MAX_BURN = 45;
const MAX_COLUMNS = 4;
const MIN_GAP = 1;
const MAX_GAP = 5;
const DEFAULT_GAP = 2;
const THERMAL_BLOCK_THRESHOLD = 10;

let nextId = 1;

function generateId(): string {
  return `col-${nextId++}`;
}

function detectThermalBlockWarnings(columns: MoxaColumn[]): Warning[] {
  const warnings: Warning[] = [];
  const sorted = [...columns].sort((a, b) => a.order - b.order);
  for (let i = 0; i < sorted.length - 1; i++) {
    const a = sorted[i];
    const b = sorted[i + 1];
    if (Math.abs(a.burnMinutes - b.burnMinutes) >= THERMAL_BLOCK_THRESHOLD) {
      const taller = a.burnMinutes > b.burnMinutes ? a : b;
      const shorter = a.burnMinutes > b.burnMinutes ? b : a;
      if (taller.burnMinutes - shorter.burnMinutes >= THERMAL_BLOCK_THRESHOLD) {
        warnings.push({
          type: 'thermal_block',
          columnIds: [a.id, b.id],
          message: `第${a.order + 1}柱与第${b.order + 1}柱燃尽时差≥${THERMAL_BLOCK_THRESHOLD}分钟，存在热力遮挡`,
        });
      }
    }
  }
  return warnings;
}

function detectGapWarnings(columns: MoxaColumn[], gapMinutes: number): Warning[] {
  const warnings: Warning[] = [];
  if (columns.length < 2) return warnings;
  if (gapMinutes < MIN_GAP || gapMinutes > MAX_GAP) {
    const sorted = [...columns].sort((a, b) => a.order - b.order);
    const first = sorted[0];
    const last = sorted[sorted.length - 1];
    warnings.push({
      type: 'gap_abnormal',
      columnIds: [first.id, last.id],
      message: `换柱空档${gapMinutes}分钟，不在${MIN_GAP}–${MAX_GAP}分钟建议范围内`,
    });
  }
  return warnings;
}

function recalculateWarnings(columns: MoxaColumn[], gapMinutes: number): {
  updatedColumns: MoxaColumn[];
  warnings: Warning[];
} {
  const thermalWarnings = detectThermalBlockWarnings(columns);
  const gapWarnings = detectGapWarnings(columns, gapMinutes);
  const allWarnings = [...thermalWarnings, ...gapWarnings];

  const thermalBlockedIds = new Set<string>();
  thermalWarnings.forEach((w) => w.columnIds.forEach((id) => thermalBlockedIds.add(id)));

  const gapWarningActive = gapWarnings.length > 0;

  const updatedColumns = columns.map((col) => ({
    ...col,
    isThermalBlocked: thermalBlockedIds.has(col.id),
    isGapWarning: gapWarningActive,
  }));

  return { updatedColumns, warnings: allWarnings };
}

function calculateTotalSeconds(columns: MoxaColumn[], gapMinutes: number): number {
  if (columns.length === 0) return 0;
  const totalBurn = columns.reduce((sum, c) => sum + c.burnMinutes, 0);
  const totalGap = (columns.length - 1) * gapMinutes;
  return (totalBurn + totalGap) * 60;
}

export interface ScheduleActions {
  addColumn: (burnMinutes?: number) => void;
  removeColumn: (id: string) => void;
  updateBurnTime: (id: string, minutes: number) => void;
  updateGapMinutes: (minutes: number) => void;
  reorderColumns: (fromIndex: number, toIndex: number) => void;
  startPlaying: () => void;
  pausePlaying: () => void;
  resumePlaying: () => void;
  reset: () => void;
  tick: (deltaSeconds: number) => void;
  setPlaybackSpeed: (speed: number) => void;
}

export {
  MIN_BURN,
  MAX_BURN,
  MAX_COLUMNS,
  MIN_GAP,
  MAX_GAP,
  DEFAULT_GAP,
  THERMAL_BLOCK_THRESHOLD,
  generateId,
  detectThermalBlockWarnings,
  detectGapWarnings,
  recalculateWarnings,
  calculateTotalSeconds,
};
