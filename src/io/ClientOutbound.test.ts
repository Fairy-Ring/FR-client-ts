import { expect, test } from 'bun:test';

import { ClientCode } from '#/client/ClientCode.js';
import Packet from '#/io/Packet.js';
import {
    writeCameraPosition,
    writeCycleLogic6,
    writePrivateMessage,
    writePublicChat,
    writeReportAbuse,
    writeSynthError
} from '#/io/ClientOutbound.js';

function createPacket(): Packet {
    return new Packet(new Uint8Array(128));
}

function bytes(packet: Packet): number[] {
    return Array.from(packet.data.subarray(0, packet.pos));
}

test('public chat matches Java style prefixes, transforms, and body length', () => {
    const packet = createPacket();
    expect(writePublicChat(packet, 'RED:SHAKE:Hi')).toEqual({ message: 'Hi', colour: 1, effect: 3 });
    expect(bytes(packet)).toEqual([49, 3, 255, 131, 0x65]);
});

test('public chat retains Java wave2, scroll, and slide effect codes', () => {
    const wave2 = createPacket();
    expect(writePublicChat(wave2, 'wave2:y')).toEqual({ message: 'y', colour: 0, effect: 2 });
    expect(bytes(wave2)).toEqual([49, 3, 0, 130, 211]);
    const wave = createPacket();
    expect(writePublicChat(wave, 'wave:y')).toEqual({ message: 'y', colour: 0, effect: 1 });
    expect(bytes(wave)).toEqual([49, 3, 0, 129, 211]);

    const scroll = createPacket();
    expect(writePublicChat(scroll, 'scroll:x')).toEqual({ message: 'x', colour: 0, effect: 4 });
    expect(bytes(scroll)).toEqual([49, 3, 0, 132, 218]);

    const slide = createPacket();
    expect(writePublicChat(slide, 'white:slide:x')).toEqual({ message: 'x', colour: 5, effect: 5 });
    expect(bytes(slide)).toEqual([49, 3, 251, 133, 218]);
    const onePrefix = createPacket();
    expect(writePublicChat(onePrefix, 'red:green:wave:Hi')).toEqual({
        message: 'green:wave:Hi',
        colour: 1,
        effect: 0
    });
});

test('camera position uses Java little-endian p2_alt1 fields', () => {
    const packet = createPacket();
    writeCameraPosition(packet, 0x1234, 0x5678);
    expect(bytes(packet)).toEqual([140, 0x34, 0x12, 0x78, 0x56]);
});

test('cyclelogic6 emits Java opcode and constant payload', () => {
    const packet = createPacket();
    writeCycleLogic6(packet);
    expect(bytes(packet)).toEqual([22, 0x95, 0xa0]);
});

test('synth errors preserve Java reporterror id and sentinel variants', () => {
    const reported = createPacket();
    writeSynthError(reported, 0x9234);
    expect(bytes(reported)).toEqual([80, 0x12, 0x34]);

    const suppressed = createPacket();
    writeSynthError(suppressed, 0x1234, false);
    expect(bytes(suppressed)).toEqual([80, 0xff, 0xff]);
});

test('report abuse includes the thirteenth Java rule and exact fields', () => {
    expect(ClientCode.CC_REPORT_RULE13).toBe(613);
    expect(ClientCode.CC_MOD_MUTE).toBe(620);

    const packet = createPacket();
    writeReportAbuse(packet, 0x0102030405060708n, ClientCode.CC_REPORT_RULE13 - ClientCode.CC_REPORT_RULE1, true);
    expect(bytes(packet)).toEqual([184, 1, 2, 3, 4, 5, 6, 7, 8, 12, 1]);
});

test('private messages match Java fields even for a zero recipient hash', () => {
    const packet = createPacket();
    writePrivateMessage(packet, 0n, 'y');
    expect(bytes(packet)).toEqual([227, 9, 0, 0, 0, 0, 0, 0, 0, 0, 211]);
});
