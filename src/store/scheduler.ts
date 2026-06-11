import { create } from 'zustand';
import {
  MoxaColumn,
  ScheduleState,
  ScheduleActions,
  generateId,
  recalculateWarnings,
  calculateTotalSeconds,
  DEFAULT_GAP,
  MIN_BURN,
  MAX_BURN,
  MAX_COLUMNS,
} from './types';

type Store = ScheduleState & ScheduleActions;

function createDefaultColumn(order: number, burnMinutes?: number): MoxaColumn {
  const minutes = burnMinutes ?? Math.round((MIN_BURN + MAX_BURN) / 2);
  return {
    id: generateId(),
    order,
    burnMinutes: minutes,
    isThermalBlocked: false,
    isGapWarning: false,
  };
}

const initialColumns: MoxaColumn[] = [
  createDefaultColumn(0, 25),
  createDefaultColumn(1, 30),
];

const { updatedColumns, warnings } = recalculateWarnings(initialColumns, DEFAULT_GAP);

export const useScheduleStore = create<Store>((set, get) => ({
  columns: updatedColumns,
  status: 'idle',
  gapMinutes: DEFAULT_GAP,
  currentColumnIndex: 0,
  elapsedSeconds: 0,
  currentColumnElapsedSeconds: 0,
  currentGapElapsedSeconds: 0,
  inGap: false,
  warnings,
  playbackSpeed: 1,

  addColumn: (burnMinutes?: number) => {
    const state = get();
    if (state.columns.length >= MAX_COLUMNS) return;
    const newOrder = state.columns.length;
    const newCol = createDefaultColumn(newOrder, burnMinutes);
    const newColumns = [...state.columns, newCol];
    const result = recalculateWarnings(newColumns, state.gapMinutes);
    set({ columns: result.updatedColumns, warnings: result.warnings });
  },

  removeColumn: (id: string) => {
    const state = get();
    if (state.columns.length <= 1) return;
    const filtered = state.columns.filter((c) => c.id !== id);
    const reindexed = filtered.map((c, i) => ({ ...c, order: i }));
    const result = recalculateWarnings(reindexed, state.gapMinutes);
    set({ columns: result.updatedColumns, warnings: result.warnings });
  },

  updateBurnTime: (id: string, minutes: number) => {
    const state = get();
    const clamped = Math.max(MIN_BURN, Math.min(MAX_BURN, minutes));
    const newColumns = state.columns.map((c) =>
      c.id === id ? { ...c, burnMinutes: clamped } : c
    );
    const result = recalculateWarnings(newColumns, state.gapMinutes);
    set({ columns: result.updatedColumns, warnings: result.warnings });
  },

  updateGapMinutes: (minutes: number) => {
    const state = get();
    const result = recalculateWarnings(state.columns, minutes);
    set({ gapMinutes: minutes, columns: result.updatedColumns, warnings: result.warnings });
  },

  reorderColumns: (fromIndex: number, toIndex: number) => {
    const state = get();
    if (fromIndex === toIndex) return;
    const sorted = [...state.columns].sort((a, b) => a.order - b.order);
    const [moved] = sorted.splice(fromIndex, 1);
    sorted.splice(toIndex, 0, moved);
    const reindexed = sorted.map((c, i) => ({ ...c, order: i }));
    const result = recalculateWarnings(reindexed, state.gapMinutes);
    set({ columns: result.updatedColumns, warnings: result.warnings });
  },

  startPlaying: () => {
    const state = get();
    if (state.columns.length === 0) return;
    const sorted = [...state.columns].sort((a, b) => a.order - b.order);
    const result = recalculateWarnings(sorted, state.gapMinutes);
    set({
      status: 'playing',
      currentColumnIndex: 0,
      elapsedSeconds: 0,
      currentColumnElapsedSeconds: 0,
      currentGapElapsedSeconds: 0,
      inGap: false,
      columns: result.updatedColumns,
      warnings: result.warnings,
    });
  },

  pausePlaying: () => {
    const state = get();
    if (state.status !== 'playing') return;
    set({ status: 'paused' });
  },

  resumePlaying: () => {
    const state = get();
    if (state.status !== 'paused') return;
    set({ status: 'playing' });
  },

  reset: () => {
    const state = get();
    const result = recalculateWarnings(state.columns, state.gapMinutes);
    set({
      status: 'idle',
      currentColumnIndex: 0,
      elapsedSeconds: 0,
      currentColumnElapsedSeconds: 0,
      currentGapElapsedSeconds: 0,
      inGap: false,
      columns: result.updatedColumns,
      warnings: result.warnings,
    });
  },

  tick: (deltaSeconds: number) => {
    const state = get();
    if (state.status !== 'playing') return;

    const sorted = [...state.columns].sort((a, b) => a.order - b.order);
    const effectiveDelta = deltaSeconds * state.playbackSpeed;
    let newElapsed = state.elapsedSeconds + effectiveDelta;
    let newColIndex = state.currentColumnIndex;
    let newColElapsed = state.currentColumnElapsedSeconds + effectiveDelta;
    let newGapElapsed = state.currentGapElapsedSeconds;
    let newInGap = state.inGap;

    const currentBurnSeconds = sorted[newColIndex].burnMinutes * 60;

    if (!newInGap) {
      if (newColElapsed >= currentBurnSeconds) {
        const overflow = newColElapsed - currentBurnSeconds;
        newColElapsed = currentBurnSeconds;

        if (newColIndex < sorted.length - 1) {
          newInGap = true;
          newGapElapsed = overflow;
          const gapSeconds = state.gapMinutes * 60;
          if (newGapElapsed >= gapSeconds) {
            newColIndex++;
            newColElapsed = newGapElapsed - gapSeconds;
            newGapElapsed = 0;
            newInGap = false;
          }
        } else {
          set({
            status: 'finished',
            elapsedSeconds: newElapsed,
            currentColumnIndex: newColIndex,
            currentColumnElapsedSeconds: currentBurnSeconds,
            currentGapElapsedSeconds: 0,
            inGap: false,
          });
          return;
        }
      }
    } else {
      const gapSeconds = state.gapMinutes * 60;
      newGapElapsed += effectiveDelta;
      if (newGapElapsed >= gapSeconds) {
        const overflow = newGapElapsed - gapSeconds;
        newColIndex++;
        newColElapsed = overflow;
        newGapElapsed = 0;
        newInGap = false;
      }
    }

    set({
      elapsedSeconds: newElapsed,
      currentColumnIndex: newColIndex,
      currentColumnElapsedSeconds: newColElapsed,
      currentGapElapsedSeconds: newGapElapsed,
      inGap: newInGap,
    });
  },

  setPlaybackSpeed: (speed: number) => {
    set({ playbackSpeed: speed });
  },
}));

export function useScheduleTotalSeconds(): number {
  const columns = useScheduleStore((s) => s.columns);
  const gapMinutes = useScheduleStore((s) => s.gapMinutes);
  return calculateTotalSeconds(columns, gapMinutes);
}
