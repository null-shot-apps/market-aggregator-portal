-- Market Aggregator Dashboard - Database Schema
-- PostgreSQL 14+

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm"; -- For fuzzy text matching

-- ============================================================================
-- CORE TABLES
-- ============================================================================

-- Assets/Products table (normalized across all sources)
CREATE TABLE assets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    asset_type VARCHAR(50) NOT NULL, -- 'crypto', 'ecommerce', 'real_estate'
    name VARCHAR(255) NOT NULL,
    symbol VARCHAR(20), -- For crypto (BTC, ETH) or stock symbols
    description TEXT,
    category VARCHAR(100),
    metadata JSONB, -- Flexible storage for asset-specific data
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_active BOOLEAN DEFAULT TRUE
);

CREATE INDEX idx_assets_type ON assets(asset_type);
CREATE INDEX idx_assets_symbol ON assets(symbol);
CREATE INDEX idx_assets_name_trgm ON assets USING gin(name gin_trgm_ops); -- Fuzzy search

-- Data sources (APIs, exchanges, marketplaces)
CREATE TABLE sources (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL UNIQUE,
    source_type VARCHAR(50) NOT NULL, -- 'api', 'scraper', 'feed'
    base_url VARCHAR(500),
    api_key_encrypted TEXT, -- Store encrypted API keys
    rate_limit_per_minute INTEGER DEFAULT 60,
    is_active BOOLEAN DEFAULT TRUE,
    last_successful_fetch TIMESTAMP WITH TIME ZONE,
    config JSONB, -- Source-specific configuration
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Asset-Source mapping (many-to-many)
CREATE TABLE asset_sources (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    asset_id UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
    source_id UUID NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
    external_id VARCHAR(255), -- ID in the external system
    external_url VARCHAR(500),
    is_primary BOOLEAN DEFAULT FALSE, -- Primary source for this asset
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(asset_id, source_id)
);

CREATE INDEX idx_asset_sources_asset ON asset_sources(asset_id);
CREATE INDEX idx_asset_sources_source ON asset_sources(source_id);

-- ============================================================================
-- PRICE DATA (Time-series optimized)
-- ============================================================================

-- Price history (partitioned by date for performance)
CREATE TABLE price_history (
    id BIGSERIAL,
    asset_id UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
    source_id UUID NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
    price NUMERIC(20, 8) NOT NULL,
    currency VARCHAR(10) DEFAULT 'USD',
    volume NUMERIC(20, 2),
    market_cap NUMERIC(20, 2),
    change_24h NUMERIC(10, 4), -- Percentage change
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    metadata JSONB, -- Additional metrics (high, low, open, close for candlestick)
    PRIMARY KEY (id, timestamp)
) PARTITION BY RANGE (timestamp);

-- Create partitions for current and future months
CREATE TABLE price_history_2024_01 PARTITION OF price_history
    FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');

CREATE TABLE price_history_2024_02 PARTITION OF price_history
    FOR VALUES FROM ('2024-02-01') TO ('2024-03-01');

-- Add more partitions as needed...

CREATE INDEX idx_price_history_asset_time ON price_history(asset_id, timestamp DESC);
CREATE INDEX idx_price_history_source ON price_history(source_id);

-- Aggregated price data (for faster queries)
CREATE TABLE price_aggregates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    asset_id UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
    interval VARCHAR(20) NOT NULL, -- '1h', '1d', '1w', '1m'
    open_price NUMERIC(20, 8),
    close_price NUMERIC(20, 8),
    high_price NUMERIC(20, 8),
    low_price NUMERIC(20, 8),
    avg_price NUMERIC(20, 8),
    total_volume NUMERIC(20, 2),
    period_start TIMESTAMP WITH TIME ZONE NOT NULL,
    period_end TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(asset_id, interval, period_start)
);

CREATE INDEX idx_price_agg_asset_interval ON price_aggregates(asset_id, interval, period_start DESC);

-- ============================================================================
-- USER & ALERT MANAGEMENT
-- ============================================================================

-- Users table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) NOT NULL UNIQUE,
    username VARCHAR(100) UNIQUE,
    password_hash TEXT NOT NULL,
    full_name VARCHAR(255),
    preferences JSONB DEFAULT '{}', -- UI preferences, notification settings
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_login TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT TRUE
);

CREATE INDEX idx_users_email ON users(email);

-- Watchlists (user's tracked assets)
CREATE TABLE watchlists (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    is_default BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_watchlists_user ON watchlists(user_id);

-- Watchlist items
CREATE TABLE watchlist_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    watchlist_id UUID NOT NULL REFERENCES watchlists(id) ON DELETE CASCADE,
    asset_id UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
    added_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    notes TEXT,
    UNIQUE(watchlist_id, asset_id)
);

-- Price alerts
CREATE TABLE alerts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    asset_id UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
    alert_type VARCHAR(50) NOT NULL, -- 'price_above', 'price_below', 'change_percent', 'volume_spike'
    threshold_value NUMERIC(20, 8) NOT NULL,
    comparison_operator VARCHAR(10) NOT NULL, -- '>', '<', '>=', '<=', '='
    is_active BOOLEAN DEFAULT TRUE,
    notification_channels JSONB DEFAULT '["email"]', -- ['email', 'sms', 'push']
    last_triggered TIMESTAMP WITH TIME ZONE,
    trigger_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_alerts_user ON alerts(user_id);
CREATE INDEX idx_alerts_asset_active ON alerts(asset_id, is_active);

-- Alert history (triggered alerts)
CREATE TABLE alert_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    alert_id UUID NOT NULL REFERENCES alerts(id) ON DELETE CASCADE,
    triggered_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    price_at_trigger NUMERIC(20, 8),
    notification_sent BOOLEAN DEFAULT FALSE,
    notification_details JSONB
);

CREATE INDEX idx_alert_history_alert ON alert_history(alert_id, triggered_at DESC);

-- ============================================================================
-- PRODUCT MATCHING & NORMALIZATION
-- ============================================================================

-- Product matching groups (for deduplication across sources)
CREATE TABLE product_matches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    canonical_asset_id UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
    matched_asset_id UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
    similarity_score NUMERIC(5, 2), -- 0-100
    match_method VARCHAR(50), -- 'exact', 'fuzzy', 'manual'
    verified_by_user BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(canonical_asset_id, matched_asset_id)
);

CREATE INDEX idx_product_matches_canonical ON product_matches(canonical_asset_id);

-- ============================================================================
-- SYSTEM & MONITORING
-- ============================================================================

-- API request logs (for rate limiting and monitoring)
CREATE TABLE api_logs (
    id BIGSERIAL PRIMARY KEY,
    source_id UUID REFERENCES sources(id) ON DELETE SET NULL,
    endpoint VARCHAR(500),
    request_time TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    response_time_ms INTEGER,
    status_code INTEGER,
    error_message TEXT,
    rate_limit_remaining INTEGER
) PARTITION BY RANGE (request_time);

-- Create monthly partitions
CREATE TABLE api_logs_2024_01 PARTITION OF api_logs
    FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');

CREATE INDEX idx_api_logs_source_time ON api_logs(source_id, request_time DESC);

-- System health metrics
CREATE TABLE system_metrics (
    id BIGSERIAL PRIMARY KEY,
    metric_name VARCHAR(100) NOT NULL,
    metric_value NUMERIC(20, 4),
    tags JSONB,
    recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
) PARTITION BY RANGE (recorded_at);

CREATE INDEX idx_system_metrics_name_time ON system_metrics(metric_name, recorded_at DESC);

-- ============================================================================
-- VIEWS FOR COMMON QUERIES
-- ============================================================================

-- Latest prices for all assets
CREATE VIEW latest_prices AS
SELECT DISTINCT ON (ph.asset_id)
    ph.asset_id,
    a.name,
    a.symbol,
    ph.price,
    ph.currency,
    ph.volume,
    ph.market_cap,
    ph.change_24h,
    ph.timestamp,
    s.name as source_name
FROM price_history ph
JOIN assets a ON ph.asset_id = a.id
JOIN sources s ON ph.source_id = s.id
WHERE a.is_active = TRUE
ORDER BY ph.asset_id, ph.timestamp DESC;

-- User dashboard summary
CREATE VIEW user_dashboard AS
SELECT 
    u.id as user_id,
    u.email,
    COUNT(DISTINCT w.id) as watchlist_count,
    COUNT(DISTINCT wi.asset_id) as tracked_assets,
    COUNT(DISTINCT a.id) FILTER (WHERE a.is_active = TRUE) as active_alerts
FROM users u
LEFT JOIN watchlists w ON u.id = w.user_id
LEFT JOIN watchlist_items wi ON w.id = wi.watchlist_id
LEFT JOIN alerts a ON u.id = a.user_id
GROUP BY u.id, u.email;

-- ============================================================================
-- FUNCTIONS & TRIGGERS
-- ============================================================================

-- Update timestamp trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_assets_updated_at BEFORE UPDATE ON assets
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_watchlists_updated_at BEFORE UPDATE ON watchlists
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Calculate 24h price change
CREATE OR REPLACE FUNCTION calculate_24h_change(p_asset_id UUID)
RETURNS NUMERIC AS $$
DECLARE
    current_price NUMERIC;
    price_24h_ago NUMERIC;
BEGIN
    SELECT price INTO current_price
    FROM price_history
    WHERE asset_id = p_asset_id
    ORDER BY timestamp DESC
    LIMIT 1;
    
    SELECT price INTO price_24h_ago
    FROM price_history
    WHERE asset_id = p_asset_id
        AND timestamp <= NOW() - INTERVAL '24 hours'
    ORDER BY timestamp DESC
    LIMIT 1;
    
    IF price_24h_ago IS NULL OR price_24h_ago = 0 THEN
        RETURN 0;
    END IF;
    
    RETURN ((current_price - price_24h_ago) / price_24h_ago) * 100;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- SAMPLE DATA (for testing)
-- ============================================================================

-- Insert sample sources
INSERT INTO sources (name, source_type, base_url, rate_limit_per_minute) VALUES
    ('Binance', 'api', 'https://api.binance.com', 1200),
    ('CoinGecko', 'api', 'https://api.coingecko.com', 50),
    ('Coinbase', 'api', 'https://api.coinbase.com', 100);

-- Insert sample crypto assets
INSERT INTO assets (asset_type, name, symbol, category) VALUES
    ('crypto', 'Bitcoin', 'BTC', 'Cryptocurrency'),
    ('crypto', 'Ethereum', 'ETH', 'Cryptocurrency'),
    ('crypto', 'Binance Coin', 'BNB', 'Cryptocurrency'),
    ('crypto', 'Solana', 'SOL', 'Cryptocurrency'),
    ('crypto', 'Cardano', 'ADA', 'Cryptocurrency');

