'use client';

import { useEffect, useState } from 'react';

// Mock data - in production, this would come from APIs
const MOCK_CRYPTO_DATA = [
  { id: 'BTC', name: 'Bitcoin', symbol: 'BTC', price: 43250.50, change24h: 2.34, volume: 28500000000, marketCap: 845000000000 },
  { id: 'ETH', name: 'Ethereum', symbol: 'ETH', price: 2280.75, change24h: -1.23, volume: 15200000000, marketCap: 274000000000 },
  { id: 'BNB', name: 'Binance Coin', symbol: 'BNB', price: 315.20, change24h: 0.87, volume: 1200000000, marketCap: 48500000000 },
  { id: 'SOL', name: 'Solana', symbol: 'SOL', price: 98.45, change24h: 5.67, volume: 2100000000, marketCap: 42000000000 },
  { id: 'ADA', name: 'Cardano', symbol: 'ADA', price: 0.52, change24h: -2.15, volume: 450000000, marketCap: 18200000000 },
];

const MOCK_PRICE_HISTORY = {
  BTC: [42100, 42350, 42800, 43100, 42900, 43250],
  ETH: [2310, 2295, 2285, 2270, 2275, 2280],
  BNB: [312, 313, 314, 315, 314, 315],
  SOL: [93, 95, 96, 97, 98, 98],
  ADA: [0.53, 0.53, 0.52, 0.52, 0.52, 0.52],
};

export default function Dashboard() {
  const [cryptoData, setCryptoData] = useState(MOCK_CRYPTO_DATA);
  const [selectedAsset, setSelectedAsset] = useState('BTC');
  const [alerts] = useState<Array<{id: string, message: string, type: string}>>([]);
  const [lastUpdate, setLastUpdate] = useState(new Date());

  // Simulate real-time data updates
  useEffect(() => {
    const interval = setInterval(() => {
      setCryptoData(prev => prev.map(coin => ({
        ...coin,
        price: coin.price * (1 + (Math.random() - 0.5) * 0.02),
        change24h: coin.change24h + (Math.random() - 0.5) * 0.5,
      })));
      setLastUpdate(new Date());
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  // Calculate KPIs
  const avgPrice = cryptoData.reduce((sum, coin) => sum + coin.price, 0) / cryptoData.length;
  const marketVolatility = Math.abs(cryptoData.reduce((sum, coin) => sum + coin.change24h, 0) / cryptoData.length);
  const topGainer = cryptoData.reduce((max, coin) => coin.change24h > max.change24h ? coin : max);

  const formatPrice = (price: number) => {
    return price < 1 ? `${price.toFixed(4)}` : `${price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatLargeNumber = (num: number) => {
    if (num >= 1e9) return `${(num / 1e9).toFixed(2)}B`;
    if (num >= 1e6) return `${(num / 1e6).toFixed(2)}M`;
    return `${num.toLocaleString()}`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white">
      {/* Header */}
      <header className="border-b border-slate-700 bg-slate-900/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
                Market Aggregator
              </h1>
              <p className="text-sm text-slate-400 mt-1">Real-time Crypto Market Dashboard</p>
            </div>
            <div className="text-right">
              <div className="text-xs text-slate-400">Last Updated</div>
              <div className="text-sm font-mono text-green-400">{lastUpdate.toLocaleTimeString()}</div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-6 border border-slate-700 hover:border-blue-500 transition-colors">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-slate-400">Average Price</h3>
              <svg className="w-5 h-5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
              </svg>
            </div>
            <div className="text-3xl font-bold">{formatPrice(avgPrice)}</div>
            <div className="text-xs text-slate-500 mt-2">Across top 5 assets</div>
          </div>

          <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-6 border border-slate-700 hover:border-purple-500 transition-colors">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-slate-400">Market Volatility</h3>
              <svg className="w-5 h-5 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
            </div>
            <div className="text-3xl font-bold">{marketVolatility.toFixed(2)}%</div>
            <div className="text-xs text-slate-500 mt-2">24h average change</div>
          </div>

          <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-6 border border-slate-700 hover:border-green-500 transition-colors">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-slate-400">Top Gainer</h3>
              <svg className="w-5 h-5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
              </svg>
            </div>
            <div className="text-3xl font-bold">{topGainer.symbol}</div>
            <div className="text-xs text-green-400 mt-2">+{topGainer.change24h.toFixed(2)}% (24h)</div>
          </div>
        </div>

        {/* Comparison Table */}
        <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl border border-slate-700 mb-8 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-700">
            <h2 className="text-xl font-semibold">Asset Comparison</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-900/50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Asset</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-slate-400 uppercase tracking-wider">Price</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-slate-400 uppercase tracking-wider">24h Change</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-slate-400 uppercase tracking-wider">Volume</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-slate-400 uppercase tracking-wider">Market Cap</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-slate-400 uppercase tracking-wider">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700">
                {cryptoData.map((coin) => (
                  <tr key={coin.id} className="hover:bg-slate-700/30 transition-colors cursor-pointer" onClick={() => setSelectedAsset(coin.id)}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-xs font-bold mr-3">
                          {coin.symbol.substring(0, 2)}
                        </div>
                        <div>
                          <div className="font-medium">{coin.name}</div>
                          <div className="text-xs text-slate-400">{coin.symbol}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right font-mono">{formatPrice(coin.price)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        coin.change24h >= 0 ? 'bg-green-900/50 text-green-400' : 'bg-red-900/50 text-red-400'
                      }`}>
                        {coin.change24h >= 0 ? '↑' : '↓'} {Math.abs(coin.change24h).toFixed(2)}%
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right font-mono text-sm">{formatLargeNumber(coin.volume)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-right font-mono text-sm">{formatLargeNumber(coin.marketCap)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <button className="text-blue-400 hover:text-blue-300 text-sm font-medium">
                        View Chart
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Trend Chart */}
        <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl border border-slate-700 mb-8 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-700 flex items-center justify-between">
            <h2 className="text-xl font-semibold">Price Trend - {selectedAsset}</h2>
            <div className="flex gap-2">
              {Object.keys(MOCK_PRICE_HISTORY).map(asset => (
                <button
                  key={asset}
                  onClick={() => setSelectedAsset(asset)}
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
              {MOCK_PRICE_HISTORY[selectedAsset as keyof typeof MOCK_PRICE_HISTORY].map((price, idx) => {
                const maxPrice = Math.max(...MOCK_PRICE_HISTORY[selectedAsset as keyof typeof MOCK_PRICE_HISTORY]);
                const minPrice = Math.min(...MOCK_PRICE_HISTORY[selectedAsset as keyof typeof MOCK_PRICE_HISTORY]);
                const height = ((price - minPrice) / (maxPrice - minPrice)) * 100;
                
                return (
                  <div key={idx} className="flex-1 flex flex-col items-center gap-2">
                    <div className="text-xs text-slate-400 font-mono">{formatPrice(price)}</div>
                    <div 
                      className="w-full bg-gradient-to-t from-blue-600 to-purple-500 rounded-t-lg transition-all duration-500 hover:from-blue-500 hover:to-purple-400"
                      style={{ height: `${Math.max(height, 10)}%` }}
                    />
                    <div className="text-xs text-slate-500">{idx + 1}h</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Alerts Section */}
        <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl border border-slate-700 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-700 flex items-center justify-between">
            <h2 className="text-xl font-semibold">Price Alerts</h2>
            <button className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm font-medium transition-colors">
              + Create Alert
            </button>
          </div>
          <div className="p-6">
            {alerts.length === 0 ? (
              <div className="text-center py-8">
                <svg className="w-12 h-12 text-slate-600 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
                <p className="text-slate-400">No active alerts</p>
                <p className="text-sm text-slate-500 mt-1">Create an alert to get notified when prices change</p>
              </div>
            ) : (
              <div className="space-y-3">
                {alerts.map(alert => (
                  <div key={alert.id} className="flex items-center justify-between p-4 bg-slate-700/30 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className={`w-2 h-2 rounded-full ${alert.type === 'success' ? 'bg-green-400' : 'bg-yellow-400'}`} />
                      <span>{alert.message}</span>
                    </div>
                    <button className="text-slate-400 hover:text-white">
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}


