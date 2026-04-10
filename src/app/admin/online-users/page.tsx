// src/app/admin/online-users/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';

interface OnlineUser {
  userId: string;
  sessionId: string;
  lastActiveTime: number;
  currentWatching: {
    videoTitle: string;
    episodeTitle?: string;
    progress: number;
    duration: number;
    progressPercent: string;
    source: string;
  };
  deviceInfo: {
    userAgent: string;
    platform: string;
  };
}

interface OnlineUsersData {
  users: OnlineUser[];
  stats: {
    totalOnline: number;
    byDevice: { desktop: number; mobile: number; tv: number };
    topVideos: Array<{ title: string; count: number }>;
  };
  timestamp: number;
}

export default function OnlineUsersPage() {
  const [data, setData] = useState<OnlineUsersData | null>(null);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);

  useEffect(() => {
    if (autoRefresh) {
      const interval = setInterval(fetchData, 5000); // 每5秒刷新
      return () => clearInterval(interval);
    }
  }, [autoRefresh]);

  const fetchData = async () => {
    try {
      const response = await fetch('/api/admin/online-users');
      if (response.ok) {
        const result = await response.json();
        setData(result.data);
      }
    } catch (error) {
      console.error('Failed to fetch online users:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  if (loading) {
    return <div className="p-8 text-center">加载中...</div>;
  }

  if (!data) {
    return <div className="p-8 text-center">暂无数据</div>;
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* 统计概览 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">在线用户</CardTitle>
            <Badge variant="secondary">{data.stats.totalOnline}</Badge>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.stats.totalOnline}</div>
            <p className="text-xs text-muted-foreground">实时在线人数</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">设备分布</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between">
              <span>桌面端</span>
              <Badge>{data.stats.byDevice.desktop}</Badge>
            </div>
            <div className="flex justify-between">
              <span>移动端</span>
              <Badge>{data.stats.byDevice.mobile}</Badge>
            </div>
            <div className="flex justify-between">
              <span>电视端</span>
              <Badge>{data.stats.byDevice.tv}</Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">热门内容</CardTitle>
          </CardHeader>
          <CardContent>
            {data.stats.topVideos.slice(0, 3).map((video, index) => (
              <div key={index} className="flex justify-between mb-1">
                <span className="truncate">{video.title}</span>
                <Badge variant="outline">{video.count}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">控制面板</CardTitle>
          </CardHeader>
          <CardContent>
            <button 
              onClick={() => setAutoRefresh(!autoRefresh)}
              className="btn btn-primary w-full"
            >
              {autoRefresh ? '暂停刷新' : '开启刷新'}
            </button>
            <button 
              onClick={fetchData}
              className="btn btn-secondary w-full mt-2"
            >
              手动刷新
            </button>
          </CardContent>
        </Card>
      </div>

      {/* 用户详情列表 */}
      <Card>
        <CardHeader>
          <CardTitle>在线用户详情</CardTitle>
          <p className="text-sm text-muted-foreground">
            最后更新: {new Date(data.timestamp).toLocaleString()}
          </p>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {data.users.map((user, index) => (
              <div key={index} className="border rounded-lg p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge variant="default">{user.deviceInfo?.platform || 'Unknown'}</Badge>
                      <span className="text-sm text-muted-foreground">
                        {user.sessionId.slice(0, 8)}...
                      </span>
                    </div>
                    
                    <h3 className="font-semibold mb-1">
                      {user.currentWatching?.videoTitle || '无观看内容'}
                    </h3>
                    
                    {user.currentWatching?.episodeTitle && (
                      <p className="text-sm text-muted-foreground mb-2">
                        剧集: {user.currentWatching.episodeTitle}
                      </p>
                    )}
                    
                    {user.currentWatching && (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <span className="text-sm">进度:</span>
                          <Progress 
                            value={parseFloat(user.currentWatching.progressPercent)} 
                            className="flex-1"
                          />
                          <Badge variant="outline">
                            {user.currentWatching.progressPercent}%
                          </Badge>
                        </div>
                        
                        <div className="flex gap-4 text-sm text-muted-foreground">
                          <span>时长: {formatDuration(user.currentWatching.duration)}</span>
                          <span>进度: {formatDuration(user.currentWatching.progress)}</span>
                          <span>来源: {user.currentWatching.source}</span>
                        </div>
                      </div>
                    )}
                  </div>
                  
                  <div className="text-right text-sm text-muted-foreground">
                    <p>活跃时间</p>
                    <p>{formatTime(user.lastActiveTime)}</p>
                  </div>
                </div>
              </div>
            ))}
            
            {data.users.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                当前无在线用户
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// 工具函数
function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  
  if (h > 0) {
    return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function formatTime(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const seconds = Math.floor(diff / 1000);
  
  if (seconds < 60) return `${seconds}秒前`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}分钟前`;
  return `${Math.floor(seconds / 3600)}小时前`;
}
