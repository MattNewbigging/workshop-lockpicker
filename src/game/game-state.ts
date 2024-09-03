import * as THREE from "three";
import { RenderPipeline } from "./render-pipeline";
import { AssetManager } from "./asset-manager";
import { addGui } from "../utils/utils";
import { KeyboardListener } from "../listeners/keyboard-listener";

/**
 * - entry animation; brings up the pick and screwdriver
 * - pick movement
 * - apply force:
 * -- both screwdriver and pick wiggle but don't turn
 * --- if you do this too much, pick breaks
 * ---- new pick entry anim
 * -- scredriver and lock inner turns while pick remains still
 *    (parent driver to inner lock, just rotate inner lock)
 *
 *
 * Lockpicking logic:
 *
 * - need determine the size of the pick zone; hardcode sizes
 * - do on scale of 0 to PI, subtract PI later when clamping rotation
 * - left side = random number between 0 and PI subtract pick zone size
 * - right side = left side + size
 * - just checking if pick is > left side && < right side
 *
 * - debug:
 * - use cylinder geometries!
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

  private renderPipeline: RenderPipeline;
  private clock = new THREE.Clock();

  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera();
  private cameraLength = 0.25;
  private cameraTarget = new THREE.Vector3();
  private cameraDir = new THREE.Vector3();

  private audioListener: THREE.AudioListener;
  private soundMap = new Map<string, THREE.Audio>();
  private pickMoveTimeout = 0;

  private pointer = new THREE.Vector2();
  private raycaster = new THREE.Raycaster();
  private castPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1));
  private intersectPoint = new THREE.Vector3();

  private lock: THREE.Object3D;
  private cylinder!: THREE.Object3D;
  private pick: THREE.Object3D;
  private screwdriver?: THREE.Object3D;
  private applyForce = false;

  private currentLock: Lock;

  private showDebugUi = false;
  private debugObjects: THREE.Mesh[] = [];

  constructor(private assetManager: AssetManager) {
    this.setupCamera();
    this.renderPipeline = new RenderPipeline(this.scene, this.camera);
    this.setupLights();
    this.setupEnvMap();

    this.audioListener = new THREE.AudioListener();
    this.camera.add(this.audioListener);
    this.setupAudio();

    // Lock
    this.lock = this.setupLock();
    this.cylinder = this.lock.getObjectByName(
      "lock_cylinder_lp"
    ) as THREE.Object3D;
    this.pick = this.setupLockpick();
    this.setupScrewdriver();
    this.scene.add(this.lock, this.pick);

    this.currentLock = this.getNextLock();

    // Start the entry animation

    // Start game
    this.update();
  }

  private setupCamera() {
    this.camera.fov = 35;
    this.camera.far = 500;
    this.camera.near = 0.1;
    this.camera.position.set(0, 0.01, 0.2);
  }

  private setupLights() {
    // Fill light
    const pointLight = new THREE.PointLight(0xffffff, 0.75);
    pointLight.position.set(0.25, 0.25, 0.25);
    // this.scene.add(pointLight);
  }

  private setupEnvMap() {
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

    const pickMoveSound = new THREE.Audio(this.audioListener);
    pickMoveSound.setBuffer(buffers.get("pick-move"));
    this.soundMap.set("pick-move", pickMoveSound);

    const jamSound = new THREE.Audio(this.audioListener);
    jamSound.setBuffer(buffers.get("jam"));
    this.soundMap.set("jam", jamSound);

    const unlockSound = new THREE.Audio(this.audioListener);
    unlockSound.setBuffer(buffers.get("unlock"));
    this.soundMap.set("unlock", unlockSound);

    const pickBreakSound = new THREE.Audio(this.audioListener);
    pickBreakSound.setBuffer(buffers.get("pick-break"));
    this.soundMap.set("pick-break", pickBreakSound);

    const pickingSound = new THREE.Audio(this.audioListener);
    pickingSound.setBuffer(buffers.get("picking"));
    this.soundMap.set("picking", pickingSound);
  }

  private playAudio(name: string) {
    const sound = this.soundMap.get(name);
    sound?.stop().play();
  }

  private setupLock() {
    const { models, textures } = this.assetManager;

    const lock = models.get("lock") as THREE.Object3D;
    const albedo = textures.get("lock-albedo");
    const normal = textures.get("lock-normal");
    const orm = textures.get("lock-orm");

    const lockMaterial = new THREE.MeshPhysicalMaterial({
      map: albedo,
      normalMap: normal,
      aoMap: orm,
      roughnessMap: orm,
      metalnessMap: orm,
      metalness: 1,
    });

    lock.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.material = lockMaterial;
      }
    });

    return lock;
  }

  private setupLockpick() {
    const { models, textures } = this.assetManager;

    const lockpick = models.get("lockpick") as THREE.Object3D;
    const albedo = textures.get("lockpick-albedo");
    const normal = textures.get("lockpick-normal");
    const orm = textures.get("lockpick-orm");

    const lockpickMaterial = new THREE.MeshPhysicalMaterial({
      map: albedo,
      normalMap: normal,
      aoMap: orm,
      roughnessMap: orm,
      metalnessMap: orm,
      metalness: 1,
    });

    lockpick.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.material = lockpickMaterial;
      }
    });

    lockpick.position.z = -0.02;

    return lockpick;
  }

  private setupScrewdriver() {
    const { models, textures } = this.assetManager;

    const screwdriver = models.get("screwdriver") as THREE.Object3D;
    const albedo = textures.get("screw-albedo");
    const normal = textures.get("screw-normal");
    const orm = textures.get("screw-orm");

    const screwMaterial = new THREE.MeshPhysicalMaterial({
      map: albedo,
      normalMap: normal,
      aoMap: orm,
      roughnessMap: orm,
      metalnessMap: orm,
      metalness: 1,
    });

    screwdriver.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.material = screwMaterial;
      }
    });

    screwdriver.rotateY(Math.PI / 3);
    screwdriver.rotation.z = -1.5;
    this.scene.add(screwdriver);

    this.screwdriver = screwdriver;

    // Parent to inner lock
    const inner = this.lock.getObjectByName("lock_cylinder_lp");
    inner?.add(screwdriver);
    screwdriver.position.set(-0.2, -0.5, 1);
  }

  private getNextLock(): Lock {
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

    this.updatePick(dt);

    this.updateLock(dt);

    this.updateScrewdriver(dt);

    //this.updateCamera();

    this.renderPipeline.render(dt);
  };

  private updateCamera() {
    const dir = this.cameraDir;

    dir.x = -Math.sin(this.pointer.x);
    dir.y = -Math.sin(this.pointer.y);
    dir.multiplyScalar(0.1);

    dir.z = 1.0;
    dir.normalize();

    dir.multiplyScalar(this.cameraLength);

    this.camera.position.copy(dir);
    this.camera.lookAt(this.cameraTarget);
  }

  private updatePick(dt: number) {
    this.pick.rotation.z =
      Math.atan2(this.intersectPoint.x, this.intersectPoint.y) * -1;
    this.pick.rotation.z = THREE.MathUtils.clamp(
      this.pick.rotation.z,
      -HALF_PI,
      HALF_PI
    );

    // Update move timers
    this.pickMoveTimeout -= dt;
  }

  private updateScrewdriver(dt: number) {
    if (!this.screwdriver) return;

    this.screwdriver.rotation.y = Math.PI / 4 + this.pointer.x * 0.1;
    this.screwdriver.rotation.z = Math.PI / 2 + this.pointer.y * 0.25;
    this.screwdriver.rotation.x = this.pointer.y * -0.1;
  }

  private updateLock(dt: number) {
    // If not applying any force, return lock to normal position
    if (!this.applyForce) {
      const newRot = this.cylinder.rotation.z + dt * 2;
      this.cylinder.rotation.z = THREE.MathUtils.clamp(newRot, -HALF_PI, 0);

      return;
    }

    // We're applying force, but is the pick in the pick zone?
    // The pick moves left-to-right from halfPi to -halfPi
    const pickRot = this.pick.rotation.z;
    const afterStart = pickRot < HALF_PI - this.currentLock.start;
    const beforeEnd =
      pickRot > HALF_PI - this.currentLock.start - this.currentLock.length;

    if (afterStart && beforeEnd) {
      // In the pick zone, turn the lock
      const newRot = this.cylinder.rotation.z - dt * 0.8;
      this.cylinder.rotation.z = THREE.MathUtils.clamp(newRot, -HALF_PI, 0);
    } else {
      // Not in the pick zone, wiggle the lock
    }

    // Have we unlocked it?
    if (this.cylinder.rotation.z === -HALF_PI) {
      this.playAudio("unlock");
      // No longer applying force/listening for that input
      // Play the entry animation
    }
  }

  private onMouseMove = (event: MouseEvent) => {
    this.pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
    this.pointer.y = -(event.clientY / window.innerHeight) * 2 + 1;

    this.raycaster.setFromCamera(this.pointer, this.camera);

    this.raycaster.ray.intersectPlane(this.castPlane, this.intersectPoint);

    if (this.pickMoveTimeout <= 0) {
      this.pickMoveTimeout = 5;
      this.playAudio("pick-move");
    }
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
    bgCylinder.position.z = -0.051;

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
    pzCylinder.position.z = -0.049;

    this.debugObjects.push(bgCylinder, pzCylinder);
    this.scene.add(bgCylinder, pzCylinder);
  }

  private hideDebugUI() {
    this.debugObjects.forEach((obj) => this.scene.remove(obj));
    this.debugObjects = [];
  }
}
