
export class StayAliveService {
  private static audioEl: HTMLAudioElement | null = null;
  private static wakeLock: any = null;
  private static heartbeatInterval: any = null;

  // Optimized silent audio for continuous playback on mobile devices
  private static readonly SILENT_AUDIO_SRC = 'data:audio/wav;base64,UklGRigAAABXQVZFRm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQQAAAAAAP8A/wD/';

  public static async start(onEndCall: () => void) {
    console.log("StayAlive Service: Activating persistent foreground state...");
    try {
      // 1. Trigger MediaSession Call UI - This tells the OS that an active call is happening.
      if ('mediaSession' in navigator) {
        (navigator as any).mediaSession.metadata = new (window as any).MediaMetadata({
          title: 'Riya & Rian Call',
          artist: 'AI Partner',
          album: 'Connected Conversation',
          artwork: [
            { src: 'https://images.unsplash.com/photo-1621784563330-caee0b138a00?q=80&w=512&auto=format&fit=crop', sizes: '512x512', type: 'image/jpeg' }
          ]
        });

        const actions = ['play', 'pause', 'stop', 'hangup', 'terminate'];
        actions.forEach(action => {
          try {
            (navigator as any).mediaSession.setActionHandler(action as any, action === 'play' ? () => this.audioEl?.play() : onEndCall);
          } catch (e) {}
        });
        
        (navigator as any).mediaSession.playbackState = 'playing';
      }

      // 2. Play Silent Loop to prevent Chrome/Safari background suspension
      if (!this.audioEl) {
        this.audioEl = new Audio(this.SILENT_AUDIO_SRC);
        this.audioEl.loop = true;
      }
      
      const playAudio = async () => {
        try {
          await this.audioEl?.play();
        } catch (e) {
          console.warn("Retrying silent audio play...");
          setTimeout(playAudio, 1000);
        }
      };
      await playAudio();

      // 3. Prevent Screen Dim & CPU Throttling
      if ('wakeLock' in navigator) {
        try {
          this.wakeLock = await (navigator as any).wakeLock.request('screen');
          this.wakeLock.addEventListener('release', () => {
             // If released by OS, re-request if we are still active
             if (this.audioEl && !this.audioEl.paused) this.reAcquireWakeLock();
          });
        } catch (err) {}
      }

      // 4. Persistence Heartbeat: Keep browser active every 5s
      if (this.heartbeatInterval) clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = setInterval(() => {
        if ('mediaSession' in navigator) {
            (navigator as any).mediaSession.playbackState = 'playing';
        }
        // Force the audio to stay alive if it paused for some reason
        if (this.audioEl?.paused) {
            this.audioEl.play().catch(() => {});
        }
      }, 5000);

      // 5. Handle Tab Visibility
      document.addEventListener('visibilitychange', this.handleVisibility);

    } catch (e) {
      console.error("StayAlive Service Activation Failed:", e);
    }
  }

  private static async reAcquireWakeLock() {
    if ('wakeLock' in navigator && !this.wakeLock) {
        try { this.wakeLock = await (navigator as any).wakeLock.request('screen'); } catch(e) {}
    }
  }

  private static handleVisibility = () => {
    if (document.visibilityState === 'visible') {
        this.reAcquireWakeLock();
    }
  }

  public static async stop() {
    console.log("StayAlive Service: Releasing resources...");
    document.removeEventListener('visibilitychange', this.handleVisibility);
    
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
      const actions = ['play', 'pause', 'stop', 'hangup', 'terminate'];
      actions.forEach(action => {
        try { (navigator as any).mediaSession.setActionHandler(action as any, null); } catch (e) {}
      });
    }
  }
}
