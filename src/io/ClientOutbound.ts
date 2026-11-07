import { ClientProt } from '#/io/ClientProt.js';
import Packet from '#/io/Packet.js';
import WordPack from '#/wordfilter/WordPack.js';

/** Port of the corresponding Client-Java 377 p1isaac writer layouts. */
export function writeCameraPosition(out: Packet, pitch: number, yaw: number): void {
    out.p1Enc(ClientProt.EVENT_CAMERA_POSITION);
    out.p2_alt1(pitch);
    out.p2_alt1(yaw);
}

export type PublicChatStyle = {
    message: string;
    colour: number;
    effect: number;
};

/** Parse Client-Java 377 public-chat prefixes and write MESSAGE_PUBLIC. */
export function writePublicChat(out: Packet, input: string): PublicChatStyle {
    let message = input;
    let lower = message.toLowerCase();
    let colour = 0;

    if (lower.startsWith('yellow:')) {
        colour = 0;
        message = message.substring(7);
    } else if (lower.startsWith('red:')) {
        colour = 1;
        message = message.substring(4);
    } else if (lower.startsWith('green:')) {
        colour = 2;
        message = message.substring(6);
    } else if (lower.startsWith('cyan:')) {
        colour = 3;
        message = message.substring(5);
    } else if (lower.startsWith('purple:')) {
        colour = 4;
        message = message.substring(7);
    } else if (lower.startsWith('white:')) {
        colour = 5;
        message = message.substring(6);
    } else if (lower.startsWith('flash1:')) {
        colour = 6;
        message = message.substring(7);
    } else if (lower.startsWith('flash2:')) {
        colour = 7;
        message = message.substring(7);
    } else if (lower.startsWith('flash3:')) {
        colour = 8;
        message = message.substring(7);
    } else if (lower.startsWith('glow1:')) {
        colour = 9;
        message = message.substring(6);
    } else if (lower.startsWith('glow2:')) {
        colour = 10;
        message = message.substring(6);
    } else if (lower.startsWith('glow3:')) {
        colour = 11;
        message = message.substring(6);
    }

    lower = message.toLowerCase();
    let effect = 0;
    if (lower.startsWith('wave:')) {
        effect = 1;
        message = message.substring(5);
    } else if (lower.startsWith('wave2:')) {
        effect = 2;
        message = message.substring(6);
    } else if (lower.startsWith('shake:')) {
        effect = 3;
        message = message.substring(6);
    } else if (lower.startsWith('scroll:')) {
        effect = 4;
        message = message.substring(7);
    } else if (lower.startsWith('slide:')) {
        effect = 5;
        message = message.substring(6);
    }

    out.p1Enc(ClientProt.MESSAGE_PUBLIC);
    out.p1(0);
    const start = out.pos;
    out.p1_alt2(colour);
    out.p1_alt1(effect);
    WordPack.pack(out, message);
    out.psize1(out.pos - start);

    return { message, colour, effect };
}

/** Java signlink.reporterror defaults to true; false sends the sentinel -1. */
export function writeSynthError(out: Packet, waveId: number, reportErrors: boolean = true): void {
    out.p1Enc(ClientProt.EVENT_SYNTH_ERROR);
    out.p2(reportErrors ? waveId & 0x7fff : -1);
}

/** Java handleChatModeInput's periodic CYCLELOGIC6 packet. */
export function writeCycleLogic6(out: Packet): void {
    out.p1Enc(ClientProt.ANTICHEAT_CYCLELOGIC6);
    out.p2(38304);
}

/** Java handleInterfaceAction report-abuse packet. */
export function writeReportAbuse(out: Packet, userhash: bigint, rule: number, mute: boolean): void {
    out.p1Enc(ClientProt.SEND_SNAPSHOT);
    out.p8(userhash);
    out.p1(rule);
    out.p1(mute ? 1 : 0);
}

/** Java handleInputKey's MESSAGE_PRIVATE body and one-byte length. */
export function writePrivateMessage(out: Packet, recipient: bigint, message: string): void {
    out.p1Enc(ClientProt.MESSAGE_PRIVATE);
    out.p1(0);
    const start = out.pos;
    out.p8(recipient);
    WordPack.pack(out, message);
    out.psize1(out.pos - start);
}
