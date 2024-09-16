import "./app.scss";

import React from "react";
import { observer } from "mobx-react-lite";

import { AppState } from "./app-state";
import { LoadingScreen } from "../ui/loading-screen/loading-screen";
import { GameScreen } from "../ui/game-screen/game-screen";
import { GameOverModal } from "../ui/game-over-modal/game-over-modal";

interface AppProps {
  appState: AppState;
}

export const App: React.FC<AppProps> = observer(({ appState }) => {
  const started = appState.started;
  const gameState = appState.gameState;
  const gameOver = gameState?.gameOver;

  return (
    <>
      {!started && <LoadingScreen appState={appState} />}
      {gameState && <GameScreen gameState={gameState} />}
      {gameOver && <GameOverModal gameState={gameState} />}
    </>
  );
});
