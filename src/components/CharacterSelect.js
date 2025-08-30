import * as THREE from 'three';

export class CharacterSelect {
    constructor(game) {
        this.game = game;
        this.element = document.getElementById('character-select');
        this.nameElement = document.getElementById('character-name');
        this.descriptionElement = document.getElementById('character-description');
        this.selectButton = document.getElementById('select-character');
        
        this.isVisible = false;
        this.currentCharacterIndex = 0;
        this.characters = [];
        this.characterModels = [];
        
        this.time = 0;
        this.isTransitioning = false;
        
        this.setupCharacters();
        this.setupEvents();
        this.createCharacterModels();
    }

    setupCharacters() {
        this.characters = [
            {
                name: "Slick",
                description: "He was a sprinter before he got SNAILED",
                color: 0x32CD32,
                speed: 1.2,
                acceleration: 1.1,
                handling: 1.3
            },
            {
                name: "Wally",
                description: "He's been eating a lot of grass",
                color: 0x8B4513,
                speed: 1.0,
                acceleration: 0.7,
                handling: 0.9
            },
            {
                name: "Baphomet",
                description: "He was SNAILED as a punishment for evil doing",
                color: 0x4169E1,
                speed: 1.5,
                acceleration: 1.0,
                handling: 1.0
            }
        ];
    }

    setupEvents() {
        this.keyHandler = (event) => {
            if (!this.isVisible || this.isTransitioning) return;
            
            if (event.key === 'a' || event.key === 'A' || event.key === 'ArrowLeft') {
                this.previousCharacter();
            } else if (event.key === 'd' || event.key === 'D' || event.key === 'ArrowRight') {
                this.nextCharacter();
            } else if (event.key === 'Enter' || event.key === ' ') {
                this.selectCurrentCharacter();
            }
        };
        
        this.selectButton.addEventListener('click', () => {
            this.selectCurrentCharacter();
        });
    }

    async createCharacterModels() {
        const positions = [
            { x: -8, y: 0, z: 0 },
            { x: 0, y: 0, z: 0 },
            { x: 8, y: 0, z: 0 }
        ];

        for (let i = 0; i < this.characters.length; i++) {
            let model;
            
            try {
                const gltf = await this.game.loader.loadAsync(`assets/models/snail_${i + 1}.glb`);
                model = gltf.scene;
                model.traverse((child) => {
                    if (child.isMesh) {
                        child.castShadow = true;
                        child.receiveShadow = true;
                        if (child.material) {
                            //child.material.color.setHex(this.characters[i].color);
                        }
                    }
                });
            } catch (error) {
                console.log(`Could not load model for character ${i + 1}, using placeholder`);
                model = this.createPlaceholderSnail(this.characters[i].color);
            }
            
            model.position.copy(positions[i]);
            model.position.y = 1;
            model.scale.set(3, 3, 3);
            model.userData.originalPosition = positions[i];
            model.userData.characterIndex = i;
            model.visible = false;
            
            this.characterModels.push(model);
            this.game.scene.add(model);
        }
    }

    createPlaceholderSnail(color) {
        const group = new THREE.Group();
        
        const bodyGeometry = new THREE.SphereGeometry(1, 16, 16);
        const bodyMaterial = new THREE.MeshLambertMaterial({ color: color });
        const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
        body.scale.set(1.2, 0.8, 1.5);
        body.castShadow = true;
        body.receiveShadow = true;
        
        const shellGeometry = new THREE.SphereGeometry(0.8, 16, 16);
        const shellMaterial = new THREE.MeshLambertMaterial({ 
            color: new THREE.Color(color).multiplyScalar(0.7)
        });
        const shell = new THREE.Mesh(shellGeometry, shellMaterial);
        shell.position.set(0, 0.2, -0.3);
        shell.scale.set(1, 1.2, 0.8);
        shell.castShadow = true;
        shell.receiveShadow = true;
        
        const eyeGeometry = new THREE.SphereGeometry(0.1, 8, 8);
        const eyeMaterial = new THREE.MeshLambertMaterial({ color: 0x000000 });
        
        const leftEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
        leftEye.position.set(-0.3, 0.5, 0.8);
        
        const rightEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
        rightEye.position.set(0.3, 0.5, 0.8);
        
        group.add(body);
        group.add(shell);
        group.add(leftEye);
        group.add(rightEye);
        
        return group;
    }

    previousCharacter() {
        if (this.isTransitioning) return;
        this.currentCharacterIndex = (this.currentCharacterIndex - 1 + this.characters.length) % this.characters.length;
        this.transitionToCharacter();
    }

    nextCharacter() {
        if (this.isTransitioning) return;
        this.currentCharacterIndex = (this.currentCharacterIndex + 1) % this.characters.length;
        this.transitionToCharacter();
    }

    transitionToCharacter() {
        this.isTransitioning = true;
        this.updateUI();
        
        this.characterModels.forEach((model, index) => {
            let targetX;
            if (index === this.currentCharacterIndex) {
                targetX = 0;
            } else if (index < this.currentCharacterIndex) {
                targetX = -20 - (this.currentCharacterIndex - index - 1) * 5;
            } else {
                targetX = 20 + (index - this.currentCharacterIndex - 1) * 5;
            }
            
            this.animateModelPosition(model, targetX, () => {
                if (index === this.currentCharacterIndex) {
                    this.isTransitioning = false;
                }
            });
        });
    }

    animateModelPosition(model, targetX, callback) {
        const startX = model.position.x;
        const duration = 500;
        const startTime = Date.now();
        
        const animate = () => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            
            model.position.x = startX + (targetX - startX) * eased;
            
            if (progress < 1) {
                requestAnimationFrame(animate);
            } else if (callback) {
                callback();
            }
        };
        
        animate();
    }

    updateUI() {
        const character = this.characters[this.currentCharacterIndex];
        this.nameElement.textContent = character.name;
        this.descriptionElement.textContent = character.description;
    }

    selectCurrentCharacter() {
        this.game.selectedCharacter = this.characters[this.currentCharacterIndex];
        this.game.selectedCharacterIndex = this.currentCharacterIndex;
        this.game.setState('racing');
    }

    show() {
        this.element.classList.remove('hidden');
        this.isVisible = true;
        
        document.addEventListener('keydown', this.keyHandler);
        
        this.characterModels.forEach(model => model.visible = true);
        this.transitionToCharacter();
        
        // Hide any racing elements that might be visible
        if (this.game.components.racing && this.game.components.racing.startGateMesh) {
            this.game.components.racing.startGateMesh.visible = false;
        }
        if (this.game.components.racing && this.game.components.racing.halfwayGateMesh) {
            this.game.components.racing.halfwayGateMesh.visible = false;
        }
        
        this.game.camera.position.set(0, 4, 8);
        this.game.camera.lookAt(0, 0, 0);
    }

    hide() {
        this.element.classList.add('hidden');
        this.isVisible = false;
        
        document.removeEventListener('keydown', this.keyHandler);
        
        this.characterModels.forEach(model => model.visible = false);
    }

    update(deltaTime) {
        if (!this.isVisible) return;
        
        this.time += deltaTime;
        
        this.characterModels.forEach((model, index) => {
            if (index === this.currentCharacterIndex) {
                model.rotation.y += deltaTime * 0.5;
                model.position.y = 1 + Math.sin(this.time * 3) * 0.3;
            } else {
                model.rotation.y += deltaTime * 0.2;
                model.position.y = 1;
            }
        });
        
        const cameraOffset = Math.sin(this.time * 0.5) * 2;
        this.game.camera.position.x = cameraOffset;
        this.game.camera.lookAt(0, 0, 0);
    }

    destroy() {
        this.characterModels.forEach(model => {
            this.game.scene.remove(model);
        });
        this.characterModels = [];
        document.removeEventListener('keydown', this.keyHandler);
    }
}