import BedCanvas from '@/components/BedCanvas';
import TimelinePlayer from '@/components/TimelinePlayer';
import ParameterPanel from '@/components/ParameterPanel';
import { useScheduleStore } from '@/store/scheduler';

function PrintSummary() {
  const columns = useScheduleStore((s) => s.columns);
  const gapMinutes = useScheduleStore((s) => s.gapMinutes);
  const warnings = useScheduleStore((s) => s.warnings);

  const sorted = [...columns].sort((a, b) => a.order - b.order);
  const totalBurn = sorted.reduce((sum, c) => sum + c.burnMinutes, 0);
  const totalGap = sorted.length > 1 ? (sorted.length - 1) * gapMinutes : 0;
  const totalOccupation = totalBurn + totalGap;

  return (
    <div style={{ padding: '20px', fontFamily: 'serif', color: '#333' }}>
      <h1 style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '12px', textAlign: 'center' }}>
        艾灸排程简表
      </h1>
      <p style={{ fontSize: '12px', marginBottom: '12px', textAlign: 'center', color: '#666' }}>
        生成时间：{new Date().toLocaleString('zh-CN')}
      </p>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
        <thead>
          <tr style={{ background: '#f5f5f5' }}>
            <th style={{ border: '1px solid #ccc', padding: '8px' }}>柱序</th>
            <th style={{ border: '1px solid #ccc', padding: '8px' }}>燃尽时长（分钟）</th>
            <th style={{ border: '1px solid #ccc', padding: '8px' }}>热力遮挡</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((col, i) => (
            <tr key={col.id}>
              <td style={{ border: '1px solid #ccc', padding: '8px', textAlign: 'center' }}>
                第{i + 1}柱
              </td>
              <td style={{ border: '1px solid #ccc', padding: '8px', textAlign: 'center' }}>
                {col.burnMinutes}
              </td>
              <td
                style={{
                  border: '1px solid #ccc',
                  padding: '8px',
                  textAlign: 'center',
                  color: col.isThermalBlocked ? '#E65100' : '#999',
                }}
              >
                {col.isThermalBlocked ? '⚠ 是' : '否'}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr style={{ background: '#f5f5f5', fontWeight: 'bold' }}>
            <td style={{ border: '1px solid #ccc', padding: '8px', textAlign: 'center' }}>合计</td>
            <td style={{ border: '1px solid #ccc', padding: '8px', textAlign: 'center' }}>
              {totalOccupation} 分钟
            </td>
            <td style={{ border: '1px solid #ccc', padding: '8px', textAlign: 'center' }}>
              含空档 {totalGap} 分钟
            </td>
          </tr>
        </tfoot>
      </table>

      {warnings.length > 0 && (
        <div style={{ marginTop: '16px' }}>
          <h3 style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '8px' }}>警告摘要</h3>
          <ul style={{ fontSize: '12px', paddingLeft: '20px' }}>
            {warnings.map((w, i) => (
              <li key={i} style={{ marginBottom: '4px', color: '#E65100' }}>
                {w.message}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export default function Home() {
  return (
    <div className="flex min-h-screen" style={{ background: '#FDF6EC' }}>
      <div className="flex-1 flex flex-col min-w-0 main-content">
        <header
          className="px-6 py-4 flex items-center gap-3 border-b"
          style={{ background: '#FFF8F0', borderColor: '#D4A574' }}
        >
          <div
            className="w-9 h-9 rounded-lg flex items-center justify-center"
            style={{ background: '#B85C38' }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z" />
              <path d="M12 6v6l4 2" />
            </svg>
          </div>
          <div>
            <h1 className="text-lg font-bold" style={{ color: '#3E2723' }}>
              多柱燃尽顺序排程沙盒
            </h1>
            <p className="text-xs" style={{ color: '#8D6E63' }}>
              民族医馆艾灸室 · 排程模拟工具
            </p>
          </div>
        </header>

        <main className="flex-1 p-6 space-y-6 overflow-y-auto">
          <BedCanvas />
          <TimelinePlayer />
        </main>
      </div>

      <ParameterPanel />

      <div className="hidden print:block">
        <PrintSummary />
      </div>
    </div>
  );
}
