import * as THREE from "three";
import * as TWEEN from "@tweenjs/tween.js";
import { AssetManager } from "./asset-manager";
import { KeyboardListener } from "./keyboard-listener";
import { makeAutoObservable, observable } from "mobx";
import { CONFIG, Lock, LockState, PickState, getRandomLock } from "./models";

const HALF_PI = Math.PI / 2;

export class GameState {
  // Observable state for UI
  @observable currentLock!: Lock;
  @observable lockpicks = 100;
  @observable points = 0;

  // Scene
  private renderer = new THREE.WebGLRenderer({ antialias: true });
  private clock = new THREE.Clock();
  private scene = new THREE.Scene();

  private camera = new THREE.PerspectiveCamera(35, 1, 0.1, 50);
  private cameraDir = new THREE.Vector3();

  private soundMap = new Map<string, THREE.Audio>();

  // 3D Objects
  private cylinder!: THREE.Object3D;
  private pick!: THREE.Object3D;
  private screwdriver!: THREE.Object3D;

  // Interaction
  private keyboardListener = new KeyboardListener();
  private pointer = new THREE.Vector2();
  private pointerDelta = new THREE.Vector2();
  private raycaster = new THREE.Raycaster();
  private castPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1));
  private intersectPoint = new THREE.Vector3();

  // Debug
  private showDebugUi = false;
  private debugObjects: THREE.Mesh[] = [];

  // Gane logic
  private gameOver = false;
  private applyForce = false;
  private pickLife = 2;
  private lockState = LockState.RESET;
  private pickState = PickState.IN_USE;

  // Animations
  private pickFallAnim: TWEEN.Tween;
  private pickEnterAnim: TWEEN.Tween;

  constructor(private assetManager: AssetManager) {
    makeAutoObservable(this);

    this.setupScene();
    this.setupAudio();
    this.setupObjects();
    this.pickFallAnim = this.setupPickFallAnimation();
    this.pickEnterAnim = this.setupPickEnterAnimation();

    this.currentLock = getRandomLock();

    this.onPickFallen();

    // Start game
    this.update();
  }

  private setupScene() {
    // Renderer
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.25;
    const root = document.getElementById("root");
    root?.appendChild(this.renderer.domElement);
    window.addEventListener("resize", this.onCanvasResize);
    this.onCanvasResize();

    // Camera
    this.camera.position.set(0, 0.01, 0.2);

    // Lights
    const pointLight = new THREE.PointLight(0xffffff, 0.75);
    pointLight.position.set(0.25, 0.25, 0.25);
    this.scene.add(pointLight);

    // Environment map
    const envMap = this.assetManager.textures.get("hdri");
    this.scene.environment = envMap;
    this.scene.background = envMap;
    this.scene.backgroundRotation = new THREE.Euler(0, -Math.PI / 6, 0);
    this.scene.environmentRotation = new THREE.Euler(0, -Math.PI / 6, 0);
    this.scene.environmentIntensity = 1;
    this.scene.backgroundIntensity = 0.5;
    this.scene.backgroundBlurriness = 0.3;
  }

  private setupAudio() {
    const buffers = this.assetManager.audioBuffers;

    const audioListener = new THREE.AudioListener();
    this.camera.add(audioListener);

    const pickMoveSound = new THREE.Audio(audioListener);
    pickMoveSound.setBuffer(buffers.get("pick-move"));
    pickMoveSound.loop = true;
    pickMoveSound.play();
    this.soundMap.set("pick-move", pickMoveSound);

    const jamSound = new THREE.Audio(audioListener);
    jamSound.setBuffer(buffers.get("jam"));
    this.soundMap.set("jam", jamSound);

    const unlockSound = new THREE.Audio(audioListener);
    unlockSound.setBuffer(buffers.get("unlock"));
    this.soundMap.set("unlock", unlockSound);

    const pickBreakSound = new THREE.Audio(audioListener);
    pickBreakSound.setBuffer(buffers.get("pick-break"));
    this.soundMap.set("pick-break", pickBreakSound);

    const pickingSound = new THREE.Audio(audioListener);
    pickingSound.setBuffer(buffers.get("picking"));
    pickingSound.loop = true;
    this.soundMap.set("picking", pickingSound);

    const tensionSound = new THREE.Audio(audioListener);
    tensionSound.setBuffer(buffers.get("tension"));
    tensionSound.setVolume(0.75);
    tensionSound.loop = true;
    this.soundMap.set("tension", tensionSound);

    const pickEnterSound = new THREE.Audio(audioListener);
    pickEnterSound.setBuffer(buffers.get("pick-enter"));
    this.soundMap.set("pick-enter", pickEnterSound);
  }

  private setupObjects() {
    const lock = this.assetManager.getLock();
    this.cylinder = lock.getObjectByName("lock_cylinder_lp") as THREE.Object3D;
    this.pick = this.assetManager.getPick();
    this.screwdriver = this.assetManager.getScrewdriver();

    this.pick.position.z = CONFIG.PICK.POSITION.z;

    this.screwdriver.rotation.y = CONFIG.SCREWDRIVER.ROTATION.y;
    this.screwdriver.rotation.z = CONFIG.SCREWDRIVER.ROTATION.z;
    this.screwdriver.position.set(
      CONFIG.SCREWDRIVER.POSITION.x,
      CONFIG.SCREWDRIVER.POSITION.y,
      CONFIG.SCREWDRIVER.POSITION.z
    );

    // Make cylinder parent of screwdriver so they rotate together
    this.cylinder.add(this.screwdriver);

    this.scene.add(lock, this.pick);
  }

  private setupPickFallAnimation() {
    const pickFall = new TWEEN.Tween(this.pick).to(
      {
        position: { y: CONFIG.PICK.FALL_TO },
      },
      1000
    );
    pickFall
      .onComplete(() => {
        this.onPickFallen();
      })
      .easing(TWEEN.Easing.Quadratic.In);

    return pickFall;
  }

  private setupPickEnterAnimation() {
    const { POSITION } = CONFIG.PICK;

    const tween = new TWEEN.Tween(this.pick)
      .to(
        {
          position: { x: POSITION.x, y: POSITION.y, z: POSITION.z },
        },
        1000
      )
      .easing(TWEEN.Easing.Quadratic.Out);

    tween.onComplete(() => {
      this.onPickEnter();
    });

    return tween;
  }

  private playAudio(name: string) {
    const sound = this.soundMap.get(name);
    sound?.stop().play();
  }

  private addListeners() {
    window.addEventListener("mousemove", this.onMouseMove);
    window.addEventListener("mousedown", this.onMouseDown);
    window.addEventListener("mouseup", this.onMouseUp);
    this.renderer.domElement.addEventListener(
      "pointerleave",
      this.onPointerLeave
    );
    this.keyboardListener.on(" ", this.onPressSpace);
    this.keyboardListener.onRelease(" ", this.onReleaseSpace);
    this.keyboardListener.on("d", this.onToggleDebugUi);
  }

  private removeListeners() {
    window.removeEventListener("mousemove", this.onMouseMove);
    window.removeEventListener("mousedown", this.onMouseDown);
    window.removeEventListener("mouseup", this.onMouseUp);
    this.renderer.domElement.addEventListener(
      "pointerleave",
      this.onPointerLeave
    );
    this.keyboardListener.off(" ", this.onPressSpace);
    this.keyboardListener.offRelease(" ", this.onReleaseSpace);
    this.keyboardListener.off("d", this.onToggleDebugUi);
  }

  private update = () => {
    requestAnimationFrame(this.update);

    const dt = this.clock.getDelta();
    const elapsed = this.clock.getElapsedTime();

    this.updateLockState();

    switch (this.lockState) {
      case LockState.RESET:
        // Lock returns to upright position
        this.resetLock(dt);
        // Pick can follow mouse
        this.moveLockpick();
        break;
      case LockState.JAM:
        // Lock and pick wiggle
        this.performJamWiggle(elapsed);
        // Pick lifetime reduced
        this.reducePickLife(dt);
        break;
      case LockState.TURN:
        // Lock turns, pick does not move
        this.turnLock(dt);
        break;
      case LockState.UNLOCK:
        this.onUnlock();
        break;
    }

    // The screwdriver and camera always move with the mouse movement
    this.moveScrewdriver();
    this.updateCamera();

    this.pointerDelta.set(0, 0); // zero out so that we don't have small persistent deltas

    this.updateAnimations();

    this.renderer.render(this.scene, this.camera);
  };

  private updateLockState() {
    // If the user isn't applying any force, the lock resets
    if (!this.applyForce) {
      this.lockState = LockState.RESET;

      return;
    }

    // If the user has no pick, the lock resets
    if (this.pickState !== PickState.IN_USE) {
      this.lockState = LockState.RESET;

      return;
    }

    // If the pick isn't inside the pick zone, the lock jams
    if (!this.isInsidePickZone()) {
      this.lockState = LockState.JAM;

      return;
    }

    // Have we turned the lock enough to open it?
    const turnedEnough = this.cylinder.rotation.z === -HALF_PI;
    this.lockState = turnedEnough ? LockState.UNLOCK : LockState.TURN;
  }

  private isInsidePickZone() {
    const pickRot = this.pick.rotation.z;
    const afterStart = pickRot < HALF_PI - this.currentLock.start;
    const beforeEnd =
      pickRot > HALF_PI - this.currentLock.start - this.currentLock.length;

    return afterStart && beforeEnd;
  }

  private resetLock(dt: number) {
    // Returns the lock to its upright position
    const newRot = this.cylinder.rotation.z + dt * CONFIG.LOCK.RESET_SPEED;
    this.cylinder.rotation.z = THREE.MathUtils.clamp(newRot, -HALF_PI, 0);

    const turnSound = this.soundMap.get("picking");
    if (turnSound?.isPlaying) {
      turnSound?.pause();
    }
  }

  private turnLock(dt: number) {
    const newRot = this.cylinder.rotation.z - dt * CONFIG.LOCK.TURN_SPEED;
    this.cylinder.rotation.z = THREE.MathUtils.clamp(newRot, -HALF_PI, 0);

    const turnSound = this.soundMap.get("picking");
    if (!turnSound?.isPlaying) {
      turnSound?.play();
    }

    this.soundMap.get("tension")?.pause();
  }

  private moveLockpick() {
    // Follow mouse movement
    this.pick.rotation.z =
      Math.atan2(this.intersectPoint.x, this.intersectPoint.y) * -1;
    this.pick.rotation.z = THREE.MathUtils.clamp(
      this.pick.rotation.z,
      -HALF_PI,
      HALF_PI
    );

    // Play pick move sound
    const pickMoveSound = this.soundMap.get("pick-move")!;

    const pointerLength = this.pointerDelta.lengthSq();
    const pickMoveVolume = Math.min(
      1,
      Math.sqrt(this.pointerDelta.lengthSq() * 25)
    );
    const pitch = Math.min(1.1, 0.8 + pointerLength);
    pickMoveSound.setPlaybackRate(pitch);
    pickMoveSound.setVolume(pickMoveVolume);
  }

  private performJamWiggle(elapsed: number) {
    // Lock wiggle
    const sin1 = Math.sin(elapsed * 30) * 0.1;
    const sin2 = Math.sin(elapsed * 41) * 0.1;
    const sin3 = Math.sin(elapsed * 27) * 0.1;
    const freq = sin1 + sin2 + sin3;

    this.cylinder.rotation.z += freq * 0.1;

    // Pick uses additional waves to move similarly but not identically
    const sin4 = Math.sin(elapsed * 30 + 3) * 0.1;
    const sin5 = Math.sin(elapsed * 41 + 3) * 0.1;
    const sin6 = Math.sin(elapsed * 27 + 3) * 0.1;
    const freq2 = sin4 + sin5 + sin6;

    this.pick.rotation.z += freq2 * 0.1;

    // Sound
    const tensionSound = this.soundMap.get("tension");
    if (!tensionSound?.isPlaying) {
      tensionSound?.play();
    }
  }

  private reducePickLife(dt: number) {
    this.pickLife -= dt;

    // If this pick still has life left in it, do nothing else
    if (this.pickLife > 0) {
      return;
    }

    // If this broken pick is currently falling, we've already entered here so we can stop
    if (this.pickState === PickState.FALL) {
      return;
    }

    // Pick has broken!
    this.pickState = PickState.FALL;
    this.lockpicks--;
    this.playAudio("pick-break");
    this.pickFallAnim.start();

    // Have we run out of picks?
    if (this.lockpicks === 0) {
      console.log("game over");
      this.gameOver = true;
      return;
    }

    // Prevent interactions during animations
    this.applyForce = false;
    this.removeListeners();
    this.soundMap.get("tension")?.pause();
  }

  private updateCamera() {
    const dir = this.cameraDir;

    dir.x = -Math.sin(this.pointer.x);
    dir.y = Math.sin(this.pointer.y);
    dir.multiplyScalar(0.05);

    dir.z = 1.0;
    dir.normalize();

    dir.multiplyScalar(0.25); // camera distance

    this.camera.position.copy(dir);
    this.camera.lookAt(new THREE.Vector3());
  }

  private moveScrewdriver() {
    this.screwdriver.rotation.y = Math.PI / 4 + this.pointer.x * 0.1;
    this.screwdriver.rotation.z = Math.PI / 2 + this.pointer.y * 0.25;
    this.screwdriver.rotation.x = this.pointer.y * -0.1;
  }

  private updateAnimations() {
    this.pickFallAnim.update();
    this.pickEnterAnim.update();
  }

  private onPickFallen() {
    if (this.gameOver) {
      return;
    }

    // Setup a new pick
    this.pickLife = CONFIG.PICK.LIFETIME;
    this.pick.position.y = CONFIG.PICK.FALL_FROM;
    this.pickState = PickState.ENTER;
    this.pickEnterAnim.start();
  }

  private onPickEnter() {
    this.playAudio("pick-enter");
    this.pickState = PickState.IN_USE;
    this.addListeners();
  }

  private onUnlock() {
    // Award
    this.points += this.currentLock.points;
    this.playAudio("unlock");

    // Stop receiving input for a second while we reset
    this.removeListeners();
    this.showDebugUi = false;
    this.hideDebugUI();
    this.applyForce = false;

    // Give it a second, then start another one
    setTimeout(() => {
      this.currentLock = getRandomLock();
      this.addListeners();
    }, 1000);
  }

  private onMouseMove = (event: MouseEvent) => {
    const ndc = {
      x: (event.clientX / window.innerWidth) * 2 - 1,
      y: -(event.clientY / window.innerHeight) * 2 + 1,
    };

    this.pointerDelta.set(this.pointer.x - ndc.x, this.pointer.y - ndc.y);

    this.pointer.x = ndc.x;
    this.pointer.y = ndc.y;

    this.raycaster.setFromCamera(this.pointer, this.camera);

    this.raycaster.ray.intersectPlane(this.castPlane, this.intersectPoint);
  };

  private onMouseDown = (event: MouseEvent) => {
    if (event.button === 0) {
      this.applyForce = true;
    }
  };

  private onMouseUp = (event: MouseEvent) => {
    if (event.button === 0) {
      this.applyForce = false;
      this.soundMap.get("tension")?.pause();
    }
  };

  private onPressSpace = () => {
    this.applyForce = true;
  };

  private onReleaseSpace = () => {
    this.applyForce = false;
    this.soundMap.get("tension")?.pause();
  };

  private onToggleDebugUi = () => {
    this.showDebugUi = !this.showDebugUi;
    this.showDebugUi ? this.showDebugUI() : this.hideDebugUI();
  };

  private showDebugUI() {
    // Background cylinder
    const bgGeom = new THREE.CylinderGeometry(
      0.05,
      0.05,
      0.1,
      16,
      1,
      false,
      -Math.PI / 2,
      -Math.PI
    );
    const bgMat = new THREE.MeshBasicMaterial({
      color: "red",
      side: THREE.DoubleSide,
    });
    const bgCylinder = new THREE.Mesh(bgGeom, bgMat);
    bgCylinder.rotateX(Math.PI / 2);
    bgCylinder.position.z = -0.055;

    // Pick zone cylinder
    const pzGeom = new THREE.CylinderGeometry(
      0.05,
      0.05,
      0.1,
      16,
      1,
      false,
      -Math.PI / 2 - this.currentLock.start,
      -this.currentLock.length // negative because going clockwise
    );
    const pzMat = new THREE.MeshBasicMaterial({
      color: "green",
      side: THREE.DoubleSide,
    });
    const pzCylinder = new THREE.Mesh(pzGeom, pzMat);
    pzCylinder.rotateX(Math.PI / 2);
    pzCylinder.position.z = -0.054;

    this.debugObjects.push(bgCylinder, pzCylinder);
    this.scene.add(bgCylinder, pzCylinder);
  }

  private hideDebugUI() {
    this.debugObjects.forEach((obj) => this.scene.remove(obj));
    this.debugObjects = [];
  }

  private onCanvasResize = () => {
    this.renderer.setSize(window.innerWidth, window.innerHeight, false);

    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    this.camera.aspect = window.innerWidth / window.innerHeight;

    this.camera.updateProjectionMatrix();
  };

  private readonly onPointerLeave = () => {
    this.pointerDelta.set(0, 0);
  };
}
