import * as THREE from 'three';

export class EffectsSystem {
    constructor(scene) {
        this.scene = scene;
        this.particles = [];
        this.keyPressEffects = [];
        this.speedLines = [];
        
        this.setupSpeedLineSystem();
    }

    setupSpeedLineSystem() {
        this.speedLineGeometry = new THREE.BufferGeometry();
        const positions = new Float32Array(200 * 3);
        const colors = new Float32Array(200 * 3);
        
        this.speedLineGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        this.speedLineGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        
        this.speedLineMaterial = new THREE.LineBasicMaterial({
            vertexColors: true,
            transparent: true,
            opacity: 0.8,
            blending: THREE.AdditiveBlending
        });
        
        this.speedLinesMesh = new THREE.LineSegments(this.speedLineGeometry, this.speedLineMaterial);
        this.scene.add(this.speedLinesMesh);
    }

    createParticleExplosion(position, color = 0xFFFFFF, count = 10) {
        for (let i = 0; i < count; i++) {
            const particle = {
                position: position.clone().add(new THREE.Vector3(
                    (Math.random() - 0.5) * 2,
                    Math.random() * 2,
                    (Math.random() - 0.5) * 2
                )),
                velocity: new THREE.Vector3(
                    (Math.random() - 0.5) * 10,
                    Math.random() * 8 + 2,
                    (Math.random() - 0.5) * 10
                ),
                life: 1.0,
                maxLife: 1.0,
                size: Math.random() * 0.8 + 0.2,
                color: new THREE.Color(color),
                gravity: -9.8,
                type: 'explosion'
            };
            
            this.particles.push(particle);
            this.createParticleMesh(particle);
        }
    }

    createSpeedParticles(position, velocity, intensity = 1.0) {
        const count = Math.floor(intensity * 5);
        
        for (let i = 0; i < count; i++) {
            const particle = {
                position: position.clone().add(new THREE.Vector3(
                    (Math.random() - 0.5) * 1,
                    Math.random() * 0.5,
                    (Math.random() - 0.5) * 1
                )),
                velocity: velocity.clone().multiplyScalar(-0.5).add(new THREE.Vector3(
                    (Math.random() - 0.5) * 2,
                    Math.random() * 2,
                    (Math.random() - 0.5) * 2
                )),
                life: 0.8,
                maxLife: 0.8,
                size: Math.random() * 0.4 + 0.1,
                color: new THREE.Color().setHSL(0.6 + Math.random() * 0.3, 0.8, 0.7),
                type: 'speed'
            };
            
            this.particles.push(particle);
            this.createParticleMesh(particle);
        }
    }

    createKeyPressEffect(position, keyInfo, color) {
        const colors = {
            top: new THREE.Color(0xff6b6b),
            middle: new THREE.Color(0xffd93d),
            bottom: new THREE.Color(0x6bcf7f)
        };
        
        const effectColor = colors[keyInfo.row] || new THREE.Color(color);
        const effectPosition = position.clone();
        effectPosition.y = 0.2;
        
        const effect = {
            position: effectPosition,
            startPosition: effectPosition.clone(),
            color: effectColor,
            life: 0.3,
            maxLife: 0.3,
            size: 0.8,
            keyInfo: keyInfo
        };
        
        this.keyPressEffects.push(effect);
        this.createKeyEffectMesh(effect);
    }

    createParticleMesh(particle) {
        const geometry = new THREE.SphereGeometry(particle.size, 6, 6);
        const material = new THREE.MeshBasicMaterial({
            color: particle.color,
            transparent: true,
            opacity: 1.0
        });
        
        particle.mesh = new THREE.Mesh(geometry, material);
        particle.mesh.position.copy(particle.position);
        this.scene.add(particle.mesh);
    }

    createKeyEffectMesh(effect) {
        const geometry = new THREE.RingGeometry(0.2, effect.size, 12);
        const material = new THREE.MeshBasicMaterial({
            color: effect.color,
            transparent: true,
            opacity: 0.4,
            side: THREE.DoubleSide
        });
        
        effect.mesh = new THREE.Mesh(geometry, material);
        effect.mesh.position.copy(effect.position);
        effect.mesh.rotation.x = -Math.PI / 2;
        this.scene.add(effect.mesh);
    }

    updateSpeedLines(cameraPosition, playerVelocity) {
        const positions = this.speedLineGeometry.attributes.position.array;
        const colors = this.speedLineGeometry.attributes.color.array;
        
        const speed = playerVelocity.length();
        const lineCount = Math.min(Math.floor(speed * 10), 100);
        
        for (let i = 0; i < lineCount; i++) {
            const i3 = i * 6;
            const i6 = i * 6;
            
            const angle = Math.random() * Math.PI * 2;
            const radius = 5 + Math.random() * 20;
            const height = (Math.random() - 0.5) * 10;
            
            const startX = cameraPosition.x + Math.cos(angle) * radius;
            const startY = cameraPosition.y + height;
            const startZ = cameraPosition.z + Math.sin(angle) * radius;
            
            const endX = startX - playerVelocity.x * 2;
            const endY = startY - playerVelocity.y * 2;
            const endZ = startZ - playerVelocity.z * 2;
            
            positions[i3] = startX;
            positions[i3 + 1] = startY;
            positions[i3 + 2] = startZ;
            positions[i3 + 3] = endX;
            positions[i3 + 4] = endY;
            positions[i3 + 5] = endZ;
            
            const intensity = Math.min(speed / 5, 1);
            colors[i6] = intensity;
            colors[i6 + 1] = intensity * 0.8;
            colors[i6 + 2] = intensity;
            colors[i6 + 3] = intensity * 0.5;
            colors[i6 + 4] = intensity * 0.4;
            colors[i6 + 5] = intensity * 0.5;
        }
        
        for (let i = lineCount; i < 100; i++) {
            const i3 = i * 6;
            const i6 = i * 6;
            
            for (let j = 0; j < 6; j++) {
                positions[i3 + j] = 0;
                colors[i6 + j] = 0;
            }
        }
        
        this.speedLineGeometry.attributes.position.needsUpdate = true;
        this.speedLineGeometry.attributes.color.needsUpdate = true;
        
        this.speedLineMaterial.opacity = Math.min(speed / 10, 0.8);
    }

    createTrailEffect(position, color = 0x00FF00) {
        const trail = {
            positions: [position.clone()],
            maxLength: 20,
            color: new THREE.Color(color),
            life: 2.0,
            mesh: null
        };
        
        this.createTrailMesh(trail);
        return trail;
    }

    updateTrail(trail, newPosition) {
        trail.positions.unshift(newPosition.clone());
        
        if (trail.positions.length > trail.maxLength) {
            trail.positions.pop();
        }
        
        this.updateTrailMesh(trail);
    }

    createTrailMesh(trail) {
        const geometry = new THREE.BufferGeometry();
        const positions = new Float32Array(trail.maxLength * 3);
        const colors = new Float32Array(trail.maxLength * 3);
        
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        
        const material = new THREE.LineBasicMaterial({
            vertexColors: true,
            transparent: true,
            opacity: 0.6
        });
        
        trail.mesh = new THREE.Line(geometry, material);
        this.scene.add(trail.mesh);
    }

    updateTrailMesh(trail) {
        if (!trail.mesh) return;
        
        const positions = trail.mesh.geometry.attributes.position.array;
        const colors = trail.mesh.geometry.attributes.color.array;
        
        for (let i = 0; i < trail.positions.length; i++) {
            const pos = trail.positions[i];
            const alpha = 1 - (i / trail.positions.length);
            
            positions[i * 3] = pos.x;
            positions[i * 3 + 1] = pos.y;
            positions[i * 3 + 2] = pos.z;
            
            colors[i * 3] = trail.color.r * alpha;
            colors[i * 3 + 1] = trail.color.g * alpha;
            colors[i * 3 + 2] = trail.color.b * alpha;
        }
        
        trail.mesh.geometry.attributes.position.needsUpdate = true;
        trail.mesh.geometry.attributes.color.needsUpdate = true;
    }

    update(deltaTime) {
        this.updateParticles(deltaTime);
        this.updateKeyPressEffects(deltaTime);
    }

    updateParticles(deltaTime) {
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const particle = this.particles[i];
            
            particle.position.add(particle.velocity.clone().multiplyScalar(deltaTime));
            
            if (particle.gravity !== undefined) {
                particle.velocity.y += particle.gravity * deltaTime;
            }
            
            particle.velocity.multiplyScalar(0.98);
            particle.life -= deltaTime;
            
            if (particle.mesh) {
                particle.mesh.position.copy(particle.position);
                
                const alpha = particle.life / particle.maxLife;
                particle.mesh.material.opacity = alpha;
                
                if (particle.type === 'speed') {
                    particle.mesh.scale.setScalar(alpha);
                }
            }
            
            if (particle.life <= 0) {
                if (particle.mesh) {
                    this.scene.remove(particle.mesh);
                    particle.mesh.geometry.dispose();
                    particle.mesh.material.dispose();
                }
                this.particles.splice(i, 1);
            }
        }
    }

    updateKeyPressEffects(deltaTime) {
        for (let i = this.keyPressEffects.length - 1; i >= 0; i--) {
            const effect = this.keyPressEffects[i];
            
            effect.life -= deltaTime;
            
            if (effect.mesh) {
                const alpha = effect.life / effect.maxLife;
                const scale = 1 + (1 - alpha) * 0.5;
                
                effect.mesh.material.opacity = alpha * 0.4;
                effect.mesh.scale.setScalar(scale);
            }
            
            if (effect.life <= 0) {
                if (effect.mesh) {
                    this.scene.remove(effect.mesh);
                    effect.mesh.geometry.dispose();
                    effect.mesh.material.dispose();
                }
                this.keyPressEffects.splice(i, 1);
            }
        }
    }

    createCameraShake(intensity, duration = 0.5) {
        return {
            intensity: intensity,
            duration: duration,
            timeLeft: duration,
            offset: new THREE.Vector3()
        };
    }

    updateCameraShake(shake, deltaTime) {
        if (shake.timeLeft <= 0) return false;
        
        shake.timeLeft -= deltaTime;
        const progress = 1 - (shake.timeLeft / shake.duration);
        const currentIntensity = shake.intensity * (1 - progress);
        
        shake.offset.set(
            (Math.random() - 0.5) * currentIntensity,
            (Math.random() - 0.5) * currentIntensity,
            (Math.random() - 0.5) * currentIntensity
        );
        
        return shake.timeLeft > 0;
    }

    dispose() {
        this.particles.forEach(particle => {
            if (particle.mesh) {
                this.scene.remove(particle.mesh);
                particle.mesh.geometry.dispose();
                particle.mesh.material.dispose();
            }
        });
        
        this.keyPressEffects.forEach(effect => {
            if (effect.mesh) {
                this.scene.remove(effect.mesh);
                effect.mesh.geometry.dispose();
                effect.mesh.material.dispose();
            }
        });
        
        if (this.speedLinesMesh) {
            this.scene.remove(this.speedLinesMesh);
            this.speedLineGeometry.dispose();
            this.speedLineMaterial.dispose();
        }
        
        this.particles = [];
        this.keyPressEffects = [];
    }
}