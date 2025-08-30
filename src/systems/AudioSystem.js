// AudioSystem.js
export class AudioSystem {
  /**
   * @param {Object} [opts]
   * @param {string[]} [opts.musicPaths] - Candidate URLs to try, first one that loads wins.
   * @param {number} [opts.volume] - 0..1 initial volume.
   * @param {boolean} [opts.autoplay] - Try to start immediately after init.
   * @param {number} [opts.loadTimeoutMs] - Safety timeout for loading.
   */
  constructor(opts = {}) {
    this.backgroundMusic = null;
    this.musicVolume = typeof opts.volume === 'number' ? clamp01(opts.volume) : 0.5;
    this.isInitialized = false;

    this._musicPaths = Array.isArray(opts.musicPaths) && opts.musicPaths.length
      ? opts.musicPaths
      : [
          // Customize as needed
          './assets/audio/background-music.mp3',
          'assets/audio/background_music.mp3',
          'assets/audio/music.mp3'
        ];

    this._autoplay = !!opts.autoplay;
    this._loadTimeoutMs = typeof opts.loadTimeoutMs === 'number' ? opts.loadTimeoutMs : 8000;

    this._gestureArmed = false;
  }

  /** Initialize and attempt to load a background track from the candidate paths. */
  async init() {
    try {
      for (const url of this._musicPaths) {
        try {
          const ok = await this._loadFromUrl(url);
          if (ok) {
            console.log(`Background music loaded from: ${url}`);
            break;
          }
        } catch (err) {
          console.log(`Failed to load music from ${url}, trying next…`);
        }
      }
    } catch (err) {
      console.warn('Audio system failed to initialize:', err);
    } finally {
      this.isInitialized = true;
      console.log('Audio system initialized', this.backgroundMusic ? 'with music' : 'without music');
      if (this._autoplay && this.backgroundMusic) this.startBackgroundMusic();
    }
  }

  /** Backwards-compat: explicit single-URL load */
  async loadBackgroundMusic(url) {
    const ok = await this._loadFromUrl(url);
    if (!ok) throw new Error('Failed to load background music');
  }

  // Add to AudioSystem class:
// In AudioSystem.js
armOnFirstGesture(targets = [document, window]) {
  if (this._gestureArmed) return;
  this._gestureArmed = true;

  const isUsefulKey = (e) => !['Shift', 'Control', 'Alt', 'Meta'].includes(e.key);

  // IMPORTANT: call play() synchronously before any await/promise work
  const handler = (e) => {
    if (e.type === 'keydown' && !isUsefulKey(e)) return;

    try {
      const a = this.backgroundMusic;
      if (a && a.paused) {
        const playPromise = a.play?.();
        // Don't await; keep it sync to preserve user gesture
        if (playPromise && typeof playPromise.catch === 'function') {
          playPromise.catch((err) => console.warn('Play failed in gesture:', err));
        }
      }
    } finally {
      // If you later use THREE.WebAudio, resume its context *after* calling play()
      try {
        const ctx = globalThis?.THREE?.AudioContext?.getContext?.();
        if (ctx && ctx.state === 'suspended') {
          // no await: keep handler synchronous
          ctx.resume?.();
        }
      } catch {}

      // Listeners are once:true; they'll auto-remove
      this._gestureArmed = false;
    }
  };

  const opts = { once: true, passive: true, capture: true };

  // pointerdown fires earlier than click and covers mouse/touch/pen
  targets.forEach((t) => {
    if (!t) return;
    t.addEventListener('pointerdown', handler, opts);
    t.addEventListener('keydown', handler, { ...opts, passive: false });
  });
}


  /** Start playing (or arm a user-gesture handler if autoplay is blocked). */
  startBackgroundMusic() {
    if (!this.backgroundMusic) {
      console.warn('Cannot start background music - no audio loaded');
      return;
    }
    if (!this.isInitialized) {
      console.warn('Cannot start background music - not initialized yet');
      return;
    }

    this.backgroundMusic.currentTime = 0;
    const p = this.backgroundMusic.play?.();
    if (p && typeof p.then === 'function') {
      p.then(() => {
        console.log('Background music started successfully');
      }).catch((err) => {
        console.warn('Autoplay blocked; arming user interaction handler…', err);
        this._armUserInteractionPlay();
      });
    }
  }

  /** Pause and rewind. */
  stopBackgroundMusic() {
    if (this.backgroundMusic) {
      this.backgroundMusic.pause?.();
      this.backgroundMusic.currentTime = 0;
    }
  }

  pauseMusic() {
    if (this.backgroundMusic && !this.backgroundMusic.paused) {
      this.backgroundMusic.pause?.();
    }
  }

  resumeMusic() {
    if (this.backgroundMusic && this.backgroundMusic.paused) {
      this.backgroundMusic.play?.().catch((error) => {
        console.warn('Could not resume background music:', error);
        this._armUserInteractionPlay();
      });
    }
  }

  toggleMusic() {
    if (!this.backgroundMusic) return;
    if (this.backgroundMusic.paused) this.resumeMusic();
    else this.pauseMusic();
  }

  setMusicVolume(volume) {
    this.musicVolume = clamp01(volume);
    if (this.backgroundMusic) this.backgroundMusic.volume = this.musicVolume;
  }

  /** Cleanup */
  destroy() {
    this.stopBackgroundMusic();
    if (this.backgroundMusic) {
      // detach src to help GC on some browsers
      this.backgroundMusic.src = '';
      this.backgroundMusic = null;
    }
    this._disarmUserInteractionPlay();
    this.isInitialized = false;
  }

  // ---------- Internals ----------

  async _loadFromUrl(url) {
    // Make a fresh element; only assign to this.backgroundMusic on success.
    const audio = new Audio();
    // If you need audio for WebAudio/filters later, uncomment:
    // audio.crossOrigin = 'anonymous';
    audio.src = url;
    audio.loop = true;
    audio.preload = 'auto';
    audio.volume = this.musicVolume;

    // Wait for reliable readiness; canplaythrough is flaky across servers.
    await this._waitForAudioReady(audio, this._loadTimeoutMs);

    // Swap in the newly loaded instance.
    if (this.backgroundMusic) {
      this.stopBackgroundMusic();
      // avoid dangling references
      this.backgroundMusic.src = '';
    }
    this.backgroundMusic = audio;
    console.log('Background music loaded successfully');
    return true;
  }

  _waitForAudioReady(audio, timeoutMs = 8000) {
    return new Promise((resolve, reject) => {
      let settled = false;
      let timeoutId;

      const cleanup = () => {
        if (timeoutId) clearTimeout(timeoutId);
        audio.removeEventListener('loadedmetadata', onReady);
        audio.removeEventListener('loadeddata', onReady);
        audio.removeEventListener('error', onErr);
        audio.removeEventListener('stalled', onStall);
        audio.removeEventListener('abort', onErr);
      };

      const settle = (fn) => (e) => {
        if (settled) return;
        settled = true;
        cleanup();
        fn(e);
      };

      const onReady = settle(() => resolve());
      const onErr = settle((e) => reject(e instanceof Error ? e : new Error('Audio error')));
      const onStall = () => {
        // Some servers stream without length; if we already have metadata, consider it good enough.
        if (!settled && (isFinite(audio.duration) || audio.duration > 0)) onReady();
      };

      audio.addEventListener('loadedmetadata', onReady, { once: true });
      audio.addEventListener('loadeddata', onReady, { once: true });
      audio.addEventListener('error', onErr, { once: true });
      audio.addEventListener('stalled', onStall);
      audio.addEventListener('abort', onErr, { once: true });

      timeoutId = setTimeout(() => onErr(new Error('Audio load timeout')), timeoutMs);

      // Kick off the fetch/parsing
      try {
        audio.load();
      } catch (e) {
        onErr(e);
      }
    });
  }

  _armUserInteractionPlay() {
    if (this._gestureArmed) return;
    this._gestureArmed = true;

    const tryResumeContexts = async () => {
      // If you’re using THREE’s WebAudio, resume its shared context too.
      try {
        const ctx = globalThis?.THREE?.AudioContext?.getContext?.();
        if (ctx && ctx.state === 'suspended') await ctx.resume();
      } catch (_) {
        // ignore
      }
    };

    const handler = async () => {
      await tryResumeContexts();
      try {
        await this.backgroundMusic?.play?.();
      } catch (err) {
        console.warn('Still could not play after user interaction:', err);
      } finally {
        this._disarmUserInteractionPlay();
      }
    };

    // pointerdown catches mouse/touch/pen; keydown as a fallback
    const oncePassive = { once: true, passive: true, capture: true };
    window.addEventListener('pointerdown', handler, oncePassive);
    window.addEventListener('keydown', handler, { once: true, capture: true });
  }

  _disarmUserInteractionPlay() {
    if (!this._gestureArmed) return;
    this._gestureArmed = false;
    // We registered with { once: true }, so they auto-remove after the first fire.
    // Nothing needed here unless you change to persistent listeners.
  }
}

// ---------- Helpers ----------
function clamp01(n) {
  n = Number(n);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}
