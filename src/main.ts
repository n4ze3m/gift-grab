import './style.css';
import { HandTracker } from './handTracking';
import { DIFFICULTY_LEVELS, COLORS, CONSTANTS } from './gameAssets';

interface GameObject {
  x: number;
  y: number;
  speed: number;
  width: number;
  height: number;
  rotation: number;
  scale: number;
  targetScale: number;
}

interface Present extends GameObject {
  caught?: boolean;
  color: string;
  stolenByGrinch?: boolean;
}

interface Grinch extends GameObject {
  targetPresent?: Present;
  hasStolen?: boolean;
}

class Game {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private presents: Present[] = [];
  private grinches: Grinch[] = [];
  private score: number = 0;
  private highScore: number = 0;
  private handX: number = 0;
  private handY: number = 0;
  private isGrabbing: boolean = false;
  private handTracker: HandTracker;
  private lastPresentTime: number = 0;
  private lastGrinchTime: number = 0;
  private presentInterval: number = DIFFICULTY_LEVELS.EASY.presentInterval;
  private grinchInterval: number = DIFFICULTY_LEVELS.EASY.grinchSpawnInterval;
  private currentDifficulty: 'EASY' | 'MEDIUM' | 'HARD' = 'EASY';
  private lastTime: number = 0;
  private combo: number = 0;
  private lastCatchTime: number = 0;
  private gameActive: boolean = false;
  private menuOverlay: HTMLElement;
  private gameOverOverlay: HTMLElement;
  private playButton: HTMLElement;
  private restartButton: HTMLElement;
  private finalScoreElement: HTMLElement;
  private highScoreElement: HTMLElement;
  private scoreValueElement: HTMLElement;
  private comboElement: HTMLElement;
  private comboValueElement: HTMLElement;
  private loadingText: HTMLElement;

  constructor() {
    console.log('Initializing game...');
    this.canvas = document.getElementById('gameCanvas') as HTMLCanvasElement;
    this.ctx = this.canvas.getContext('2d')!;

    this.menuOverlay = document.getElementById('menuOverlay')!;
    this.gameOverOverlay = document.getElementById('gameOverOverlay')!;
    this.playButton = document.getElementById('playButton')!;
    this.restartButton = document.getElementById('restartButton')!;
    this.finalScoreElement = document.getElementById('finalScore')!;
    this.highScoreElement = document.getElementById('highScoreValue')!;
    this.scoreValueElement = document.getElementById('scoreValue')!;
    this.comboElement = document.getElementById('combo')!;
    this.comboValueElement = document.getElementById('comboValue')!;
    this.loadingText = document.getElementById('loadingText')!;

    this.highScore = parseInt(localStorage.getItem('highScore') || '0');
    this.highScoreElement.textContent = this.highScore.toString();

    this.resizeCanvas();
    window.addEventListener('resize', () => this.resizeCanvas());

    this.handTracker = new HandTracker();
    this.handTracker.setUpdateCallback((x, y, grabbing) => this.updateHandPosition(x, y, grabbing));

    this.setupEventListeners();
    requestAnimationFrame(this.gameLoop);
  }

  private setupEventListeners() {
    this.playButton.addEventListener('click', async () => {
      try {
        this.playButton.style.display = 'none';
        this.loadingText.style.display = 'block';
        this.loadingText.textContent = 'Loading hand tracking...';

        await this.handTracker.initialize();
        await this.handTracker.start();

        this.loadingText.style.display = 'none';
        this.startGame();
      } catch (error) {
        console.error('Failed to start camera:', error);
        this.showMessage('Camera permission denied!', '#FF0000');
        this.playButton.style.display = 'block';
        this.loadingText.style.display = 'none';
      }
    });

    this.restartButton.addEventListener('click', () => {
      this.gameOverOverlay.classList.add('hidden');
      this.startGame();
    });
  }

  private startGame() {
    this.score = 0;
    this.combo = 0;
    this.presents = [];
    this.grinches = [];
    this.currentDifficulty = 'EASY';
    this.presentInterval = DIFFICULTY_LEVELS.EASY.presentInterval;
    this.grinchInterval = DIFFICULTY_LEVELS.EASY.grinchSpawnInterval;
    this.lastPresentTime = 0;
    this.lastGrinchTime = 0;
    this.lastCatchTime = 0;

    this.menuOverlay.classList.add('hidden');
    this.scoreValueElement.textContent = '0';

    this.gameActive = true;
    this.lastTime = performance.now();
    this.showMessage('Game Started!', '#4CAF50');
  }

  private updateScore(points: number) {
    this.score += points;
    this.scoreValueElement.textContent = this.score.toString();

    if (this.combo > 1) {
      this.comboElement?.classList.remove('hidden');
      if (this.comboValueElement) {
        this.comboValueElement.textContent = this.combo.toString();
      }
    } else {
      this.comboElement?.classList.add('hidden');
    }
  }

  private gameOver() {
    this.gameActive = false;

    if (this.score > this.highScore) {
      this.highScore = this.score;
      localStorage.setItem('highScore', this.highScore.toString());
      this.highScoreElement.textContent = this.highScore.toString();
      this.showMessage('New High Score! 🏆', '#FFD700');
    }

    this.finalScoreElement.textContent = this.score.toString();
    this.gameOverOverlay.classList.remove('hidden');
    this.showMessage('Game Over!', '#FF0000');

    this.handTracker.stop();
  }

  private checkGrinchCollision() {
    for (const grinch of this.grinches) {
      const distance = Math.sqrt(
        Math.pow(grinch.x + grinch.width / 2 - this.handX, 2) +
        Math.pow(grinch.y + grinch.height / 2 - this.handY, 2)
      );

      if (distance < CONSTANTS.CATCH_RADIUS) {
        this.gameOver();
        return true;
      }
    }
    return false;
  }

  private updateDifficulty() {
    if (this.score >= CONSTANTS.SCORE_THRESHOLDS.HARD && this.currentDifficulty !== 'HARD') {
      this.currentDifficulty = 'HARD';
      this.presentInterval = DIFFICULTY_LEVELS.HARD.presentInterval;
      this.grinchInterval = DIFFICULTY_LEVELS.HARD.grinchSpawnInterval;
      this.showMessage('HARD MODE!', '#FF0000');
    } else if (this.score >= CONSTANTS.SCORE_THRESHOLDS.MEDIUM && this.currentDifficulty === 'EASY') {
      this.currentDifficulty = 'MEDIUM';
      this.presentInterval = DIFFICULTY_LEVELS.MEDIUM.presentInterval;
      this.grinchInterval = DIFFICULTY_LEVELS.MEDIUM.grinchSpawnInterval;
      this.showMessage('MEDIUM MODE!', '#FFA500');
    }
  }

  private generateGrinch() {
    const side = Math.random() > 0.5 ? 'left' : 'right';
    const grinch: Grinch = {
      x: side === 'left' ? -CONSTANTS.GRINCH_SIZE : this.canvas.width,
      y: Math.random() * (this.canvas.height - CONSTANTS.GRINCH_SIZE),
      speed: DIFFICULTY_LEVELS[this.currentDifficulty].grinchSpeed * (side === 'left' ? 1 : -1),
      width: CONSTANTS.GRINCH_SIZE,
      height: CONSTANTS.GRINCH_SIZE,
      rotation: 0,
      scale: 0,
      targetScale: 1
    };
    this.grinches.push(grinch);
  }

  private updateGrinches(deltaTime: number) {
    const currentTime = performance.now();

    if (currentTime - this.lastGrinchTime > this.grinchInterval) {
      this.generateGrinch();
      this.lastGrinchTime = currentTime;
    }

    for (let i = this.grinches.length - 1; i >= 0; i--) {
      const grinch = this.grinches[i];
      grinch.scale += (grinch.targetScale - grinch.scale) * 0.1;

      grinch.x += grinch.speed * deltaTime * 0.06;

      if (!grinch.targetPresent) {
        let nearestPresent: Present | null = null;
        let minDistance = Infinity;

        for (const present of this.presents) {
          if (!present.caught && !present.stolenByGrinch) {
            const distance = Math.sqrt(
              Math.pow(present.x - grinch.x, 2) +
              Math.pow(present.y - grinch.y, 2)
            );
            if (distance < minDistance) {
              minDistance = distance;
              nearestPresent = present;
            }
          }
        }

        if (nearestPresent) {
          grinch.targetPresent = nearestPresent;
        }
      }

      if (grinch.targetPresent && !grinch.hasStolen) {
        const dx = grinch.targetPresent.x - grinch.x;
        const dy = grinch.targetPresent.y - grinch.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < CONSTANTS.CATCH_RADIUS) {
          grinch.targetPresent.stolenByGrinch = true;
          grinch.hasStolen = true;
          grinch.targetPresent.targetScale = 0; // Start shrinking animation
          this.showMessage('Present stolen!', '#FF0000');
          this.combo = 0;
        } else {
          grinch.x += (dx / distance) * grinch.speed * deltaTime * 0.06;
          grinch.y += (dy / distance) * grinch.speed * deltaTime * 0.06;
        }
      }

      // Remove grinch if off screen or has stolen a present
      if (grinch.x < -CONSTANTS.GRINCH_SIZE * 2 ||
        grinch.x > this.canvas.width + CONSTANTS.GRINCH_SIZE * 2 ||
        (grinch.hasStolen && grinch?.targetPresent && grinch?.targetPresent?.scale < 0.1)) {
        // Remove the stolen present
        if (grinch.hasStolen && grinch.targetPresent) {
          const presentIndex = this.presents.indexOf(grinch.targetPresent);
          if (presentIndex !== -1) {
            this.presents.splice(presentIndex, 1);
          }
        }
        this.grinches.splice(i, 1);
      }
    }
  }

  private drawGrinch(grinch: Grinch) {
    this.ctx.save();
    this.ctx.translate(grinch.x + grinch.width / 2, grinch.y + grinch.height / 2);
    this.ctx.scale(grinch.scale, grinch.scale);

    this.ctx.fillStyle = COLORS.GRINCH;
    this.ctx.beginPath();
    this.ctx.arc(0, 0, grinch.width / 2, 0, Math.PI * 2);
    this.ctx.fill();

    this.ctx.fillStyle = '#FF0000';
    this.ctx.beginPath();
    this.ctx.arc(-10, -5, 5, 0, Math.PI * 2);
    this.ctx.arc(10, -5, 5, 0, Math.PI * 2);
    this.ctx.fill();

    this.ctx.strokeStyle = '#000000';
    this.ctx.lineWidth = 3;
    this.ctx.beginPath();
    this.ctx.arc(0, 5, 15, 0, Math.PI);
    this.ctx.stroke();

    this.ctx.restore();
  }

  private showMessage(text: string, color: string) {
    const message = document.createElement('div');
    message.className = 'game-message';
    message.textContent = text;
    message.style.cssText = `
      position: absolute;
      color: ${color};
      font-size: 36px;
      font-weight: bold;
      text-shadow: 0 0 10px rgba(0,0,0,0.5);
      left: 50%;
      top: 50%;
      transform: translate(-50%, -50%);
      pointer-events: none;
      animation: fadeUp 1s ease-out forwards;
    `;
    document.body.appendChild(message);
    setTimeout(() => message.remove(), 1000);
  }

  private generatePresent() {
    const present: Present = {
      x: Math.random() * (this.canvas.width - 50),
      y: -50,
      speed: 2 + Math.random() * 2,
      width: 40,
      height: 40,
      rotation: Math.random() * Math.PI * 2,
      color: COLORS.PRESENTS[Math.floor(Math.random() * COLORS.PRESENTS.length)],
      scale: 0,
      targetScale: 1
    };
    this.presents.push(present);
  }

  private updatePresents(deltaTime: number) {
    const currentTime = performance.now();

    // Generate new presents
    if (currentTime - this.lastPresentTime > this.presentInterval) {
      this.generatePresent();
      this.lastPresentTime = currentTime;

      // Decrease interval (increase difficulty)
      this.presentInterval = Math.max(800, this.presentInterval * 0.98);
    }

    // Update combo system
    if (currentTime - this.lastCatchTime > 2000) {
      this.combo = 0;
    }

    const deltaSeconds = deltaTime / 1000;

    for (let i = this.presents.length - 1; i >= 0; i--) {
      const present = this.presents[i];

      present.scale += (present.targetScale - present.scale) * 0.1;

      if (!present.caught && !present.stolenByGrinch) {
        present.y += present.speed * deltaSeconds * 60;
        present.rotation += 0.02;
        const distance = Math.sqrt(
          Math.pow(present.x + present.width / 2 - this.handX, 2) +
          Math.pow(present.y + present.height / 2 - this.handY, 2)
        );

        if (distance < CONSTANTS.CATCH_RADIUS && this.isGrabbing) {
          present.caught = true;
          present.targetScale = 1.2; // Grow when caught
          this.combo++;
          this.lastCatchTime = currentTime;
          const comboBonus = Math.min(this.combo * 5, 50);
          this.updateScore(10 + comboBonus);
          if (this.combo > 1) {
            this.showMessage(`${this.combo}x Combo!`, '#FFD700');
          }
        }
      } else if (present.caught) {
        const targetX = this.handX - present.width / 2;
        const targetY = this.handY - present.height / 2;
        present.x += (targetX - present.x) * 0.15;
        present.y += (targetY - present.y) * 0.15;
        present.rotation += 0.1;
      }
      if (present.y > this.canvas.height) {
        if (!present.caught && !present.stolenByGrinch) {
          present.targetScale = 0;
          if (present.scale < 0.1) {
            this.presents.splice(i, 1);
          }
        }
      }
    }
  }

  private drawPresent(present: Present) {
    if (present.scale < 0.01) return;

    this.ctx.save();
    this.ctx.translate(present.x + present.width / 2, present.y + present.height / 2);
    this.ctx.rotate(present.rotation);
    this.ctx.scale(present.scale, present.scale);

    this.ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
    this.ctx.shadowBlur = 10;
    this.ctx.shadowOffsetY = 5;

    this.ctx.fillStyle = present.caught ? '#4CAF50' : present.color;
    this.ctx.fillRect(-present.width / 2, -present.height / 2, present.width, present.height);

    this.ctx.shadowColor = 'transparent';

    this.ctx.strokeStyle = '#FFFFFF';
    this.ctx.lineWidth = 3;
    this.ctx.beginPath();
    this.ctx.moveTo(-present.width / 2, 0);
    this.ctx.lineTo(present.width / 2, 0);
    this.ctx.moveTo(0, -present.height / 2);
    this.ctx.lineTo(0, present.height / 2);
    this.ctx.stroke();

    this.ctx.beginPath();
    this.ctx.arc(0, 0, 5, 0, Math.PI * 2);
    this.ctx.fillStyle = '#FFFFFF';
    this.ctx.fill();

    this.ctx.restore();
  }

  private resizeCanvas() {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
    console.log(`Canvas resized to ${this.canvas.width}x${this.canvas.height}`);
  }

  private draw() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    this.ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
    for (let i = 0; i < 100; i++) {
      const size = Math.random() * 3 + 1;
      const x = Math.random() * this.canvas.width;
      const y = (performance.now() * 0.05 + i * 50) % this.canvas.height;
      this.ctx.beginPath();
      this.ctx.arc(x, y, size, 0, Math.PI * 2);
      this.ctx.fill();
    }

    for (const present of this.presents) {
      this.drawPresent(present);
    }

    for (const grinch of this.grinches) {
      this.drawGrinch(grinch);
    }

    const glowColor = this.isGrabbing ? 'rgba(212, 36, 38, 0.3)' : 'rgba(22, 91, 51, 0.3)';
    for (let i = 3; i > 0; i--) {
      this.ctx.beginPath();
      this.ctx.arc(this.handX, this.handY, CONSTANTS.CATCH_RADIUS + i * 5, 0, Math.PI * 2);
      this.ctx.fillStyle = glowColor;
      this.ctx.fill();
    }

    this.ctx.beginPath();
    this.ctx.arc(this.handX, this.handY, CONSTANTS.CATCH_RADIUS, 0, Math.PI * 2);
    this.ctx.fillStyle = this.isGrabbing ? 'rgba(212, 36, 38, 0.4)' : 'rgba(22, 91, 51, 0.4)';
    this.ctx.fill();

    if (this.combo > 1) {
      this.ctx.font = 'bold 24px "Mountains of Christmas"';
      this.ctx.fillStyle = '#FFD700';
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'middle';
      this.ctx.fillText(`${this.combo}x`, this.handX, this.handY - CONSTANTS.CATCH_RADIUS - 20);
    }
  }

  private gameLoop = (timestamp: number) => {
    if (this.lastTime === 0) {
      this.lastTime = timestamp;
    }
    const deltaTime = timestamp - this.lastTime;
    this.lastTime = timestamp;

    if (this.gameActive) {
      this.updateDifficulty();
      this.updatePresents(deltaTime);
      this.updateGrinches(deltaTime);
      if (this.checkGrinchCollision()) {
        return;
      }
    }

    this.draw();
    requestAnimationFrame(this.gameLoop);
  }

  public updateHandPosition(x: number, y: number, grabbing: boolean) {
    this.handX = x;
    this.handY = y;
    this.isGrabbing = grabbing;
    document.getElementById('handPosition')!.textContent =
      `Hand: (${x.toFixed(0)}, ${y.toFixed(0)}) ${grabbing ? '✊' : '✋'}`;
  }
}

console.log('Starting game...');
const game = new Game();

export { game };