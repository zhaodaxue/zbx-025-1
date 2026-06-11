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
  MIN_GAP,
  MAX_GAP,
} from './types';

type Store = ScheduleState & ScheduleActions;

function computePlaybackPosition(
  sortedColumns: MoxaColumn[],
  gapMinutes: number,
  elapsedSeconds: number,
): {
  currentColumnIndex: number;
  currentColumnElapsedSeconds: number;
  currentGapElapsedSeconds: number;
  inGap: boolean;
  isFinished: boolean;
} {
  if (sortedColumns.length === 0) {
    return {
      currentColumnIndex: 0,
      currentColumnElapsedSeconds: 0,
      currentGapElapsedSeconds: 0,
      inGap: false,
      isFinished: true,
    };
  }

  let remaining = elapsedSeconds;

  for (let i = 0; i < sortedColumns.length; i++) {
    const burnSeconds = sortedColumns[i].burnMinutes * 60;
    if (remaining < burnSeconds) {
      return {
        currentColumnIndex: i,
        currentColumnElapsedSeconds: remaining,
        currentGapElapsedSeconds: 0,
        inGap: false,
        isFinished: false,
      };
    }
    remaining -= burnSeconds;

    if (i < sortedColumns.length - 1) {
      const gapSeconds = gapMinutes * 60;
      if (remaining < gapSeconds) {
        return {
          currentColumnIndex: i,
          currentColumnElapsedSeconds: burnSeconds,
          currentGapElapsedSeconds: remaining,
          inGap: true,
          isFinished: false,
        };
      }
      remaining -= gapSeconds;
    }
  }

  const lastIndex = sortedColumns.length - 1;
  return {
    currentColumnIndex: lastIndex,
    currentColumnElapsedSeconds: sortedColumns[lastIndex].burnMinutes * 60,
    currentGapElapsedSeconds: 0,
    inGap: false,
    isFinished: true,
  };
}

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

    if (state.status === 'idle') {
      set({ columns: result.updatedColumns, warnings: result.warnings });
    } else {
      const sorted = [...result.updatedColumns].sort((a, b) => a.order - b.order);
      const totalSeconds = calculateTotalSeconds(result.updatedColumns, state.gapMinutes);
      const clampedElapsed = Math.min(state.elapsedSeconds, totalSeconds);
      const pos = computePlaybackPosition(sorted, state.gapMinutes, clampedElapsed);

      set({
        columns: result.updatedColumns,
        warnings: result.warnings,
        currentColumnIndex: pos.currentColumnIndex,
        currentColumnElapsedSeconds: pos.currentColumnElapsedSeconds,
        currentGapElapsedSeconds: pos.currentGapElapsedSeconds,
        inGap: pos.inGap,
        elapsedSeconds: clampedElapsed,
        status: pos.isFinished ? 'finished' : state.status,
      });
    }
  },

  updateBurnTime: (id: string, minutes: number) => {
    const state = get();
    const clamped = Math.max(MIN_BURN, Math.min(MAX_BURN, minutes));
    const newColumns = state.columns.map((c) =>
      c.id === id ? { ...c, burnMinutes: clamped } : c
    );
    const result = recalculateWarnings(newColumns, state.gapMinutes);

    if (state.status === 'idle') {
      set({ columns: result.updatedColumns, warnings: result.warnings });
    } else {
      const sorted = [...result.updatedColumns].sort((a, b) => a.order - b.order);
      const totalSeconds = calculateTotalSeconds(result.updatedColumns, state.gapMinutes);
      const clampedElapsed = Math.min(state.elapsedSeconds, totalSeconds);
      const pos = computePlaybackPosition(sorted, state.gapMinutes, clampedElapsed);

      set({
        columns: result.updatedColumns,
        warnings: result.warnings,
        currentColumnIndex: pos.currentColumnIndex,
        currentColumnElapsedSeconds: pos.currentColumnElapsedSeconds,
        currentGapElapsedSeconds: pos.currentGapElapsedSeconds,
        inGap: pos.inGap,
        elapsedSeconds: clampedElapsed,
        status: pos.isFinished ? 'finished' : state.status,
      });
    }
  },

  updateGapMinutes: (minutes: number) => {
    const state = get();
    const clamped = Math.max(MIN_GAP, Math.min(MAX_GAP, minutes));
    const result = recalculateWarnings(state.columns, clamped);

    if (state.status === 'idle') {
      set({ gapMinutes: clamped, columns: result.updatedColumns, warnings: result.warnings });
    } else {
      const sorted = [...result.updatedColumns].sort((a, b) => a.order - b.order);
      const totalSeconds = calculateTotalSeconds(result.updatedColumns, clamped);
      const clampedElapsed = Math.min(state.elapsedSeconds, totalSeconds);
      const pos = computePlaybackPosition(sorted, clamped, clampedElapsed);

      set({
        gapMinutes: clamped,
        columns: result.updatedColumns,
        warnings: result.warnings,
        currentColumnIndex: pos.currentColumnIndex,
        currentColumnElapsedSeconds: pos.currentColumnElapsedSeconds,
        currentGapElapsedSeconds: pos.currentGapElapsedSeconds,
        inGap: pos.inGap,
        elapsedSeconds: clampedElapsed,
        status: pos.isFinished ? 'finished' : state.status,
      });
    }
  },

  reorderColumns: (fromIndex: number, toIndex: number) => {
    const state = get();
    if (fromIndex === toIndex) return;
    const sorted = [...state.columns].sort((a, b) => a.order - b.order);
    const [moved] = sorted.splice(fromIndex, 1);
    sorted.splice(toIndex, 0, moved);
    const reindexed = sorted.map((c, i) => ({ ...c, order: i }));
    const result = recalculateWarnings(reindexed, state.gapMinutes);

    if (state.status === 'idle') {
      set({ columns: result.updatedColumns, warnings: result.warnings });
    } else {
      const newSorted = [...result.updatedColumns].sort((a, b) => a.order - b.order);
      const totalSeconds = calculateTotalSeconds(result.updatedColumns, state.gapMinutes);
      const clampedElapsed = Math.min(state.elapsedSeconds, totalSeconds);
      const pos = computePlaybackPosition(newSorted, state.gapMinutes, clampedElapsed);

      set({
        columns: result.updatedColumns,
        warnings: result.warnings,
        currentColumnIndex: pos.currentColumnIndex,
        currentColumnElapsedSeconds: pos.currentColumnElapsedSeconds,
        currentGapElapsedSeconds: pos.currentGapElapsedSeconds,
        inGap: pos.inGap,
        elapsedSeconds: clampedElapsed,
        status: pos.isFinished ? 'finished' : state.status,
      });
    }
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
    let remainingDelta = deltaSeconds * state.playbackSpeed;
    let newElapsed = state.elapsedSeconds;
    let newColIndex = state.currentColumnIndex;
    let newColElapsed = state.currentColumnElapsedSeconds;
    let newGapElapsed = state.currentGapElapsedSeconds;
    let newInGap = state.inGap;
    let finished = false;

    while (remainingDelta > 0 && !finished) {
      if (!newInGap) {
        const currentBurnSeconds = sorted[newColIndex].burnMinutes * 60;
        const remainingInColumn = currentBurnSeconds - newColElapsed;

        if (remainingDelta < remainingInColumn) {
          newColElapsed += remainingDelta;
          newElapsed += remainingDelta;
          remainingDelta = 0;
        } else {
          remainingDelta -= remainingInColumn;
          newElapsed += remainingInColumn;
          newColElapsed = currentBurnSeconds;

          if (newColIndex < sorted.length - 1) {
            newInGap = true;
            newGapElapsed = 0;
          } else {
            finished = true;
          }
        }
      } else {
        const gapSeconds = state.gapMinutes * 60;
        const remainingInGap = gapSeconds - newGapElapsed;

        if (remainingDelta < remainingInGap) {
          newGapElapsed += remainingDelta;
          newElapsed += remainingDelta;
          remainingDelta = 0;
        } else {
          remainingDelta -= remainingInGap;
          newElapsed += remainingInGap;
          newGapElapsed = gapSeconds;

          newColIndex++;
          newColElapsed = 0;
          newGapElapsed = 0;
          newInGap = false;
        }
      }
    }

    if (finished) {
      set({
        status: 'finished',
        elapsedSeconds: newElapsed,
        currentColumnIndex: newColIndex,
        currentColumnElapsedSeconds: sorted[newColIndex].burnMinutes * 60,
        currentGapElapsedSeconds: 0,
        inGap: false,
      });
    } else {
      set({
        elapsedSeconds: newElapsed,
        currentColumnIndex: newColIndex,
        currentColumnElapsedSeconds: newColElapsed,
        currentGapElapsedSeconds: newGapElapsed,
        inGap: newInGap,
      });
    }
  },

  setPlaybackSpeed: (speed: number) => {
    set({ playbackSpeed: speed });
  },

  seekTo: (targetElapsedSeconds: number) => {
    const state = get();
    if (state.columns.length === 0) return;
    if (state.status === 'idle') return;

    const sorted = [...state.columns].sort((a, b) => a.order - b.order);
    const totalSeconds = calculateTotalSeconds(state.columns, state.gapMinutes);
    const clampedElapsed = Math.max(0, Math.min(targetElapsedSeconds, totalSeconds));
    const pos = computePlaybackPosition(sorted, state.gapMinutes, clampedElapsed);

    const newStatus = pos.isFinished
      ? 'finished'
      : state.status === 'playing'
        ? 'paused'
        : state.status;

    set({
      elapsedSeconds: clampedElapsed,
      currentColumnIndex: pos.currentColumnIndex,
      currentColumnElapsedSeconds: pos.currentColumnElapsedSeconds,
      currentGapElapsedSeconds: pos.currentGapElapsedSeconds,
      inGap: pos.inGap,
      status: newStatus,
    });
  },
}));

export function useScheduleTotalSeconds(): number {
  const columns = useScheduleStore((s) => s.columns);
  const gapMinutes = useScheduleStore((s) => s.gapMinutes);
  return calculateTotalSeconds(columns, gapMinutes);
}
