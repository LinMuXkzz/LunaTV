// src/lib/watchingTracker.ts
interface WatchingData {
  videoId: string;
  videoTitle: string;
  episodeId?: string;
  episodeTitle?: string;
  progress: number;
  duration: number;
  source: string;
}

class WatchingTracker {
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private currentWatching: WatchingData | null = null;
  private readonly HEARTBEAT_INTERVAL = 30000; // 30秒心跳间隔
  private readonly OFFLINE_TIMEOUT = 90000; // 90秒超时判定

  constructor() {
    this.init();
  }

  private init() {
    // 页面卸载时清理
    window.addEventListener('beforeunload', () => {
      this.reportOffline();
    });

    // 页面可见性变化
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.pauseTracking();
      } else {
        this.resumeTracking();
      }
    });
  }

  // 开始追踪播放内容
  public startTracking(player: any, videoData: WatchingData) {
    this.currentWatching = videoData;
    
    // 监听播放器事件
    player.on('play', () => this.onPlayStart(videoData));
    player.on('pause', () => this.onPause());
    player.on('timeupdate', (currentTime: number) => this.onProgress(currentTime));
    player.on('ended', () => this.onEnded());
    player.on('error', () => this.onError());

    // 启动心跳
    this.startHeartbeat();
  }

  private onPlayStart(videoData: WatchingData) {
    this.reportOnline(videoData);
  }

  private onProgress(currentTime: number) {
    if (this.currentWatching) {
      this.currentWatching.progress = currentTime;
      this.reportProgress(currentTime);
    }
  }

  private startHeartbeat() {
    this.heartbeatInterval = setInterval(() => {
      if (this.currentWatching) {
        this.sendHeartbeat();
      }
    }, this.HEARTBEAT_INTERVAL);
  }

  // API 调用方法
  private async reportOnline(data: WatchingData) {
    await fetch('/api/online/report', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'online',
        data: { ...data, timestamp: Date.now() }
      })
    });
  }

  private async reportProgress(progress: number) {
    await fetch('/api/online/progress', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        progress,
        timestamp: Date.now()
      })
    });
  }

  private async sendHeartbeat() {
    await fetch('/api/online/heartbeat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        currentWatching: this.currentWatching,
        timestamp: Date.now()
      })
    });
  }

  private async reportOffline() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }
    
    await fetch('/api/online/offline', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
  }

  public pauseTracking() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  public resumeTracking() {
    if (this.currentWatching && !this.heartbeatInterval) {
      this.startHeartbeat();
    }
  }
}

export default WatchingTracker;
