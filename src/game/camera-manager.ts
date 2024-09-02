import * as THREE from "three";

export class CameraManager {
  constructor(
    private readonly camera: THREE.Camera,
    private readonly targetPosition: THREE.Vector3,
    private readonly length: number = 1
  ) {}

  update(dt: number, pointer: THREE.Vector2) {
    const dir = new THREE.Vector3();

    dir.x = -Math.sin(pointer.x);
    dir.y = -Math.sin(pointer.y);
    dir.multiplyScalar(0.1);

    dir.z = 1.0;
    dir.normalize();

    dir.multiplyScalar(this.length);

    this.camera.position.copy(dir);
    this.camera.lookAt(this.targetPosition);
  }
}
