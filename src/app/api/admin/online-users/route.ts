// src/app/api/admin/online-users/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminAuth } from '@/lib/auth';
import { getRedisClient } from '@/lib/redis';

export async function GET(request: NextRequest) {
  try {
    // 验证站长权限
    const isAdmin = await verifyAdminAuth(request);
    if (!isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const redis = await getRedisClient();
    
    // 获取所有在线用户的会话ID
    const onlineSessions = await redis.zrangebyscore(
      'online:users:active',
      Date.now() - 90000, // 90秒内活跃
      Date.now()
    );
    
    // 批量获取用户详细信息
    const onlineUsers = [];
    for (const sessionId of onlineSessions) {
      const userData = await redis.get(`online:users:${sessionId}`);
      if (userData) {
        const parsed = JSON.parse(userData);
        // 计算观看进度百分比
        if (parsed.currentWatching) {
          const progressPercent = parsed.currentWatching.duration > 0 
            ? (parsed.currentWatching.progress / parsed.currentWatching.duration * 100).toFixed(1)
            : 0;
          parsed.currentWatching.progressPercent = progressPercent;
        }
        onlineUsers.push(parsed);
      }
    }
    
    // 统计信息
    const stats = {
      totalOnline: onlineUsers.length,
      byDevice: {
        desktop: onlineUsers.filter(u => u.deviceInfo?.platform === 'desktop').length,
        mobile: onlineUsers.filter(u => u.deviceInfo?.platform === 'mobile').length,
        tv: onlineUsers.filter(u => u.deviceInfo?.platform === 'tv').length,
      },
      topVideos: getTopWatchingVideos(onlineUsers)
    };
    
    return NextResponse.json({
      success: true,
      data: {
        users: onlineUsers,
        stats,
        timestamp: Date.now()
      }
    });
    
  } catch (error) {
    console.error('Get online users error:', error);
    return NextResponse.json(
      { error: 'Failed to get online users' },
      { status: 500 }
    );
  }
}

// 获取最热门观看内容
function getTopWatchingVideos(users: any[]) {
  const videoCounts = {};
  users.forEach(user => {
    if (user.currentWatching?.videoTitle) {
      const title = user.currentWatching.videoTitle;
      videoCounts[title] = (videoCounts[title] || 0) + 1;
    }
  });
  
  return Object.entries(videoCounts)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 10)
    .map(([title, count]) => ({ title, count }));
}
