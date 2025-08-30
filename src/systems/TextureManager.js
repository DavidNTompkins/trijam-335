import * as THREE from 'three';

export class TextureManager {
    constructor() {
        this.loader = new THREE.TextureLoader();
        this.textures = {};
        this.loadedTextures = 0;
        this.totalTextures = 0;
        this.onAllLoadedCallback = null;
    }

    async loadTextures() {
        const textureDefinitions = [
            { name: 'grass', path: 'assets/textures/grass.jpg', repeat: [8, 8] },
            { name: 'asphalt', path: 'assets/textures/asphalt.jpg', repeat: [4, 20] },
            { name: 'sky', path: 'assets/textures/sky.jpg', repeat: [1, 1] }
        ];

        this.totalTextures = textureDefinitions.length;

        const loadPromises = textureDefinitions.map(texDef => {
            return new Promise((resolve, reject) => {
                this.loader.load(
                    texDef.path,
                    (texture) => {
                        // Configure texture
                        texture.wrapS = THREE.RepeatWrapping;
                        texture.wrapT = THREE.RepeatWrapping;
                        texture.repeat.set(texDef.repeat[0], texDef.repeat[1]);
                        texture.anisotropy = 16; // Better quality at angles
                        
                        this.textures[texDef.name] = texture;
                        this.loadedTextures++;
                        
                        console.log(`Loaded texture: ${texDef.name}`);
                        resolve(texture);
                    },
                    undefined,
                    (error) => {
                        console.warn(`Failed to load texture ${texDef.name}:`, error);
                        // Create fallback color texture
                        this.textures[texDef.name] = this.createFallbackTexture(texDef.name);
                        this.loadedTextures++;
                        resolve(this.textures[texDef.name]);
                    }
                );
            });
        });

        await Promise.all(loadPromises);
        console.log(`Loaded ${this.loadedTextures}/${this.totalTextures} textures`);
        
        if (this.onAllLoadedCallback) {
            this.onAllLoadedCallback();
        }
    }

    createFallbackTexture(name) {
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = 64;
        const context = canvas.getContext('2d');
        
        // Different fallback colors for different textures
        const colors = {
            'grass': '#228B22',
            'asphalt': '#404040', 
            'sky': '#87CEEB'
        };
        
        context.fillStyle = colors[name] || '#CCCCCC';
        context.fillRect(0, 0, 64, 64);
        
        const texture = new THREE.CanvasTexture(canvas);
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        
        return texture;
    }

    getTexture(name) {
        return this.textures[name] || null;
    }

    onAllLoaded(callback) {
        if (this.loadedTextures === this.totalTextures) {
            callback();
        } else {
            this.onAllLoadedCallback = callback;
        }
    }
}