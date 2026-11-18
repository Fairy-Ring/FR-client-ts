import { expect, test } from 'bun:test';

import { MiniMenuAction } from '#/client/MiniMenuAction.js';
import type JagFile from '#/io/JagFile.js';

interface ClientModule {
    Client: { new (nodeid: number, lowmem: boolean, members: boolean): object; prototype: object };
}

let clientModule: Promise<ClientModule> | null = null;

function loadClient(): Promise<ClientModule> {
    if (!clientModule) {
        const previousDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
        const previousWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
        const previousStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
        const input = {
            style: { left: '', top: '' },
            setAttribute: () => {},
            addEventListener: () => {},
            focus: () => {},
            click: () => {},
            blur: () => {}
        };
        const image = { src: '', onload: null, naturalWidth: 0, naturalHeight: 0 };
        const canvas = {
            width: 765,
            height: 503,
            getContext: () => ({
                fillRect: () => {},
                createImageData: (width: number, height: number) => ({ data: new Uint8ClampedArray(width * height * 4) })
            }),
            dispatchEvent: () => true,
            addEventListener: () => {},
            removeEventListener: () => {},
            focus: () => {},
            blur: () => {}
        } as unknown as HTMLCanvasElement;
        Object.defineProperty(globalThis, 'document', {
            configurable: true,
            value: {
                getElementById: () => canvas,
                createElement: (tagName: string) => (tagName === 'canvas' ? canvas : tagName === 'input' ? input : image),
                addEventListener: () => {},
                removeEventListener: () => {},
                body: { appendChild: () => {}, removeChild: () => {} },
                hidden: false
            } as unknown as Document
        });
        Object.defineProperty(globalThis, 'window', {
            configurable: true,
            value: { AudioContext: undefined, webkitAudioContext: undefined }
        });
        Object.defineProperty(globalThis, 'localStorage', {
            configurable: true,
            value: { getItem: () => null, setItem: () => {} }
        });
        clientModule = import('#/client/Client.js')
            .then(({ Client }) => ({ Client }))
            .finally(() => {
                if (previousDocument) {
                    Object.defineProperty(globalThis, 'document', previousDocument);
                } else {
                    Reflect.deleteProperty(globalThis, 'document');
                }
                if (previousWindow) {
                    Object.defineProperty(globalThis, 'window', previousWindow);
                } else {
                    Reflect.deleteProperty(globalThis, 'window');
                }
                if (previousStorage) {
                    Object.defineProperty(globalThis, 'localStorage', previousStorage);
                } else {
                    Reflect.deleteProperty(globalThis, 'localStorage');
                }
            });
    }
    return clientModule;
}

test('NPC examine skips an unresolved multi-NPC form', async () => {
    const [{ Client }, { default: NpcType }] = await Promise.all([loadClient(), import('#/config/NpcType.js')]);
    const type = new NpcType();
    type.name = 'Base form';
    type.desc = 'Base form description';
    type.multinpc = new Int32Array([-1]);

    const messages: unknown[][] = [];
    const client = Object.assign(Object.create(Client.prototype), {
        npc: [{ type }],
        menuAction: [MiniMenuAction.OP_NPC6],
        menuParamA: [0],
        menuParamB: [0],
        menuParamC: [0],
        chatbackInputOpen: 0,
        addMessage: (...args: unknown[]) => messages.push(args)
    }) as {
        useMenuOption: (optionId: number) => void;
    };

    client.useMenuOption(0);

    expect(messages).toEqual([]);
});

test('OnDemand model load redraws an open sticky chat interface', async () => {
    const [{ Client }, { default: Model }] = await Promise.all([loadClient(), import('#/dash3d/Model.js')]);
    const unpack = Model.unpack;
    Model.unpack = () => {};

    const requests = [{ archive: 0, file: 0, data: null }];
    const client = Object.assign(Object.create(Client.prototype), {
        onDemand: {
            run: async () => {},
            loop: () => requests.shift() ?? null,
            getModelUse: () => 0x62
        },
        chatModalId: -1,
        tutComId: 123,
        redrawSide: false,
        redrawChat: false
    }) as {
        updateOnDemand: () => Promise<void>;
        redrawSide: boolean;
        redrawChat: boolean;
    };

    try {
        await client.updateOnDemand();
    } finally {
        Model.unpack = unpack;
    }

    expect(client.redrawSide).toBe(true);
    expect(client.redrawChat).toBe(true);
});

/** Packed opcode 106/77 parents use Ernest's varp and three identical child slots. */
function multiConfig(): JagFile {
    const files = new Map<string, Uint8Array>();
    for (const [name, opcode] of [['npc', 106], ['loc', 77]] as const) {
        const parent = [opcode, 255, 255, 0, 32, 2, 0, 1, 0, 1, 0, 1, 0];
        const child = [2, ...new TextEncoder().encode('Concrete form'), 10, 0];
        files.set(`${name}.dat`, new Uint8Array([0, 2, ...parent, ...child]));
        files.set(`${name}.idx`, new Uint8Array([0, 2, 0, parent.length, 0, child.length]));
    }
    return { read: (name: string) => files.get(name) ?? null } as JagFile;
}

test('unreceived varps and VARP_SYNC preserve Java zero defaults for multi NPCs and locs', async () => {
    const [{ Client }, { default: NpcType }, { default: LocType }, { default: ClientLocAnim }, { default: VarpType }, { ServerProt }] =
        await Promise.all([
            loadClient(),
            import('#/config/NpcType.js'),
            import('#/config/LocType.js'),
            import('#/dash3d/ClientLocAnim.js'),
            import('#/config/VarpType.js'),
            import('#/io/ServerProt.js')
        ]);
    const previousWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
    const previousNpc = { ...NpcType };
    const previousLoc = { ...LocType };
    const previousAnimProvider = ClientLocAnim.varProvider;
    const previousVarps = VarpType.list;
    try {
        Object.defineProperty(globalThis, 'window', { configurable: true, value: { location: { search: '' } } });
        // The existing constructor's missing-arguments branch creates fields without starting the game loop.
        const client = Reflect.construct(Client, [undefined, undefined, undefined]) as {
            var: Int32Array;
            varServ: Int32Array;
            ptype: number;
            psize: number;
            stream: { available: number; readBytes: () => Promise<void> };
            readPacket: () => Promise<boolean>;
        };
        expect(client.var).toBeInstanceOf(Int32Array);
        expect(client.varServ).toBeInstanceOf(Int32Array);
        expect(client.var.length).toBe(2000);
        expect(client.varServ.length).toBe(2000);
        expect(client.var.every(value => value === 0)).toBe(true);
        expect(client.varServ.every(value => value === 0)).toBe(true);
        expect(client.var).not.toBe(client.varServ);

        const config = multiConfig();
        NpcType.init(config);
        LocType.init(config);
        NpcType.varProvider = client;
        LocType.varProvider = client;
        ClientLocAnim.varProvider = client;
        const npc = NpcType.list(0);
        const loc = LocType.list(0);
        const animatedLoc = new ClientLocAnim(0, 10, 0, 0, 0, 0, 0, -1, false) as unknown as {
            getMultiLoc: () => InstanceType<typeof LocType> | null;
        };
        expect(npc.getMultiNpc()?.id).toBe(1);
        expect(loc.getMultiLoc()?.id).toBe(1);
        expect(animatedLoc.getMultiLoc()?.id).toBe(1);
        for (const state of [0, 1, 2, 3, -1]) {
            client.var[32] = state;
            const child = state >= 0 && state < 3 ? 1 : undefined;
            expect(npc.getMultiNpc()?.id).toBe(child);
            expect(npc.isMultiActive()).toBe(child !== undefined);
            expect(loc.getMultiLoc()?.id).toBe(child);
            expect(animatedLoc.getMultiLoc()?.id).toBe(child);
            if (child === undefined) {
                expect(npc.getTempModel(-1, -1, null)).toBeNull();
                expect(npc.getHead()).toBeNull();
            }
        }

        client.var[32] = 3;
        VarpType.list = [];
        VarpType.list[32] = new VarpType();
        client.ptype = ServerProt.VARP_SYNC;
        client.psize = 0;
        client.stream = { available: 1, readBytes: async () => {} };
        expect(await client.readPacket()).toBe(true);
        expect(client.var[32]).toBe(0);
        expect(npc.getMultiNpc()?.id).toBe(1);
        expect(loc.getMultiLoc()?.id).toBe(1);
        expect(animatedLoc.getMultiLoc()?.id).toBe(1);
    } finally {
        if (previousWindow) {
            Object.defineProperty(globalThis, 'window', previousWindow);
        } else {
            Reflect.deleteProperty(globalThis, 'window');
        }
        Object.assign(NpcType, previousNpc);
        Object.assign(LocType, previousLoc);
        ClientLocAnim.varProvider = previousAnimProvider;
        VarpType.list = previousVarps;
    }
});

test('NPC and loc lookups reject invalid indices without changing their decode caches', async () => {
    await loadClient();
    const [{ default: NpcType }, { default: LocType }] = await Promise.all([import('#/config/NpcType.js'), import('#/config/LocType.js')]);
    const previousNpc = { ...NpcType };
    const previousLoc = { ...LocType };
    try {
        const config = multiConfig();
        NpcType.init(config);
        LocType.init(config);
        for (const type of [NpcType, LocType]) {
            const recent = type.recent!.slice();
            const recentPos = type.recentPos;
            const pos = type.dat!.pos;
            for (const id of [undefined, NaN, Infinity, -1, 0.5, type.numDefinitions, 65535]) {
                expect(() => type.list(id as number)).toThrow(RangeError);
                expect(type.recent).toEqual(recent);
                expect(type.recentPos).toBe(recentPos);
                expect(type.dat!.pos).toBe(pos);
            }
            expect(type.list(0).id).toBe(0);
            expect(type.list(type.numDefinitions - 1).id).toBe(type.numDefinitions - 1);
        }
    } finally {
        Object.assign(NpcType, previousNpc);
        Object.assign(LocType, previousLoc);
    }
});

/** Synthetic definitions exercise the real config decoder and varp selector. */
function examineConfig(): JagFile {
    const files = new Map<string, Uint8Array>();
    const text = (opcode: number, value: string) => [opcode, ...new TextEncoder().encode(value), 10];
    for (const [name, opcode] of [
        ['npc', 106],
        ['loc', 77]
    ] as const) {
        const definitions = [
            [...text(2, 'null'), opcode, 255, 255, 0, 32, 1, 0, 1, 0, 2, 0],
            [...text(2, 'Dormant form'), ...text(3, 'The dormant form.'), ...text(30, 'Inspect'), 0],
            [...text(2, 'Grown form'), ...text(3, 'The grown form.'), ...text(30, 'Inspect'), 0],
            [...text(2, 'Single form'), ...text(3, 'The single form.'), ...text(30, 'Inspect'), 0]
        ];
        files.set(`${name}.dat`, new Uint8Array([0, definitions.length, ...definitions.flat()]));
        files.set(`${name}.idx`, new Uint8Array([0, definitions.length, ...definitions.flatMap(bytes => [bytes.length >> 8, bytes.length & 255])]));
    }
    return { read: (name: string) => files.get(name) ?? null } as JagFile;
}

test('loc Examine stores the resolved definition, while operations keep the scene typecode', async () => {
    const [{ Client }, { default: LocType }, { default: Model }] = await Promise.all([loadClient(), import('#/config/LocType.js'), import('#/dash3d/Model.js')]);
    const previousLoc = { ...LocType };
    const previousPicked = { count: Model.pickedCount, typecodes: Model.pickedEntityTypecode };
    const messages: unknown[][] = [];
    const client = Object.assign(Object.create(Client.prototype), {
        var: new Int32Array(2000),
        useMode: 0,
        targetMode: 0,
        menuNumEntries: 0,
        menuOption: [],
        menuAction: [],
        menuParamA: [],
        menuParamB: [],
        menuParamC: [],
        chatbackInputOpen: 0,
        world: { typeCode2: () => 0 },
        addMessage: (...args: unknown[]) => messages.push(args)
    }) as {
        var: Int32Array;
        menuNumEntries: number;
        menuOption: string[];
        menuAction: number[];
        menuParamA: number[];
        menuParamB: number[];
        menuParamC: number[];
        handleViewportOptions: () => void;
        useMenuOption: (optionId: number) => void;
    };
    try {
        LocType.init(examineConfig());
        LocType.varProvider = client;
        for (const [baseId, state, resolvedId, name, description] of [
            [0, 0, 1, 'Dormant form', 'The dormant form.'],
            [0, 1, 2, 'Grown form', 'The grown form.'],
            [3, 1, 3, 'Single form', 'The single form.']
        ] as const) {
            const typecode = (2 << 29) | (baseId << 14) | (24 << 7) | 17;
            Model.pickedCount = 1;
            Model.pickedEntityTypecode = new Int32Array([typecode]);
            client.var[32] = state;
            client.menuNumEntries = 0;
            client.handleViewportOptions();
            const entries = client.menuAction.slice(0, client.menuNumEntries);
            const examine = entries.indexOf(MiniMenuAction.OP_LOC6);
            const operation = entries.indexOf(MiniMenuAction.OP_LOC1);
            expect(examine).toBeGreaterThanOrEqual(0);
            expect(operation).toBeGreaterThanOrEqual(0);
            expect(client.menuOption[examine]).toBe(`Examine @cya@${name}`);
            expect(client.menuParamA[operation]).toBe(typecode);
            expect(client.menuParamA[examine]).toBe(resolvedId << 14);
            expect(client.menuParamB[examine]).toBe(17);
            expect(client.menuParamC[examine]).toBe(24);
            // Java loc Examine retains the menu-time definition even if its varp changes.
            client.var[32] = 1 - state;
            messages.length = 0;
            client.useMenuOption(examine);
            expect(messages).toEqual([['', description, 0]]);
        }
    } finally {
        Object.assign(LocType, previousLoc);
        Model.pickedCount = previousPicked.count;
        Model.pickedEntityTypecode = previousPicked.typecodes;
    }
});

test('NPC Examine stores the instance index and resolves its form again when selected', async () => {
    const [{ Client }, { default: NpcType }] = await Promise.all([loadClient(), import('#/config/NpcType.js')]);
    const previousNpc = { ...NpcType };
    const messages: unknown[][] = [];
    const client = Object.assign(Object.create(Client.prototype), {
        var: new Int32Array(2000),
        npc: [],
        useMode: 0,
        targetMode: 0,
        menuNumEntries: 0,
        menuOption: [],
        menuAction: [],
        menuParamA: [],
        menuParamB: [],
        menuParamC: [],
        chatbackInputOpen: 0,
        addMessage: (...args: unknown[]) => messages.push(args)
    }) as {
        var: Int32Array;
        npc: { type: InstanceType<typeof NpcType> }[];
        menuNumEntries: number;
        menuOption: string[];
        menuAction: number[];
        menuParamA: number[];
        addNpcOptions: (type: InstanceType<typeof NpcType>, index: number, x: number, z: number) => void;
        useMenuOption: (optionId: number) => void;
    };
    try {
        NpcType.init(examineConfig());
        NpcType.varProvider = client;
        const type = NpcType.list(0);
        client.npc[7] = { type };
        client.var[32] = 0;
        client.addNpcOptions(type, 7, 17, 24);
        const examine = client.menuAction.slice(0, client.menuNumEntries).indexOf(MiniMenuAction.OP_NPC6);
        expect(examine).toBeGreaterThanOrEqual(0);
        expect(client.menuOption[examine]).toBe('Examine @yel@Dormant form');
        expect(client.menuParamA[examine]).toBe(7);
        for (const [state, expected] of [
            [0, 'The dormant form.'],
            [1, 'The grown form.'],
            [2, null]
        ] as const) {
            client.var[32] = state;
            messages.length = 0;
            client.useMenuOption(examine);
            expect(messages).toEqual(expected === null ? [] : [['', expected, 0]]);
        }
    } finally {
        Object.assign(NpcType, previousNpc);
    }
});
