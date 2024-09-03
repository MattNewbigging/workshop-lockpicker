import * as THREE from "three";
import { AssetManager } from "./asset-manager";
import { addGui } from "../utils/utils";
import { KeyboardListener } from "../listeners/keyboard-listener";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";

/**
 * States:
 * - Entry animation; brings screwdriver and lockpick up to the lock (cannot interact while playing)
 * - Gameplay; player tries to pick the lock
 * - Success; lock is picked! Stop receiving input, after brief delay reset by playing entry anim
 */

export enum LockLevel {
  EASY,
  AVERAGE,
  HARD,
}

export interface Lock {
  level: LockLevel;
  start: number;
  length: number;
}

const HALF_PI = Math.PI / 2;

export class GameState {
  private keyboardListener = new KeyboardListener();

  private renderer = new THREE.WebGLRenderer({ antialias: true });
  private clock = new THREE.Clock();
  private scene = new THREE.Scene();

  private camera = new THREE.PerspectiveCamera(35, 1, 0.1, 50);
  private cameraLength = 0.25;
  private cameraTarget = new THREE.Vector3();
  private cameraDir = new THREE.Vector3();

  private soundMap = new Map<string, THREE.Audio>();

  private pointer = new THREE.Vector2();
  private raycaster = new THREE.Raycaster();
  private castPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1));
  private intersectPoint = new THREE.Vector3();

  private currentLock!: Lock;
  private cylinder!: THREE.Object3D;
  private lockpick!: THREE.Object3D;
  private screwdriver!: THREE.Object3D;
  private applyForce = false;

  private showDebugUi = false;
  private debugObjects: THREE.Mesh[] = [];

  // private orbitControls: OrbitControls;

  constructor(private assetManager: AssetManager) {
    this.setupScene();
    this.setupAudio();
    this.setupObjects();

    this.currentLock = this.getRandomLock();
    this.addListeners();

    // this.orbitControls = new OrbitControls(
    //   this.camera,
    //   this.renderer.domElement
    // );
    // this.orbitControls.enableDamping = true;

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
    this.soundMap.set("picking", pickingSound);
  }

  private setupObjects() {
    const lock = this.assetManager.getLock();
    this.cylinder = lock.getObjectByName("lock_cylinder_lp") as THREE.Object3D;
    this.lockpick = this.assetManager.getLockpick();
    this.screwdriver = this.assetManager.getScrewdriver();

    this.lockpick.position.z = -0.03;

    this.screwdriver.rotateY(Math.PI / 3);
    this.screwdriver.rotation.z = -1.5;
    this.screwdriver.position.set(-0.1, -0.6, 1);

    // Make cylinder parent of screwdriver so they rotate together
    this.cylinder.add(this.screwdriver);

    this.scene.add(lock, this.lockpick);
  }

  private playAudio(name: string) {
    const sound = this.soundMap.get(name);
    sound?.stop().play();
  }

  private getRandomLock(): Lock {
    // Same lock level for now
    const level = LockLevel.EASY;
    const maxSize = Math.PI;
    const size = HALF_PI;

    const start = Math.random() * (maxSize - size);
    const length = size;

    return {
      level,
      start,
      length,
    };
  }

  private addListeners() {
    window.addEventListener("mousemove", this.onMouseMove);
    window.addEventListener("mousedown", this.onMouseDown);
    window.addEventListener("mouseup", this.onMouseUp);
    this.keyboardListener.on(" ", this.onPressSpace);
    this.keyboardListener.onRelease(" ", this.onReleaseSpace);
    this.keyboardListener.on("d", this.toggleDebugUi);
  }

  private removeListeners() {
    window.removeEventListener("mousemove", this.onMouseMove);
    window.removeEventListener("mousedown", this.onMouseDown);
    window.removeEventListener("mouseup", this.onMouseUp);
    this.keyboardListener.off(" ", this.onPressSpace);
    this.keyboardListener.offRelease(" ", this.onReleaseSpace);
    this.keyboardListener.off("d", this.toggleDebugUi);
  }

  private update = () => {
    requestAnimationFrame(this.update);

    const dt = this.clock.getDelta();
    const elapsed = this.clock.getElapsedTime();

    //this.orbitControls.update();

    // Cannot move pick while turning lock
    if (!this.applyForce) {
      this.updatePick(dt);
    }

    this.updateLock(dt, elapsed);

    this.updateScrewdriver(dt);

    this.updateCamera();

    this.renderer.render(this.scene, this.camera);
  };

  private updateCamera() {
    const dir = this.cameraDir;

    dir.x = -Math.sin(this.pointer.x);
    dir.y = Math.sin(this.pointer.y);
    dir.multiplyScalar(0.05);

    dir.z = 1.0;
    dir.normalize();

    dir.multiplyScalar(this.cameraLength);

    this.camera.position.copy(dir);
    this.camera.lookAt(this.cameraTarget);
  }

  private updatePick(dt: number) {
    this.lockpick.rotation.z =
      Math.atan2(this.intersectPoint.x, this.intersectPoint.y) * -1;
    this.lockpick.rotation.z = THREE.MathUtils.clamp(
      this.lockpick.rotation.z,
      -HALF_PI,
      HALF_PI
    );
  }

  private updateScrewdriver(dt: number) {
    if (!this.screwdriver) return;

    this.screwdriver.rotation.y = Math.PI / 4 + this.pointer.x * 0.1;
    this.screwdriver.rotation.z = Math.PI / 2 + this.pointer.y * 0.25;
    this.screwdriver.rotation.x = this.pointer.y * -0.1;
  }

  private updateLock(dt: number, elapsed: number) {
    // If not applying any force, return lock to normal position
    if (!this.applyForce) {
      const newRot = this.cylinder.rotation.z + dt * 2;
      this.cylinder.rotation.z = THREE.MathUtils.clamp(newRot, -HALF_PI, 0);

      return;
    }

    // We're applying force, but is the pick in the pick zone?
    // The pick moves left-to-right from halfPi to -halfPi
    const pickRot = this.lockpick.rotation.z;
    const afterStart = pickRot < HALF_PI - this.currentLock.start;
    const beforeEnd =
      pickRot > HALF_PI - this.currentLock.start - this.currentLock.length;

    if (afterStart && beforeEnd) {
      // In the pick zone, turn the lock
      const newRot = this.cylinder.rotation.z - dt * 0.8;
      this.cylinder.rotation.z = THREE.MathUtils.clamp(newRot, -HALF_PI, 0);
    } else {
      // Not in the pick zone, wiggle the lock
      const sin1 = Math.sin(elapsed * 30) * 0.1;
      const sin2 = Math.sin(elapsed * 41) * 0.1;
      const sin3 = Math.sin(elapsed * 27) * 0.1;
      const freq = sin1 + sin2 + sin3;

      this.cylinder.rotation.z += freq * 0.1;

      const sin4 = Math.sin(elapsed * 30 + 3) * 0.1;
      const sin5 = Math.sin(elapsed * 41 + 3) * 0.1;
      const sin6 = Math.sin(elapsed * 27 + 3) * 0.1;
      const freq2 = sin4 + sin5 + sin6;

      this.lockpick.rotation.z += freq2 * 0.1;
    }

    // Have we unlocked it?
    if (this.cylinder.rotation.z === -HALF_PI) {
      this.playAudio("unlock");
      // No longer applying force/listening for that input
      this.applyForce = false;
      this.removeListeners();

      // Reset lock rotation
      this.cylinder.rotation.z = 0;
    }
  }

  private onMouseMove = (event: MouseEvent) => {
    this.pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
    this.pointer.y = -(event.clientY / window.innerHeight) * 2 + 1;

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
    }
  };

  private onPressSpace = () => {
    this.applyForce = true;
  };

  private onReleaseSpace = () => {
    this.applyForce = false;
  };

  private toggleDebugUi = () => {
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
      color: "blue",
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
}
