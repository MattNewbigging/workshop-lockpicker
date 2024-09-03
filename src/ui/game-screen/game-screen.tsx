import "./game-screen.scss";
import "../../app/app.scss";
import React from "react";

export const GameScreen: React.FC = () => {
  return (
    <div className="game-screen">
      <div className="bottom-left">
        <p className="align-left">Lockpick Skill</p>
        <p>100</p>
        <p className="align-left">Bobby Pins</p>
        <p>90</p>
        <p className="align-left">Lock Level</p>
        <p>Average</p>
      </div>

      <div className="bottom-right">
        <p>Show debug UI D)</p>
      </div>
    </div>
  );
};
