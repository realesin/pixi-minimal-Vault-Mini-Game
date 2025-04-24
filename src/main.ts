import * as PIXI from "pixi.js";
import VaultGame from "./VaultGame";

const app = new PIXI.Application({ resizeTo: window, backgroundAlpha: 0 });

document.body.appendChild(app.view as unknown as HTMLCanvasElement);

const game = new VaultGame(app);
await game.begin();
app.stage.addChild(game);

// @ts-expect-error
window.__PIXI_APP__ = app;
