import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader";
import { RGBELoader } from "three/examples/jsm/loaders/RGBELoader";
import { FBXLoader } from "three/examples/jsm/loaders/FBXLoader";

export class AssetManager {
  models = new Map();
  textures = new Map();
  animations = new Map();
  audioBuffers = new Map();

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
    const audioLoader = new THREE.AudioLoader(this.loadingManager);

    this.loadModels(gltfLoader, fbxLoader);
    this.loadTextures(textureLoader, rgbeLoader);
    this.loadAudio(audioLoader);

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

  private loadAudio(loader: THREE.AudioLoader) {
    const pickMove = new URL(
      "/audio/ui_lockpicking_pickmovement_03.wav",
      import.meta.url
    ).href;
    loader.load(pickMove, (buffer) =>
      this.audioBuffers.set("pick-move", buffer)
    );

    const jam = new URL(
      "/audio/Antique Lock Mechanism Movement B.wav",
      import.meta.url
    ).href;
    loader.load(jam, (buffer) => {
      this.audioBuffers.set("jam", buffer);
    });

    const unlock = new URL(
      "/audio/Antique Lock Normal Unlock.wav",
      import.meta.url
    ).href;
    loader.load(unlock, (buffer) => this.audioBuffers.set("unlock", buffer));

    const pickBreak = new URL("/audio/Lock Break.wav", import.meta.url).href;
    loader.load(pickBreak, (buffer) =>
      this.audioBuffers.set("pick-break", buffer)
    );

    const picking = new URL("/audio/Lock Picking.wav", import.meta.url).href;
    loader.load(picking, (buffer) => this.audioBuffers.set("picking", buffer));
  }
}
