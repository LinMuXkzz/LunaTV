// src/app/api/online/report/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getRedisClient } from '@/lib/redis';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const redis = await getRedisClient();
    
    // 生成或获取用户会话ID
    const sessionId = request.headers.get('x-session-id') || generateSessionId();
    const userId = getUserIdFromRequest(request); // 实现用户ID获取逻辑
    
    // 存储在线用户信息
    const onlineKey = `online:users:${sessionId}`;
    const userData = {
      userId,
      sessionId,
      lastActiveTime: Date.now(),
      currentWatching: body.data,
      deviceInfo: {
        userAgent: request.headers.get('user-agent') || '',
        ip: getClientIP(request),
        platform: detectPlatform(request.headers.get('user-agent'))
      }
    };
    
    // 存储到 Redis，设置90秒过期时间
    await redis.setex(onlineKey, 90, JSON.stringify(userData));
    
    // 同时添加到在线用户集合
    await redis.zadd('online:users:active', Date.now(), sessionId);
    
    return NextResponse.json({
      success: true,
      sessionId,
      timestamp: Date.now()
    }, {
      headers: {
        'x-session-id': sessionId
      }
    });
    
  } catch (error) {
    console.error('Report online status error:', error);
    return NextResponse.json(
      { error: 'Failed to report online status' },
      { status: 500 }
    );
  }
}

// src/app/api/online/heartbeat/route.ts
export async function POST(request: NextRequest) {
  try {
    const sessionId = request.headers.get('x-session-id');
    if (!sessionId) {
      return NextResponse.json({ error: 'No session ID' }, { status: 400 });
    }
    
    const body = await request.json();
    const redis = await getRedisClient();
    
    // 更新用户活跃时间
    const onlineKey = `online:users:${sessionId}`;
    const existingData = await redis.get(onlineKey);
    
    if (existingData) {
      const userData = JSON.parse(existingData);
      userData.lastActiveTime = Date.now();
      userData.currentWatching = body.currentWatching;
      
      // 重新设置过期时间
      await redis.setex(onlineKey, 90, JSON.stringify(userData));
      await redis.zadd('online:users:active', Date.now(), sessionId);
      
      return NextResponse.json({ success: true });
    }
    
    return NextResponse.json({ error: 'Session expired' }, { status: 404 });
    
  } catch (error) {
    return NextResponse.json(
      { error: 'Heartbeat failed' },
      { status: 500 }
    );
  }
}

// src/app/api/online/offline/route.ts
export async function POST(request: NextRequest) {
  try {
    const sessionId = request.headers.get('x-session-id');
    const redis = await getRedisClient();
    
    if (sessionId) {
      // 删除在线记录
      await redis.del(`online:users:${sessionId}`);
      await redis.zrem('online:users:active', sessionId);
    }
    
    return NextResponse.json({ success: true });
    
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to report offline' },
      { status: 500 }
    );
  }
}
