import "./game-screen.scss";
import "../../app/app.scss";
import React from "react";
import { observer } from "mobx-react-lite";
import { GameState } from "../../game/game-state";

interface GameScreenProps {
  gameState: GameState;
}

export const GameScreen: React.FC<GameScreenProps> = observer(
  ({ gameState }) => {
    const points = gameState.points;
    const picks = gameState.lockpicks;
    const level = gameState.currentLock.level;

    return (
      <div className="game-screen">
        <div className="bottom-left">
          <p className="align-left">Lockpick Points</p>
          <p>{points}</p>
          <p className="align-left">Bobby Pins</p>
          <p>{picks}</p>
          <p className="align-left">Lock Level</p>
          <p>{level}</p>
        </div>

        <div className="bottom-right">
          <p>Turn lock LMB) Spacebar)</p>
          <p>Show debug UI D)</p>
        </div>
      </div>
    );
  }
);
