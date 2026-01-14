import { ReactNode } from 'react';

interface KPICardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: ReactNode;
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string;
  color?: 'blue' | 'purple' | 'green' | 'red' | 'yellow';
}

export default function KPICard({
  title,
  value,
  subtitle,
  icon,
  trend,
  trendValue,
  color = 'blue'
}: KPICardProps) {
  const colorClasses = {
    blue: 'border-blue-500 hover:border-blue-400',
    purple: 'border-purple-500 hover:border-purple-400',
    green: 'border-green-500 hover:border-green-400',
    red: 'border-red-500 hover:border-red-400',
    yellow: 'border-yellow-500 hover:border-yellow-400',
  };

  const iconColorClasses = {
    blue: 'text-blue-400',
    purple: 'text-purple-400',
    green: 'text-green-400',
    red: 'text-red-400',
    yellow: 'text-yellow-400',
  };

  const trendColorClasses = {
    up: 'text-green-400',
    down: 'text-red-400',
    neutral: 'text-slate-400',
  };

  return (
    <div className={`bg-slate-800/50 backdrop-blur-sm rounded-xl p-6 border border-slate-700 ${colorClasses[color]} transition-colors`}>
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-medium text-slate-400">{title}</h3>
        {icon && <div className={iconColorClasses[color]}>{icon}</div>}
      </div>
      <div className="text-3xl font-bold mb-1">{value}</div>
      {subtitle && <div className="text-xs text-slate-500">{subtitle}</div>}
      {trend && trendValue && (
        <div className={`text-xs mt-2 ${trendColorClasses[trend]}`}>
          {trend === 'up' ? '↑' : trend === 'down' ? '↓' : '→'} {trendValue}
        </div>
      )}
    </div>
  );
}

