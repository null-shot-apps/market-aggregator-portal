# Market Aggregator Dashboard - Implementation Guide

## 🚀 Quick Start

This guide walks you through implementing a production-ready Market Aggregator Dashboard.

## 📋 Table of Contents

1. [Project Setup](#project-setup)
2. [Data Layer Implementation](#data-layer-implementation)
3. [API Integration](#api-integration)
4. [Frontend Components](#frontend-components)
5. [Real-time Updates](#real-time-updates)
6. [Alert System](#alert-system)
7. [Deployment](#deployment)
8. [Performance Optimization](#performance-optimization)

---

## 1. Project Setup

### Prerequisites

```bash
# Required
- Node.js 18+ 
- PostgreSQL 14+
- Redis 7+
- npm or pnpm

# Optional (for production)
- Docker
- Kubernetes
- Cloudflare Workers (for edge deployment)
```

### Install Dependencies

```bash
# Core dependencies (already included)
npm install next react react-dom

# Additional production dependencies
npm install @vercel/postgres redis ioredis
npm install @tanstack/react-query zustand
npm install date-fns recharts
npm install zod # For validation
npm install jose # For JWT auth
```

### Environment Variables

Create `.env.local`:

```env
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/market_aggregator
REDIS_URL=redis://localhost:6379

# API Keys (encrypt these!)
BINANCE_API_KEY=your_binance_key
BINANCE_API_SECRET=your_binance_secret
COINGECKO_API_KEY=your_coingecko_key

# Authentication
JWT_SECRET=your_jwt_secret_min_32_chars
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your_nextauth_secret

# Rate Limiting
RATE_LIMIT_WINDOW=60000 # 1 minute
RATE_LIMIT_MAX_REQUESTS=100

# Caching
CACHE_TTL=300000 # 5 minutes
```

---

## 2. Data Layer Implementation

### Step 1: Initialize Database

```bash
# Run the schema
psql -U postgres -d market_aggregator -f DATABASE_SCHEMA.sql

# Create partitions for current month
psql -U postgres -d market_aggregator -c "
CREATE TABLE price_history_$(date +%Y_%m) PARTITION OF price_history
FOR VALUES FROM ('$(date +%Y-%m-01)') TO ('$(date -d '+1 month' +%Y-%m-01)');
"
```

### Step 2: Set Up Redis Cache

```typescript
// src/lib/cache.ts
import Redis from 'ioredis';

const redis = new Redis(process.env.REDIS_URL!);

export async function getCached<T>(key: string): Promise<T | null> {
  const cached = await redis.get(key);
  return cached ? JSON.parse(cached) : null;
}

export async function setCache(
  key: string,
  value: unknown,
  ttl: number = 300
): Promise<void> {
  await redis.setex(key, ttl, JSON.stringify(value));
}

export async function invalidateCache(pattern: string): Promise<void> {
  const keys = await redis.keys(pattern);
  if (keys.length > 0) {
    await redis.del(...keys);
  }
}
```

### Step 3: Database Client

```typescript
// src/lib/db.ts
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

export async function query<T>(
  text: string,
  params?: unknown[]
): Promise<T[]> {
  const client = await pool.connect();
  try {
    const result = await client.query(text, params);
    return result.rows;
  } finally {
    client.release();
  }
}

// Example: Get latest prices
export async function getLatestPrices() {
  return query(`
    SELECT * FROM latest_prices
    WHERE timestamp > NOW() - INTERVAL '1 hour'
    ORDER BY market_cap DESC
    LIMIT 100
  `);
}
```

---

## 3. API Integration

### Step 1: Implement Rate Limiting

```typescript
// src/lib/rate-limiter.ts
import { Redis } from 'ioredis';

const redis = new Redis(process.env.REDIS_URL!);

export async function checkRateLimit(
  identifier: string,
  limit: number = 100,
  window: number = 60000
): Promise<{ allowed: boolean; remaining: number }> {
  const key = `rate_limit:${identifier}`;
  const current = await redis.incr(key);
  
  if (current === 1) {
    await redis.pexpire(key, window);
  }
  
  return {
    allowed: current <= limit,
    remaining: Math.max(0, limit - current),
  };
}
```

### Step 2: Create API Middleware

```typescript
// src/middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { checkRateLimit } from './lib/rate-limiter';

export async function middleware(request: NextRequest) {
  // Rate limiting
  const ip = request.ip || 'anonymous';
  const { allowed, remaining } = await checkRateLimit(ip);
  
  if (!allowed) {
    return NextResponse.json(
      { error: 'Rate limit exceeded' },
      { 
        status: 429,
        headers: {
          'X-RateLimit-Remaining': '0',
          'Retry-After': '60',
        },
      }
    );
  }
  
  const response = NextResponse.next();
  response.headers.set('X-RateLimit-Remaining', remaining.toString());
  return response;
}

export const config = {
  matcher: '/api/:path*',
};
```

### Step 3: Implement Data Fetching Service

```typescript
// src/lib/fetcher.ts
import { getCached, setCache } from './cache';
import { query } from './db';

export async function fetchWithCache<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttl: number = 300
): Promise<T> {
  // Check cache first
  const cached = await getCached<T>(key);
  if (cached) return cached;
  
  // Fetch fresh data
  const data = await fetcher();
  
  // Cache it
  await setCache(key, data, ttl);
  
  return data;
}

// Example: Fetch assets with caching
export async function getAssets() {
  return fetchWithCache(
    'assets:all',
    async () => {
      return query(`
        SELECT a.*, 
               ph.price, 
               ph.change_24h,
               ph.volume,
               ph.market_cap
        FROM assets a
        JOIN LATERAL (
          SELECT price, change_24h, volume, market_cap
          FROM price_history
          WHERE asset_id = a.id
          ORDER BY timestamp DESC
          LIMIT 1
        ) ph ON true
        WHERE a.is_active = true
        ORDER BY ph.market_cap DESC
      `);
    },
    300 // 5 minutes
  );
}
```

---

## 4. Frontend Components

### Step 1: Set Up React Query

```typescript
// src/app/providers.tsx
'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 5 * 60 * 1000, // 5 minutes
        refetchInterval: 5 * 60 * 1000,
      },
    },
  }));

  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}
```

### Step 2: Create Custom Hooks

```typescript
// src/hooks/useAssets.ts
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';

export function useAssets() {
  return useQuery({
    queryKey: ['assets'],
    queryFn: async () => {
      const response = await apiClient.getAssets();
      if (!response.success) throw new Error(response.error);
      return response.data;
    },
    refetchInterval: 5000, // Refetch every 5 seconds
  });
}

export function useAssetHistory(assetId: string, interval: string = '1h') {
  return useQuery({
    queryKey: ['asset-history', assetId, interval],
    queryFn: async () => {
      const response = await apiClient.getPriceHistory(assetId, interval as any);
      if (!response.success) throw new Error(response.error);
      return response.data;
    },
  });
}
```

### Step 3: Update Main Dashboard

```typescript
// src/app/page.tsx
'use client';

import { useAssets } from '@/hooks/useAssets';
import ComparisonTable from '@/components/ComparisonTable';
import KPICard from '@/components/KPICard';
import TrendChart from '@/components/TrendChart';

export default function Dashboard() {
  const { data: assets, isLoading, error } = useAssets();

  if (isLoading) return <LoadingSpinner />;
  if (error) return <ErrorMessage error={error} />;
  if (!assets) return null;

  // Calculate KPIs
  const avgPrice = assets.reduce((sum, a) => sum + a.price, 0) / assets.length;
  const volatility = Math.abs(
    assets.reduce((sum, a) => sum + a.change24h, 0) / assets.length
  );
  const topGainer = assets.reduce((max, a) => 
    a.change24h > max.change24h ? a : max
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <KPICard
          title="Average Price"
          value={`$${avgPrice.toFixed(2)}`}
          subtitle="Across top assets"
          color="blue"
        />
        <KPICard
          title="Market Volatility"
          value={`${volatility.toFixed(2)}%`}
          subtitle="24h average change"
          color="purple"
        />
        <KPICard
          title="Top Gainer"
          value={topGainer.symbol}
          subtitle={`+${topGainer.change24h.toFixed(2)}%`}
          color="green"
        />
      </div>

      {/* Comparison Table */}
      <ComparisonTable assets={assets} />

      {/* Add more components */}
    </div>
  );
}
```

---

## 5. Real-time Updates

### Option A: Server-Sent Events (SSE)

```typescript
// src/app/api/stream/route.ts
export async function GET() {
  const encoder = new TextEncoder();
  
  const stream = new ReadableStream({
    async start(controller) {
      const interval = setInterval(async () => {
        const data = await getLatestPrices();
        const message = `data: ${JSON.stringify(data)}\n\n`;
        controller.enqueue(encoder.encode(message));
      }, 5000);

      // Cleanup
      return () => clearInterval(interval);
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
```

### Option B: WebSocket (Recommended for Production)

```typescript
// src/lib/websocket-server.ts
import { WebSocketServer } from 'ws';

const wss = new WebSocketServer({ port: 8080 });

wss.on('connection', (ws) => {
  console.log('Client connected');

  // Send updates every 5 seconds
  const interval = setInterval(async () => {
    const data = await getLatestPrices();
    ws.send(JSON.stringify({ type: 'price_update', data }));
  }, 5000);

  ws.on('close', () => {
    clearInterval(interval);
    console.log('Client disconnected');
  });
});
```

---

## 6. Alert System

### Step 1: Alert Monitoring Service

```typescript
// src/services/alert-monitor.ts
import { query } from '@/lib/db';
import { sendNotification } from '@/lib/notifications';

export async function checkAlerts() {
  const alerts = await query(`
    SELECT a.*, ast.price as current_price
    FROM alerts a
    JOIN LATERAL (
      SELECT price
      FROM price_history
      WHERE asset_id = a.asset_id
      ORDER BY timestamp DESC
      LIMIT 1
    ) ast ON true
    WHERE a.is_active = true
  `);

  for (const alert of alerts) {
    const triggered = evaluateAlert(alert);
    
    if (triggered) {
      await triggerAlert(alert);
    }
  }
}

function evaluateAlert(alert: any): boolean {
  switch (alert.alert_type) {
    case 'price_above':
      return alert.current_price > alert.threshold_value;
    case 'price_below':
      return alert.current_price < alert.threshold_value;
    case 'change_percent':
      return Math.abs(alert.change_24h) > alert.threshold_value;
    default:
      return false;
  }
}

async function triggerAlert(alert: any) {
  // Log to database
  await query(`
    INSERT INTO alert_history (alert_id, price_at_trigger)
    VALUES ($1, $2)
  `, [alert.id, alert.current_price]);

  // Send notification
  await sendNotification(alert);
}

// Run every minute
setInterval(checkAlerts, 60000);
```

### Step 2: Notification Service

```typescript
// src/lib/notifications.ts
export async function sendNotification(alert: any) {
  const channels = alert.notification_channels || ['email'];

  for (const channel of channels) {
    switch (channel) {
      case 'email':
        await sendEmail(alert);
        break;
      case 'sms':
        await sendSMS(alert);
        break;
      case 'push':
        await sendPushNotification(alert);
        break;
    }
  }
}

async function sendEmail(alert: any) {
  // Implement email sending (e.g., using SendGrid, AWS SES)
  console.log(`Sending email for alert ${alert.id}`);
}
```

---

## 7. Deployment

### Docker Setup

```dockerfile
# Dockerfile
FROM node:18-alpine AS base

# Dependencies
FROM base AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci

# Builder
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# Runner
FROM base AS runner
WORKDIR /app
ENV NODE_ENV production

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

EXPOSE 3000
CMD ["node", "server.js"]
```

### Docker Compose

```yaml
# docker-compose.yml
version: '3.8'

services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - DATABASE_URL=postgresql://postgres:password@db:5432/market_aggregator
      - REDIS_URL=redis://redis:6379
    depends_on:
      - db
      - redis

  db:
    image: postgres:14
    environment:
      POSTGRES_DB: market_aggregator
      POSTGRES_PASSWORD: password
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    volumes:
      - redis_data:/data

volumes:
  postgres_data:
  redis_data:
```

---

## 8. Performance Optimization

### Database Indexing

```sql
-- Add indexes for common queries
CREATE INDEX CONCURRENTLY idx_price_history_asset_time 
ON price_history(asset_id, timestamp DESC);

CREATE INDEX CONCURRENTLY idx_alerts_active 
ON alerts(is_active, asset_id) WHERE is_active = true;

-- Analyze tables
ANALYZE price_history;
ANALYZE assets;
```

### Caching Strategy

```typescript
// Implement multi-level caching
// 1. Browser cache (React Query)
// 2. CDN cache (Cloudflare)
// 3. Redis cache (Application)
// 4. Database query cache (PostgreSQL)

// Example: Aggressive caching for static data
export const revalidate = 300; // 5 minutes
```

### Code Splitting

```typescript
// Use dynamic imports for heavy components
import dynamic from 'next/dynamic';

const TrendChart = dynamic(() => import('@/components/TrendChart'), {
  loading: () => <ChartSkeleton />,
  ssr: false,
});
```

---

## 🎯 Next Steps

1. **Add Authentication**: Implement NextAuth.js for user management
2. **Add More Sources**: Integrate additional APIs (Kraken, Coinbase, etc.)
3. **Implement WebSockets**: For true real-time updates
4. **Add Testing**: Unit tests (Jest) and E2E tests (Playwright)
5. **Set Up Monitoring**: Use Sentry for error tracking, Grafana for metrics
6. **Optimize SEO**: Add meta tags, sitemap, robots.txt
7. **Add Analytics**: Google Analytics or Plausible

## 📚 Additional Resources

- [Next.js Documentation](https://nextjs.org/docs)
- [PostgreSQL Performance](https://www.postgresql.org/docs/current/performance-tips.html)
- [Redis Best Practices](https://redis.io/docs/manual/patterns/)
- [API Rate Limiting](https://www.npmjs.com/package/express-rate-limit)

