
export class StayAliveService {
  private static audioEl: HTMLAudioElement | null = null;
  private static wakeLock: any = null;
  private static heartbeatInterval: any = null;

  // High-fidelity silent WAV for persistent background execution
  private static readonly SILENT_AUDIO_SRC = 'data:audio/wav;base64,UklGRigAAABXQVZFRm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQQAAAAAAP8A/wD/';

  public static async start(onEndCall: () => void) {
    console.log("Service: Elevating to Call-Grade Foreground status");
    try {
      // 1. Trigger MediaSession Call UI
      if ('mediaSession' in navigator) {
        (navigator as any).mediaSession.metadata = new (window as any).MediaMetadata({
          title: 'Riya - Connected Call',
          artist: 'AI Companion',
          album: 'Ongoing Conversation',
          artwork: [
            { src: 'https://images.unsplash.com/photo-1621784563330-caee0b138a00?q=80&w=512&auto=format&fit=crop', sizes: '512x512', type: 'image/jpeg' }
          ]
        });

        const handlers = [
          ['play', () => this.audioEl?.play()],
          ['pause', () => this.audioEl?.pause()],
          ['stop', onEndCall],
          ['hangup', onEndCall],
          ['terminate', onEndCall]
        ];

        handlers.forEach(([action, handler]: any) => {
          try { (navigator as any).mediaSession.setActionHandler(action, handler); } catch (e) {}
        });
        
        (navigator as any).mediaSession.playbackState = 'playing';
      }

      // 2. Play Silent Loop to prevent Chrome/Safari background suspension
      if (!this.audioEl) {
        this.audioEl = new Audio(this.SILENT_AUDIO_SRC);
        this.audioEl.loop = true;
      }
      await this.audioEl.play().catch(e => console.warn("Background audio play failed, but proceeding..."));

      // 3. Prevent Screen Dim (Keep Mic active)
      if ('wakeLock' in navigator) {
        try {
          this.wakeLock = await (navigator as any).wakeLock.request('screen');
        } catch (err) {}
      }

      // 4. Persistence Heartbeat
      this.heartbeatInterval = setInterval(() => {
        if ('mediaSession' in navigator) {
            (navigator as any).mediaSession.playbackState = 'playing';
        }
      }, 3000);

      console.log("StayAlive Service: Running in background");
    } catch (e) {
      console.error("StayAlive Service Error:", e);
    }
  }

  public static async stop() {
    console.log("Service: De-elevating foreground status");
    if (this.audioEl) {
      this.audioEl.pause();
      this.audioEl.currentTime = 0;
    }
    
    if (this.wakeLock) {
      try { await this.wakeLock.release(); } catch(e){}
      this.wakeLock = null;
    }

    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }

    if ('mediaSession' in navigator) {
      (navigator as any).mediaSession.playbackState = 'none';
      try {
        ['play', 'pause', 'stop', 'hangup', 'terminate'].forEach((action) => {
          (navigator as any).mediaSession.setActionHandler(action, null);
        });
      } catch (e) {}
    }
  }
}
