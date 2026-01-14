/**
 * Data Aggregation Service
 * Handles fetching and normalizing data from multiple sources
 */

export interface DataSource {
  name: string;
  type: 'crypto' | 'ecommerce' | 'realestate';
  fetchData: () => Promise<RawAssetData[]>;
  rateLimit: number; // requests per minute
}

export interface RawAssetData {
  source: string;
  externalId: string;
  name: string;
  symbol?: string;
  price: number;
  currency: string;
  volume?: number;
  marketCap?: number;
  metadata?: Record<string, unknown>;
}

export interface NormalizedAsset {
  id: string;
  name: string;
  symbol: string;
  price: number; // Always in USD
  change24h: number;
  volume: number;
  marketCap: number;
  sources: string[];
  lastUpdated: Date;
}

/**
 * Product matching algorithm using fuzzy string matching
 */
export class ProductMatcher {
  /**
   * Calculate Levenshtein distance between two strings
   */
  private levenshteinDistance(str1: string, str2: string): number {
    const matrix: number[][] = [];

    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }

    return matrix[str2.length][str1.length];
  }

  /**
   * Normalize text for comparison
   */
  private normalizeText(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '')
      .trim();
  }

  /**
   * Calculate similarity score between two product names (0-100)
   */
  calculateSimilarity(name1: string, name2: string): number {
    const norm1 = this.normalizeText(name1);
    const norm2 = this.normalizeText(name2);

    // Exact match
    if (norm1 === norm2) return 100;

    // Calculate Levenshtein distance
    const distance = this.levenshteinDistance(norm1, norm2);
    const maxLength = Math.max(norm1.length, norm2.length);
    
    if (maxLength === 0) return 0;

    // Convert distance to similarity percentage
    const similarity = ((maxLength - distance) / maxLength) * 100;

    return Math.round(similarity);
  }

  /**
   * Find matching products across sources
   */
  findMatches(
    products: RawAssetData[],
    threshold: number = 80
  ): Map<string, RawAssetData[]> {
    const matches = new Map<string, RawAssetData[]>();
    const processed = new Set<number>();

    for (let i = 0; i < products.length; i++) {
      if (processed.has(i)) continue;

      const group: RawAssetData[] = [products[i]];
      processed.add(i);

      for (let j = i + 1; j < products.length; j++) {
        if (processed.has(j)) continue;

        const similarity = this.calculateSimilarity(
          products[i].name,
          products[j].name
        );

        if (similarity >= threshold) {
          group.push(products[j]);
          processed.add(j);
        }
      }

      // Use the most common name as the key
      const canonicalName = products[i].name;
      matches.set(canonicalName, group);
    }

    return matches;
  }
}

/**
 * Data Aggregator Service
 */
export class DataAggregator {
  private sources: DataSource[] = [];
  private matcher: ProductMatcher;
  private exchangeRates: Map<string, number> = new Map([['USD', 1]]);

  constructor() {
    this.matcher = new ProductMatcher();
  }

  /**
   * Register a data source
   */
  registerSource(source: DataSource): void {
    this.sources.push(source);
  }

  /**
   * Update exchange rates for currency conversion
   */
  updateExchangeRates(rates: Record<string, number>): void {
    Object.entries(rates).forEach(([currency, rate]) => {
      this.exchangeRates.set(currency, rate);
    });
  }

  /**
   * Convert price to USD
   */
  private convertToUSD(price: number, currency: string): number {
    const rate = this.exchangeRates.get(currency) || 1;
    return price / rate;
  }

  /**
   * Fetch data from all sources in parallel
   */
  async fetchAllSources(): Promise<RawAssetData[]> {
    const promises = this.sources.map(async (source) => {
      try {
        return await source.fetchData();
      } catch (error) {
        console.error(`Error fetching from ${source.name}:`, error);
        return [];
      }
    });

    const results = await Promise.all(promises);
    return results.flat();
  }

  /**
   * Aggregate and normalize data from all sources
   */
  async aggregateData(): Promise<NormalizedAsset[]> {
    // Fetch raw data
    const rawData = await this.fetchAllSources();

    // Find matching products
    const matches = this.matcher.findMatches(rawData);

    // Normalize and aggregate
    const normalized: NormalizedAsset[] = [];

    matches.forEach((group, canonicalName) => {
      // Calculate average price across sources
      const prices = group.map(item => 
        this.convertToUSD(item.price, item.currency)
      );
      const avgPrice = prices.reduce((a, b) => a + b, 0) / prices.length;

      // Calculate total volume
      const totalVolume = group.reduce((sum, item) => 
        sum + (item.volume || 0), 0
      );

      // Calculate total market cap
      const totalMarketCap = group.reduce((sum, item) => 
        sum + (item.marketCap || 0), 0
      );

      // Get unique sources
      const sources = [...new Set(group.map(item => item.source))];

      // Create normalized asset
      normalized.push({
        id: this.generateId(canonicalName),
        name: canonicalName,
        symbol: group[0].symbol || '',
        price: avgPrice,
        change24h: 0, // Would be calculated from historical data
        volume: totalVolume,
        marketCap: totalMarketCap,
        sources,
        lastUpdated: new Date(),
      });
    });

    return normalized;
  }

  /**
   * Generate consistent ID from name
   */
  private generateId(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  }
}

/**
 * Example: Binance API integration
 */
export class BinanceSource implements DataSource {
  name = 'Binance';
  type = 'crypto' as const;
  rateLimit = 1200;

  async fetchData(): Promise<RawAssetData[]> {
    try {
      const response = await fetch('https://api.binance.com/api/v3/ticker/24hr');
      const data = await response.json();

      return data
        .filter((item: { symbol: string }) => item.symbol.endsWith('USDT'))
        .map((item: {
          symbol: string;
          lastPrice: string;
          volume: string;
          priceChangePercent: string;
        }) => ({
          source: this.name,
          externalId: item.symbol,
          name: item.symbol.replace('USDT', ''),
          symbol: item.symbol.replace('USDT', ''),
          price: parseFloat(item.lastPrice),
          currency: 'USD',
          volume: parseFloat(item.volume),
          metadata: {
            change24h: parseFloat(item.priceChangePercent),
          },
        }));
    } catch (error) {
      console.error('Binance API error:', error);
      return [];
    }
  }
}

/**
 * Example: CoinGecko API integration
 */
export class CoinGeckoSource implements DataSource {
  name = 'CoinGecko';
  type = 'crypto' as const;
  rateLimit = 50;

  async fetchData(): Promise<RawAssetData[]> {
    try {
      const response = await fetch(
        'https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=100'
      );
      const data = await response.json();

      return data.map((item: {
        id: string;
        symbol: string;
        name: string;
        current_price: number;
        total_volume: number;
        market_cap: number;
        price_change_percentage_24h: number;
      }) => ({
        source: this.name,
        externalId: item.id,
        name: item.name,
        symbol: item.symbol.toUpperCase(),
        price: item.current_price,
        currency: 'USD',
        volume: item.total_volume,
        marketCap: item.market_cap,
        metadata: {
          change24h: item.price_change_percentage_24h,
        },
      }));
    } catch (error) {
      console.error('CoinGecko API error:', error);
      return [];
    }
  }
}

// Export singleton instance
export const dataAggregator = new DataAggregator();

// Register default sources
dataAggregator.registerSource(new BinanceSource());
dataAggregator.registerSource(new CoinGeckoSource());

