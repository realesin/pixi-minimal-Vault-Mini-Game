import config from "../config";
import ParallaxBackground from "../prefabs/ParallaxBackground";
import { Player } from "../prefabs/Player";
import { Container, Text, Graphics } from "pixi.js";
import { centerObjects } from "../utils/misc";
import { SceneUtils } from "../core/App";

export default class Game extends Container {
  name = "Game";

  private player!: Player;
  private background!: ParallaxBackground;

  constructor(protected utils: SceneUtils) {
    super();
  }

  async load() {

    const bg = new Graphics().beginFill(0x0b1354).drawRect(0, 0, window.innerWidth, window.innerHeight)

    const text = new Text("Loading...", {
      fontFamily: "Verdana",
      fontSize: 50,
      fill: "white",
    });

    text.resolution = 2;

    centerObjects(text);

    this.addChild(bg, text);

    await this.utils.assetLoader.loadAssets();
  }

  async start() {
    this.removeChildren();

    this.background = new ParallaxBackground(config.backgrounds.forest);
    this.player = new Player();

    this.player.x = window.innerWidth / 2;
    this.player.y = window.innerHeight - this.player.height / 3;

    this.addChild(this.background, this.player);
  }

  update(delta: number) {
    const x = this.player.state.velocity.x * delta;
    const y = this.player.state.velocity.y * delta;
    this.background.updatePosition(x, y);
  }

  onResize(width: number, height: number) {
    this.player.x = width / 2;
    this.player.y = height - this.player.height / 3;

    this.background.resize(width, height);
  }
}
