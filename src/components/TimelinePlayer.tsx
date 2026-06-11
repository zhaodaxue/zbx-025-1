import React, { useEffect, useRef, useCallback, useState } from 'react';
import { useScheduleStore, useScheduleTotalSeconds } from '@/store/scheduler';
import { Play, Pause, RotateCcw, FastForward, Printer } from 'lucide-react';
import type { Warning } from '@/store/types';

const COLUMN_COLORS = ['#E8B960', '#D4943C', '#C06A2E', '#A8522D'];

function formatTime(seconds: number): string {
  const clamped = Math.max(0, seconds);
  const m = Math.floor(clamped / 60);
  const s = Math.floor(clamped % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function getStatusLabel(status: string): string {
  switch (status) {
    case 'playing':
      return '施灸中';
    case 'paused':
      return '暂停';
    case 'finished':
      return '已完成';
    default:
      return '就绪';
  }
}

export default function TimelinePlayer() {
  const status = useScheduleStore((s) => s.status);
  const columns = useScheduleStore((s) => s.columns);
  const gapMinutes = useScheduleStore((s) => s.gapMinutes);
  const currentColumnIndex = useScheduleStore((s) => s.currentColumnIndex);
  const elapsedSeconds = useScheduleStore((s) => s.elapsedSeconds);
  const inGap = useScheduleStore((s) => s.inGap);
  const playbackSpeed = useScheduleStore((s) => s.playbackSpeed);
  const warnings = useScheduleStore((s) => s.warnings);
  const startPlaying = useScheduleStore((s) => s.startPlaying);
  const pausePlaying = useScheduleStore((s) => s.pausePlaying);
  const resumePlaying = useScheduleStore((s) => s.resumePlaying);
  const reset = useScheduleStore((s) => s.reset);
  const setPlaybackSpeed = useScheduleStore((s) => s.setPlaybackSpeed);
  const seekTo = useScheduleStore((s) => s.seekTo);

  const totalSeconds = useScheduleTotalSeconds();
  const rafRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);
  const timelineRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const canSeek = status === 'paused' || status === 'finished' || status === 'playing';

  const animate = useCallback(
    (timestamp: number) => {
      if (lastTimeRef.current === 0) {
        lastTimeRef.current = timestamp;
      }
      const delta = (timestamp - lastTimeRef.current) / 1000;
      lastTimeRef.current = timestamp;
      useScheduleStore.getState().tick(delta);
      if (useScheduleStore.getState().status === 'playing') {
        rafRef.current = requestAnimationFrame(animate);
      }
    },
    [],
  );

  useEffect(() => {
    if (status === 'playing') {
      lastTimeRef.current = 0;
      rafRef.current = requestAnimationFrame(animate);
    }
    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = 0;
      }
    };
  }, [status, animate]);

  const sorted = [...columns].sort((a, b) => a.order - b.order);
  const remainingSeconds = Math.max(0, totalSeconds - elapsedSeconds);
  const progressPercent =
    totalSeconds > 0 ? Math.min((elapsedSeconds / totalSeconds) * 100, 100) : 0;

  const segments: Array<{
    type: 'column' | 'gap';
    columnIndex: number;
    left: number;
    width: number;
  }> = [];

  let offset = 0;
  sorted.forEach((col, i) => {
    const width = totalSeconds > 0 ? (col.burnMinutes * 60 / totalSeconds) * 100 : 0;
    segments.push({ type: 'column', columnIndex: i, left: offset, width });
    offset += width;
    if (i < sorted.length - 1 && gapMinutes > 0) {
      const gapWidth = totalSeconds > 0 ? (gapMinutes * 60 / totalSeconds) * 100 : 0;
      segments.push({ type: 'gap', columnIndex: i, left: offset, width: gapWidth });
      offset += gapWidth;
    }
  });

  const currentLabel =
    status === 'idle'
      ? '-'
      : status === 'finished'
        ? '已完成'
        : inGap
          ? '换柱空档'
          : `第${currentColumnIndex + 1}柱`;

  const speeds = [1, 2, 4];

  const calculateElapsedFromEvent = useCallback(
    (clientX: number): number => {
      if (!timelineRef.current || totalSeconds === 0) return 0;
      const rect = timelineRef.current.getBoundingClientRect();
      const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      return ratio * totalSeconds;
    },
    [totalSeconds],
  );

  const handleTimelineMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (!canSeek) return;
      e.preventDefault();
      setIsDragging(true);
      seekTo(calculateElapsedFromEvent(e.clientX));
    },
    [canSeek, calculateElapsedFromEvent, seekTo],
  );

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      seekTo(calculateElapsedFromEvent(e.clientX));
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, calculateElapsedFromEvent, seekTo]);

  return (
    <div className="w-full space-y-5 p-5 rounded-xl" style={{ background: '#2C1810' }}>
      <style>{`
        @keyframes pulse-glow {
          0%, 100% { box-shadow: 0 0 8px 2px rgba(244, 208, 63, 0.45); }
          50% { box-shadow: 0 0 20px 6px rgba(244, 208, 63, 0.85); }
        }
        .column-glow {
          animation: pulse-glow 1.5s ease-in-out infinite;
        }
      `}</style>

      <div className="space-y-1">
        <div className="relative h-11">
          {segments
            .filter((s) => s.type === 'column')
            .map((seg) => (
              <div
                key={`label-${seg.columnIndex}`}
                className="absolute text-center text-xs overflow-hidden"
                style={{
                  left: `${seg.left}%`,
                  width: `${seg.width}%`,
                  color: '#D4A76A',
                }}
              >
                <div className="font-semibold truncate">第{seg.columnIndex + 1}柱</div>
                <div className="truncate">{sorted[seg.columnIndex].burnMinutes}分</div>
              </div>
            ))}
        </div>

        <div
          ref={timelineRef}
          className={`relative ${canSeek ? 'cursor-pointer' : 'cursor-default'}`}
          onMouseDown={handleTimelineMouseDown}
        >
          <div
            className="relative h-10 rounded-lg overflow-hidden"
            style={{ background: '#3E2723' }}
          >
            {segments.map((seg, i) => {
              if (seg.type === 'column') {
                const isCurrent =
                  status !== 'idle' &&
                  status !== 'finished' &&
                  !inGap &&
                  currentColumnIndex === seg.columnIndex;
                return (
                  <div
                    key={`col-${seg.columnIndex}`}
                    className={`absolute top-0 h-full ${isCurrent ? 'column-glow' : ''}`}
                    style={{
                      left: `${seg.left}%`,
                      width: `${seg.width}%`,
                      background: COLUMN_COLORS[seg.columnIndex % COLUMN_COLORS.length],
                    }}
                  />
                );
              }
              return (
                <div
                  key={`gap-${i}`}
                  className="absolute top-0 h-full"
                  style={{
                    left: `${seg.left}%`,
                    width: `${seg.width}%`,
                    backgroundImage:
                      'repeating-linear-gradient(90deg, #8B7355 0px, #8B7355 6px, transparent 6px, transparent 12px)',
                  }}
                />
              );
            })}
          </div>

          {status !== 'idle' && (
            <div
              className={`absolute top-0 h-10 z-10 ${isDragging || canSeek ? 'cursor-grab active:cursor-grabbing' : 'pointer-events-none'}`}
              style={{
                left: `${progressPercent}%`,
                width: '6px',
                background: '#F4D03F',
                boxShadow: isDragging
                  ? '0 0 16px 4px rgba(244, 208, 63, 0.9)'
                  : '0 0 8px 2px rgba(244, 208, 63, 0.7)',
                transform: 'translateX(-3px)',
                borderRadius: '3px',
              }}
            >
              <div
                className="absolute -top-1 left-1/2 -translate-x-1/2 w-3 h-3 rounded-full"
                style={{ background: '#F4D03F', boxShadow: '0 0 6px rgba(244, 208, 63, 0.8)' }}
              />
              <div
                className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-3 h-3 rounded-full"
                style={{ background: '#F4D03F', boxShadow: '0 0 6px rgba(244, 208, 63, 0.8)' }}
              />
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-sm" style={{ color: '#D4A76A' }}>
        <div>
          已用时间:{' '}
          <span className="font-mono text-white">{formatTime(elapsedSeconds)}</span>
        </div>
        <div>
          剩余时间:{' '}
          <span className="font-mono text-white">{formatTime(remainingSeconds)}</span>
        </div>
        <div>
          当前状态:{' '}
          <span style={{ color: '#F4D03F' }}>{getStatusLabel(status)}</span>
        </div>
        <div>
          当前:{' '}
          <span style={{ color: '#F4D03F' }}>{currentLabel}</span>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        {status === 'idle' && (
          <button
            onClick={startPlaying}
            disabled={sorted.length === 0}
            className="flex items-center gap-1.5 px-5 py-2 rounded-full text-white font-medium transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ background: '#B85C38' }}
          >
            <Play size={16} />
            开始施灸
          </button>
        )}

        {status === 'playing' && (
          <button
            onClick={pausePlaying}
            className="flex items-center gap-1.5 px-5 py-2 rounded-full font-medium transition-colors"
            style={{ color: '#5C8A4D', border: '2px solid #5C8A4D', background: 'transparent' }}
          >
            <Pause size={16} />
            暂停
          </button>
        )}

        {status === 'paused' && (
          <button
            onClick={resumePlaying}
            className="flex items-center gap-1.5 px-5 py-2 rounded-full text-white font-medium transition-colors"
            style={{ background: '#5C8A4D' }}
          >
            <Play size={16} />
            继续
          </button>
        )}

        {status === 'finished' && (
          <button
            onClick={startPlaying}
            disabled={sorted.length === 0}
            className="flex items-center gap-1.5 px-5 py-2 rounded-full text-white font-medium transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ background: '#B85C38' }}
          >
            <Play size={16} />
            重新开始
          </button>
        )}

        {status !== 'idle' && (
          <button
            onClick={reset}
            className="flex items-center gap-1.5 px-4 py-2 rounded-full font-medium text-gray-400 transition-colors"
            style={{ border: '2px solid #6B7280', background: 'transparent' }}
          >
            <RotateCcw size={16} />
            重置
          </button>
        )}

        <div className="flex items-center gap-1.5 ml-2">
          <FastForward size={14} style={{ color: '#8B7355' }} />
          {speeds.map((spd) => (
            <button
              key={spd}
              onClick={() => setPlaybackSpeed(spd)}
              className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                playbackSpeed === spd
                  ? 'text-[#2C1810]'
                  : 'border'
              }`}
              style={
                playbackSpeed === spd
                  ? { background: '#D4A76A' }
                  : { color: '#8B7355', borderColor: '#8B7355', background: 'transparent' }
              }
            >
              {spd}x
            </button>
          ))}
        </div>

        <button
          onClick={() => window.print()}
          className="flex items-center gap-1.5 px-4 py-2 rounded-full text-sm ml-auto transition-colors"
          style={{ color: '#8B7355', border: '1px solid #8B7355', background: 'transparent' }}
        >
          <Printer size={14} />
          导出简表
        </button>
      </div>

      {warnings.length > 0 && (
        <div className="space-y-1">
          {warnings.map((w: Warning, i: number) => (
            <div key={i} className="text-xs" style={{ color: '#F0AD4E' }}>
              ⚠ {w.message}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
