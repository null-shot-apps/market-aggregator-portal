import { NextResponse } from 'next/server';

// Mock alerts storage
const mockAlerts = new Map<string, {
  id: string;
  userId: string;
  assetId: string;
  type: string;
  threshold: number;
  isActive: boolean;
  createdAt: string;
}>();

export async function GET() {
  try {
    // In production:
    // 1. Authenticate user
    // 2. Query alerts from database
    // 3. Return user's alerts

    const alerts = Array.from(mockAlerts.values());

    return NextResponse.json({
      success: true,
      data: alerts,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
    }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as {
      assetId?: string;
      type?: string;
      threshold?: number;
    };

    // Validate required fields
    if (!body.assetId || !body.type || body.threshold === undefined) {
      return NextResponse.json({
        success: false,
        error: 'Missing required fields: assetId, type, threshold',
      }, { status: 400 });
    }

    // Validate alert type
    const validTypes = ['price_above', 'price_below', 'change_percent', 'volume_spike'];
    if (!validTypes.includes(body.type)) {
      return NextResponse.json({
        success: false,
        error: `Invalid alert type. Must be one of: ${validTypes.join(', ')}`,
      }, { status: 400 });
    }

    // In production:
    // 1. Authenticate user
    // 2. Insert alert into database
    // 3. Register with alert monitoring service
    // 4. Return created alert

    const alertId = `alert_${Date.now()}`;
    const newAlert = {
      id: alertId,
      userId: 'user_123', // Would come from auth
      assetId: body.assetId,
      type: body.type,
      threshold: body.threshold,
      isActive: true,
      createdAt: new Date().toISOString(),
    };

    mockAlerts.set(alertId, newAlert);

    return NextResponse.json({
      success: true,
      data: newAlert,
    }, { status: 201 });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
    }, { status: 500 });
  }
}


