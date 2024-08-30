import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";

import { RenderPipeline } from "./render-pipeline";
import { AssetManager } from "./asset-manager";
import { addGui } from "../utils/utils";

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
  private renderPipeline: RenderPipeline;
  private clock = new THREE.Clock();

  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera();
  private controls: OrbitControls;

  private pointer = new THREE.Vector2();
  private raycaster = new THREE.Raycaster();
  private castPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1));
  private intersectPoint = new THREE.Vector3();
  private intersectDebug: THREE.Object3D;

  private lock: THREE.Object3D;
  private pick: THREE.Object3D;

  constructor(private assetManager: AssetManager) {
    this.setupCamera();

    this.renderPipeline = new RenderPipeline(this.scene, this.camera);

    this.setupLights();
    this.setupObjects();

    this.controls = new OrbitControls(this.camera, this.renderPipeline.canvas);
    this.controls.enableDamping = true;
    this.controls.target.set(0, 0.01, 0);

    const envMap = this.assetManager.textures.get("hdri");
    this.scene.environment = envMap;
    this.scene.background = envMap;

    // Lock
    this.lock = this.setupLock();
    console.log(this.lock);
    this.pick = this.setupLockpick();
    this.setupScrewdriver();
    this.scene.add(this.lock, this.pick);

    this.intersectDebug = new THREE.Mesh(
      new THREE.SphereGeometry(0.005),
      new THREE.MeshBasicMaterial({ color: "red" })
    );
    this.scene.add(this.intersectDebug);

    // Listeners
    window.addEventListener("mousemove", this.onMouseMove);

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
    const screwdriver = this.assetManager.models.get("screwdriver");
    screwdriver.rotateY(Math.PI / 3);
    screwdriver.rotation.z = -0.075;
    this.scene.add(screwdriver);

    // Parent to inner lock
    const inner = this.lock.getObjectByName("lock_cylinder_lp");
    inner?.add(screwdriver);
    screwdriver.scale.multiplyScalar(100);
    screwdriver.position.set(-0.2, -0.5, 1);
  }

  private update = () => {
    requestAnimationFrame(this.update);

    const dt = this.clock.getDelta();

    this.controls.update();

    // Pick follows mouse
    this.intersectDebug.position.copy(this.intersectPoint);

    this.pick.rotation.z =
      Math.atan2(this.intersectPoint.x, this.intersectPoint.y) * -1;
    this.pick.rotation.z = THREE.MathUtils.clamp(
      this.pick.rotation.z,
      -Math.PI / 2,
      Math.PI / 2
    );

    this.renderPipeline.render(dt);
  };

  private onMouseMove = (event: MouseEvent) => {
    // Ndc
    this.pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
    this.pointer.y = -(event.clientY / window.innerHeight) * 2 + 1;

    this.raycaster.setFromCamera(this.pointer, this.camera);

    this.raycaster.ray.intersectPlane(this.castPlane, this.intersectPoint);
  };
}
