import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";

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
 */

export class GameState {
  private keyboardListener = new KeyboardListener();

  private renderPipeline: RenderPipeline;
  private clock = new THREE.Clock();

  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera();
  //private controls: OrbitControls;

  private audioListener: THREE.AudioListener;
  private soundMap = new Map<string, THREE.Audio>();
  private pickMoveTimeout = 0;

  private pointer = new THREE.Vector2();
  private raycaster = new THREE.Raycaster();
  private castPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1));
  private intersectPoint = new THREE.Vector3();
  private intersectDebug: THREE.Object3D;

  private lock: THREE.Object3D;
  private cylinder!: THREE.Object3D;
  private pick: THREE.Object3D;

  private applyForce = false;

  constructor(private assetManager: AssetManager) {
    this.setupCamera();

    this.renderPipeline = new RenderPipeline(this.scene, this.camera);

    this.setupLights();
    this.setupObjects();

    // this.controls = new OrbitControls(this.camera, this.renderPipeline.canvas);
    // this.controls.enableDamping = true;
    // this.controls.target.set(0, 0.01, 0);

    const envMap = this.assetManager.textures.get("hdri");
    this.scene.environment = envMap;
    this.scene.background = envMap;

    this.audioListener = new THREE.AudioListener();
    this.camera.add(this.audioListener);
    this.setupAudio();

    // Lock
    this.lock = this.setupLock();
    this.cylinder = this.lock.getObjectByName(
      "lock_cylinder_lp"
    ) as THREE.Object3D;
    console.log(this.cylinder.rotation);
    this.pick = this.setupLockpick();
    this.setupScrewdriver();
    this.scene.add(this.lock, this.pick);

    // Testing
    this.intersectDebug = new THREE.Mesh(
      new THREE.SphereGeometry(0.005),
      new THREE.MeshBasicMaterial({ color: "red" })
    );
    this.scene.add(this.intersectDebug);

    // Listeners
    window.addEventListener("mousemove", this.onMouseMove);
    window.addEventListener("mousedown", this.onMouseDown);
    window.addEventListener("mouseup", this.onMouseUp);
    this.keyboardListener.on(" ", this.onPressSpace);
    this.keyboardListener.onRelease(" ", this.onReleaseSpace);

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
    const ambientLight = new THREE.AmbientLight(undefined, 1);
    this.scene.add(ambientLight);

    const directLight = new THREE.DirectionalLight(undefined, Math.PI);
    directLight.position.copy(new THREE.Vector3(0.75, 1, 0.75).normalize());
    this.scene.add(directLight);
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

  private setupObjects() {
    const axesHelper = new THREE.AxesHelper(10);
    this.scene.add(axesHelper);
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
    const lockpick = this.assetManager.models.get("lockpick");
    lockpick.position.z = 0.004;

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

    // Parent to inner lock
    const inner = this.lock.getObjectByName("lock_cylinder_lp");
    inner?.add(screwdriver);
    //screwdriver.scale.multiplyScalar(100);
    screwdriver.position.set(-0.2, -0.5, 1);
  }

  private update = () => {
    requestAnimationFrame(this.update);

    const dt = this.clock.getDelta();

    //this.controls.update();

    this.updatePick(dt);

    this.updateLock(dt);

    this.renderPipeline.render(dt);
  };

  private updatePick(dt: number) {
    this.intersectDebug.position.copy(this.intersectPoint);

    this.pick.rotation.z =
      Math.atan2(this.intersectPoint.x, this.intersectPoint.y) * -1;
    this.pick.rotation.z = THREE.MathUtils.clamp(
      this.pick.rotation.z,
      -Math.PI / 2,
      Math.PI / 2
    );

    // Update move timers
    this.pickMoveTimeout -= dt;
  }

  private updateLock(dt: number) {
    // Turn lock when applying force
    if (this.applyForce) {
      const newRot = this.cylinder.rotation.z - dt * 0.8;
      this.cylinder.rotation.z = THREE.MathUtils.clamp(newRot, -Math.PI / 2, 0);
    } else {
      // Lock returns to normal position
      const newRot = this.cylinder.rotation.z + dt * 2;
      this.cylinder.rotation.z = THREE.MathUtils.clamp(newRot, -Math.PI / 2, 0);
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
}
