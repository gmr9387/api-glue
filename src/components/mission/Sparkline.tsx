import { Area, AreaChart, ResponsiveContainer, YAxis } from 'recharts';

interface SparklineProps {
  data: number[];
  tone?: 'primary' | 'success' | 'warning' | 'danger' | 'info';
  height?: number;
}

const toneColor: Record<NonNullable<SparklineProps['tone']>, string> = {
  primary: 'hsl(var(--primary))',
  success: 'hsl(var(--success))',
  warning: 'hsl(var(--warning))',
  danger: 'hsl(var(--danger))',
  info: 'hsl(var(--info))',
};

export function Sparkline({ data, tone = 'primary', height = 36 }: SparklineProps) {
  const stroke = toneColor[tone];
  const chartData = data.map((v, i) => ({ i, v }));
  return (
    <div style={{ width: '100%', height }}>
      <ResponsiveContainer>
        <AreaChart data={chartData} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id={`spark-${tone}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={stroke} stopOpacity={0.35} />
              <stop offset="100%" stopColor={stroke} stopOpacity={0} />
            </linearGradient>
          </defs>
          <YAxis hide domain={['dataMin', 'dataMax']} />
          <Area type="monotone" dataKey="v" stroke={stroke} strokeWidth={1.5} fill={`url(#spark-${tone})`} isAnimationActive={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
