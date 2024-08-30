import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";

import { RenderPipeline } from "./render-pipeline";
import { AssetManager } from "./asset-manager";
import { addGui } from "../utils/utils";

export class GameState {
  private renderPipeline: RenderPipeline;
  private clock = new THREE.Clock();

  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera();
  private controls: OrbitControls;

  private pointer = new THREE.Vector2();
  private raycaster = new THREE.Raycaster();
  private castPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1));

  private lock: THREE.Object3D;

  constructor(private assetManager: AssetManager) {
    this.setupCamera();

    this.renderPipeline = new RenderPipeline(this.scene, this.camera);

    this.setupLights();
    this.setupObjects();

    this.controls = new OrbitControls(this.camera, this.renderPipeline.canvas);
    this.controls.enableDamping = true;
    this.controls.target.set(0, 0, 0);

    const envMap = this.assetManager.textures.get("hdri");
    this.scene.environment = envMap;
    this.scene.background = envMap; // new THREE.Color("#1680AF");

    // Lock
    this.lock = this.setupLock();
    this.scene.add(this.lock);

    // Start game
    this.update();
  }

  private setupCamera() {
    this.camera.fov = 35;
    this.camera.far = 500;
    this.camera.near = 0.1;
    this.camera.position.set(0, 0, 0.2);
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

    // const lockBody = this.assetManager.models.get("lock-body");
    // this.scene.add(lockBody);

    // const lockCylinder = this.assetManager.models.get("lock-cylinder");
    // this.scene.add(lockCylinder);

    const lockpick = this.assetManager.models.get("lockpick");
    lockpick.position.z = 0.004;
    this.scene.add(lockpick);

    const screwdriver = this.assetManager.models.get("screwdriver");
    screwdriver.position.set(0, -0.005, 0.015);
    screwdriver.rotateY(Math.PI / 3);
    addGui(screwdriver);
    this.scene.add(screwdriver);
  }

  private setupLock() {
    const { models, textures } = this.assetManager;

    const lock = models.get("lock") as THREE.Object3D;
    const albedo = textures.get("lock-albedo");
    const normal = textures.get("lock-normal");
    const orm = textures.get("lock-orm");
    console.log(albedo);

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

  private update = () => {
    requestAnimationFrame(this.update);

    const dt = this.clock.getDelta();

    this.controls.update();

    this.renderPipeline.render(dt);
  };

  private onMouseMove = (event: MouseEvent) => {
    // Ndc
    this.pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
    this.pointer.y = -(event.clientY / window.innerHeight) * 2 + 1;

    this.raycaster.setFromCamera(this.pointer, this.camera);

    const intersectPoint = this.raycaster.ray.intersectPlane(
      this.castPlane,
      new THREE.Vector3()
    );
  };
}
