import JagFile from '#/io/JagFile.js';
import Packet from '#/io/Packet.js';

import Model from '#/dash3d/Model.js';
import PixFont from '#/graphics/PixFont.js';

import LruCache from '#/datastruct/LruCache.js';
import JString from '#/datastruct/JString.js';

import Pix32 from '#/graphics/Pix32.js';

import { TypedArray1d } from '#/util/Arrays.js';
import NpcType from '#/config/NpcType.js';
import ObjType from '#/config/ObjType.js';
import type ClientPlayer from '#/dash3d/ClientPlayer.js';
import AnimFrame from '#/dash3d/AnimFrame.js';

/**
 * Component types — 377 Java `jagex2.config.Component.decode` (`EWIXBTLV.a(I,Packet,I)`).
 * Type 8 is 377-era (tooltip / static string); absent in Client-TS 289 base.
 */
export const enum ComponentType {
    TYPE_LAYER = 0,
    /** Archive still emits type-1 (g2 + g1 + shared text/colour fields). */
    TYPE_UNUSED = 1,
    TYPE_INV = 2,
    TYPE_RECT = 3,
    TYPE_TEXT = 4,
    TYPE_GRAPHIC = 5,
    TYPE_MODEL = 6,
    TYPE_INV_TEXT = 7,
    /** Tooltip / static text string — must be read or stream desyncs. */
    TYPE_TEXT_STATIC = 8,
}

export const enum ButtonType {
    BUTTON_OK = 1,
    BUTTON_TARGET = 2,
    BUTTON_CLOSE = 3,
    BUTTON_TOGGLE = 4,
    BUTTON_SELECT = 5,
    BUTTON_CONTINUE = 6,
}

/**
 * Port of 377 Java `jagex2.config.Component` (class EWIXBTLV).
 * Unpack: `Component.unpack` / `Component.decode` / `Component.get` / `Component.unloadCom`.
 *
 * Eager `init` fills `list` once (parity with first-paint needs). Raw archive slices in
 * `rawData` allow `get` to re-decode after `unloadCom` nulls non-INV entries (tab swap).
 */
export default class IfType {
    /** Java `Component.types` — may contain null after unloadCom. */
    static list: (IfType | null)[] = [];
    /**
     * Java `Component.data` — per-id raw bytes: `[layerHi, layerLo, ...decode body]`.
     * Used by `get` to rehydrate after unloadCom.
     */
    static rawData: (Uint8Array | null)[] = [];
    /** Java `Component.fonts` — retained after unpack for re-decode. */
    static fonts: PixFont[] | null = null;
    /** Java `Component.media` — set during unpack, nulled after (sprites live in spriteCache). */
    static media: JagFile | null = null;

    static modelCache: LruCache<Model> = new LruCache(30);
    /** Java `Component.imageCache` — kept after unpack for re-decode sprite hits. */
    static spriteCache: LruCache<Pix32> | null = null;

    /** Java `Component.field728` — clientCode 600 layer (report abuse). */
    static reportAbuseLayer: number = -1;
    /** Java `Component.field737` — clientCode 650 layer. */
    static clientCode650Layer: number = -1;
    /** Java `Component.field759` — clientCode 655 layer. */
    static clientCode655Layer: number = -1;

    // Runtime animation state (not from archive)
    animFrame: number = 0;
    animCycle: number = 0;

    // Header (all types)
    id: number = -1;
    layerId: number = -1;
    type: number = -1;
    buttonType: number = -1;
    clientCode: number = 0;
    width: number = 0;
    height: number = 0;
    /** Java `trans` (byte). */
    trans: number = 0;
    /** Java `overlayer`. */
    overLayerId: number = -1;
    /** Java `field710` — IF_SETPOSITION X offset. */
    x: number = 0;
    /** Java `field741` — IF_SETPOSITION Y offset. */
    y: number = 0;

    // Scripts
    scripts: (Uint16Array | null)[] | null = null;
    scriptComparator: Uint8Array | null = null;
    scriptOperand: Uint16Array | null = null;

    // Type 0 LAYER
    /** Java `scroll`. */
    scrollHeight: number = 0;
    /** Java `field713` — runtime scroll position. */
    scrollPos: number = 0;
    hide: boolean = false;
    children: number[] | null = null;
    childX: number[] | null = null;
    childY: number[] | null = null;

    // Type 1 UNUSED (Java field707 / field715) — stored for fidelity
    type1Word: number = 0;
    type1Flag: boolean = false;

    // Type 2 INV / Type 7 INV_TEXT
    /** Java `invSlotObjId`. */
    linkObjType: Int32Array | null = null;
    /** Java `invSlotObjCount`. */
    linkObjNumber: Int32Array | null = null;
    /** Java `draggable`. */
    objSwap: boolean = false;
    /** Java `interactable`. */
    objOps: boolean = false;
    /** Java `usable`. */
    objUse: boolean = false;
    /** Java `swappable`. */
    objReplace: boolean = false;
    marginX: number = 0;
    marginY: number = 0;
    /** Java `invSlotOffsetX`. */
    invBackgroundX: Int16Array | null = null;
    /** Java `invSlotOffsetY`. */
    invBackgroundY: Int16Array | null = null;
    /** Java `invSlotGraphic`. */
    invBackground: (Pix32 | null)[] | null = null;
    /** Java `iop`. */
    iop: (string | null)[] | null = null;

    // Type 3 RECT
    fill: boolean = false;

    // Type 4 TEXT / Type 1 / Type 7 shared text style
    /** Java `center`. */
    centre: boolean = false;
    font: PixFont | null = null;
    /** Java `shadowed`. */
    shadow: boolean = false;
    /** Java `text`. */
    text: string | null = null;
    /** Java `activeText`. */
    text2: string | null = null;
    colour: number = 0;
    /** Java `activeColour`. */
    colour2: number = 0;
    /** Java `overColour`. */
    colourOver: number = 0;
    /** Java `activeOverColour`. */
    colour2Over: number = 0;

    // Type 5 GRAPHIC
    graphic: Pix32 | null = null;
    /** Java `activeGraphic`. */
    graphic2: Pix32 | null = null;

    // Type 6 MODEL
    /** Java `modelType`. */
    model1Type: number = 0;
    /** Java `model`. */
    model1Id: number = 0;
    /** Java `activeModelType`. */
    model2Type: number = 0;
    /** Java `activeModel`. */
    model2Id: number = 0;
    /** Java `anim`. */
    modelAnim: number = -1;
    /** Java `activeAnim`. */
    modelAnim2: number = -1;
    /** Java `zoom`. */
    modelZoom: number = 0;
    /** Java `xan`. */
    modelXAn: number = 0;
    /** Java `yan`. */
    modelYAn: number = 0;
    /**
     * Java `field700` — packed model spin rates from IF_SETROTATION.
     * High 16 = xan delta per tick, low 16 (signed) = yan delta.
     */
    modelRotate: number = 0;

    // Shared button / target tails
    targetVerb: string | null = null;
    /** Java `targetText`. */
    targetBase: string | null = null;
    targetMask: number = -1;
    /** Java `option`. */
    buttonText: string | null = null;

    /**
     * Java `Component.get(int id)`.
     * Returns cached instance, or re-decodes from `rawData` after unloadCom.
     */
    static get(id: number): IfType | null {
        if (id < 0 || id >= this.list.length) {
            return null;
        }

        const existing = this.list[id];
        if (existing != null) {
            return existing;
        }

        const raw = this.rawData[id];
        if (!raw) {
            return null;
        }

        const buf = new Packet(raw);
        const layer = buf.g2();
        const com = this.decode(layer, buf, id);
        this.list[id] = com;
        return com;
    }

    /**
     * Java `Component.unloadCom(int)`.
     * Nulls every component with layerId == id and type != INV (2).
     * INV keeps runtime slot state across tab swaps; others rehydrate via get().
     */
    static unloadCom(id: number): void {
        if (id === -1) {
            return;
        }

        for (let i = 0; i < this.list.length; i++) {
            const com = this.list[i];
            if (com != null && com.layerId === id && com.type !== ComponentType.TYPE_INV) {
                this.list[i] = null;
            }
        }
    }

    /**
     * Java `Component.unpack(PixFont[], Jagfile interfaces, Jagfile media)`.
     * Eagerly decodes every component and stores raw slices for lazy re-get.
     */
    static init(interfaces: JagFile, media: JagFile | null, fonts: PixFont[]): void {
        this.spriteCache = new LruCache(50000);
        this.media = media;
        this.fonts = fonts;
        this.reportAbuseLayer = -1;
        this.clientCode650Layer = -1;
        this.clientCode655Layer = -1;

        const data: Packet = new Packet(interfaces.read('data'));
        let layer: number = -1;

        const count = data.g2();
        this.list = new Array(count);
        this.rawData = new Array(count);

        // Java: while (buf.pos < buf.data.length) { id = g2; if 65535 layer=g2 id=g2; start; decode; copy raw }
        while (data.pos < data.length) {
            let id: number = data.g2();
            if (id === 65535) {
                layer = data.g2();
                id = data.g2();
            }

            const start: number = data.pos;
            const com: IfType = this.decode(layer, data, id);
            this.list[id] = com;

            // Java: data[id] = [layerHi, layerLo, ...body from start..pos)
            const bodyLen: number = data.pos - start;
            const copy: Uint8Array = new Uint8Array(bodyLen + 2);
            copy[0] = (layer >> 8) & 0xff;
            copy[1] = layer & 0xff;
            copy.set(data.data.subarray(start, data.pos), 2);
            this.rawData[id] = copy;
        }

        // Java nulls media after unpack; imageCache (spriteCache) + fonts retained for get().
        this.media = null;
    }

    /**
     * Java `Component.decode(int layer, Packet buf, int id)`.
     */
    static decode(layer: number, data: Packet, id: number): IfType {
        const com: IfType = new IfType();
        com.id = id;
        com.layerId = layer;

        // --- Component.decode header ---
        com.type = data.g1();
        com.buttonType = data.g1();
        com.clientCode = data.g2();
        com.width = data.g2();
        com.height = data.g2();
        com.trans = data.g1();

        com.overLayerId = data.g1();
        if (com.overLayerId === 0) {
            com.overLayerId = -1;
        } else {
            com.overLayerId = ((com.overLayerId - 1) << 8) + data.g1();
        }

        // clientCode special layers (Java field728 / field737 / field759)
        if (com.clientCode === 600) {
            this.reportAbuseLayer = layer;
        } else if (com.clientCode === 650) {
            this.clientCode650Layer = layer;
        } else if (com.clientCode === 655) {
            this.clientCode655Layer = layer;
        }

        const comparatorCount: number = data.g1();
        if (comparatorCount > 0) {
            com.scriptComparator = new Uint8Array(comparatorCount);
            com.scriptOperand = new Uint16Array(comparatorCount);

            for (let i: number = 0; i < comparatorCount; i++) {
                com.scriptComparator[i] = data.g1();
                com.scriptOperand[i] = data.g2();
            }
        }

        const scriptCount: number = data.g1();
        if (scriptCount > 0) {
            com.scripts = new TypedArray1d(scriptCount, null);

            for (let i: number = 0; i < scriptCount; i++) {
                const opcodeCount: number = data.g2();
                const script: Uint16Array = new Uint16Array(opcodeCount);
                com.scripts[i] = script;
                for (let j: number = 0; j < opcodeCount; j++) {
                    script[j] = data.g2();
                }
            }
        }

        // --- type 0 LAYER ---
        if (com.type === ComponentType.TYPE_LAYER) {
            com.scrollHeight = data.g2();
            com.hide = data.g1() === 1;

            const childCount: number = data.g2();
            com.children = new Array(childCount);
            com.childX = new Array(childCount);
            com.childY = new Array(childCount);

            for (let i: number = 0; i < childCount; i++) {
                com.children[i] = data.g2();
                com.childX[i] = data.g2b();
                com.childY[i] = data.g2b();
            }
        }

        // --- type 1 UNUSED (Java field707 + field715) ---
        if (com.type === ComponentType.TYPE_UNUSED) {
            com.type1Word = data.g2();
            com.type1Flag = data.g1() === 1;
        }

        // --- type 2 INV ---
        if (com.type === ComponentType.TYPE_INV) {
            com.linkObjType = new Int32Array(com.width * com.height);
            com.linkObjNumber = new Int32Array(com.width * com.height);

            com.objSwap = data.g1() === 1; // draggable
            com.objOps = data.g1() === 1; // interactable
            com.objUse = data.g1() === 1; // usable
            com.objReplace = data.g1() === 1; // swappable
            com.marginX = data.g1();
            com.marginY = data.g1();

            com.invBackgroundX = new Int16Array(20);
            com.invBackgroundY = new Int16Array(20);
            com.invBackground = new TypedArray1d(20, null);

            for (let i: number = 0; i < 20; i++) {
                if (data.g1() === 1) {
                    com.invBackgroundX[i] = data.g2b();
                    com.invBackgroundY[i] = data.g2b();

                    const graphic: string = data.gjstr();
                    if (graphic.length > 0) {
                        const spriteIndex: number = graphic.lastIndexOf(',');
                        com.invBackground[i] = this.getSprite(graphic.substring(0, spriteIndex), parseInt(graphic.substring(spriteIndex + 1), 10));
                    }
                }
            }

            com.iop = new TypedArray1d(5, null);
            for (let i: number = 0; i < 5; i++) {
                com.iop[i] = data.gjstr();
                if (com.iop[i]!.length === 0) {
                    com.iop[i] = null;
                }
            }
        }

        // --- type 3 RECT ---
        if (com.type === ComponentType.TYPE_RECT) {
            com.fill = data.g1() === 1;
        }

        // --- type 4 TEXT or type 1: font style ---
        if (com.type === ComponentType.TYPE_TEXT || com.type === ComponentType.TYPE_UNUSED) {
            com.centre = data.g1() === 1;

            const font: number = data.g1();
            if (this.fonts) {
                com.font = this.fonts[font];
            }

            com.shadow = data.g1() === 1;
        }

        // --- type 4 TEXT strings ---
        if (com.type === ComponentType.TYPE_TEXT) {
            com.text = data.gjstr();
            com.text2 = data.gjstr();
        }

        // --- type 1 / 3 / 4 colour ---
        if (com.type === ComponentType.TYPE_UNUSED || com.type === ComponentType.TYPE_RECT || com.type === ComponentType.TYPE_TEXT) {
            com.colour = data.g4();
        }

        // --- type 3 / 4 active + over colours ---
        if (com.type === ComponentType.TYPE_RECT || com.type === ComponentType.TYPE_TEXT) {
            com.colour2 = data.g4();
            com.colourOver = data.g4();
            com.colour2Over = data.g4();
        }

        // --- type 5 GRAPHIC ---
        if (com.type === ComponentType.TYPE_GRAPHIC) {
            const graphic: string = data.gjstr();
            if (graphic.length > 0) {
                const index: number = graphic.lastIndexOf(',');
                com.graphic = this.getSprite(graphic.substring(0, index), parseInt(graphic.substring(index + 1), 10));
            }

            const activeGraphic: string = data.gjstr();
            if (activeGraphic.length > 0) {
                const index: number = activeGraphic.lastIndexOf(',');
                com.graphic2 = this.getSprite(activeGraphic.substring(0, index), parseInt(activeGraphic.substring(index + 1), 10));
            }
        }

        // --- type 6 MODEL ---
        if (com.type === ComponentType.TYPE_MODEL) {
            const model: number = data.g1();
            if (model !== 0) {
                com.model1Type = 1;
                com.model1Id = ((model - 1) << 8) + data.g1();
            }

            const activeModel: number = data.g1();
            if (activeModel !== 0) {
                com.model2Type = 1;
                com.model2Id = ((activeModel - 1) << 8) + data.g1();
            }

            const anim: number = data.g1();
            if (anim === 0) {
                com.modelAnim = -1;
            } else {
                com.modelAnim = ((anim - 1) << 8) + data.g1();
            }

            const activeAnim: number = data.g1();
            if (activeAnim === 0) {
                com.modelAnim2 = -1;
            } else {
                com.modelAnim2 = ((activeAnim - 1) << 8) + data.g1();
            }

            com.modelZoom = data.g2();
            com.modelXAn = data.g2();
            com.modelYAn = data.g2();
        }

        // --- type 7 INV_TEXT ---
        if (com.type === ComponentType.TYPE_INV_TEXT) {
            com.linkObjType = new Int32Array(com.width * com.height);
            com.linkObjNumber = new Int32Array(com.width * com.height);

            com.centre = data.g1() === 1;

            const font: number = data.g1();
            if (this.fonts) {
                com.font = this.fonts[font];
            }

            com.shadow = data.g1() === 1;
            com.colour = data.g4();
            com.marginX = data.g2b();
            com.marginY = data.g2b();
            com.objOps = data.g1() === 1;

            com.iop = new TypedArray1d(5, null);
            for (let i: number = 0; i < 5; i++) {
                com.iop[i] = data.gjstr();
                if (com.iop[i]!.length === 0) {
                    com.iop[i] = null;
                }
            }
        }

        // --- type 8 TEXT_STATIC (tooltip) — 377 only ---
        if (com.type === ComponentType.TYPE_TEXT_STATIC) {
            com.text = data.gjstr();
        }

        // --- buttonType 2 or type 2: target verb/text/mask ---
        if (com.buttonType === ButtonType.BUTTON_TARGET || com.type === ComponentType.TYPE_INV) {
            com.targetVerb = data.gjstr();
            com.targetBase = data.gjstr();
            com.targetMask = data.g2();
        }

        // --- button option defaults ---
        if (
            com.buttonType === ButtonType.BUTTON_OK ||
            com.buttonType === ButtonType.BUTTON_TOGGLE ||
            com.buttonType === ButtonType.BUTTON_SELECT ||
            com.buttonType === ButtonType.BUTTON_CONTINUE
        ) {
            com.buttonText = data.gjstr();

            if (com.buttonText.length === 0) {
                if (com.buttonType === ButtonType.BUTTON_OK) {
                    com.buttonText = 'Ok';
                } else if (com.buttonType === ButtonType.BUTTON_TOGGLE) {
                    com.buttonText = 'Select';
                } else if (com.buttonType === ButtonType.BUTTON_SELECT) {
                    com.buttonText = 'Select';
                } else if (com.buttonType === ButtonType.BUTTON_CONTINUE) {
                    com.buttonText = 'Continue';
                }
            }
        }

        return com;
    }

    /** Java `Component.swapObj`. */
    swapSlots(src: number, dst: number) {
        if (!this.linkObjType || !this.linkObjNumber) {
            return;
        }

        let tmp = this.linkObjType[src];
        this.linkObjType[src] = this.linkObjType[dst];
        this.linkObjType[dst] = tmp;

        tmp = this.linkObjNumber[src];
        this.linkObjNumber[src] = this.linkObjNumber[dst];
        this.linkObjNumber[dst] = tmp;
    }

    /**
     * Java `Component.getModel(primaryTransformId, secondaryTransformId, active)`.
     * (ambient/contrast constants 64/768 applied here; obj ambient/contrast handled in getModel.)
     */
    getTempModel(primaryFrame: number, secondaryFrame: number, active: boolean, localPlayer: ClientPlayer | null): Model | null {
        let model: Model | null = null;
        if (active) {
            model = this.getModel(this.model2Type, this.model2Id, localPlayer);
        } else {
            model = this.getModel(this.model1Type, this.model1Id, localPlayer);
        }

        if (!model) {
            return null;
        }

        if (primaryFrame === -1 && secondaryFrame === -1 && !model.faceColour) {
            return model;
        }

        const tmp: Model = Model.copyForAnim(model, true, AnimFrame.animateTransparencies(primaryFrame) && AnimFrame.animateTransparencies(secondaryFrame), false);
        if (primaryFrame !== -1 || secondaryFrame !== -1) {
            tmp.prepareAnim();
        }

        if (primaryFrame !== -1) {
            tmp.animate(primaryFrame);
        }

        if (secondaryFrame !== -1) {
            tmp.animate(secondaryFrame);
        }

        tmp.calculateNormals(64, 768, -50, -10, -50, true);
        return tmp;
    }

    /** Java `Component.loadModel(type, id)`. */
    private getModel(type: number, id: number, localPlayer: ClientPlayer | null): Model | null {
        let model = IfType.modelCache.find(BigInt((type << 16) + id));
        if (model) {
            return model;
        }

        if (type === 1) {
            model = Model.load(id);
        } else if (type === 2) {
            model = NpcType.list(id).getHead();
        } else if (type === 3) {
            if (localPlayer) {
                model = localPlayer.getHeadModel();
            }
        } else if (type === 4) {
            model = ObjType.list(id).getModelUnlit(50);
        } else if (type === 5) {
            model = null;
        }

        if (model) {
            IfType.modelCache.put(model, BigInt((type << 16) + id));
        }

        return model;
    }

    /** Java `Component.cacheModel`. */
    static cacheModel(model: Model, type: number, id: number) {
        IfType.modelCache.clear();

        if (model && type != 4) {
            IfType.modelCache.put(model, BigInt((type << 16) + id));
        }
    }

    /**
     * Java `Component.getImage` / media sprite load.
     * Uses static media + spriteCache (imageCache). media is null after init; cache hits still work.
     */
    private static getSprite(name: string, spriteIndex: number): Pix32 | null {
        const uid: bigint = (JString.hashCode(name) << 8n) | BigInt(spriteIndex);

        if (this.spriteCache) {
            const image = this.spriteCache.find(uid);
            if (image) {
                return image;
            }
        }

        if (!this.media) {
            return null;
        }

        try {
            const image = Pix32.depack(this.media, name, spriteIndex);
            this.spriteCache?.put(image, uid);
            return image;
        } catch (_e) {
            return null;
        }
    }
}
