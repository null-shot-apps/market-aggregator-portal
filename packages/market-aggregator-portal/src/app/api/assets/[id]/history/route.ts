import { NextResponse } from 'next/server';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const interval = searchParams.get('interval') || '1h';

    // Generate mock historical data
    const dataPoints = interval === '1h' ? 24 : interval === '1d' ? 30 : 12;
    const basePrice = Math.random() * 10000;
    
    const history = Array.from({ length: dataPoints }, (_, i) => {
      const timestamp = new Date();
      timestamp.setHours(timestamp.getHours() - (dataPoints - i));
      
      return {
        timestamp: timestamp.toISOString(),
        price: basePrice * (1 + (Math.random() - 0.5) * 0.1),
        volume: Math.random() * 1000000000,
        high: basePrice * 1.05,
        low: basePrice * 0.95,
        open: basePrice,
        close: basePrice * (1 + (Math.random() - 0.5) * 0.05),
      };
    });

    return NextResponse.json({
      success: true,
      data: history,
      interval,
      assetId: id,
      timestamp: new Date().toISOString(),
    }, {
      headers: {
        'Cache-Control': 'public, s-maxage=300',
      },
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
    }, { status: 500 });
  }
}

