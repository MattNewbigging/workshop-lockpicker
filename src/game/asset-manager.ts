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

  getLock() {
    const lock = this.models.get("lock") as THREE.Object3D;
    const albedo = this.textures.get("lock-albedo");
    const normal = this.textures.get("lock-normal");
    const orm = this.textures.get("lock-orm");

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

  getPick() {
    const pick = this.models.get("lockpick") as THREE.Object3D;
    const albedo = this.textures.get("lockpick-albedo");
    const normal = this.textures.get("lockpick-normal");
    const orm = this.textures.get("lockpick-orm");

    const pickMaterial = new THREE.MeshPhysicalMaterial({
      map: albedo,
      normalMap: normal,
      aoMap: orm,
      roughnessMap: orm,
      metalnessMap: orm,
      metalness: 1,
    });

    pick.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.material = pickMaterial;
      }
    });

    return pick;
  }

  getScrewdriver() {
    const screwdriver = this.models.get("screwdriver") as THREE.Object3D;
    const albedo = this.textures.get("screw-albedo");
    const normal = this.textures.get("screw-normal");
    const orm = this.textures.get("screw-orm");

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

    return screwdriver;
  }

  load(): Promise<void> {
    const fbxLoader = new FBXLoader(this.loadingManager);
    const textureLoader = new THREE.TextureLoader(this.loadingManager);
    const rgbeLoader = new RGBELoader(this.loadingManager);
    const audioLoader = new THREE.AudioLoader(this.loadingManager);

    this.loadModels(fbxLoader);
    this.loadTextures(textureLoader, rgbeLoader);
    this.loadAudio(audioLoader);

    return new Promise((resolve) => {
      this.loadingManager.onLoad = () => {
        resolve();
      };
    });
  }

  private loadModels(fbxLoader: FBXLoader) {
    const lock = new URL("/models/lock.fbx", import.meta.url).href;
    fbxLoader.load(lock, (group) => {
      group.scale.multiplyScalar(0.01);
      this.models.set("lock", group);
    });

    const lockpick = new URL("/models/lockpick.fbx", import.meta.url).href;
    fbxLoader.load(lockpick, (group) => {
      group.scale.multiplyScalar(0.01);
      this.models.set("lockpick", group);
    });

    const screwdriver = new URL("/models/screwdriver.fbx", import.meta.url)
      .href;
    fbxLoader.load(screwdriver, (group) => {
      this.models.set("screwdriver", group);
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

    const lockAlbedo = new URL(
      "/textures/lock_lp_Material _20_albedo.png",
      import.meta.url
    ).href;
    loader.load(lockAlbedo, (texture) => {
      texture.colorSpace = THREE.SRGBColorSpace;
      this.textures.set("lock-albedo", texture);
    });

    const lockNormal = new URL(
      "/textures/lock_lp_Material _20_normal.png",
      import.meta.url
    ).href;
    loader.load(lockNormal, (texture) => {
      this.textures.set("lock-normal", texture);
    });

    const lockOrm = new URL(
      "/textures/lock_lp_Material _20_ORM.png",
      import.meta.url
    ).href;
    loader.load(lockOrm, (texture) => {
      this.textures.set("lock-orm", texture);
    });

    const screwdriverAlbedo = new URL(
      "/textures/screwdriver_lp_Material _20_albedo.png",
      import.meta.url
    ).href;
    loader.load(screwdriverAlbedo, (texture) => {
      texture.colorSpace = THREE.SRGBColorSpace;
      this.textures.set("screw-albedo", texture);
    });

    const screwdriverNormal = new URL(
      "/textures/screwdriver_lp_Material _20_normal.png",
      import.meta.url
    ).href;
    loader.load(screwdriverNormal, (texture) => {
      this.textures.set("screw-normal", texture);
    });

    const screwdriverOrm = new URL(
      "/textures/screwdriver_lp_Material _20_ORM.png",
      import.meta.url
    ).href;
    loader.load(screwdriverOrm, (texture) => {
      this.textures.set("screw-orm", texture);
    });

    const lockpickAlbedo = new URL(
      "/textures/lockpick_LP_DefaultMaterial_albedo.png",
      import.meta.url
    ).href;
    loader.load(lockpickAlbedo, (texture) => {
      texture.colorSpace = THREE.SRGBColorSpace;
      this.textures.set("lockpick-albedo", texture);
    });

    const lockpickNormal = new URL(
      "/textures/lockpick_LP_DefaultMaterial_normal.png",
      import.meta.url
    ).href;
    loader.load(lockpickNormal, (texture) => {
      this.textures.set("lockpick-normal", texture);
    });

    const lockpickOrm = new URL(
      "/textures/lockpick_LP_DefaultMaterial_ORM.png",
      import.meta.url
    ).href;
    loader.load(lockpickOrm, (texture) => {
      this.textures.set("lockpick-orm", texture);
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

    const tension = new URL(
      "/audio/ui_lockpicking_picktension_01_lpm.wav",
      import.meta.url
    ).href;
    loader.load(tension, (buffer) => this.audioBuffers.set("tension", buffer));

    const pickEnter = new URL(
      "/audio/ui_lockpicking_pickmovement_04.wav",
      import.meta.url
    ).href;
    loader.load(pickEnter, (buffer) =>
      this.audioBuffers.set("pick-enter", buffer)
    );
  }
}
