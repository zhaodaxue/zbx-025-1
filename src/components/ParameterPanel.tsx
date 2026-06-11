import React from 'react';
import { useScheduleStore } from '@/store/scheduler';
import { Settings, AlertTriangle, Clock, Flame, AlertCircle } from 'lucide-react';

const CHINESE_NUMERALS = ['一', '二', '三', '四', '五', '六', '七', '八', '九', '十'];

export default function ParameterPanel() {
  const columns = useScheduleStore((s) => s.columns);
  const status = useScheduleStore((s) => s.status);
  const gapMinutes = useScheduleStore((s) => s.gapMinutes);
  const warnings = useScheduleStore((s) => s.warnings);
  const updateBurnTime = useScheduleStore((s) => s.updateBurnTime);
  const updateGapMinutes = useScheduleStore((s) => s.updateGapMinutes);

  const sorted = [...columns].sort((a, b) => a.order - b.order);
  const isDisabled = status === 'playing';
  const totalBurn = sorted.reduce((sum, c) => sum + c.burnMinutes, 0);
  const totalGap = sorted.length > 1 ? (sorted.length - 1) * gapMinutes : 0;
  const totalOccupation = totalBurn + totalGap;
  const gapOutOfRange = gapMinutes < 1 || gapMinutes > 5;

  return (
    <aside
      className="w-[280px] h-screen flex-shrink-0 overflow-y-auto sticky top-0"
      style={{ background: '#FFF8F0', borderLeft: '2px solid #D4A574' }}
    >
      <div className="p-5">
        <div className="flex items-center gap-2 mb-6">
          <Settings size={20} style={{ color: '#3E2723' }} />
          <h2 className="text-lg font-bold" style={{ color: '#3E2723' }}>
            参数设置
          </h2>
        </div>

        <div className="space-y-5 mb-8">
          {sorted.map((col) => (
            <div key={col.id} className="rounded-lg p-3" style={{ background: '#FFF1E6' }}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold" style={{ color: '#3E2723' }}>
                  第{CHINESE_NUMERALS[col.order] || col.order + 1}柱
                </span>
                <span
                  className="text-sm font-bold px-2 py-0.5 rounded"
                  style={{ background: '#D4A574', color: '#FFF8F0' }}
                >
                  {col.burnMinutes}分钟
                </span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs" style={{ color: '#8D6E63' }}>15</span>
                <input
                  type="range"
                  min={15}
                  max={45}
                  step={1}
                  value={col.burnMinutes}
                  disabled={isDisabled}
                  onChange={(e) => updateBurnTime(col.id, Number(e.target.value))}
                  className="flex-1 h-2 rounded-full appearance-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{
                    background: `linear-gradient(to right, #B85C38 0%, #B85C38 ${((col.burnMinutes - 15) / 30) * 100}%, #D4A574 ${((col.burnMinutes - 15) / 30) * 100}%, #D4A574 100%)`,
                  }}
                />
                <span className="text-xs" style={{ color: '#8D6E63' }}>45</span>
              </div>
              {col.isThermalBlocked && (
                <div className="flex items-center gap-1 mt-1.5">
                  <AlertTriangle size={12} style={{ color: '#E65100' }} />
                  <span className="text-xs" style={{ color: '#E65100' }}>热力遮挡</span>
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="mb-8">
          <label className="text-sm font-semibold block mb-2" style={{ color: '#3E2723' }}>
            换柱空档
          </label>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={1}
              max={5}
              value={gapMinutes}
              disabled={isDisabled}
              onChange={(e) => updateGapMinutes(Number(e.target.value))}
              onBlur={(e) => {
                const v = Number(e.target.value);
                if (v < 1) updateGapMinutes(1);
                else if (v > 5) updateGapMinutes(5);
              }}
              className="w-20 px-3 py-1.5 rounded-lg text-sm font-medium text-center outline-none transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                border: gapOutOfRange ? '2px solid #F9A825' : '2px solid #D4A574',
                background: '#FFF1E6',
                color: '#3E2723',
              }}
            />
            <span className="text-sm" style={{ color: '#8D6E63' }}>分钟</span>
            {gapOutOfRange && (
              <AlertCircle size={16} style={{ color: '#F9A825' }} />
            )}
          </div>
        </div>

        <div className="rounded-lg p-4 mb-6" style={{ background: '#FFF1E6' }}>
          <h3 className="text-sm font-bold mb-3 flex items-center gap-1.5" style={{ color: '#3E2723' }}>
            <Clock size={14} style={{ color: '#B85C38' }} />
            排程总览
          </h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span style={{ color: '#8D6E63' }}>总柱数</span>
              <span className="font-semibold" style={{ color: '#3E2723' }}>{sorted.length}柱</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="flex items-center gap-1" style={{ color: '#8D6E63' }}>
                <Flame size={12} style={{ color: '#B85C38' }} />
                总燃时
              </span>
              <span className="font-semibold" style={{ color: '#3E2723' }}>{totalBurn}分钟</span>
            </div>
            <div className="flex justify-between">
              <span style={{ color: '#8D6E63' }}>总空档</span>
              <span className="font-semibold" style={{ color: '#3E2723' }}>{totalGap}分钟</span>
            </div>
            <div className="border-t pt-2 flex justify-between" style={{ borderColor: '#D4A574' }}>
              <span className="font-semibold" style={{ color: '#3E2723' }}>总占用</span>
              <span className="font-bold" style={{ color: '#B85C38' }}>{totalOccupation}分钟</span>
            </div>
            <div className="flex justify-between">
              <span style={{ color: '#8D6E63' }}>警告</span>
              <span
                className="font-semibold"
                style={{ color: warnings.length > 0 ? '#E65100' : '#4CAF50' }}
              >
                {warnings.length}项
              </span>
            </div>
          </div>
        </div>

        {warnings.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-sm font-bold flex items-center gap-1.5" style={{ color: '#3E2723' }}>
              <AlertTriangle size={14} style={{ color: '#E65100' }} />
              警告列表
            </h3>
            {warnings.map((w, i) => (
              <div
                key={i}
                className="rounded-lg px-3 py-2 text-xs flex items-start gap-2"
                style={{
                  background: w.type === 'thermal_block' ? '#FFF3E0' : '#FFFDE7',
                  borderLeft: w.type === 'thermal_block'
                    ? '3px solid #E65100'
                    : '3px solid #F9A825',
                }}
              >
                {w.type === 'thermal_block' ? (
                  <AlertTriangle size={14} className="mt-0.5 flex-shrink-0" style={{ color: '#E65100' }} />
                ) : (
                  <AlertCircle size={14} className="mt-0.5 flex-shrink-0" style={{ color: '#F9A825' }} />
                )}
                <span style={{ color: '#3E2723' }}>{w.message}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </aside>
  );
}
