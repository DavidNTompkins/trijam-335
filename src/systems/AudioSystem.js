export class AudioSystem {
    constructor() {
        this.backgroundMusic = null;
        this.musicVolume = 0.5;
        this.isInitialized = false;
    }

    async init() {
        try {
            // Load background music
            await this.loadBackgroundMusic('assets/audio/background_music.mp3');
            
            this.isInitialized = true;
            console.log('Audio system initialized');
        } catch (error) {
            console.warn('Audio system failed to initialize:', error);
        }
    }

    async loadBackgroundMusic(url) {
        try {
            this.backgroundMusic = new Audio(url);
            this.backgroundMusic.loop = true;
            this.backgroundMusic.volume = this.musicVolume;
            
            // Preload the audio
            await new Promise((resolve, reject) => {
                this.backgroundMusic.addEventListener('canplaythrough', resolve, { once: true });
                this.backgroundMusic.addEventListener('error', reject, { once: true });
                this.backgroundMusic.load();
            });
            
            console.log('Background music loaded successfully');
        } catch (error) {
            console.warn('Failed to load background music:', error);
            this.backgroundMusic = null;
        }
    }


    startBackgroundMusic() {
        if (this.backgroundMusic && this.isInitialized) {
            this.backgroundMusic.currentTime = 0;
            const playPromise = this.backgroundMusic.play();
            
            if (playPromise !== undefined) {
                playPromise.catch(error => {
                    console.warn('Could not play background music:', error);
                    // Try to play after user interaction
                    this.setupUserInteractionHandler();
                });
            }
        }
    }

    stopBackgroundMusic() {
        if (this.backgroundMusic) {
            this.backgroundMusic.pause();
            this.backgroundMusic.currentTime = 0;
        }
    }


    setupUserInteractionHandler() {
        const handleUserInteraction = () => {
            if (this.backgroundMusic) {
                this.backgroundMusic.play().catch(error => {
                    console.warn('Still could not play background music after user interaction:', error);
                });
            }
            
            // Remove the event listeners after first interaction
            document.removeEventListener('click', handleUserInteraction);
            document.removeEventListener('keydown', handleUserInteraction);
            document.removeEventListener('touchstart', handleUserInteraction);
        };

        document.addEventListener('click', handleUserInteraction, { once: true });
        document.addEventListener('keydown', handleUserInteraction, { once: true });
        document.addEventListener('touchstart', handleUserInteraction, { once: true });
    }

    setMusicVolume(volume) {
        this.musicVolume = Math.max(0, Math.min(1, volume));
        if (this.backgroundMusic) {
            this.backgroundMusic.volume = this.musicVolume;
        }
    }


    pauseMusic() {
        if (this.backgroundMusic && !this.backgroundMusic.paused) {
            this.backgroundMusic.pause();
        }
    }

    resumeMusic() {
        if (this.backgroundMusic && this.backgroundMusic.paused) {
            this.backgroundMusic.play().catch(error => {
                console.warn('Could not resume background music:', error);
            });
        }
    }

    toggleMusic() {
        if (this.backgroundMusic) {
            if (this.backgroundMusic.paused) {
                this.resumeMusic();
            } else {
                this.pauseMusic();
            }
        }
    }

    destroy() {
        this.stopBackgroundMusic();
        
        if (this.backgroundMusic) {
            this.backgroundMusic = null;
        }
        
        this.isInitialized = false;
    }
}