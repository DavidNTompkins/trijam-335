import * as THREE from 'three';
import { CollisionSystem } from '../systems/CollisionSystem.js';

export class Racing {
    constructor(game) {
        this.game = game;
        this.element = document.getElementById('racing-ui');
        this.isVisible = false;
        
        this.track = null;
        this.player = null;
        this.aiRacers = [];
        this.checkpoints = [];
        this.particles = [];

        // Race state / UI
        this.raceProgress = {
            player: 0,
            aiRacers: []
        };
        this.raceStarted = false;
        this.raceFinished = false;
        this.countdown = 3;
        this.countdownTimer = 0;
        this.finishOrder = [];       // NEW: order racers cross 2 laps
        this.finishBannerEl = null;  // NEW: DOM overlay element
        
        this.time = 0;
        this.cameraShake = { x: 0, y: 0, intensity: 0 };
        this.collisionSystem = new CollisionSystem();
        
        this.setupTrack();
        this.setupPlayer();
        this.setupAIRacers();
        this.setupCheckpoints();
    }

    setupTrack() {
        const trackGroup = new THREE.Group();
        
        this.trackWidth = 12;
        this.trackPath = this.createTrackPath();
        
        const trackMesh = this.createTrackMesh();
        const grassMesh = this.createGrassMesh();
        
        trackGroup.add(trackMesh);
        trackGroup.add(grassMesh);
        
        this.addTrackMarkings();
        this.addPerimeterFence();
        
        this.track = trackGroup;
        this.game.scene.add(trackGroup);
    }

    createTrackPath() {
        const points = [
            new THREE.Vector2(-40, -20),  // Start line
            new THREE.Vector2(-40, 20),   // Straight
            new THREE.Vector2(-30, 35),   // Curve
            new THREE.Vector2(-10, 40),   // Curve
            new THREE.Vector2(20, 40),    // Straight
            new THREE.Vector2(35, 30),    // Curve
            new THREE.Vector2(40, 10),    // Curve
            new THREE.Vector2(40, -10),   // Straight
            new THREE.Vector2(35, -30),   // Curve
            new THREE.Vector2(20, -40),   // Curve
            new THREE.Vector2(-20, -40),  // Straight
            new THREE.Vector2(-35, -30),  // Curve
            new THREE.Vector2(-40, -20)   // Back to start
        ];
        
        const curve = new THREE.CatmullRomCurve3(
            points.map(p => new THREE.Vector3(p.x, 0, p.y))
        );
        curve.closed = true;
        
        return curve;
    }

    createTrackMesh() {
        const trackPoints = this.trackPath.getPoints(200);
        const trackGeometry = new THREE.BufferGeometry();
        
        const vertices = [];
        theIndices: {
        }
        const indices = [];
        const uvs = [];
        
        const halfWidth = this.trackWidth / 2;
        
        for (let i = 0; i < trackPoints.length; i++) {
            const point = trackPoints[i];
            const nextPoint = trackPoints[(i + 1) % trackPoints.length];
            
            const direction = new THREE.Vector3().subVectors(nextPoint, point).normalize();
            const perpendicular = new THREE.Vector3(-direction.z, 0, direction.x);
            
            const leftPoint = new THREE.Vector3().addVectors(point, perpendicular.clone().multiplyScalar(halfWidth));
            const rightPoint = new THREE.Vector3().addVectors(point, perpendicular.clone().multiplyScalar(-halfWidth));
            
            vertices.push(leftPoint.x, leftPoint.y, leftPoint.z);
            vertices.push(rightPoint.x, rightPoint.y, rightPoint.z);
            
            uvs.push(0, i / trackPoints.length);
            uvs.push(1, i / trackPoints.length);
            
            if (i < trackPoints.length - 1) {
                const base = i * 2;
                indices.push(base, base + 1, base + 2);
                indices.push(base + 1, base + 3, base + 2);
            }
        }
        
        const base = (trackPoints.length - 1) * 2;
        indices.push(base, base + 1, 0);
        indices.push(base + 1, 1, 0);
        
        trackGeometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
        trackGeometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
        trackGeometry.setIndex(indices);
        trackGeometry.computeVertexNormals();
        
        const asphaltTexture = this.game.textureManager.getTexture('asphalt');
        const trackMaterial = new THREE.MeshLambertMaterial({ 
            color: asphaltTexture ? 0xFFFFFF : 0x8B4513,
            map: asphaltTexture,
            side: THREE.DoubleSide
        });
        
        const trackMesh = new THREE.Mesh(trackGeometry, trackMaterial);
        trackMesh.receiveShadow = true;
        return trackMesh;
    }

    createGrassMesh() {
        const grassGeometry = new THREE.PlaneGeometry(200, 200);
        const grassTexture = this.game.textureManager.getTexture('grass');
        const grassMaterial = new THREE.MeshLambertMaterial({ 
            color: grassTexture ? 0xFFFFFF : 0x228B22,
            map: grassTexture
        });
        
        const grassMesh = new THREE.Mesh(grassGeometry, grassMaterial);
        grassMesh.rotation.x = -Math.PI / 2;
        grassMesh.position.y = -0.1;
        grassMesh.receiveShadow = true;
        
        return grassMesh;
    }

    addTrackMarkings() {
        const markingGroup = new THREE.Group();
        const trackPoints = this.trackPath.getPoints(200);
        
        // Skip start/finish area completely - avoid first 20 and last 20 points
        for (let i = 20; i < trackPoints.length - 20; i += 15) {
            const point = trackPoints[i];
            const nextIndex = (i + 6) % trackPoints.length;
            const nextPoint = trackPoints[nextIndex];
            
            const direction = new THREE.Vector3().subVectors(nextPoint, point).normalize();
            const angle = Math.atan2(direction.z, direction.x);
            
            const markingGeometry = new THREE.BoxGeometry(2.5, 0.05, 0.6);
            const markingMaterial = new THREE.MeshLambertMaterial({ color: 0xFFFFFF });
            const marking = new THREE.Mesh(markingGeometry, markingMaterial);
            
            marking.position.copy(point);
            marking.position.y = 0.05;
            marking.rotation.y = angle;
            
            markingGroup.add(marking);
        }
        
        this.markingGroup = markingGroup;
        this.game.scene.add(markingGroup);
    }

    addPerimeterFence() {
        const fenceGroup = new THREE.Group();
        const mapSize = 100;
        const fenceHeight = 4;
        const postSpacing = 8;
        
        const fencePostGeometry = new THREE.BoxGeometry(0.3, fenceHeight, 0.3);
        const fencePostMaterial = new THREE.MeshLambertMaterial({ color: 0x8B4513 });
        
        const fenceRailGeometry = new THREE.BoxGeometry(postSpacing, 0.2, 0.2);
        const fenceRailMaterial = new THREE.MeshLambertMaterial({ color: 0xDEB887 });
        
        const sides = [
            { start: [-mapSize/2, -mapSize/2], end: [mapSize/2, -mapSize/2], dir: [1, 0] },
            { start: [mapSize/2, -mapSize/2], end: [mapSize/2, mapSize/2], dir: [0, 1] }, 
            { start: [mapSize/2, mapSize/2], end: [-mapSize/2, mapSize/2], dir: [-1, 0] },
            { start: [-mapSize/2, mapSize/2], end: [-mapSize/2, -mapSize/2], dir: [0, -1] }
        ];
        
        sides.forEach(side => {
            const sideLength = Math.sqrt(
                Math.pow(side.end[0] - side.start[0], 2) + 
                Math.pow(side.end[1] - side.start[1], 2)
            );
            const numPosts = Math.floor(sideLength / postSpacing) + 1;
            
            for (let i = 0; i <= numPosts; i++) {
                const t = i / numPosts;
                const x = side.start[0] + (side.end[0] - side.start[0]) * t;
                const z = side.start[1] + (side.end[1] - side.start[1]) * t;
                
                const post = new THREE.Mesh(fencePostGeometry, fencePostMaterial);
                post.position.set(x, fenceHeight/2, z);
                post.castShadow = true;
                post.receiveShadow = true;
                fenceGroup.add(post);
                
                if (i < numPosts) {
                    const railX = x + (side.end[0] - side.start[0]) * postSpacing / (2 * sideLength);
                    const railZ = z + (side.end[1] - side.start[1]) * postSpacing / (2 * sideLength);
                    
                    for (let railHeight = 1; railHeight <= 3; railHeight += 1) {
                        const rail = new THREE.Mesh(fenceRailGeometry, fenceRailMaterial);
                        rail.position.set(railX, railHeight, railZ);
                        
                        if (side.dir[0] !== 0) {
                            rail.rotation.y = 0;
                        } else {
                            rail.rotation.y = Math.PI / 2;
                        }
                        
                        rail.castShadow = true;
                        rail.receiveShadow = true;
                        fenceGroup.add(rail);
                    }
                }
            }
        });
        
        this.fenceGroup = fenceGroup;
        this.game.scene.add(fenceGroup);
    }

    setupPlayer() {
        this.player = {
            model: null,
            position: new THREE.Vector3(-40, 0, -20),
            rotation: Math.PI / 2,
            velocity: new THREE.Vector3(0, 0, 0),
            lap: 0,
            passedStartLine: false,
            passedHalfwayPoint: false,
            character: null
        };
        
        // Player model will be created when racing starts with selected character
    }

    async createPlayerModel() {
        let model;
        const character = this.game.selectedCharacter;
        const characterIndex = this.game.selectedCharacterIndex !== undefined ? this.game.selectedCharacterIndex : 0;
        
        console.log(`Creating player model with character index: ${characterIndex}, character:`, character);
        
        try {
            const gltf = await this.game.loader.loadAsync(`assets/models/snail_${characterIndex + 1}.glb`);
            model = gltf.scene.clone();
            
            model.traverse((child) => {
                if (child.isMesh) {
                    child.castShadow = true;
                    child.receiveShadow = true;
                }
            });
            console.log(`Successfully loaded player model: snail_${characterIndex + 1}.glb`);
        } catch (error) {
            console.log(`Could not load player model snail_${characterIndex + 1}.glb, using placeholder`);
            const color = character ? character.color : 0x32CD32;
            model = this.createPlaceholderSnail(color);
        }
        
        model.position.copy(this.player.position);
        model.position.y = 0.5;
        model.rotation.y = this.player.rotation - Math.PI/2;
        model.scale.set(1.5, 1.5, 1.5);
        
        this.player.model = model;
        this.game.scene.add(model);
    }

    setupAIRacers() {
        // Don't create AI models here, wait for racing to start
        const aiCount = 4;  // Reduced to 4 since player takes 1 slot
        const colors = [0xFF6B6B, 0x4ECDC4, 0xFFE66D, 0xFF8B94];
        
        for (let i = 0; i < aiCount; i++) {
            const startPos = new THREE.Vector3(-38 + (i + 1) * 2, 0.5, -20);
            const ai = {
                model: null,
                position: startPos.clone(),  // Start at same position
                rotation: Math.PI / 2,
                speed: 2.6 + Math.random() * 0.4,
                lap: 0,
                trackProgress: 0,
                targetTrackProgress: (i + 1) * 0.1,
                personality: Math.random(),
                color: colors[i],
                startPosition: startPos.clone(),  // Store starting position
                finished: false                   // NEW
            };
            
            this.aiRacers.push(ai);
        }
    }

    async createAIModel(ai, index) {
        let model;
        const playerCharacterIndex = this.game.selectedCharacterIndex !== undefined ? this.game.selectedCharacterIndex : 0;
        
        try {
            // Create list of all available models (1-5) excluding the player's choice
            const allModels = [1, 2, 3, 4, 5];
            const availableModels = allModels.filter(i => i !== (playerCharacterIndex + 1));
            
            // Assign models cyclically from available ones
            const modelIndex = availableModels[index % availableModels.length];
            
            console.log(`AI ${index}: Using model ${modelIndex}, player has ${playerCharacterIndex + 1}`);
            
            const gltf = await this.game.loader.loadAsync(`assets/models/snail_${modelIndex}.glb`);
            model = gltf.scene.clone();
            
            model.traverse((child) => {
                if (child.isMesh) {
                    child.castShadow = true;
                    child.receiveShadow = true;
                }
            });
        } catch (error) {
            console.log(`Could not load AI model, using placeholder`);
            model = this.createPlaceholderSnail(ai.color);
        }
        
        // Set starting position
        model.position.copy(ai.startPosition);
        model.rotation.y = ai.rotation;
        model.scale.set(1.2, 1.2, 1.2);
        model.visible = false;
        
        ai.model = model;
        this.game.scene.add(model);
    }

    createPlaceholderSnail(color) {
        const group = new THREE.Group();
        
        const bodyGeometry = new THREE.CapsuleGeometry(0.5, 1.5, 4, 8);
        const bodyMaterial = new THREE.MeshLambertMaterial({ color: color });
        const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
        body.castShadow = true;
        body.receiveShadow = true;
        
        const shellGeometry = new THREE.SphereGeometry(0.6, 12, 12);
        const shellMaterial = new THREE.MeshLambertMaterial({ 
            color: new THREE.Color(color).multiplyScalar(0.7)
        });
        const shell = new THREE.Mesh(shellGeometry, shellMaterial);
        shell.position.set(0, 0.2, -0.5);
        shell.castShadow = true;
        shell.receiveShadow = true;
        
        group.add(body);
        group.add(shell);
        
        return group;
    }

    setupCheckpoints() {
        this.startLineGate = {
            position: new THREE.Vector3(-40, 0, -20),
            width: 15,
            direction: new THREE.Vector3(0, 0, 1)
        };
        
        this.halfwayGate = {
            position: new THREE.Vector3(40, 0, 0),
            width: 15,
            direction: new THREE.Vector3(0, 0, 1)
        };
        
        this.createCheckeredStartGate();
        this.createArchGate();
    }

    createCheckeredStartGate() {
        const gateGroup = new THREE.Group();
        
        const poleGeometry = new THREE.CylinderGeometry(0.2, 0.2, 5);
        const poleMaterial = new THREE.MeshLambertMaterial({ color: 0xFFFFFF });
        
        const leftPole = new THREE.Mesh(poleGeometry, poleMaterial);
        leftPole.position.set(-7.5, 2.5, 0);
        gateGroup.add(leftPole);
        
        const rightPole = new THREE.Mesh(poleGeometry, poleMaterial);
        rightPole.position.set(7.5, 2.5, 0);
        gateGroup.add(rightPole);
        
        const flagGeometry = new THREE.PlaneGeometry(15, 3);
        const flagCanvas = document.createElement('canvas');
        flagCanvas.width = 64;
        flagCanvas.height = 16;
        const flagContext = flagCanvas.getContext('2d');
        
        const squareSize = 4;
        for (let x = 0; x < 64; x += squareSize) {
            for (let y = 0; y < 16; y += squareSize) {
                const isBlack = (Math.floor(x / squareSize) + Math.floor(y / squareSize)) % 2 === 0;
                flagContext.fillStyle = isBlack ? '#000000' : '#FFFFFF';
                flagContext.fillRect(x, y, squareSize, squareSize);
            }
        }
        
        const flagTexture = new THREE.CanvasTexture(flagCanvas);
        const flagMaterial = new THREE.MeshLambertMaterial({ 
            map: flagTexture,
            transparent: true,
            side: THREE.DoubleSide
        });
        
        const flag = new THREE.Mesh(flagGeometry, flagMaterial);
        flag.position.set(0, 4, 0);
        gateGroup.add(flag);
        
        gateGroup.position.copy(this.startLineGate.position);
        this.startGateMesh = gateGroup;
        this.game.scene.add(gateGroup);
    }

    createArchGate() {
        const gateGroup = new THREE.Group();
        
        const poleGeometry = new THREE.CylinderGeometry(0.3, 0.3, 6);
        const poleMaterial = new THREE.MeshLambertMaterial({ color: 0xFF4444 });
        
        const leftPole = new THREE.Mesh(poleGeometry, poleMaterial);
        leftPole.position.set(-7.5, 3, 0);
        gateGroup.add(leftPole);
        
        const rightPole = new THREE.Mesh(poleGeometry, poleMaterial);
        rightPole.position.set(7.5, 3, 0);
        gateGroup.add(rightPole);
        
        const archGeometry = new THREE.CylinderGeometry(0.3, 0.3, 15);
        const archMaterial = new THREE.MeshLambertMaterial({ color: 0xFF4444 });
        const arch = new THREE.Mesh(archGeometry, archMaterial);
        arch.position.set(0, 6, 0);
        arch.rotation.z = Math.PI / 2;
        gateGroup.add(arch);
        
        gateGroup.position.copy(this.halfwayGate.position);
        this.halfwayGateMesh = gateGroup;
        this.game.scene.add(gateGroup);
    }

    startRace() {
        // Reset race state for a clean start
        this.raceStarted = false;
        this.raceFinished = false;
        this.finishOrder = [];
        this.countdown = 3;
        this.countdownTimer = 0;

        // Reset UI banner if it exists
        if (this.finishBannerEl) {
            this.finishBannerEl.remove();
            this.finishBannerEl = null;
        }

        // Reset player state
        if (this.player) {
            this.player.lap = 0;
            this.player.passedStartLine = false;
            this.player.passedHalfwayPoint = false;
            this.player.velocity.set(0, 0, 0);
            if (this.player.model) {
                this.player.position.set(-40, 0, -20);
                this.player.rotation = Math.PI / 2;
                this.player.model.position.copy(this.player.position);
                this.player.model.rotation.y = this.player.rotation - Math.PI / 2;
            }
        }

        // Reset AIs
        this.aiRacers.forEach(ai => {
            ai.lap = 0;
            ai.trackProgress = 0;
            ai.finished = false;
            ai.position.copy(ai.startPosition);
            if (ai.model) {
                ai.model.position.copy(ai.startPosition);
                ai.model.rotation.y = ai.rotation;
            }
        });
        
        this.game.controlSystem.setInputCallback((inputData) => {
            if (this.raceStarted && !this.raceFinished) {
                this.handlePlayerInput(inputData);
            }
        });
        
        setTimeout(() => {
            this.raceStarted = true;
            this.game.controlSystem.activate();
        }, 3000);
    }

    handlePlayerInput(inputData) {
        const character = this.game.selectedCharacter;
        const multiplier = character ? character.speed : 1.0;
        
        const forwardForce = inputData.boost * multiplier * 0.4;
        const turnForce = inputData.turn * (character ? character.handling : 1.0) * 0.03;
        
        const forwardX = Math.cos(this.player.rotation) * forwardForce;
        const forwardZ = Math.sin(this.player.rotation) * forwardForce;
        
        this.player.velocity.x += forwardX;
        this.player.velocity.z += forwardZ;
        
        this.player.rotation += turnForce;
        
        this.player.velocity.multiplyScalar(0.92);
        
        const maxSpeed = 12;
        if (this.player.velocity.length() > maxSpeed) {
            this.player.velocity.normalize().multiplyScalar(maxSpeed);
        }
        
        if (inputData.boost > 1.0) {
            this.addCameraShake(0.3);
            this.createSpeedEffect();
        }
    }

    addCameraShake(intensity) {
        this.cameraShake.intensity = Math.max(this.cameraShake.intensity, intensity);
    }

    createSpeedEffect() {
        if (this.game.effectsSystem && this.player.model) {
            const velocity = new THREE.Vector3(
                -Math.cos(this.player.rotation) * this.player.velocity.z,
                0,
                -Math.sin(this.player.rotation) * this.player.velocity.z
            );
            
            this.game.effectsSystem.createSpeedParticles(
                this.player.model.position,
                velocity,
                this.player.velocity.length() / 5
            );
        }
    }

    updatePlayer(deltaTime) {
        if (!this.raceStarted || this.raceFinished || !this.player.model) return;
        
        this.player.position.add(this.player.velocity.clone().multiplyScalar(deltaTime));
        
        this.player.model.position.copy(this.player.position);
        this.player.model.position.y = 0.5;
        this.player.model.rotation.y =  (-1* this.player.rotation + Math.PI/2);
        
        this.checkPlayerGates();
    }

    updateAIRacers(deltaTime) {
        this.aiRacers.forEach((ai, index) => {
            if (!ai.model) return;
            if (this.raceFinished) {
                // Freeze AI when race is finished
                ai.model.position.copy(ai.position);
                ai.model.rotation.y = -1 * ai.rotation + Math.PI/2;
                ai.model.position.y = 0.5;
                return;
            }
            
            if (this.raceStarted) {
                const prev = ai.trackProgress;                          // NEW: track previous progress
                ai.trackProgress += ai.speed * deltaTime * 0.01;
                ai.trackProgress = ai.trackProgress % 1.0;
                
                // NEW: Lap detection on wrap
                if (prev > ai.trackProgress) {
                    ai.lap++;
                    if (ai.lap >= 2 && !ai.finished) {
                        ai.finished = true;
                        this.finishOrder.push(`ai_${index}`);
                        if (this.game.effectsSystem) {
                            this.game.effectsSystem.createParticleExplosion(
                                ai.position.clone().add(new THREE.Vector3(0, 2, 0)),
                                0xFFD700,
                                12
                            );
                        }
                    }
                }
                
                const trackPoint = this.trackPath.getPointAt(ai.trackProgress);
                const nextPoint = this.trackPath.getPointAt((ai.trackProgress + 0.01) % 1.0);
                
                const targetPosition = trackPoint.clone();
                ai.rotation = Math.atan2(nextPoint.z - trackPoint.z, nextPoint.x - trackPoint.x);
                
                const personalityOffset = Math.sin(this.time * ai.personality) * 2;
                const perpendicular = new THREE.Vector3(-Math.sin(ai.rotation), 0, Math.cos(ai.rotation));
                targetPosition.add(perpendicular.multiplyScalar(personalityOffset));
                
                ai.position.lerp(targetPosition, deltaTime * 3);
            } else {
                // Stay at starting position before race starts
                ai.position.copy(ai.startPosition);
            }
            
            ai.model.position.copy(ai.position);
            // Fix rotation to match player rotation logic
            ai.model.rotation.y = -1 * ai.rotation + Math.PI/2;
            
            const bobbing = Math.sin(this.time * 4 + ai.personality * 10) * 0.1;
            ai.model.position.y = 0.5 + bobbing;
        });
    }

    checkPlayerGates() {
        const playerPos = this.player.position;
        
        if (!this.player.passedHalfwayPoint) {
            const distanceToHalfway = playerPos.distanceTo(this.halfwayGate.position);
            if (distanceToHalfway < this.halfwayGate.width / 2) {
                this.player.passedHalfwayPoint = true;
                console.log("Halfway point reached!");
            }
        }
        
        if (this.player.passedHalfwayPoint && !this.player.passedStartLine) {
            const distanceToStart = playerPos.distanceTo(this.startLineGate.position);
            if (distanceToStart < this.startLineGate.width / 2) {
                this.player.lap++;
                this.player.passedStartLine = false;
                this.player.passedHalfwayPoint = false;
                console.log(`Lap ${this.player.lap} completed!`);
                
                if (this.game.effectsSystem) {
                    this.game.effectsSystem.createParticleExplosion(
                        playerPos.clone().add(new THREE.Vector3(0, 2, 0)),
                        0x00FF00,
                        15
                    );
                }

                // NEW: finish when player hits lap 2
                if (!this.raceFinished && this.player.lap >= 2) {
                    this.onPlayerFinish();
                }
            }
        }
    }

    updateParticles(deltaTime) {
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const particle = this.particles[i];
            
            particle.position.add(particle.velocity.clone().multiplyScalar(deltaTime));
            particle.velocity.multiplyScalar(0.98);
            particle.life -= deltaTime;
            
            if (particle.life <= 0) {
                this.particles.splice(i, 1);
            }
        }
    }

    updateCamera(deltaTime) {
        if (!this.player?.model) return;
        
        const targetPos = this.player.position.clone();
        targetPos.y = 8;
        targetPos.add(new THREE.Vector3(
            Math.cos(this.player.rotation + Math.PI) * 15,
            0,
            Math.sin(this.player.rotation + Math.PI) * 15
        ));
        
        this.game.camera.position.lerp(targetPos, deltaTime * 2);
        
        const lookTarget = this.player.position.clone();
        lookTarget.y = 2;
        this.game.camera.lookAt(lookTarget);
        
        if (this.cameraShake.intensity > 0) {
            this.cameraShake.x = (Math.random() - 0.5) * this.cameraShake.intensity;
            this.cameraShake.y = (Math.random() - 0.5) * this.cameraShake.intensity;
            
            this.game.camera.position.x += this.cameraShake.x;
            this.game.camera.position.y += this.cameraShake.y;
            
            this.cameraShake.intensity *= 0.9;
            if (this.cameraShake.intensity < 0.01) {
                this.cameraShake.intensity = 0;
            }
        }
        
        if (this.game.effectsSystem && this.player.velocity.length() > 2) {
            const playerVel = new THREE.Vector3(
                -Math.cos(this.player.rotation) * this.player.velocity.z,
                0,
                -Math.sin(this.player.rotation) * this.player.velocity.z
            );
            this.game.effectsSystem.updateSpeedLines(this.game.camera.position, playerVel);
        }
    }

    async show() {
        this.element.classList.remove('hidden');
        this.isVisible = true;
        
        if (this.track) this.track.visible = true;
        if (this.markingGroup) this.markingGroup.visible = true;
        if (this.fenceGroup) this.fenceGroup.visible = true;
        if (this.startGateMesh) this.startGateMesh.visible = true;
        if (this.halfwayGateMesh) this.halfwayGateMesh.visible = true;
        
        // Create player model with selected character
        if (!this.player.model) {
            await this.createPlayerModel();
        }
        
        // Create AI models now that we know the player's character
        for (let i = 0; i < this.aiRacers.length; i++) {
            if (!this.aiRacers[i].model) {
                await this.createAIModel(this.aiRacers[i], i);
            }
        }
        
        if (this.player.model) this.player.model.visible = true;
        this.aiRacers.forEach(ai => {
            if (ai.model) ai.model.visible = true;
        });
        
        this.startRace();
    }

    hide() {
        this.element.classList.add('hidden');
        this.isVisible = false;
        
        if (this.track) this.track.visible = false;
        if (this.markingGroup) this.markingGroup.visible = false;
        if (this.fenceGroup) this.fenceGroup.visible = false;
        if (this.startGateMesh) this.startGateMesh.visible = false;
        if (this.halfwayGateMesh) this.halfwayGateMesh.visible = false;
        if (this.player.model) this.player.model.visible = false;
        this.aiRacers.forEach(ai => {
            if (ai.model) ai.model.visible = false;
        });

        if (this.finishBannerEl) {
            this.finishBannerEl.remove();
            this.finishBannerEl = null;
        }
        
        this.game.controlSystem.deactivate();
    }

    update(deltaTime) {
        if (!this.isVisible) return;
        
        this.time += deltaTime;
        
        if (!this.raceStarted) {
            this.countdownTimer += deltaTime;
            if (this.countdownTimer >= 1.0) {
                this.countdown--;
                this.countdownTimer = 0;
            }
        }
        
        this.game.controlSystem.update(deltaTime);
        this.updatePlayer(deltaTime);
        this.updateAIRacers(deltaTime);
        this.updateCollisions();
        this.updateParticles(deltaTime);
        this.updateCamera(deltaTime);
    }

    destroy() {
        if (this.track) this.game.scene.remove(this.track);
        if (this.player?.model) this.game.scene.remove(this.player.model);
        
        this.aiRacers.forEach(ai => {
            if (ai.model) this.game.scene.remove(ai.model);
        });

        if (this.finishBannerEl) {
            this.finishBannerEl.remove();
            this.finishBannerEl = null;
        }
        
        this.game.controlSystem.deactivate();
    }

    updateCollisions() {
        if (!this.raceStarted || this.raceFinished) return;
        
        const collisions = this.collisionSystem.checkAllCollisions(this.player, this.aiRacers);
        
        // Create effects for collisions
        collisions.forEach(collision => {
            const midpoint = new THREE.Vector3()
                .addVectors(collision.racer1.position, collision.racer2.position)
                .multiplyScalar(0.5);
            
            this.collisionSystem.createCollisionEffect(midpoint, this.game);
        });
    }

    // ===== NEW helpers =====
    getOrdinal(n) {
        const s = ["th","st","nd","rd"], v = n % 100;
        return n + (s[(v - 20) % 10] || s[v] || s[0]);
    }

    showFinishBanner(place) {
        if (this.finishBannerEl) this.finishBannerEl.remove();

        const overlay = document.createElement('div');
        overlay.id = 'finish-overlay';
        Object.assign(overlay.style, {
            position: 'fixed',
            inset: '0',
            display: 'grid',
            placeItems: 'center',
            background: 'rgba(0,0,0,0.35)',
            zIndex: 9999,
            pointerEvents: 'none',
        });

        const box = document.createElement('div');
        Object.assign(box.style, {
            color: '#fff',
            fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif',
            textAlign: 'center',
            textShadow: '0 2px 12px rgba(0,0,0,0.5)',
        });
        box.innerHTML = `
            <div style="font-size: 72px; font-weight: 900; letter-spacing: 2px;">FINISH!</div>
            <div style="font-size: 28px; margin-top: 8px;">You came ${this.getOrdinal(place)}.</div>
        `;

        overlay.appendChild(box);
        document.body.appendChild(overlay);
        this.finishBannerEl = overlay;
    }

    onPlayerFinish() {
        // Place = everyone who already finished + 1
        const place = this.finishOrder.length + 1;
        this.finishOrder.push('player');

        this.raceFinished = true;
        this.game.controlSystem.deactivate();   // stop inputs
        this.showFinishBanner(place);
    }
}
