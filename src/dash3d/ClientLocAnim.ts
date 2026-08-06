import { Client } from '#/client/Client.js';

import LocType from '#/config/LocType.js';
import SeqType from '#/config/SeqType.js';
import VarBitType from '#/config/VarBitType.js';

import type Model from '#/dash3d/Model.js';
import ModelSource from '#/dash3d/ModelSource.js';

/**
 * Port of Client-Java 377 `ClientLocAnim` (NRPYRAWK).
 * Multiloc fields are snapshotted at construct time because LocType.list reuses a ring buffer.
 */
export default class ClientLocAnim extends ModelSource {
    readonly index: number;
    readonly shape: number;
    readonly angle: number;
    readonly heightSW: number;
    readonly heightSE: number;
    readonly heightNE: number;
    readonly heightNW: number;
    anim: SeqType | null;
    animFrame: number;
    animCycle: number;

    /** Java field1339 — LocType.field1632 / multivarbit */
    readonly multivarbit: number;
    /** Java field1340 — LocType.field1635 / multivar */
    readonly multivar: number;
    /** Java field1341 — LocType.field1659 / multiloc */
    readonly multiloc: Int32Array | null;

    /**
     * Java `ClientLocAnim.varProvider` — set to live Client after load.
     * Used by method440 multiloc resolve.
     */
    static varProvider: { var: number[] } | null = null;

    constructor(index: number, shape: number, angle: number, heightSW: number, heightSE: number, heightNE: number, heightNW: number, seq: number, randomFrame: boolean) {
        super();

        this.index = index;
        this.shape = shape;
        this.angle = angle;

        this.heightSW = heightSW;
        this.heightSE = heightSE;
        this.heightNE = heightNE;
        this.heightNW = heightNW;

        // Java: if (arg0 != -1) { field1338 = SeqType...; field1343 = loopCycle - 1; }
        // multiloc-only locs pass seq=-1. field1343 starts at loopCycle-1 so first draw advances.
        if (seq !== -1 && SeqType.list[seq]) {
            this.anim = SeqType.list[seq];
            this.animFrame = 0;
            this.animCycle = Client.loopCycle - 1;

            // Java: arg7 && field780 != -1 (loops)
            if (randomFrame && this.anim.loops !== -1) {
                this.animFrame = (Math.random() * this.anim.numFrames) | 0;
                this.animCycle -= (Math.random() * this.anim.getDelay(this.animFrame)) | 0;
            }
        } else {
            this.anim = null;
            this.animFrame = 0;
            this.animCycle = Client.loopCycle - 1;
        }

        // Java ClientLocAnim ctor: snapshot multi fields from LocType.method561(id)
        const base: LocType = LocType.list(this.index);
        this.multivarbit = base.multivarbit;
        this.multivar = base.multivar;
        this.multiloc = base.multiloc;
    }

    /**
     * Port of Client-Java 377 `ClientLocAnim.method440`.
     * Same varbit/varp resolve as LocType.method562, using snapshotted multi fields.
     */
    private getMultiLoc(): LocType | null {
        if (!this.multiloc) {
            return null;
        }

        let state: number = -1;
        const provider = ClientLocAnim.varProvider;

        if (this.multivarbit !== -1) {
            // Java method440: Client.VARBIT_MASKS[end-start]; varProvider.varps[base] >> start & mask
            const varbit: VarBitType = VarBitType.list[this.multivarbit];
            if (provider && varbit) {
                const mask: number = Client.readbit[varbit.endbit - varbit.startbit];
                state = (provider.var[varbit.basevar] >> varbit.startbit) & mask;
            }
        } else if (this.multivar !== -1) {
            if (provider) {
                state = provider.var[this.multivar];
            }
        }

        if (state < 0 || state >= this.multiloc.length || this.multiloc[state] === -1) {
            return null;
        }
        return LocType.list(this.multiloc[state]);
    }

    override getTempModel(): Model | null {
        if (this.anim) {
            let delta = Client.loopCycle - this.animCycle;
            if (delta > 100 && this.anim.loops > 0) {
                delta = 100;
            }

            while (delta > this.anim.getDelay(this.animFrame)) {
                delta -= this.anim.getDelay(this.animFrame);
                this.animFrame++;

                if (this.animFrame < this.anim.numFrames) {
                    continue;
                }

                this.animFrame -= this.anim.loops;

                if (this.animFrame < 0 || this.animFrame >= this.anim.numFrames) {
                    this.anim = null;
                    break;
                }
            }

            this.animCycle = Client.loopCycle - delta;
        }

        let frame = -1;
        if (this.anim && this.anim.frames && typeof this.anim.frames[this.animFrame] !== 'undefined') {
            frame = this.anim.frames[this.animFrame];
        }

        // Java method239: if field1341 == null then list(id) else method440()
        let loc: LocType | null;
        if (this.multiloc === null) {
            loc = LocType.list(this.index);
        } else {
            loc = this.getMultiLoc();
        }
        if (loc === null) {
            return null;
        }
        return loc.getModel(this.shape, this.angle, this.heightSW, this.heightSE, this.heightNE, this.heightNW, frame);
    }
}
