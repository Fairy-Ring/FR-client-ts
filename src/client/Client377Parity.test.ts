import { expect, test } from 'bun:test';

import { MiniMenuAction } from '#/client/MiniMenuAction.js';

interface ClientModule {
    Client: { prototype: object };
}

let clientModule: Promise<ClientModule> | null = null;

function loadClient(): Promise<ClientModule> {
    if (!clientModule) {
        const previousDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
        const canvas = {
            getContext: () => ({})
        } as unknown as HTMLCanvasElement;
        Object.defineProperty(globalThis, 'document', {
            configurable: true,
            value: { getElementById: () => canvas } as unknown as Document
        });
        clientModule = import('#/client/Client.js')
            .then(({ Client }) => ({ Client }))
            .finally(() => {
                if (previousDocument) {
                    Object.defineProperty(globalThis, 'document', previousDocument);
                } else {
                    Reflect.deleteProperty(globalThis, 'document');
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

