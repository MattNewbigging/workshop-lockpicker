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

  const points = [4, 7, 10, 20, 36][rnd];

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
