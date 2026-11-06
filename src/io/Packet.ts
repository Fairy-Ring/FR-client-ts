/**
 * Packet buffer — oracle: Client-Java 377 `jagex2.io.Packet` (MFMVIYHT).
 * Alt encodings (gN_alt / pN_alt) are 377-only vs 289; bodies match origin/377 Packet.java.
 *
 * Naming notes:
 * - TS keeps 289-style `gsmart` (unsigned) / `gsmarts` (signed). Java 377 deob swaps those names;
 *   callers must use the TS names (see ClientBuild / Model / Tone comments).
 * - `p1Enc` == Java `p1isaac`; `gBitStart`/`gBitEnd` == `accessBits`/`accessBytes`.
 * - Superset helpers (g3_alt1/2, g4s_*, gdata_alt3, g2s_alt3) are not in Java 377;
 *   keep for engine-compat only — prefer Java-named methods for 377 ports.
 */
import Linkable2 from '#/datastruct/Linkable2.js';
import LinkList from '#/datastruct/LinkList.js';

import Isaac from '#/io/Isaac.js';

import { bigIntModPow, bigIntToBytes, bytesToBigInt } from '#/util/JsUtil.js';

export default class Packet extends Linkable2 {
    private static readonly CRC32_POLYNOMIAL: number = 0xedb88320;

    private static readonly crctable: Int32Array = new Int32Array(256);
    /** Java `field1283` / bitmask — includes terminal -1 (all bits). */
    private static readonly bitmask: Uint32Array = new Uint32Array(33);

    private static readonly cacheMin: LinkList<Packet> = new LinkList();
    private static readonly cacheMid: LinkList<Packet> = new LinkList();
    private static readonly cacheMax: LinkList<Packet> = new LinkList();

    private static cacheMinCount: number = 0;
    private static cacheMidCount: number = 0;
    private static cacheMaxCount: number = 0;

    static {
        // Java Packet.field1283 (bitmask) — last entry -1 ≡ all bits set
        const bits = [
            0, 1, 3, 7, 15, 31, 63, 127, 255, 511, 1023, 2047, 4095, 8191, 16383, 32767, 65535, 131071, 262143,
            524287, 1048575, 2097151, 4194303, 8388607, 16777215, 33554431, 67108863, 134217727, 268435455,
            536870911, 1073741823, 0x7fffffff, 0xffffffff
        ];
        for (let i = 0; i < 33; i++) {
            Packet.bitmask[i] = bits[i] >>> 0;
        }

        // Java CRC table: (var1 & 0x1) == 1 then >>>1 ^ poly (same as 289/377)
        for (let i: number = 0; i < 256; i++) {
            let remainder: number = i;

            for (let bit: number = 0; bit < 8; bit++) {
                if ((remainder & 1) === 1) {
                    remainder = (remainder >>> 1) ^ Packet.CRC32_POLYNOMIAL;
                } else {
                    remainder >>>= 1;
                }
            }

            Packet.crctable[i] = remainder;
        }
    }

    static getcrc(src: Uint8Array, offset: number, length: number): number {
        let crc = 0xffffffff;
        for (let i = offset; i < length; i++) {
            crc = (crc >>> 8) ^ this.crctable[(crc ^ src[i]) & 0xff];
        }
        return ~crc;
    }

    static checkcrc(src: Uint8Array, offset: number, length: number, expected: number = 0): boolean {
        return Packet.getcrc(src, offset, length) == expected;
    }

    private readonly view: DataView;
    readonly data: Uint8Array;

    pos: number = 0;
    bitPos: number = 0;
    random: Isaac | null = null;

    constructor(src: Uint8Array | Int8Array | null) {
        if (!src) {
            throw new Error();
        }

        super();

        if (src instanceof Int8Array) {
            this.data = new Uint8Array(src.buffer, src.byteOffset, src.byteLength);
        } else {
            this.data = src;
        }

        this.view = new DataView(this.data.buffer, this.data.byteOffset, this.data.byteLength);
    }

    get length(): number {
        return this.view.byteLength;
    }

    get available(): number {
        return this.view.byteLength - this.pos;
    }

    static alloc(type: number): Packet {
        let cached: Packet | null = null;
        if (type === 0 && Packet.cacheMinCount > 0) {
            Packet.cacheMinCount--;
            cached = Packet.cacheMin.popFront();
        } else if (type === 1 && Packet.cacheMidCount > 0) {
            Packet.cacheMidCount--;
            cached = Packet.cacheMid.popFront();
        } else if (type === 2 && Packet.cacheMaxCount > 0) {
            Packet.cacheMaxCount--;
            cached = Packet.cacheMax.popFront();
        }

        if (cached) {
            cached.pos = 0;
            return cached;
        }

        if (type === 0) {
            return new Packet(new Uint8Array(100));
        } else if (type === 1) {
            return new Packet(new Uint8Array(5000));
        } else {
            return new Packet(new Uint8Array(30000));
        }
    }

    release(): void {
        this.pos = 0;

        if (this.length === 100 && Packet.cacheMinCount < 1000) {
            Packet.cacheMin.push(this);
            Packet.cacheMinCount++;
        } else if (this.length === 5000 && Packet.cacheMidCount < 250) {
            Packet.cacheMid.push(this);
            Packet.cacheMidCount++;
        } else if (this.length === 30000 && Packet.cacheMaxCount < 50) {
            Packet.cacheMax.push(this);
            Packet.cacheMaxCount++;
        }
    }

    g1(): number {
        return this.view.getUint8(this.pos++);
    }

    // signed
    g1b(): number {
        return this.view.getInt8(this.pos++);
    }

    g2(): number {
        const result: number = this.view.getUint16(this.pos);
        this.pos += 2;
        return result;
    }

    // signed
    g2b(): number {
        const result: number = this.view.getInt16(this.pos);
        this.pos += 2;
        return result;
    }

    g3(): number {
        const result: number = (this.view.getUint8(this.pos++) << 16) | this.view.getUint16(this.pos);
        this.pos += 2;
        return result;
    }

    g4(): number {
        const result: number = this.view.getInt32(this.pos);
        this.pos += 4;
        return result;
    }

    // --- 377 alt encodings — exact bodies from Client-Java origin/377 Packet ---

    /** Java `g1_alt1` — `data[pos++] - 128 & 0xFF` */
    g1_alt1(): number {
        return (this.data[this.pos++] - 128) & 0xff;
    }

    /** Java `g1_alt2` — `-data[pos++] & 0xFF` */
    g1_alt2(): number {
        return (-this.data[this.pos++]) & 0xff;
    }

    /** Java `g1_alt3` — `128 - data[pos++] & 0xFF` */
    g1_alt3(): number {
        return (128 - this.data[this.pos++]) & 0xff;
    }

    /** Java `g1b_alt1` — `(byte)(data[pos++] - 128)` */
    g1b_alt1(): number {
        let v = (this.data[this.pos++] - 128) & 0xff;
        return v > 127 ? v - 256 : v;
    }

    /** Java `g1b_alt2` — `(byte)(-data[pos++])` */
    g1b_alt2(): number {
        let v = (-this.data[this.pos++]) & 0xff;
        return v > 127 ? v - 256 : v;
    }

    /** Java `g1b_alt3` — `(byte)(128 - data[pos++])` */
    g1b_alt3(): number {
        let v = (128 - this.data[this.pos++]) & 0xff;
        return v > 127 ? v - 256 : v;
    }

    /** Java `g2_alt1` — LE u16 */
    g2_alt1(): number {
        this.pos += 2;
        return ((this.data[this.pos - 1] & 0xff) << 8) + (this.data[this.pos - 2] & 0xff);
    }

    /** Java `g2_alt2` — BE with lo-128 */
    g2_alt2(): number {
        this.pos += 2;
        return ((this.data[this.pos - 2] & 0xff) << 8) + ((this.data[this.pos - 1] - 128) & 0xff);
    }

    /** Java `g2_alt3` — swapped with lo-128 on first */
    g2_alt3(): number {
        this.pos += 2;
        return ((this.data[this.pos - 1] & 0xff) << 8) + ((this.data[this.pos - 2] - 128) & 0xff);
    }

    /** Engine alias; Java name is `g2b_alt1`. */
    g2s_alt1(): number {
        return this.g2b_alt1();
    }

    g2s_alt2(): number {
        return this.g2b_alt2();
    }

    /** Not in Java 377 — signed form of g2_alt3 for engine-compat. */
    g2s_alt3(): number {
        this.pos += 2;
        const v = ((this.data[this.pos - 1] & 0xff) << 8) + ((this.data[this.pos - 2] - 128) & 0xff);
        return v > 32767 ? v - 65536 : v;
    }

    /** Java `g2b_alt1` — signed LE */
    g2b_alt1(): number {
        this.pos += 2;
        let v = ((this.data[this.pos - 1] & 0xff) << 8) + (this.data[this.pos - 2] & 0xff);
        if (v > 32767) {
            v -= 65536;
        }
        return v;
    }

    /** Java `g2b_alt2` — signed BE with lo-128 */
    g2b_alt2(): number {
        this.pos += 2;
        let v = ((this.data[this.pos - 2] & 0xff) << 8) + ((this.data[this.pos - 1] - 128) & 0xff);
        if (v > 32767) {
            v -= 65536;
        }
        return v;
    }

    /** Not in Java 377. */
    g3_alt1(): number {
        this.pos += 3;
        return (
            ((this.data[this.pos - 1] & 0xff) << 16) +
            ((this.data[this.pos - 2] & 0xff) << 8) +
            (this.data[this.pos - 3] & 0xff)
        );
    }

    /** Not in Java 377. */
    g3_alt2(): number {
        this.pos += 3;
        return (
            ((this.data[this.pos - 3] & 0xff) << 16) +
            ((this.data[this.pos - 1] & 0xff) << 8) +
            (this.data[this.pos - 2] & 0xff)
        );
    }

    /** Java `g3_alt3` — only g3 alt present in 377 */
    g3_alt3(): number {
        this.pos += 3;
        return (
            (this.data[this.pos - 1] & 0xff) +
            ((this.data[this.pos - 2] & 0xff) << 16) +
            ((this.data[this.pos - 3] & 0xff) << 8)
        );
    }

    /** Not in Java 377. */
    g3s_alt1(): number {
        this.pos += 3;
        const v =
            ((this.data[this.pos - 1] & 0xff) << 16) +
            ((this.data[this.pos - 2] & 0xff) << 8) +
            (this.data[this.pos - 3] & 0xff);
        return v > 0x7fffff ? v - 0x1000000 : v;
    }

    g3s_alt2(): number {
        this.pos += 3;
        const v =
            ((this.data[this.pos - 3] & 0xff) << 16) +
            ((this.data[this.pos - 1] & 0xff) << 8) +
            (this.data[this.pos - 2] & 0xff);
        return v > 0x7fffff ? v - 0x1000000 : v;
    }

    g3s_alt3(): number {
        this.pos += 3;
        const v =
            ((this.data[this.pos - 2] & 0xff) << 16) +
            ((this.data[this.pos - 3] & 0xff) << 8) +
            (this.data[this.pos - 1] & 0xff);
        return v > 0x7fffff ? v - 0x1000000 : v;
    }

    /** Java `g4_alt1` */
    g4_alt1(): number {
        this.pos += 4;
        return (
            (this.data[this.pos - 4] & 0xff) +
            ((this.data[this.pos - 3] & 0xff) << 8) +
            ((this.data[this.pos - 1] & 0xff) << 24) +
            ((this.data[this.pos - 2] & 0xff) << 16)
        );
    }

    /** Java `g4_alt2` */
    g4_alt2(): number {
        this.pos += 4;
        return (
            (this.data[this.pos - 3] & 0xff) +
            ((this.data[this.pos - 4] & 0xff) << 8) +
            ((this.data[this.pos - 2] & 0xff) << 24) +
            ((this.data[this.pos - 1] & 0xff) << 16)
        );
    }

    /** Java `g4_alt3` */
    g4_alt3(): number {
        this.pos += 4;
        return (
            (this.data[this.pos - 2] & 0xff) +
            ((this.data[this.pos - 1] & 0xff) << 8) +
            ((this.data[this.pos - 3] & 0xff) << 24) +
            ((this.data[this.pos - 4] & 0xff) << 16)
        );
    }

    /** Not in Java 377 — signed reinterpret of g4_alt1 layout. */
    g4s_alt1(): number {
        this.pos += 4;
        const i =
            ((this.data[this.pos - 1] & 0xff) << 24) +
            ((this.data[this.pos - 2] & 0xff) << 16) +
            ((this.data[this.pos - 3] & 0xff) << 8) +
            (this.data[this.pos - 4] & 0xff);
        return i > 0x7fffffff ? i - 0x100000000 : i;
    }

    g4s_alt2(): number {
        this.pos += 4;
        const i =
            ((this.data[this.pos - 2] & 0xff) << 24) +
            ((this.data[this.pos - 1] & 0xff) << 16) +
            ((this.data[this.pos - 4] & 0xff) << 8) +
            (this.data[this.pos - 3] & 0xff);
        return i > 0x7fffffff ? i - 0x100000000 : i;
    }

    g4s_alt3(): number {
        this.pos += 4;
        const i =
            ((this.data[this.pos - 3] & 0xff) << 24) +
            ((this.data[this.pos - 4] & 0xff) << 16) +
            ((this.data[this.pos - 1] & 0xff) << 8) +
            (this.data[this.pos - 2] & 0xff);
        return i > 0x7fffffff ? i - 0x100000000 : i;
    }

    g8(): bigint {
        // Java: two g4() as unsigned then combine; DataView big-endian is equivalent
        const result: bigint = this.view.getBigInt64(this.pos);
        this.pos += 8;
        return result;
    }

    /**
     * TS/289 name: **signed** smart (g1-64 / g2-49152).
     * Java 377 deob names this `gsmart` (names are inverted vs 289).
     */
    gsmarts(): number {
        return this.view.getUint8(this.pos) < 0x80 ? this.g1() - 0x40 : this.g2() - 0xc000;
    }

    /**
     * TS/289 name: **unsigned** smart (g1 / g2-32768).
     * Java 377 deob names this `gsmarts` (names are inverted vs 289).
     */
    gsmart(): number {
        return this.view.getUint8(this.pos) < 0x80 ? this.g1() : this.g2() - 0x8000;
    }

    gjstr(): string {
        const view: DataView = this.view;
        const length: number = view.byteLength;
        let str: string = '';
        let b: number;
        while ((b = view.getUint8(this.pos++)) !== 10 && this.pos < length) {
            str += String.fromCharCode(b);
        }
        return str;
    }

    /** Java `gjstrraw` — raw bytes up to (excluding) newline 10. */
    gjstrraw(): Uint8Array {
        const start = this.pos;
        while (this.data[this.pos++] !== 10) {
            // advance
        }
        const out = new Uint8Array(this.pos - start - 1);
        out.set(this.data.subarray(start, this.pos - 1));
        return out;
    }

    gdata(length: number, offset: number, dest: Uint8Array | Int8Array): void {
        dest.set(this.data.subarray(this.pos, this.pos + length), offset);
        this.pos += length;
    }

    /** Java `gdata_alt1` — reverse-order bulk (appearance). */
    gdata_alt1(dest: Uint8Array | Int8Array, offset: number, length: number): void {
        for (let i = offset + length - 1; i >= offset; i--) {
            dest[i] = this.data[this.pos++];
        }
    }

    /** Java `gdata_alt2` — each byte −128 (chat). */
    gdata_alt2(dest: Uint8Array | Int8Array, offset: number, length: number): void {
        for (let i = offset; i < offset + length; i++) {
            dest[i] = (this.data[this.pos++] - 128) & 0xff;
        }
    }

    /** Not in Java 377 — reverse + −128. */
    gdata_alt3(dest: Uint8Array | Int8Array, offset: number, length: number): void {
        for (let i = offset + length - 1; i >= offset; i--) {
            dest[i] = (this.data[this.pos++] - 128) & 0xff;
        }
    }

    /**
     * Java `p1isaac(opcode)`. Refuse negative / unknown 289 placeholders:
     * engine NetworkPlayer closes on unregistered ClientGameProt id (e.g. 255 from -1).
     */
    p1Enc(opcode: number): void {
        if (opcode < 0 || opcode > 255) {
            // 377 has no ANTICHEAT_OPLOGIC6–9 / CYCLELOGIC7; never emit garbage.
            console.warn(`[377port] blocked p1Enc invalid opcode=${opcode}`);
            return;
        }
        this.view.setUint8(this.pos++, (opcode + (this.random?.nextInt ?? 0)) & 0xff);
    }

    /** Java name for `p1Enc`. */
    p1isaac(opcode: number): void {
        this.p1Enc(opcode);
    }

    p1(value: number): void {
        this.view.setUint8(this.pos++, value);
    }

    /** Java `p1_alt1` — `(v + 128)` */
    p1_alt1(value: number): void {
        this.view.setUint8(this.pos++, (value + 128) & 0xff);
    }

    /** Java `p1_alt2` — `-v` */
    p1_alt2(value: number): void {
        this.view.setUint8(this.pos++, (-value) & 0xff);
    }

    /** Java `p1_alt3` — `(128 - v)` */
    p1_alt3(value: number): void {
        this.view.setUint8(this.pos++, (128 - value) & 0xff);
    }

    p2(value: number): void {
        this.view.setUint16(this.pos, value);
        this.pos += 2;
    }

    /** Java 377 `ip2` — little-endian (289 wrongly wrote hi as 0). */
    ip2(value: number): void {
        this.view.setUint16(this.pos, value, true);
        this.pos += 2;
    }

    /** Java `p2_alt1` — LE u16 */
    p2_alt1(value: number): void {
        this.data[this.pos++] = value;
        this.data[this.pos++] = value >> 8;
    }

    /** Java `p2_alt2` — hi, lo+128 */
    p2_alt2(value: number): void {
        this.data[this.pos++] = value >> 8;
        this.data[this.pos++] = value + 128;
    }

    /** Java `p2_alt3` — lo+128, hi */
    p2_alt3(value: number): void {
        this.data[this.pos++] = value + 128;
        this.data[this.pos++] = value >> 8;
    }

    p3(value: number): void {
        this.view.setUint8(this.pos++, value >> 16);
        this.view.setUint16(this.pos, value);
        this.pos += 2;
    }

    p4(value: number): void {
        this.view.setInt32(this.pos, value);
        this.pos += 4;
    }

    ip4(value: number): void {
        this.view.setInt32(this.pos, value, true);
        this.pos += 4;
    }

    p8(value: bigint): void {
        this.view.setBigInt64(this.pos, value);
        this.pos += 8;
    }

    pjstr(str: string): void {
        const view: DataView = this.view;
        const length: number = str.length;
        for (let i: number = 0; i < length; i++) {
            view.setUint8(this.pos++, str.charCodeAt(i));
        }
        view.setUint8(this.pos++, 10);
    }

    pdata(src: Uint8Array, offset: number, length: number): void {
        this.data.set(src.subarray(offset, offset + length), this.pos);
        this.pos += length;
    }

    psize1(size: number): void {
        this.view.setUint8(this.pos - size - 1, size);
    }

    /** Java `accessBits` */
    gBitStart(): void {
        this.bitPos = this.pos * 8;
    }

    accessBits(): void {
        this.gBitStart();
    }

    /** Java `accessBytes` */
    gBitEnd(): void {
        this.pos = ((this.bitPos + 7) / 8) | 0;
    }

    accessBytes(): void {
        this.gBitEnd();
    }

    /** Java `gBit` */
    gBit(n: number): number {
        let bytePos: number = this.bitPos >> 3;
        let remaining: number = 8 - (this.bitPos & 0x7);
        let value: number = 0;
        this.bitPos += n;

        for (; n > remaining; remaining = 8) {
            value += (this.data[bytePos++] & Packet.bitmask[remaining]) << (n - remaining);
            n -= remaining;
        }

        if (n === remaining) {
            value += this.data[bytePos] & Packet.bitmask[remaining];
        } else {
            value += (this.data[bytePos] >> (remaining - n)) & Packet.bitmask[n];
        }

        return value;
    }

    rsaenc(mod: bigint, exp: bigint): void {
        const length: number = this.pos;
        this.pos = 0;

        const temp: Uint8Array = new Uint8Array(length);
        this.gdata(length, 0, temp);

        const bigRaw: bigint = bytesToBigInt(temp);
        const bigEnc: bigint = bigIntModPow(bigRaw, exp, mod);
        const rawEnc: Uint8Array = bigIntToBytes(bigEnc);

        this.pos = 0;
        this.p1(rawEnc.length);
        this.pdata(rawEnc, 0, rawEnc.length);
    }
}
