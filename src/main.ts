import './styles.css';
import { Game } from './game/Game';

const canvas = document.querySelector<HTMLCanvasElement>('#game-canvas');
if (!canvas) throw new Error('Missing #game-canvas element.');
canvas.tabIndex = 0;

const game = new Game(canvas);
game.boot();

if (import.meta.hot) {
  import.meta.hot.dispose(() => game.dispose());
}
