import { expect, test } from 'bun:test';

import { MiniMenuAction } from '#/client/MiniMenuAction.js';
import Packet from '#/io/Packet.js';
import { ServerProt } from '#/io/ServerProt.js';

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

test('IF_SETTEXT redraws root and child tutorial components', async () => {
    const [{ Client }, { default: IfType }] = await Promise.all([loadClient(), import('#/config/IfType.js')]);
    const previousList = IfType.list;
    const cases = [
        { comId: 100, layerId: 7, tutComId: 100 },
        { comId: 101, layerId: 42, tutComId: 42 }
    ] as const;

    try {
        for (const { comId, layerId, tutComId } of cases) {
            const component = new IfType();
            component.layerId = layerId;
            component.text = 'before';
            IfType.list = [];
            IfType.list[comId] = component;

            const packet = new Packet(new Uint8Array(128));
            packet.p2_alt3(comId);
            packet.pjstr('after');
            const body = packet.data.slice(0, packet.pos);
            let position = 0;
            const client = Object.assign(Object.create(Client.prototype), {
                in: new Packet(new Uint8Array(128)),
                stream: {
                    get available() {
                        return body.length - position;
                    },
                    async readBytes(destination: Uint8Array, offset: number, length: number) {
                        destination.set(body.subarray(position, position + length), offset);
                        position += length;
                    }
                },
                ptype: ServerProt.IF_SETTEXT,
                psize: body.length,
                ptype0: -1,
                ptype1: -1,
                ptype2: -1,
                timeoutTimer: 0,
                chatModalId: -1,
                tutComId,
                sideIcon: [-1],
                activeIcon: 0,
                redrawChat: false,
                redrawSide: false
            }) as {
                readPacket: () => Promise<boolean>;
                redrawChat: boolean;
            };

            expect(await client.readPacket()).toBe(true);
            expect(component.text).toBe('after');
            expect(client.redrawChat).toBe(true);
        }
    } finally {
        IfType.list = previousList;
    }
});
