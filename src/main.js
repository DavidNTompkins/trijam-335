import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { StartMenu } from './components/StartMenu.js';
import { CharacterSelect } from './components/CharacterSelect.js';
import { Racing } from './components/Racing.js';
import { ControlSystem } from './systems/ControlSystem.js';
import { EffectsSystem } from './systems/EffectsSystem.js';
import { TextureManager } from './systems/TextureManager.js';
import { AudioSystem } from './systems/AudioSystem.js';

export class Game {
    constructor() {
        this.canvas = document.getElementById('game-canvas');
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true });
        this.loader = new GLTFLoader();
        
        this.currentState = 'start';
        this.selectedCharacter = null;
        
        this.components = {
            startMenu: null,
            characterSelect: null,
            racing: null
        };
        
        this.controlSystem = new ControlSystem();
        this.effectsSystem = null;
        this.textureManager = new TextureManager();
        this.audioSystem = new AudioSystem();
        
        window.game = this;
        
        this.init();
    }

    async init() {
        this.setupRenderer();
        this.setupLights();
        this.setupCamera();
        
        // Load textures and audio before initializing components
        await this.textureManager.loadTextures();
        await this.audioSystem.init();
        
        // Update background with sky texture
        this.updateSceneBackground();
        
        this.initComponents();
        this.bindEvents();
        this.animate();
    }

    setupRenderer() {
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.renderer.outputEncoding = THREE.sRGBEncoding;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.25;
        
        this.scene.fog = new THREE.Fog(0x87CEEB, 50, 200);
        
        // Set background - will be updated with sky texture when available
        this.updateSceneBackground();
    }

    setupLights() {
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        this.scene.add(ambientLight);

        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
        directionalLight.position.set(10, 20, 5);
        directionalLight.castShadow = true;
        directionalLight.shadow.mapSize.width = 2048;
        directionalLight.shadow.mapSize.height = 2048;
        directionalLight.shadow.camera.near = 0.5;
        directionalLight.shadow.camera.far = 100;
        directionalLight.shadow.camera.left = -50;
        directionalLight.shadow.camera.right = 50;
        directionalLight.shadow.camera.top = 50;
        directionalLight.shadow.camera.bottom = -50;
        this.scene.add(directionalLight);
    }

    setupCamera() {
        this.camera.position.set(0, 15, 20);
        this.camera.lookAt(0, 0, 0);
    }

    initComponents() {
        this.effectsSystem = new EffectsSystem(this.scene);
        
        this.components.startMenu = new StartMenu(this);
        this.components.characterSelect = new CharacterSelect(this);
        this.components.racing = new Racing(this);
        
        this.components.startMenu.show();
    }

    bindEvents() {
        window.addEventListener('resize', () => this.onWindowResize());
        
        document.getElementById('start-button').addEventListener('click', () => {
            this.setState('characterSelect');
        });
    }

    setState(newState) {
        if (this.currentState === newState) return;
        
        this.hideAllComponents();
        this.currentState = newState;
        
        switch (newState) {
            case 'start':
                this.components.startMenu.show();
                this.audioSystem.startBackgroundMusic();
                break;
            case 'characterSelect':
                this.components.characterSelect.show();
                break;
            case 'racing':
                this.components.racing.show();
                break;
        }
    }

    hideAllComponents() {
        Object.values(this.components).forEach(component => {
            if (component) component.hide();
        });
    }

    onWindowResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }

    updateSceneBackground() {
        const skyTexture = this.textureManager.getTexture('sky');
        if (skyTexture) {
            // Create sky sphere
            const skyGeometry = new THREE.SphereGeometry(500, 32, 32);
            const skyMaterial = new THREE.MeshBasicMaterial({
                map: skyTexture,
                side: THREE.BackSide
            });
            
            if (this.skyMesh) {
                this.scene.remove(this.skyMesh);
            }
            
            this.skyMesh = new THREE.Mesh(skyGeometry, skyMaterial);
            this.scene.add(this.skyMesh);
        } else {
            this.scene.background = new THREE.Color(0x87CEEB);
        }
    }

    createKeyPressEffect(keyInfo, color) {
        if (this.effectsSystem && this.components.racing && this.components.racing.player && this.components.racing.player.model) {
            const position = this.components.racing.player.model.position.clone();
            position.y += 2;
            this.effectsSystem.createKeyPressEffect(position, keyInfo, color);
        }
    }

    animate() {
        requestAnimationFrame(() => this.animate());
        
        const deltaTime = 0.016;
        
        if (this.components[this.currentState]) {
            this.components[this.currentState].update(deltaTime);
        }
        
        if (this.effectsSystem) {
            this.effectsSystem.update(deltaTime);
        }
        
        this.renderer.render(this.scene, this.camera);
    }
}

const game = new Game();