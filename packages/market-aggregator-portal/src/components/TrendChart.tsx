'use client';

interface TrendChartProps {
  data: number[];
  labels?: string[];
  selectedAsset: string;
  availableAssets: string[];
  onAssetChange: (asset: string) => void;
  formatValue?: (value: number) => string;
}

export default function TrendChart({
  data,
  labels,
  selectedAsset,
  availableAssets,
  onAssetChange,
  formatValue = (val) => `$${val.toFixed(2)}`
}: TrendChartProps) {
  const maxValue = Math.max(...data);
  const minValue = Math.min(...data);
  const range = maxValue - minValue;

  return (
    <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl border border-slate-700 overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-700 flex items-center justify-between">
        <h2 className="text-xl font-semibold">Price Trend - {selectedAsset}</h2>
        <div className="flex gap-2">
          {availableAssets.map(asset => (
            <button
              key={asset}
              onClick={() => onAssetChange(asset)}
              className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                selectedAsset === asset 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
              }`}
            >
              {asset}
            </button>
          ))}
        </div>
      </div>
      <div className="p-6">
        <div className="h-64 flex items-end justify-between gap-2">
          {data.map((value, idx) => {
            const height = range === 0 ? 50 : ((value - minValue) / range) * 100;
            const label = labels?.[idx] || `${idx + 1}h`;
            
            return (
              <div key={idx} className="flex-1 flex flex-col items-center gap-2 group">
                <div className="text-xs text-slate-400 font-mono opacity-0 group-hover:opacity-100 transition-opacity">
                  {formatValue(value)}
                </div>
                <div 
                  className="w-full bg-gradient-to-t from-blue-600 to-purple-500 rounded-t-lg transition-all duration-500 hover:from-blue-500 hover:to-purple-400 cursor-pointer relative"
                  style={{ height: `${Math.max(height, 10)}%` }}
                  title={`${label}: ${formatValue(value)}`}
                >
                  {/* Tooltip on hover */}
                  <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-slate-900 px-2 py-1 rounded text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                    {formatValue(value)}
                  </div>
                </div>
                <div className="text-xs text-slate-500">{label}</div>
              </div>
            );
          })}
        </div>
        
        {/* Chart legend */}
        <div className="mt-6 flex items-center justify-between text-xs text-slate-400">
          <div>Min: {formatValue(minValue)}</div>
          <div>Avg: {formatValue(data.reduce((a, b) => a + b, 0) / data.length)}</div>
          <div>Max: {formatValue(maxValue)}</div>
        </div>
      </div>
    </div>
  );
}

