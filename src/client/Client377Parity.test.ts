import { expect, test } from 'bun:test';

import { MiniMenuAction } from '#/client/MiniMenuAction.js';

interface ClientModule {
    Client: { prototype: object };
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
            getContext: () => ({}),
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
