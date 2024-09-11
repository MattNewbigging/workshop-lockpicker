import { observer } from "mobx-react-lite";
import { GameState } from "../../game/game-state";
import "./game-over-modal.scss";
import React from "react";
import { LockLevel } from "../../game/models";

interface GameOverModalProps {
  gameState: GameState;
}

export const GameOverModal: React.FC<GameOverModalProps> = observer(
  ({ gameState }) => {
    const points = gameState.points;
    const locks = gameState.completedLocks;
    const veryEasy = locks.filter(
      (level) => level === LockLevel.VERY_EASY
    ).length;
    const easy = locks.filter((level) => level === LockLevel.EASY).length;
    const average = locks.filter((level) => level === LockLevel.AVERAGE).length;
    const hard = locks.filter((level) => level === LockLevel.HARD).length;
    const veryHard = locks.filter((level) => level === LockLevel.VERY_HARD);

    return (
      <div className="game-over-modal">
        <div>Game Over!</div>

        <div className="summary">
          <p>Points</p>
          <p>{points}</p>
          <p>Very Easy</p>
          <p>{veryEasy}</p>
          <p>Easy</p>
          <p>{easy}</p>
          <p>Average</p>
          <p>{average}</p>
          <p>Hard</p>
          <p>{hard}</p>
          <p>Very Hard</p>
          <p>{veryHard}</p>
        </div>

        <div>Play Again</div>
      </div>
    );
  }
);
