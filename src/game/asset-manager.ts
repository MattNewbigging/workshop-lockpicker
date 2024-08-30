import * as THREE from "three";
import { FBXLoader } from "three/examples/jsm/loaders/FBXLoader";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader";

export class AssetManager {
  models = new Map();
  textures = new Map();
  animations = new Map();

  private loadingManager = new THREE.LoadingManager();

  applyModelTexture(model: THREE.Object3D, textureName: string) {
    const texture = this.textures.get(textureName);
    if (!texture) {
      return;
    }

    model.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.material.map = texture;
      }
    });
  }

  load(): Promise<void> {
    const gltfLoader = new GLTFLoader(this.loadingManager);

    this.loadModels(gltfLoader);

    return new Promise((resolve) => {
      this.loadingManager.onLoad = () => {
        resolve();
      };
    });
  }

  private loadModels(gltfLoader: GLTFLoader) {
    const lockBody = new URL("/models/lock_body.glb", import.meta.url).href;
    gltfLoader.load(lockBody, (gltf) => {
      this.models.set("lock-body", gltf.scene);
    });

    const lockCylinder = new URL("/models/lock_cylinder.glb", import.meta.url)
      .href;
    gltfLoader.load(lockCylinder, (gltf) => {
      this.models.set("lock-cylinder", gltf.scene);
    });

    const lockpick = new URL("/models/lockpick.glb", import.meta.url).href;
    gltfLoader.load(lockpick, (gltf) => {
      this.models.set("lockpick", gltf.scene);
    });

    const screwdriver = new URL("/models/screwdriver.glb", import.meta.url)
      .href;
    gltfLoader.load(screwdriver, (gltf) => {
      this.models.set("screwdriver", gltf.scene);
    });
  }
}
