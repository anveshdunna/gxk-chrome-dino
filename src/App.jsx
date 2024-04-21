import RiveCanvas from '@rive-app/canvas-advanced';
import './App.css';
import { registerTouchInteractions } from './listeners';

let canvasWidth = 360;
let canvasHeight = 240;
let obstacleArray = [];
let obstacle1Width = 36;
let obstacle2Width = 40;
let obstacle3Width = 48;
let obstacleHeight = 48;
let obstacleX = 400;
let obstacleY = 160;
let velocityX = -0.8;
let smSpeed = 0;
let smJump = null;
let smState = 0;
let rafSpeed = null;
let acceleration = 0.0002;
let score = 0;
let hitboxGap = 16;
let highScore = null;
let HIGH_SCORE_KEY = 'highScore';

export default function App() {
  return (
    <div className="App">
      <h2>Dino game</h2>
      <canvas id="canvas" width={canvasWidth} height={canvasHeight}></canvas>
    </div>
  );
}

function initializeHighScore() {
  const initialHighScore = 0; // Set this to whatever initial score you want
  let storedHighScore = localStorage.getItem(HIGH_SCORE_KEY);
  if (!storedHighScore || Number(storedHighScore) < initialHighScore) {
    localStorage.setItem(HIGH_SCORE_KEY, initialHighScore.toString());
    highScore = initialHighScore; // Ensure highScore variable is also set
  } else {
    highScore = Number(storedHighScore); // Ensure highScore variable is set to the stored value if it exists
  }
}

// Ensure you call initializeHighScore at the beginning of your game setup or main function
initializeHighScore();

// Call this before main to ensure the high score is set/initialized
// initializeHighScore();

async function main() {
  // Variables
  let lastObstacleTime = 0;
  let obstacleInterval = 1000;

  // Access to low-level Rive API through WASM
  const rive = await RiveCanvas({
    locateFile: (_) =>
      `https://unpkg.com/@rive-app/canvas-advanced@2.12.1/rive.wasm`,
  });

  // Setting canvas and renderer
  const canvas = document.getElementById('canvas');
  const renderer = rive.makeRenderer(canvas);

  const riveFileUrl =
    'https://public.rive.app/hosted/47677/140601/SVwqR9MRvUGz1YzkqIB5iw.riv';

  // Loading Rive file
  // const gameBytes = await(await fetch(new Request(GameRive))).arrayBuffer();
  const gameBytes = await (await fetch(riveFileUrl)).arrayBuffer();
  const gameFile = await rive.load(new Uint8Array(gameBytes));

  // Creating relevant artboards and state machines
  const gameArtboard = gameFile.artboardByName('Game');
  const gameSm = new rive.StateMachineInstance(
    gameArtboard.stateMachineByIndex(0),
    gameArtboard
  );
  const hero = gameArtboard.node('Hero');
  hero.width = 48;
  hero.height = 48;

  // Getting inputs from state machine
  smSpeed = gameSm.input(0).asNumber();
  smJump = gameSm.input(1).asTrigger();
  smState = gameSm.input(2).asNumber();

  // Setting up listeners
  const setupListeners = registerRiveListeners(
    canvas,
    renderer,
    rive,
    rive.Fit.contain,
    rive.Alignment.center
  );
  setupListeners(gameArtboard, gameSm);

  // Keyboard and touch listeners
  document.removeEventListener('keydown', jumpDino);
  document.addEventListener('keydown', jumpDino);
  document.removeEventListener('touchstart', touchJumpDino);
  document.addEventListener('touchstart', touchJumpDino);

  // Update rAF speed
  function updateRafSpeed(elapsedTimeSec) {
    rafSpeed += elapsedTimeSec * acceleration;
  }

  // Update state machine speed
  function updateSmSpeed(elapsedTimeSec) {
    smSpeed.value += elapsedTimeSec * acceleration * 2500;
  }

  // Select and add random obstacle to an array
  function placeObstacles() {
    let obstacle = {
      artboard: null,
      sm: null,
      speed: 0,
      state: 1,
      x: obstacleX,
      y: obstacleY,
      width: null,
      height: obstacleHeight,
    };
    let placeObstacleChance = Math.random();
    if (placeObstacleChance > 0.8) {
      obstacle.artboard = gameFile.artboardByName('Obstacle3');
      obstacle.sm = new rive.StateMachineInstance(
        obstacle.artboard.stateMachineByIndex(0),
        obstacle.artboard
      );
      obstacle.speed = obstacle.sm.input(0).asNumber();
      obstacle.state = obstacle.sm.input(1).asNumber();
      obstacle.width = obstacle3Width;
      obstacleArray.push(obstacle);
    } else if (placeObstacleChance > 0.5) {
      obstacle.artboard = gameFile.artboardByName('Obstacle2');
      obstacle.sm = new rive.StateMachineInstance(
        obstacle.artboard.stateMachineByIndex(0),
        obstacle.artboard
      );
      obstacle.speed = obstacle.sm.input(0).asNumber();
      obstacle.state = obstacle.sm.input(1).asNumber();
      obstacle.width = obstacle2Width;
      obstacleArray.push(obstacle);
    } else if (placeObstacleChance > 0.2) {
      obstacle.artboard = gameFile.artboardByName('Obstacle1');
      obstacle.sm = new rive.StateMachineInstance(
        obstacle.artboard.stateMachineByIndex(0),
        obstacle.artboard
      );
      obstacle.speed = obstacle.sm.input(0).asNumber();
      obstacle.state = obstacle.sm.input(1).asNumber();
      obstacle.width = obstacle1Width;
      obstacleArray.push(obstacle);
    }

    if (obstacleArray.length > 4) {
      obstacleArray.shift();
    }
  }

  // Clean up obstacles that are outside frame
  function clearPassedObstacles() {
    for (let i = obstacleArray.length - 1; i >= 0; i--) {
      let obstacle = obstacleArray[i];
      if (obstacle.x <= -100) {
        obstacle.sm.delete();
        obstacle.artboard.delete();
        obstacleArray.splice(i, 1); // Remove the obstacle from the array
      }
    }
  }

  // Delete all obstacles
  function deleteAllObstacles() {
    obstacleArray.forEach((obstacle) => {
      obstacle.sm.delete(); // Delete the state machine instance
      obstacle.artboard.delete(); // Delete the artboard instance
    });
    obstacleArray = []; // Clear the array
  }

  // Detect collisions
  function detectCollision(hero, obstacle) {
    return (
      hero.x < obstacle.x + obstacle.width - hitboxGap &&
      hero.x + hero.width > obstacle.x + hitboxGap &&
      hero.y < obstacle.y + obstacle.height - hitboxGap &&
      hero.y + hero.height > obstacle.y + hitboxGap
    );
  }

  // Reset game
  function resetGame() {
    score = 0;
    smSpeed.value = 0;
    lastObstacleTime = 0;
    deleteAllObstacles();
    smState.value = 1;
  }

  // Update score
  function updateScore(rafSpeed) {
    score += rafSpeed * 10;
  }

  function setHighScore(score) {
    highScore = Number(localStorage.getItem(HIGH_SCORE_KEY));
    if (score > highScore) {
      localStorage.setItem(HIGH_SCORE_KEY, Math.floor(score));
    }
  }

  // Jump dino with keyboard
  function jumpDino(e) {
    if (e.code == 'Space' || e.code == 'ArrowUp') {
      if (smState.value == 2) {
        resetGame();
        return;
      } else if (smState.value == 0) {
        smState.value = 1;
      }
      smJump.fire();
    }
  }

  // Jump dino on touch screens
  function touchJumpDino(e) {
    if (smState.value == 2) {
      resetGame();
      return;
    } else if (smState.value == 0) {
      smState.value = 1;
    }
    smJump.fire();
  }

  // Renderloop
  let lastTime = 0;
  function renderLoop(time) {
    if (!lastTime) {
      lastTime = time;
    }
    const elapsedTimeMs = time - lastTime;
    const elapsedTimeSec = elapsedTimeMs / 1000;
    lastTime = time;

    lastObstacleTime += elapsedTimeMs;

    // Clear the canvas
    renderer.clear();

    if (smState.value == 1) {
      updateRafSpeed(elapsedTimeSec);
      updateSmSpeed(elapsedTimeSec);
    } else rafSpeed = elapsedTimeSec;

    // Game hero and ground
    gameSm.advance(elapsedTimeSec);
    gameArtboard.advance(elapsedTimeSec);
    renderer.save();
    renderer.align(
      rive.Fit.contain,
      rive.Alignment.center,
      {
        minX: 0,
        minY: 0,
        maxX: canvas.width,
        maxY: canvas.height,
      },
      gameArtboard.bounds
    );
    gameArtboard.draw(renderer);
    renderer.restore();

    // Score

    renderer.font = '16px "Press Start 2P"';
    if (smState.value == 1) {
      updateScore(rafSpeed);
    }
    renderer.fillStyle = '#535353';
    const scorePadded = Math.floor(score).toString().padStart(5, 0);
    renderer.fillText(scorePadded, 280, 20);

    // High Score
    renderer.fillStyle = '#535353';
    const highScorePadded = highScore.toString().padStart(5, 0);
    renderer.fillText(`HI ${highScorePadded}`, 132, 20);

    if (smState.value == 1 && lastObstacleTime >= obstacleInterval) {
      placeObstacles(); // Place a new obstacle
      lastObstacleTime = 0; // Reset the timer
    }

    // Place obstacles in render loop
    for (let i = 0; i < obstacleArray.length; i++) {
      let obstacle = obstacleArray[i];
      let dynamicSpeed = velocityX * rafSpeed * 250;
      obstacle.speed.value = smSpeed.value;

      if (smState.value != 2) {
        obstacle.x += dynamicSpeed;
      }

      obstacle.sm.advance(elapsedTimeSec);
      obstacle.artboard.advance(elapsedTimeSec);
      renderer.save();
      renderer.align(
        rive.Fit.contain,
        rive.Alignment.center,
        {
          minX: 0,
          minY: obstacle.y,
          maxX: obstacle.width,
          maxY: obstacle.y + obstacle.height,
        },
        obstacle.artboard.bounds
      );
      renderer.translate(obstacle.x, 0);
      obstacle.artboard.draw(renderer);
      renderer.restore();

      if (detectCollision(hero, obstacle)) {
        smState.value = 2;
        obstacle.state.value = smState.value;
        setHighScore(score);
      }
    }

    // Remove the passed obstacles
    clearPassedObstacles();
    rive.requestAnimationFrame(renderLoop);
  }
  rive.requestAnimationFrame(renderLoop);
}

function registerRiveListeners(canvas, renderer, rive, fit, alignment) {
  return function (artboard, stateMachine) {
    registerTouchInteractions({
      canvas,
      artboard,
      stateMachines: [stateMachine],
      renderer,
      rive,
      fit,
      alignment,
    });
  };
}

// main();
if ('fonts' in document) {
  document.fonts.load('16px "Press Start 2P"').then(function () {
    // The font is now available for use.
    // You can start your main function or trigger a re-render here.
    main();
  });
}
