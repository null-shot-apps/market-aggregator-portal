/**
 * API Client for Market Aggregator
 * Handles data fetching from multiple sources with caching and error handling
 */

export interface CryptoAsset {
  id: string;
  name: string;
  symbol: string;
  price: number;
  change24h: number;
  volume: number;
  marketCap: number;
  lastUpdated: Date;
}

export interface PriceHistory {
  timestamp: Date;
  price: number;
  volume?: number;
}

export interface ApiResponse<T> {
  data: T;
  success: boolean;
  error?: string;
  cached?: boolean;
  timestamp: Date;
}

class MarketAggregatorAPI {
  private baseUrl: string;
  private cache: Map<string, { data: unknown; expiry: number }>;
  private cacheTTL: number = 5 * 60 * 1000; // 5 minutes

  constructor(baseUrl: string = '/api') {
    this.baseUrl = baseUrl;
    this.cache = new Map();
  }

  /**
   * Generic fetch with caching and error handling
   */
  private async fetchWithCache<T>(
    endpoint: string,
    options?: RequestInit,
    skipCache = false
  ): Promise<ApiResponse<T>> {
    const cacheKey = `${endpoint}:${JSON.stringify(options)}`;
    
    // Check cache first
    if (!skipCache) {
      const cached = this.cache.get(cacheKey);
      if (cached && cached.expiry > Date.now()) {
        return {
          data: cached.data as T,
          success: true,
          cached: true,
          timestamp: new Date(),
        };
      }
    }

    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...options?.headers,
        },
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json() as T;

      // Cache successful response
      this.cache.set(cacheKey, {
        data,
        expiry: Date.now() + this.cacheTTL,
      });

      return {
        data,
        success: true,
        cached: false,
        timestamp: new Date(),
      };
    } catch (error) {
      return {
        data: null as T,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date(),
      };
    }
  }

  /**
   * Fetch all tracked assets
   */
  async getAssets(): Promise<ApiResponse<CryptoAsset[]>> {
    return this.fetchWithCache<CryptoAsset[]>('/assets');
  }

  /**
   * Fetch single asset details
   */
  async getAsset(id: string): Promise<ApiResponse<CryptoAsset>> {
    return this.fetchWithCache<CryptoAsset>(`/assets/${id}`);
  }

  /**
   * Fetch price history for an asset
   */
  async getPriceHistory(
    id: string,
    interval: '1h' | '1d' | '1w' | '1m' = '1h'
  ): Promise<ApiResponse<PriceHistory[]>> {
    return this.fetchWithCache<PriceHistory[]>(
      `/assets/${id}/history?interval=${interval}`
    );
  }

  /**
   * Create a price alert
   */
  async createAlert(alert: {
    assetId: string;
    type: 'price_above' | 'price_below' | 'change_percent';
    threshold: number;
  }): Promise<ApiResponse<{ id: string }>> {
    return this.fetchWithCache<{ id: string }>(
      '/alerts',
      {
        method: 'POST',
        body: JSON.stringify(alert),
      },
      true // Skip cache for mutations
    );
  }

  /**
   * Get user's alerts
   */
  async getAlerts(): Promise<ApiResponse<Array<{
    id: string;
    assetId: string;
    type: string;
    threshold: number;
    isActive: boolean;
  }>>> {
    return this.fetchWithCache('/alerts');
  }

  /**
   * Delete an alert
   */
  async deleteAlert(id: string): Promise<ApiResponse<void>> {
    return this.fetchWithCache<void>(
      `/alerts/${id}`,
      { method: 'DELETE' },
      true
    );
  }

  /**
   * Clear cache (useful for force refresh)
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Set custom cache TTL
   */
  setCacheTTL(milliseconds: number): void {
    this.cacheTTL = milliseconds;
  }
}

// Export singleton instance
export const apiClient = new MarketAggregatorAPI();

/**
 * React hook for fetching data with automatic refetch
 */
export function useMarketData<T>(
  fetcher: () => Promise<ApiResponse<T>>,
  interval: number = 5000
) {
  const [data, setData] = React.useState<T | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let mounted = true;

    const fetchData = async () => {
      const response = await fetcher();
      if (mounted) {
        if (response.success) {
          setData(response.data);
          setError(null);
        } else {
          setError(response.error || 'Failed to fetch data');
        }
        setLoading(false);
      }
    };

    fetchData();
    const intervalId = setInterval(fetchData, interval);

    return () => {
      mounted = false;
      clearInterval(intervalId);
    };
  }, [fetcher, interval]);

  return { data, loading, error };
}

// Import React for the hook
import React from 'react';



