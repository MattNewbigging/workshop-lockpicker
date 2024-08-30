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

  constructor(private assetManager: AssetManager) {
    this.setupCamera();

    this.renderPipeline = new RenderPipeline(this.scene, this.camera);

    this.setupLights();
    this.setupObjects();

    this.controls = new OrbitControls(this.camera, this.renderPipeline.canvas);
    this.controls.enableDamping = true;
    this.controls.target.set(0, 0, 0);

    this.scene.background = new THREE.Color("#1680AF");

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

    const lockBody = this.assetManager.models.get("lock-body");
    this.scene.add(lockBody);

    const lockCylinder = this.assetManager.models.get("lock-cylinder");
    this.scene.add(lockCylinder);

    const lockpick = this.assetManager.models.get("lockpick");
    lockpick.position.z = 0.004;
    this.scene.add(lockpick);

    const screwdriver = this.assetManager.models.get("screwdriver");
    screwdriver.position.set(0, -0.005, 0.015);
    screwdriver.rotateY(Math.PI / 3);
    addGui(screwdriver);
    this.scene.add(screwdriver);
  }

  private update = () => {
    requestAnimationFrame(this.update);

    const dt = this.clock.getDelta();

    this.controls.update();

    this.renderPipeline.render(dt);
  };
}
