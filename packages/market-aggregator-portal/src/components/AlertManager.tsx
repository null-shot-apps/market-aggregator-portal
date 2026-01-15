'use client';

import { useState } from 'react';

export interface Alert {
  id: string;
  message: string;
  type: 'success' | 'warning' | 'error' | 'info';
  timestamp: Date;
}

interface AlertManagerProps {
  alerts: Alert[];
  onCreateAlert?: () => void;
  onDismissAlert?: (id: string) => void;
}

export default function AlertManager({ alerts, onCreateAlert, onDismissAlert }: AlertManagerProps) {
  const [, setShowCreateModal] = useState(false);

  const alertTypeColors = {
    success: 'bg-green-400',
    warning: 'bg-yellow-400',
    error: 'bg-red-400',
    info: 'bg-blue-400',
  };

  return (
    <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl border border-slate-700 overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-700 flex items-center justify-between">
        <h2 className="text-xl font-semibold">Price Alerts</h2>
        <button 
          onClick={() => {
            setShowCreateModal(true);
            onCreateAlert?.();
          }}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm font-medium transition-colors"
        >
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
              <div key={alert.id} className="flex items-center justify-between p-4 bg-slate-700/30 rounded-lg hover:bg-slate-700/50 transition-colors">
                <div className="flex items-center gap-3">
                  <div className={`w-2 h-2 rounded-full ${alertTypeColors[alert.type]}`} />
                  <div>
                    <div className="font-medium">{alert.message}</div>
                    <div className="text-xs text-slate-400 mt-1">
                      {alert.timestamp.toLocaleString()}
                    </div>
                  </div>
                </div>
                <button 
                  onClick={() => onDismissAlert?.(alert.id)}
                  className="text-slate-400 hover:text-white transition-colors"
                >
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
  );
}


