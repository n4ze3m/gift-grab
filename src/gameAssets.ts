export const DIFFICULTY_LEVELS = {
  EASY: {
    presentSpeed: 2,
    presentInterval: 1500,
    grinchSpeed: 3,
    grinchSpawnInterval: 5000
  },
  MEDIUM: {
    presentSpeed: 3,
    presentInterval: 1200,
    grinchSpeed: 4,
    grinchSpawnInterval: 4000
  },
  HARD: {
    presentSpeed: 8,
    presentInterval: 500,
    grinchSpeed: 8,
    grinchSpawnInterval: 3000
  }
};

export const COLORS = {
  PRESENTS: ['#FF4444', '#4CAF50', '#2196F3', '#FFEB3B', '#9C27B0'],
  GRINCH: '#2d5a27',
  GRINCH_GLOW: 'rgba(45, 90, 39, 0.3)'
};

export const CONSTANTS = {
  CATCH_RADIUS: 60,
  GRINCH_SIZE: 70,
  PRESENT_SIZE: 40,
  COMBO_TIMEOUT: 2000,
  SCORE_THRESHOLDS: {
    MEDIUM: 100,
    HARD: 200
  }
};
