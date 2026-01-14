import { NextResponse } from 'next/server';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // In production: Query database for specific asset
    const mockAsset = {
      id,
      name: id.charAt(0).toUpperCase() + id.slice(1),
      symbol: id.toUpperCase().substring(0, 3),
      price: Math.random() * 10000,
      change24h: (Math.random() - 0.5) * 10,
      volume: Math.random() * 1000000000,
      marketCap: Math.random() * 100000000000,
      lastUpdated: new Date().toISOString(),
      sources: ['Binance', 'CoinGecko'],
      metadata: {
        description: `${id} cryptocurrency`,
        website: `https://${id}.org`,
        whitepaper: `https://${id}.org/whitepaper.pdf`,
      },
    };

    return NextResponse.json({
      success: true,
      data: mockAsset,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
    }, { status: 500 });
  }
}

