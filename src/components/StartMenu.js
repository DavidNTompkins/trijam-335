import * as THREE from 'three';

export class StartMenu {
    constructor(game) {
        this.game = game;
        this.element = document.getElementById('start-menu');
        this.isVisible = false;
        
        this.backgroundObjects = [];
        this.time = 0;
        
        this.createBackground();
    }

    createBackground() {
        const geometry = new THREE.SphereGeometry(2, 16, 16);
        const materials = [
            new THREE.MeshLambertMaterial({ color: 0x8FBC8F }),
            new THREE.MeshLambertMaterial({ color: 0x9ACD32 }),
            new THREE.MeshLambertMaterial({ color: 0x90EE90 })
        ];

        for (let i = 0; i < 8; i++) {
            const material = materials[Math.floor(Math.random() * materials.length)];
            const snail = new THREE.Mesh(geometry, material);
            
            snail.position.set(
                (Math.random() - 0.5) * 40,
                Math.random() * 5,
                (Math.random() - 0.5) * 40
            );
            
            snail.scale.set(0.5, 0.3, 0.8);
            snail.userData.originalY = snail.position.y;
            snail.userData.bobOffset = Math.random() * Math.PI * 2;
            snail.userData.rotationSpeed = (Math.random() - 0.5) * 0.5;
            
            this.backgroundObjects.push(snail);
            this.game.scene.add(snail);
        }

        this.createGround();
    }

    createGround() {
        const groundGeometry = new THREE.PlaneGeometry(100, 100);
        const groundMaterial = new THREE.MeshLambertMaterial({ 
            color: 0x228B22,
            transparent: true,
            opacity: 0.8
        });
        
        this.ground = new THREE.Mesh(groundGeometry, groundMaterial);
        this.ground.rotation.x = -Math.PI / 2;
        this.ground.position.y = -2;
        this.ground.receiveShadow = true;
        
        this.game.scene.add(this.ground);
    }

    show() {
        this.element.classList.remove('hidden');
        this.isVisible = true;
        
        this.backgroundObjects.forEach(obj => obj.visible = true);
        if (this.ground) this.ground.visible = true;
        
        this.game.camera.position.set(0, 15, 20);
        this.game.camera.lookAt(0, 0, 0);
    }

    hide() {
        this.element.classList.add('hidden');
        this.isVisible = false;
        
        this.backgroundObjects.forEach(obj => obj.visible = false);
        if (this.ground) this.ground.visible = false;
    }

    update(deltaTime) {
        if (!this.isVisible) return;
        
        this.time += deltaTime;
        
        this.backgroundObjects.forEach(obj => {
            obj.position.y = obj.userData.originalY + Math.sin(this.time * 2 + obj.userData.bobOffset) * 0.5;
            obj.rotation.y += obj.userData.rotationSpeed * deltaTime;
        });
        
        const cameraRadius = 25;
        const cameraHeight = 15;
        this.game.camera.position.x = Math.sin(this.time * 0.2) * cameraRadius;
        this.game.camera.position.z = Math.cos(this.time * 0.2) * cameraRadius;
        this.game.camera.position.y = cameraHeight + Math.sin(this.time * 0.5) * 2;
        this.game.camera.lookAt(0, 0, 0);
    }

    destroy() {
        this.backgroundObjects.forEach(obj => {
            this.game.scene.remove(obj);
        });
        if (this.ground) {
            this.game.scene.remove(this.ground);
        }
        this.backgroundObjects = [];
    }
}