import * as PIXI from "pixi.js";
import gsap from "gsap";

type Direction = "clockwise" | "counterclockwise";
interface Step { ticks: number; dir: Direction }

const TICK_ANGLE = 60 * (Math.PI / 180);

const randInt = (a: number, b: number) => Math.floor(Math.random() * (b - a + 1)) + a;

const randomDir = (): Direction => Math.random() < 0.5 ? "clockwise" : "counterclockwise";

const delay = (s: number) => new Promise<void>((r) => gsap.to({}, { duration: s, onComplete: r }));

const tweenRotation = (t: PIXI.DisplayObject, by: number, d = 0.25) => new Promise<void>((r) =>
  gsap.to(t, { rotation: t.rotation + by, duration: d, ease: "power2.inOut", onComplete: r }));

export default class VaultGame extends PIXI.Container {
  constructor(private app: PIXI.Application) {
    super();
    this.interactive = true;

    document.addEventListener("contextmenu", (e) => {
      if(e.target === this.app.renderer.view) e.preventDefault();
    }, { capture: true });

    window.addEventListener("keydown", (e) => this.onKeyDown(e));
    window.addEventListener("wheel",   (e) => this.onWheel(e), { passive: false });
  }

  private bg!: PIXI.Sprite;
  private doorClosed!: PIXI.Sprite;
  private doorOpen!: PIXI.Sprite;
  private doorOpenShadow!: PIXI.Sprite;
  private handle!: PIXI.Sprite;
  private handleShadow!: PIXI.Sprite;
  private blink!: PIXI.Sprite;
  private timerText!: PIXI.Text;

  private combination: Step[] = [];
  private currentStep = 0;
  private remainingTicks = 0;
  private keyEnabled = true;

  private dragging = false;
  private prevX = 0;
  private accumAngle = 0;

  private startTime = 0;
  private tickerFn?: PIXI.TickerCallback<PIXI.Ticker>;

  async begin() {
    await this.loadAssets();
    this.createScene();
    this.newRound();
    this.bindResize();
  }

  private async loadAssets() {
    PIXI.Assets.addBundle("vault", {
      bg: "bg.png",
      doorClosed: "door.png",
      doorOpen: "doorOpen.png",
      doorOpenShadow: "doorOpenShadow.png",
      handle: "handle.png",
      handleShadow: "handleShadow.png",
      blink: "blink.png"
    });
    await PIXI.Assets.loadBundle("vault");
  }

  private createScene() {
    this.bg = PIXI.Sprite.from("bg");
    this.addChild(this.bg);

    this.doorClosed = PIXI.Sprite.from("doorClosed");
    this.doorClosed.anchor.set(0.5);
    this.addChild(this.doorClosed);

    this.doorOpenShadow = PIXI.Sprite.from("doorOpenShadow");
    this.doorOpenShadow.anchor.set(0.5);
    this.doorOpenShadow.visible = false;
    this.addChild(this.doorOpenShadow);

    this.doorOpen = PIXI.Sprite.from("doorOpen");
    this.doorOpen.anchor.set(0.5);
    this.doorOpen.visible = false;
    this.addChild(this.doorOpen);

    this.handleShadow = PIXI.Sprite.from("handleShadow");
    this.handleShadow.anchor.set(0.5);
    this.handleShadow.alpha = 0.3;
    this.addChild(this.handleShadow);

    this.handle = PIXI.Sprite.from("handle");
    this.handle.anchor.set(0.5);
    this.handle.interactive = true;
    this.handle.cursor = "grab";
    this.handle.on("pointerdown", this.onDragStart, this);
    this.handle.on("pointertap", this.onHandleTap, this);
    this.addChild(this.handle);

    this.blink = PIXI.Sprite.from("blink");
    this.blink.anchor.set(0.5);
    this.blink.visible = false;
    this.addChild(this.blink);

    this.timerText = new PIXI.Text("0.0s", { fontFamily: "Arial", fontSize: 28, fill: 0x382f1d });
    this.timerText.anchor.set(0.5);
    this.addChild(this.timerText);
  }

  private bindResize() {
    const onWindowResize = () => {
      this.app.renderer.resize(window.innerWidth, window.innerHeight);
      this.resize();
    };

    window.addEventListener("resize", onWindowResize);
    this.app.renderer.on("resize", () => this.resize());
    onWindowResize();
  }

  private resize() {
    if(!this.bg) return;
    const fit = Math.min(
      this.app.screen.width / this.bg.texture.width,
      this.app.screen.height / this.bg.texture.height
    );
    const scale = Math.min(1, fit);
    this.bg.scale.set(scale);

    this.bg.position.set(
      (this.app.screen.width - this.bg.width ) / 2,
      (this.app.screen.height - this.bg.height) / 2
    );

    const cx = this.bg.x + this.bg.width  / 2;
    const cy = this.bg.y + this.bg.height / 2;
    [
      this.doorClosed,
      this.doorOpen,
      this.doorOpenShadow,
      this.handle,
      this.handleShadow,
      this.blink
    ].forEach(s => {
      s.scale.set(scale);
      s.position.set(cx + 50, cy - 10);
    });
    this.handle.position.set(this.handle.position._x - 65, this.handle.position.y);
    this.handleShadow.position.set(this.handle.position._x, this.handle.position.y + 20);

    this.blink.position.y -= this.bg.height * 0.07 - 200;

    this.timerText.position.set(cx - this.bg.width * 0.23, cy - this.bg.height * 0.015);
  }

  private newRound() {
    this.generateCombination();
    this.resetTimer();
    this.enableInput();

    this.handle.visible = this.handleShadow.visible = true;
    this.handle.rotation = this.handleShadow.rotation = 0;

    this.doorClosed.visible = true;
    this.doorClosed.alpha = 1;
    this.doorOpen.visible = this.doorOpenShadow.visible = false;

    gsap.killTweensOf(this.blink);
    this.blink.visible = false;
    this.blink.alpha = 1;
  }

  private generateCombination() {
    this.combination = Array.from({ length: 3 }, () => ({
      ticks: randInt(1, 9),
      dir:   randomDir()
    }));
    this.currentStep    = 0;
    this.remainingTicks = this.combination[0].ticks;

    console.info("combination: ", this.combination.map(s => `${s.ticks} ${s.dir}`).join(", ")
    );
  }

  private onKeyDown(e: KeyboardEvent) {
    if(!this.keyEnabled) return;
    if(e.code === "ArrowRight") this.processTurn("clockwise");
    else if(e.code === "ArrowLeft") this.processTurn("counterclockwise");
  }

  private onWheel(e: WheelEvent) {
    if(!this.keyEnabled) return;
    e.preventDefault();
    this.processTurn(e.deltaY > 0 ? "clockwise" : "counterclockwise");
  }

  private onHandleTap(e: PIXI.FederatedPointerEvent) {
    if(!this.keyEnabled) return;
    const local = this.handle.toLocal(e.global);
    this.processTurn(local.x >= 0 ? "clockwise" : "counterclockwise");
  }

  private onDragStart(e: PIXI.FederatedPointerEvent) {
    if(!this.keyEnabled || e.button !== 2) return;
    const dx = e.global.x - this.handle.x;
    const dy = e.global.y - this.handle.y;

    if(Math.hypot(dx, dy) < this.handle.width / 2) return;
    this.dragging = true;
    this.prevX = e.global.x;
    this.accumAngle = 0;
    this.handle.cursor = "grabbing";
    this.app.stage.on("pointermove", this.onDragMove, this);
    this.app.stage.once("pointerup", this.onDragEnd, this);
    this.app.stage.once("pointerupoutside", this.onDragEnd, this);
  }

  private onDragMove(e: PIXI.FederatedPointerEvent) {
    if(!this.dragging) return;
    const dx = e.global.x - this.prevX;
    this.prevX = e.global.x;
    const radius = this.handle.width / 2;
    const diffAngle = (dx / radius) * TICK_ANGLE;
    this.handle.rotation += diffAngle;
    this.handleShadow.rotation += diffAngle;
    this.accumAngle += diffAngle;
    while(Math.abs(this.accumAngle) >= TICK_ANGLE) {
      const dir: Direction =
        this.accumAngle > 0 ? "clockwise" : "counterclockwise";
      this.accumAngle += dir === "clockwise" ? -TICK_ANGLE : TICK_ANGLE;
      this.processTurn(dir, false);
    }
  }

  private onDragEnd() {
    this.dragging = false;
    this.handle.cursor = "grab";
    this.app.stage.off("pointermove", this.onDragMove, this);
  }

  private async processTurn(dir: Direction, animate = true) {
    const delta = dir === "clockwise" ? TICK_ANGLE : -TICK_ANGLE;
    if(animate) {
      await tweenRotation(this.handle, delta);
      await tweenRotation(this.handleShadow, delta);
    } else {
      this.handle.rotation += delta;
      this.handleShadow.rotation += delta;
    }

    const step = this.combination[this.currentStep];
    if(dir === step.dir) {
      if(--this.remainingTicks === 0) {
        if(++this.currentStep === this.combination.length) return this.unlock();
        this.remainingTicks = this.combination[this.currentStep].ticks;
      }
    } else {
      await this.fail();
    }
  }

  private async unlock() {
    this.disableInput();
    this.stopTimer();
    this.handle.visible = this.handleShadow.visible = false;

    const shift = this.app.screen.width * 0.2;

    this.doorOpen.rotation =this.doorClosed.rotation;
    this.doorOpenShadow.rotation = this.doorClosed.rotation;
    this.doorOpen.visible = this.doorOpenShadow.visible = true;

    await new Promise<void>((resolve) => {
      gsap.timeline({ onComplete: resolve })
      .to(this.doorClosed, { duration: 0.3, alpha: 0 })
      .fromTo([this.doorOpen, this.doorOpenShadow],
      { alpha: 0, x: this.doorClosed.x },
      { alpha: 1, duration: 0.3 }, "<")
      .to([this.doorOpen, this.doorOpenShadow],
      { x: `+=${shift}`, duration: 0.4, ease: "power2.inOut" });
    });

    this.blink.visible = true;
    gsap.to(this.blink, {
      duration: 0.6, alpha: 0, yoyo: true, repeat: -1,
      rotation: `+=${Math.PI / 2}`, ease: "sine.inOut"
    });

    await delay(5);
    await this.reclose(shift);
  }

  private async reclose(shift: number) {
    gsap.killTweensOf(this.blink);
    this.blink.visible = false;
    this.blink.alpha   = 1;
    await new Promise<void>((resolve) => {
      gsap.timeline({ onComplete: resolve })
      .to([this.doorOpen, this.doorOpenShadow],
      { x: `-=${shift}`, duration: 0.4, ease: "power2.inOut" })
      .to([this.doorOpen, this.doorOpenShadow], { duration: 0.3, alpha: 0 })
      .to(this.doorClosed, { duration: 0.3, alpha: 1 }, "<");
    });
    this.handle.visible = this.handleShadow.visible = true;
    await Promise.all([
      tweenRotation(this.handle, 8 * Math.PI, 1.2),
      tweenRotation(this.handleShadow, 8 * Math.PI, 1.2),
    ]);

    this.newRound();
  }

  private async fail() {
    this.disableInput();
    this.stopTimer();
    await Promise.all([
      tweenRotation(this.handle, 8 * Math.PI, 1.2),
      tweenRotation(this.handleShadow, 8 * Math.PI, 1.2),
    ]);
    await delay(0.3);
    this.newRound();
  }

  private resetTimer() {
    this.startTime = performance.now();
    if(this.tickerFn) this.app.ticker.remove(this.tickerFn);
      this.tickerFn = () => {
      const secs = (performance.now() - this.startTime) / 1000;
      this.timerText.text = `${secs.toFixed(1)}s`;
    };
    this.app.ticker.add(this.tickerFn);
  }

  private stopTimer() {
    if(this.tickerFn) this.app.ticker.remove(this.tickerFn);
  }

  private enableInput() { this.handle.interactive = this.keyEnabled = true; }
  private disableInput() { this.handle.interactive = this.keyEnabled = false; }
}