import PixiApp from "./core/App";
const pixiApp = new PixiApp();
await pixiApp.begin();

// @ts-expect-error Set PIXI app to global wndow object for the PIXI Inspector
window.__PIXI_APP__ = pixiApp;