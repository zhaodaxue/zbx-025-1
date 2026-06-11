import React, { useState, useRef } from 'react';
import { useScheduleStore } from '@/store/scheduler';
import { Plus, X, GripVertical, Flame, AlertTriangle } from 'lucide-react';

function burnMinutesToHeight(minutes: number): number {
  const MIN_H = 60;
  const MAX_H = 200;
  const MIN_M = 15;
  const MAX_M = 45;
  const clamped = Math.max(MIN_M, Math.min(MAX_M, minutes));
  return MIN_H + ((clamped - MIN_M) / (MAX_M - MIN_M)) * (MAX_H - MIN_H);
}

interface ColumnCardProps {
  column: {
    id: string;
    order: number;
    burnMinutes: number;
    isThermalBlocked: boolean;
    isGapWarning: boolean;
  };
  index: number;
  isPlaying: boolean;
  isCurrentColumn: boolean;
  inGap: boolean;
  isSelected: boolean;
  onSelect: (id: string) => void;
  onRemove: (id: string) => void;
  onDragStart: (e: React.DragEvent, index: number) => void;
  onDragOver: (e: React.DragEvent, index: number) => void;
  onDragEnd: () => void;
}

function ColumnCard({
  column,
  index,
  isPlaying,
  isCurrentColumn,
  inGap,
  isSelected,
  onSelect,
  onRemove,
  onDragStart,
  onDragOver,
  onDragEnd,
}: ColumnCardProps) {
  const height = burnMinutesToHeight(column.burnMinutes);
  const canDrag = !isPlaying;

  return (
    <div
      draggable={canDrag}
      onDragStart={(e) => onDragStart(e, index)}
      onDragOver={(e) => onDragOver(e, index)}
      onDragEnd={onDragEnd}
      onClick={() => onSelect(column.id)}
      className={`
        relative flex flex-col items-center cursor-pointer select-none
        transition-all duration-300 ease-in-out
        ${isSelected ? 'scale-105' : 'hover:scale-[1.02]'}
        ${canDrag ? 'cursor-grab active:cursor-grabbing' : 'cursor-default'}
      `}
    >
      <div className="relative flex items-start gap-1 mb-1">
        {canDrag && (
          <GripVertical className="w-3.5 h-3.5 text-amber-700/40 mt-0.5" />
        )}
        <span className="text-xs font-bold text-amber-800">
          {column.order + 1}
        </span>
      </div>

      <div
        className={`
          relative rounded-t-md rounded-b-sm w-14 transition-all duration-300
          ${isSelected ? 'ring-2 ring-amber-500 ring-offset-2 ring-offset-[#FFF8F0]' : ''}
          ${isCurrentColumn && !inGap ? 'ring-2 ring-orange-500 ring-offset-2 ring-offset-[#FFF8F0]' : ''}
        `}
        style={{ height: `${height}px` }}
      >
        <div
          className={`
            absolute inset-0 rounded-t-md rounded-b-sm
            bg-gradient-to-b from-[#B85C38] to-[#D4885A]
            transition-shadow duration-300
            ${isCurrentColumn && !inGap ? 'shadow-[0_0_20px_4px_rgba(255,120,30,0.5)]' : ''}
          `}
        />

        {isCurrentColumn && !inGap && (
          <div
            className="absolute -top-1 left-1/2 -translate-x-1/2 w-6 h-6 rounded-full animate-pulse"
            style={{
              background:
                'radial-gradient(circle, rgba(255,180,50,0.9) 0%, rgba(255,100,20,0.6) 40%, transparent 70%)',
            }}
          />
        )}

        {isCurrentColumn && !inGap && (
          <Flame className="absolute top-1 left-1/2 -translate-x-1/2 w-4 h-4 text-yellow-300 animate-pulse drop-shadow-[0_0_4px_rgba(255,200,0,0.8)]" />
        )}

        <div className="absolute bottom-1.5 left-0 right-0 text-center">
          <span className="text-[10px] font-semibold text-white/90 drop-shadow-sm">
            {column.burnMinutes}分钟
          </span>
        </div>
      </div>

      {column.isThermalBlocked && (
        <div className="absolute -top-2 -right-3 z-10">
          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-bold text-white bg-[#E67E22] shadow-sm whitespace-nowrap">
            <AlertTriangle className="w-2.5 h-2.5" />
            热力遮挡
          </span>
        </div>
      )}

      {column.isGapWarning && !column.isThermalBlocked && (
        <div className="absolute -top-2 -right-3 z-10">
          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-bold text-gray-800 bg-[#F1C40F] shadow-sm whitespace-nowrap">
            <AlertTriangle className="w-2.5 h-2.5" />
            空档异常
          </span>
        </div>
      )}

      {!isPlaying && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemove(column.id);
          }}
          className="absolute -top-1.5 -left-1.5 z-10 w-4 h-4 rounded-full bg-red-400 hover:bg-red-500 text-white flex items-center justify-center shadow-sm transition-colors"
        >
          <X className="w-2.5 h-2.5" />
        </button>
      )}
    </div>
  );
}

export default function BedCanvas() {
  const columns = useScheduleStore((s) => s.columns);
  const status = useScheduleStore((s) => s.status);
  const currentColumnIndex = useScheduleStore((s) => s.currentColumnIndex);
  const inGap = useScheduleStore((s) => s.inGap);
  const gapMinutes = useScheduleStore((s) => s.gapMinutes);
  const addColumn = useScheduleStore((s) => s.addColumn);
  const removeColumn = useScheduleStore((s) => s.removeColumn);
  const reorderColumns = useScheduleStore((s) => s.reorderColumns);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dragFromIndex, setDragFromIndex] = useState<number | null>(null);
  const [dropTargetIndex, setDropTargetIndex] = useState<number | null>(null);
  const bedRef = useRef<HTMLDivElement>(null);

  const sorted = [...columns].sort((a, b) => a.order - b.order);
  const isPlaying = status === 'playing';
  const canAdd = sorted.length < 4;

  const handleDragStart = (e: React.DragEvent, index: number) => {
    if (isPlaying) return;
    setDragFromIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(index));
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = '0.4';
    }
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDropTargetIndex(index);
  };

  const handleDragEnd = () => {
    if (dragFromIndex !== null && dropTargetIndex !== null && dragFromIndex !== dropTargetIndex) {
      reorderColumns(dragFromIndex, dropTargetIndex);
    }
    setDragFromIndex(null);
    setDropTargetIndex(null);
  };

  const handleBedDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleBedDragLeave = (e: React.DragEvent) => {
    if (bedRef.current && !bedRef.current.contains(e.relatedTarget as Node)) {
      setDropTargetIndex(null);
    }
  };

  return (
    <div className="w-full max-w-[1100px] mx-auto px-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-amber-900 tracking-wide">
          艾灸排床
        </h2>
        <span className="text-xs text-amber-700/60">
          {sorted.length}/4 柱 · {status === 'idle' ? '就绪' : status === 'playing' ? '燃烧中' : status === 'paused' ? '已暂停' : '已完成'}
        </span>
      </div>

      <div
        ref={bedRef}
        onDragOver={handleBedDragOver}
        onDragLeave={handleBedDragLeave}
        className="relative rounded-xl border-2 border-[#D4A574] bg-[#FFF8F0] px-8 py-10 min-h-[280px] flex items-end justify-center gap-2 shadow-[inset_0_2px_8px_rgba(212,165,116,0.15)]"
        style={{
          backgroundImage:
            'repeating-linear-gradient(90deg, transparent, transparent 49.5%, rgba(212,165,116,0.08) 49.5%, rgba(212,165,116,0.08) 50.5%, transparent 50.5%)',
        }}
      >
        {sorted.map((col, index) => (
          <React.Fragment key={col.id}>
            {index > 0 && (
              <div className="flex flex-col items-center justify-end pb-2 self-end min-w-[40px]">
                <div className={`w-8 border-t border-dashed mb-1 ${col.isGapWarning ? 'border-[#F1C40F]' : 'border-[#D4A574]/50'}`} />
                <span className={`text-[9px] font-medium whitespace-nowrap ${col.isGapWarning ? 'text-[#F1C40F]' : 'text-amber-700/50'}`}>
                  {dropTargetIndex !== null && dragFromIndex !== null && (
                    (index === dropTargetIndex || index === dragFromIndex)
                  )
                    ? '→'
                    : `${gapMinutes}分钟`}
                </span>
              </div>
            )}

            {dropTargetIndex === index && dragFromIndex !== null && dragFromIndex !== index && (
              <div
                className={`
                  self-end mb-2 w-1 rounded-full bg-amber-400/70
                  transition-all duration-200
                  ${dragFromIndex < dropTargetIndex ? 'order-last' : 'order-first'}
                `}
                style={{ height: `${burnMinutesToHeight(sorted[Math.max(0, dragFromIndex)]?.burnMinutes ?? 30)}px` }}
              />
            )}

            <ColumnCard
              column={col}
              index={index}
              isPlaying={isPlaying}
              isCurrentColumn={status !== 'idle' && status !== 'finished' && currentColumnIndex === index}
              inGap={inGap}
              isSelected={selectedId === col.id}
              onSelect={setSelectedId}
              onRemove={removeColumn}
              onDragStart={handleDragStart}
              onDragOver={handleDragOver}
              onDragEnd={handleDragEnd}
            />
          </React.Fragment>
        ))}

        {canAdd && (
          <button
            onClick={() => addColumn()}
            disabled={isPlaying}
            className={`
              self-end mb-2 ml-3 w-14 h-14 rounded-lg border-2 border-dashed border-[#D4A574]/50
              flex flex-col items-center justify-center gap-0.5
              text-[#D4A574]/60 hover:text-[#D4A574] hover:border-[#D4A574]/80 hover:bg-[#D4A574]/5
              transition-all duration-200
              ${isPlaying ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}
            `}
          >
            <Plus className="w-5 h-5" />
            <span className="text-[9px] font-medium">添加柱</span>
          </button>
        )}
      </div>
    </div>
  );
}
