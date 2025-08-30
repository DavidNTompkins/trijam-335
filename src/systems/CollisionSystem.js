import * as THREE from 'three';

export class CollisionSystem {
    constructor() {
        this.mapBounds = {
            minX: -50,
            maxX: 50,
            minZ: -50,
            maxZ: 50
        };
        
        this.collisionRadius = 1.0;
        this.bounceStrength = 0.8;
        this.dampening = 0.9;
    }

    checkBoundaryCollision(position, velocity) {
        let collided = false;
        
        // Check X boundaries
        if (position.x < this.mapBounds.minX) {
            position.x = this.mapBounds.minX;
            velocity.x = Math.abs(velocity.x) * this.bounceStrength;
            collided = true;
        } else if (position.x > this.mapBounds.maxX) {
            position.x = this.mapBounds.maxX;
            velocity.x = -Math.abs(velocity.x) * this.bounceStrength;
            collided = true;
        }
        
        // Check Z boundaries
        if (position.z < this.mapBounds.minZ) {
            position.z = this.mapBounds.minZ;
            velocity.z = Math.abs(velocity.z) * this.bounceStrength;
            collided = true;
        } else if (position.z > this.mapBounds.maxZ) {
            position.z = this.mapBounds.maxZ;
            velocity.z = -Math.abs(velocity.z) * this.bounceStrength;
            collided = true;
        }
        
        if (collided) {
            velocity.multiplyScalar(this.dampening);
        }
        
        return collided;
    }

    checkRacerCollision(racer1, racer2) {
        // Safety check for required properties
        if (!racer1.position || !racer2.position) return false;
        if (!racer1.velocity) racer1.velocity = new THREE.Vector3(0, 0, 0);
        if (!racer2.velocity) racer2.velocity = new THREE.Vector3(0, 0, 0);
        
        const distance = racer1.position.distanceTo(racer2.position);
        
        if (distance < this.collisionRadius && distance > 0.1) {
            // Calculate collision normal
            const normal = new THREE.Vector3()
                .subVectors(racer1.position, racer2.position)
                .normalize();
            
            // Separate the racers
            const overlap = this.collisionRadius - distance;
            const separation = normal.clone().multiplyScalar(overlap);
            
            racer1.position.add(separation);
            racer2.position.sub(separation);
            
            // Only apply velocity changes to player (who has velocity)
            if (racer1.velocity && racer1.velocity.length && racer1.velocity.length() > 0) {
                const impulse = normal.clone().multiplyScalar(2);
                racer1.velocity.add(impulse);
                racer1.velocity.multiplyScalar(0.8);
            }
            
            return true;
        }
        
        return false;
    }

    checkAllCollisions(player, aiRacers) {
        if (!player || !aiRacers) return [];
        
        const allRacers = [player, ...aiRacers.filter(ai => ai && ai.position)];
        const collisions = [];
        
        // Check racer-to-racer collisions
        for (let i = 0; i < allRacers.length; i++) {
            for (let j = i + 1; j < allRacers.length; j++) {
                const racer1 = allRacers[i];
                const racer2 = allRacers[j];
                
                if (racer1 && racer2 && racer1.model && racer2.model && racer1.position && racer2.position) {
                    if (this.checkRacerCollision(racer1, racer2)) {
                        collisions.push({ racer1, racer2 });
                    }
                }
            }
        }
        
        // Check boundary collisions only for player
        if (player && player.position && player.velocity) {
            this.checkBoundaryCollision(player.position, player.velocity);
        }
        
        return collisions;
    }

    createCollisionEffect(position, game) {
        if (game.effectsSystem) {
            // Create sparks/impact particles - reduced intensity
            game.effectsSystem.createParticleExplosion(
                position.clone().add(new THREE.Vector3(0, 0.5, 0)),
                0xFFAA00,
                1  // Reduced from 8 to 3
            );
        }
        
        
        // Add camera shake if player is involved - reduced intensity
        if (game.components.racing) {
            game.components.racing.addCameraShake(0.1);  // Reduced from 0.3 to 0.1
        }
    }
}