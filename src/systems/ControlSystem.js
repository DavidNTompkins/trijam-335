export class ControlSystem {
    constructor() {
        this.keyRows = {
            top: ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'],
            middle: ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l'],
            bottom: ['z', 'x', 'c', 'v', 'b', 'n', 'm', ',', '.']
        };
        
        this.keyPositions = {};
        this.setupKeyPositions();
        
        this.lastKeyPressed = { row: null, index: -1, time: 0 };
        this.currentVelocity = { forward: 0, turn: 0 };
        this.velocityDecay = 0.95;
        
        this.controlParams = {
            decayFactor: 2.0,
            baseBoost: 1.0,
            maxVelocity: 15.0,
            turnSensitivity: 1.6
        };
        
        this.keyPressHistory = [];
        this.maxHistoryLength = 5;
        
        this.isActive = false;
        this.onInputCallback = null;
        
        this.setupEventListeners();
    }

    setupKeyPositions() {
        Object.keys(this.keyRows).forEach(rowName => {
            this.keyRows[rowName].forEach((key, index) => {
                this.keyPositions[key] = {
                    row: rowName,
                    index: index
                };
            });
        });
    }

    setupEventListeners() {
        this.keyDownHandler = (event) => {
            if (!this.isActive) return;
            
            const key = event.key.toLowerCase();
            if (this.keyPositions[key]) {
                event.preventDefault();
                this.handleKeyPress(key);
            }
        };
        
        document.addEventListener('keydown', this.keyDownHandler);
    }

    handleKeyPress(key) {
        const keyInfo = this.keyPositions[key];
        const currentTime = Date.now();
        
        this.addToHistory(key, keyInfo, currentTime);
        
        const boost = this.calculateBoost(keyInfo, currentTime);
        const turnAmount = this.calculateTurn(keyInfo.row);
        
        this.currentVelocity.forward += boost;
        this.currentVelocity.turn += turnAmount;
        
        this.currentVelocity.forward = Math.min(this.currentVelocity.forward, this.controlParams.maxVelocity);
        this.currentVelocity.turn = Math.max(-this.controlParams.maxVelocity, 
                                           Math.min(this.currentVelocity.turn, this.controlParams.maxVelocity));
        
        this.lastKeyPressed = {
            row: keyInfo.row,
            index: keyInfo.index,
            time: currentTime
        };
        
        if (this.onInputCallback) {
            this.onInputCallback({
                key: key,
                boost: boost,
                turn: turnAmount,
                velocity: { ...this.currentVelocity },
                keyInfo: keyInfo
            });
        }
        
        this.createVisualFeedback(keyInfo);
    }

    addToHistory(key, keyInfo, time) {
        this.keyPressHistory.unshift({
            key: key,
            row: keyInfo.row,
            index: keyInfo.index,
            time: time
        });
        
        if (this.keyPressHistory.length > this.maxHistoryLength) {
            this.keyPressHistory.pop();
        }
    }

    calculateBoost(keyInfo, currentTime) {
        if (this.lastKeyPressed.row === null) {
            return this.controlParams.baseBoost;
        }
        
        const timeDiff = (currentTime - this.lastKeyPressed.time) / 1000;
        const timeDecay = Math.exp(-this.controlParams.decayFactor * timeDiff);
        
        let distanceBonus = 1.0;
        if (this.lastKeyPressed.row === keyInfo.row) {
            const keyDistance = Math.abs(keyInfo.index - this.lastKeyPressed.index);
            distanceBonus = Math.pow(0.5, keyDistance - 1);
        }
        
        const waveBonus = this.calculateWaveBonus();
        
        const totalBoost = this.controlParams.baseBoost * timeDecay * distanceBonus * waveBonus;
        
        return totalBoost;
    }

    calculateWaveBonus() {
        if (this.keyPressHistory.length < 3) return 1.0;
        
        const recentKeys = this.keyPressHistory.slice(0, 3);
        const rows = recentKeys.map(k => k.row);
        const indices = recentKeys.map(k => k.index);
        
        let waveBonus = 1.0;
        
        const hasRowVariation = new Set(rows).size > 1;
        if (hasRowVariation) {
            waveBonus *= 1.3;
        }
        
        let isWavePattern = true;
        for (let i = 1; i < indices.length; i++) {
            const diff = Math.abs(indices[i] - indices[i-1]);
            if (diff > 3) {
                isWavePattern = false;
                break;
            }
        }
        
        if (isWavePattern) {
            waveBonus *= 1.2;
        }
        
        const avgTimeBetween = this.getAverageTimeBetweenKeys();
        const rhythmBonus = this.calculateRhythmBonus(avgTimeBetween);
        waveBonus *= rhythmBonus;
        
        return Math.min(waveBonus, 2.0);
    }

    getAverageTimeBetweenKeys() {
        if (this.keyPressHistory.length < 2) return 0;
        
        let totalTime = 0;
        for (let i = 0; i < this.keyPressHistory.length - 1; i++) {
            totalTime += this.keyPressHistory[i].time - this.keyPressHistory[i + 1].time;
        }
        
        return totalTime / (this.keyPressHistory.length - 1);
    }

    calculateRhythmBonus(avgTime) {
        const idealRhythm = 150;
        const timeDiff = Math.abs(avgTime - idealRhythm);
        const rhythmBonus = Math.max(0.8, 1.5 - (timeDiff / 200));
        return rhythmBonus;
    }

    calculateTurn(row) {
        let turnAmount = 0;
        
        switch (row) {
            case 'top':
                turnAmount = this.controlParams.turnSensitivity;
                break;
            case 'middle':
                turnAmount = 0;
                break;
            case 'bottom':
                turnAmount = -this.controlParams.turnSensitivity;
                break;
        }
        
        return turnAmount;
    }

    createVisualFeedback(keyInfo) {
        const colors = {
            top: '#ff6b6b',
            middle: '#ffd93d', 
            bottom: '#6bcf7f'
        };
        
        const color = colors[keyInfo.row];
        
        if (typeof window !== 'undefined' && window.game) {
            window.game.createKeyPressEffect(keyInfo, color);
        }
    }

    update(deltaTime) {
        this.currentVelocity.forward *= this.velocityDecay;
        this.currentVelocity.turn *= this.velocityDecay;
        
        if (Math.abs(this.currentVelocity.forward) < 0.01) {
            this.currentVelocity.forward = 0;
        }
        if (Math.abs(this.currentVelocity.turn) < 0.01) {
            this.currentVelocity.turn = 0;
        }
    }

    activate() {
        this.isActive = true;
        this.reset();
    }

    deactivate() {
        this.isActive = false;
    }

    reset() {
        this.currentVelocity = { forward: 0, turn: 0 };
        this.lastKeyPressed = { row: null, index: -1, time: 0 };
        this.keyPressHistory = [];
    }

    getVelocity() {
        return { ...this.currentVelocity };
    }

    setInputCallback(callback) {
        this.onInputCallback = callback;
    }

    destroy() {
        document.removeEventListener('keydown', this.keyDownHandler);
    }
}