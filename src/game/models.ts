export enum LockLevel {
  VERY_EASY = "Very Easy",
  EASY = "Easy",
  AVERAGE = "Average",
  HARD = "Hard",
  VERY_HARD = "Very Hard",
}

export interface Lock {
  level: LockLevel;
  start: number;
  length: number;
  points: number;
}

export enum LockState {
  RESET,
  TURN,
  JAM,
  UNLOCK,
}

export enum PickState {
  ENTER,
  IN_USE,
  FALL,
}

export function getRandomLock(): Lock {
  const rnd = Math.floor(Math.random() * 5);

  const level = [
    LockLevel.VERY_EASY,
    LockLevel.EASY,
    LockLevel.AVERAGE,
    LockLevel.HARD,
    LockLevel.VERY_HARD,
  ][rnd];

  const points = [4, 6, 10, 20, 36][rnd];

  const size = Math.PI / points;

  const maxSize = Math.PI;

  const start = Math.random() * (maxSize - size);
  const length = size;

  return {
    level,
    start,
    length,
    points,
  };
}

export const CONFIG = {
  PICK: {
    POSITION: {
      x: 0,
      y: 0,
      z: -0.03,
    },
    FALL_TO: -1,
    FALL_FROM: 1,
    LIFETIME: 2,
    MAX: 10,
  },
  SCREWDRIVER: {
    POSITION: {
      x: -0.1,
      y: -0.6,
      z: 1,
    },
    ROTATION: {
      y: Math.PI / 3,
      z: -1.5,
    },
  },
  LOCK: {
    RESET_SPEED: 2,
    TURN_SPEED: 0.8,
  },
};
