/**
 * Port of Client-Java `jagex2.dash3d.WorldRegion` (377).
 * Static helpers for REBUILD_REGION / instanced 8×8 chunk placement with rotation.
 * Parameter order matches Java exactly (including deob arg naming quirks).
 */
export default class WorldRegion {
    /**
     * Java `WorldRegion.method461(arg1=angle, arg2=x, arg3=z)`.
     * Map local tile X within an 8×8 after chunk rotation.
     */
    static localX(angle: number, x: number, z: number): number {
        const rot: number = angle & 0x3;
        if (rot === 0) {
            return x;
        } else if (rot === 1) {
            return z;
        } else if (rot === 2) {
            return 7 - x;
        } else {
            return 7 - z;
        }
    }

    /**
     * Java `WorldRegion.method462(arg0=z, arg1=x, arg2=angle)`.
     * Map local tile Z within an 8×8 after chunk rotation.
     */
    static localZ(z: number, x: number, angle: number): number {
        const rot: number = angle & 0x3;
        if (rot === 0) {
            return z;
        } else if (rot === 1) {
            return 7 - x;
        } else if (rot === 2) {
            return 7 - z;
        } else {
            return x;
        }
    }

    /**
     * Java `WorldRegion.method463(arg0, arg1, arg2, arg3, arg5, arg6)`.
     * Loc placement X for multi-tile locs under chunk rotation.
     * Call site (World.method20): method463(rotation, loc.length, locAngle, localX, loc.width, localZ).
     */
    static locX(angle: number, length: number, locAngle: number, x: number, width: number, z: number): number {
        let sizeX: number = width;
        let sizeZ: number = length;
        if ((locAngle & 0x1) === 1) {
            const tmp: number = sizeX;
            sizeX = sizeZ;
            sizeZ = tmp;
        }
        const rot: number = angle & 0x3;
        if (rot === 0) {
            return x;
        } else if (rot === 1) {
            return z;
        } else if (rot === 2) {
            return 7 - x - (sizeX - 1);
        } else {
            return 7 - z - (sizeZ - 1);
        }
    }

    /**
     * Java `WorldRegion.method464(arg0, arg1, arg3, arg4, arg5, arg6)`.
     * Loc placement Z for multi-tile locs under chunk rotation.
     * Call site (World.method20): method464(loc.width, rotation, localX, localZ, loc.length, locAngle).
     */
    static locZ(width: number, angle: number, x: number, z: number, length: number, locAngle: number): number {
        let sizeX: number = width;
        let sizeZ: number = length;
        if ((locAngle & 0x1) === 1) {
            const tmp: number = sizeX;
            sizeX = sizeZ;
            sizeZ = tmp;
        }
        const rot: number = angle & 0x3;
        if (rot === 0) {
            return z;
        } else if (rot === 1) {
            return 7 - x - (sizeX - 1);
        } else if (rot === 2) {
            return 7 - z - (sizeZ - 1);
        } else {
            return x;
        }
    }
}
