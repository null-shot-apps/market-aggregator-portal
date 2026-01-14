# Market Aggregator Dashboard - System Architecture

## 1. System Architecture (Text-Based Diagram)

```
┌─────────────────────────────────────────────────────────────────┐
│                         CLIENT LAYER                             │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  Next.js 15 Frontend (React 19)                          │   │
│  │  - Dashboard UI (KPI Cards, Tables, Charts)              │   │
│  │  - Real-time Updates (WebSocket/Polling)                 │   │
│  │  - Alert Management Interface                            │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              ↕ HTTP/WebSocket
┌─────────────────────────────────────────────────────────────────┐
│                         API GATEWAY                              │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  Next.js API Routes / Node.js Backend                    │   │
│  │  - Rate Limiting & Authentication                        │   │
│  │  - Request Routing & Load Balancing                      │   │
│  │  - API Key Management                                    │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              ↕
┌─────────────────────────────────────────────────────────────────┐
│                      BUSINESS LOGIC LAYER                        │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │ Aggregation  │  │ Normalization│  │  Alert Engine        │  │
│  │ Service      │  │ Service      │  │  - Price Monitoring  │  │
│  │ - Multi-API  │  │ - Product    │  │  - Notification      │  │
│  │   Fetching   │  │   Matching   │  │  - Threshold Check   │  │
│  │ - Parallel   │  │ - Fuzzy      │  │                      │  │
│  │   Requests   │  │   Matching   │  │                      │  │
│  └──────────────┘  └──────────────┘  └──────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              ↕
┌─────────────────────────────────────────────────────────────────┐
│                       CACHING LAYER                              │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  Redis Cache                                              │   │
│  │  - API Response Cache (TTL: 5 minutes)                   │   │
│  │  - Rate Limit Counters                                   │   │
│  │  - Session Storage                                       │   │
│  │  - Real-time Price Updates                               │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              ↕
┌─────────────────────────────────────────────────────────────────┐
│                      DATA SOURCES LAYER                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │ Crypto APIs  │  │ E-commerce   │  │  Real Estate APIs    │  │
│  │ - Binance    │  │ - Amazon MWS │  │  - Zillow            │  │
│  │ - Coinbase   │  │ - eBay       │  │  - Realtor.com       │  │
│  │ - CoinGecko  │  │ - Keepa      │  │  - Redfin            │  │
│  │ - Kraken     │  │ - Shopify    │  │                      │  │
│  └──────────────┘  └──────────────┘  └──────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              ↕
┌─────────────────────────────────────────────────────────────────┐
│                      PERSISTENCE LAYER                           │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  PostgreSQL Database                                      │   │
│  │  - Products & Assets                                     │   │
│  │  - Price History (Time-series)                           │   │
│  │  - User Preferences & Alerts                             │   │
│  │  - Source Mappings                                       │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

## 2. Data Flow

### Real-time Price Updates (Every 5 minutes)
```
1. Scheduler triggers aggregation service
2. Service makes parallel API calls to all sources
3. Raw data normalized and matched
4. Results cached in Redis (TTL: 5 min)
5. Database updated with new price points
6. WebSocket pushes updates to connected clients
7. Alert engine checks thresholds and triggers notifications
```

### Product Matching Algorithm
```
1. Extract product identifiers (name, SKU, UPC)
2. Normalize text (lowercase, remove special chars)
3. Calculate similarity scores:
   - Exact match: 100%
   - Fuzzy match (Levenshtein): 80-99%
   - Partial match: 60-79%
4. Group products with score > 80%
5. Store mapping in database
```

## 3. Key Components

### A. Data Ingestion Service
- **Polling Strategy**: Scheduled jobs every 5 minutes
- **API Management**: 
  - Rate limiting per source
  - Retry logic with exponential backoff
  - Circuit breaker pattern for failing APIs
- **Error Handling**: Fallback to cached data if API fails

### B. Normalization Service
- **Price Standardization**: Convert all currencies to USD
- **Unit Conversion**: Standardize units (per item, per kg, etc.)
- **Data Validation**: Schema validation, outlier detection
- **Deduplication**: Remove duplicate entries from same source

### C. Alert Engine
- **Trigger Types**:
  - Price drop/increase by X%
  - Price crosses threshold
  - Volume spike detection
  - New listing detected
- **Notification Channels**: Email, SMS, Push, Webhook

### D. Caching Strategy
- **Hot Data** (Redis): Current prices, active sessions
- **Warm Data** (PostgreSQL): Recent history (30 days)
- **Cold Data** (Archive): Historical data > 30 days

## 4. API Endpoints

```
GET  /api/assets              - List all tracked assets
GET  /api/assets/:id          - Get asset details
GET  /api/assets/:id/history  - Get price history
POST /api/alerts              - Create price alert
GET  /api/alerts              - List user alerts
DELETE /api/alerts/:id        - Delete alert
GET  /api/sources             - List data sources
GET  /api/kpis                - Get dashboard KPIs
```

## 5. Security Considerations

- **API Key Rotation**: Automated rotation every 90 days
- **Rate Limiting**: Per-user and per-IP limits
- **Data Encryption**: TLS in transit, AES-256 at rest
- **Authentication**: JWT tokens with refresh mechanism
- **CORS**: Whitelist allowed origins

## 6. Scalability

- **Horizontal Scaling**: Stateless API servers behind load balancer
- **Database Sharding**: Partition by asset type or date range
- **CDN**: Static assets and cached API responses
- **Queue System**: Background jobs for heavy processing

## 7. Monitoring & Observability

- **Metrics**: API latency, error rates, cache hit ratio
- **Logging**: Structured logs with correlation IDs
- **Alerting**: PagerDuty for critical failures
- **Dashboards**: Grafana for real-time monitoring

