import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader";
import { RGBELoader } from "three/examples/jsm/loaders/RGBELoader";
import { FBXLoader } from "three/examples/jsm/loaders/FBXLoader";

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
    const fbxLoader = new FBXLoader(this.loadingManager);
    const textureLoader = new THREE.TextureLoader(this.loadingManager);
    const rgbeLoader = new RGBELoader(this.loadingManager);

    this.loadModels(gltfLoader, fbxLoader);
    this.loadTextures(textureLoader, rgbeLoader);

    return new Promise((resolve) => {
      this.loadingManager.onLoad = () => {
        resolve();
      };
    });
  }

  private loadModels(gltfLoader: GLTFLoader, fbxLoader: FBXLoader) {
    const lock = new URL("/models/lock.fbx", import.meta.url).href;
    fbxLoader.load(lock, (group) => {
      group.scale.multiplyScalar(0.01);
      this.models.set("lock", group);
    });

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

  private loadTextures(loader: THREE.TextureLoader, rgbeLoader: RGBELoader) {
    const hdri = new URL(
      "/textures/industrial_pipe_and_valve_02_1k.hdr",
      import.meta.url
    ).href;
    rgbeLoader.load(hdri, (texture) => {
      texture.mapping = THREE.EquirectangularReflectionMapping;
      this.textures.set("hdri", texture);
    });

    const albedo = new URL(
      "/textures/lock_lp_Material _20_albedo.png",
      import.meta.url
    ).href;
    loader.load(albedo, (texture) => {
      texture.colorSpace = THREE.SRGBColorSpace;
      this.textures.set("lock-albedo", texture);
    });

    const normal = new URL(
      "/textures/lock_lp_Material _20_normal.png",
      import.meta.url
    ).href;
    loader.load(normal, (texture) => {
      this.textures.set("lock-normal", texture);
    });

    const orm = new URL(
      "/textures/lock_lp_Material _20_ORM.png",
      import.meta.url
    ).href;
    loader.load(orm, (texture) => {
      this.textures.set("lock-orm", texture);
    });
  }
}
