import Packet from '#/io/Packet.js';

import Tone from '#/sound/Tone.js';

import { TypedArray1d } from '#/util/Arrays.js';

/**
 * Port of Client-Java `jagex2.sound.Wave` (procedural SFX synth).
 * Tables sized 5000 to match Java field1471/field1472.
 */
export default class JagFX {
    // Java: Wave.field1471 / field1472 length 5000
    static synth: (JagFX | null)[] = new TypedArray1d(5000, null);
    static delays: Int32Array = new Int32Array(5000);

    // Java: field1473 = new byte[441000]  (22050 Hz × 20 s)
    static waveBytes: Uint8Array = new Uint8Array(441000);
    static waveBuffer: Packet = new Packet(this.waveBytes);

    tones: (Tone | null)[] = new TypedArray1d(10, null);
    loopBegin: number = 0;
    loopEnd: number = 0;

    /** Java Wave.unpack(Packet, 36135) — dummy arg omitted. */
    static init(buf: Packet): void {
        // Tone static sine/noise tables are built in Tone's static block (Java Tone.method186)
        while (true) {
            const id = buf.g2();
            if (id === 65535) {
                break;
            }

            this.synth[id] = new JagFX();
            this.synth[id]!.load(buf);
            this.delays[id] = this.synth[id]!.optimiseStart();
        }
    }

    /** Java Wave.method479(loops, 6, id) */
    static generate(id: number, loopCount: number): Packet | null {
        const sound = this.synth[id];
        if (sound === null) {
            return null;
        }

        return sound.getWave(loopCount);
    }

    /** Java Wave.method480 */
    load(dat: Packet): void {
        for (let tone = 0; tone < 10; tone++) {
            if (dat.g1() !== 0) {
                dat.pos--;

                this.tones[tone] = new Tone();
                this.tones[tone]!.load(dat);
            }
        }

        this.loopBegin = dat.g2();
        this.loopEnd = dat.g2();
    }

    /** Java Wave.method481 — trim leading silence; return delay ticks. */
    optimiseStart(): number {
        let start = 9999999;
        for (let i = 0; i < 10; i++) {
            const tone = this.tones[i];
            if (tone !== null && ((tone.start / 20) | 0) < start) {
                start = (tone.start / 20) | 0;
            }
        }

        if (this.loopBegin < this.loopEnd && ((this.loopBegin / 20) | 0) < start) {
            start = (this.loopBegin / 20) | 0;
        }

        if (start === 9999999 || start === 0) {
            return 0;
        }

        for (let i = 0; i < 10; i++) {
            const tone = this.tones[i];
            if (tone !== null) {
                tone.start -= start * 20;
            }
        }

        if (this.loopBegin < this.loopEnd) {
            this.loopBegin -= start * 20;
            this.loopEnd -= start * 20;
        }

        return start;
    }

    /** Java Wave.method482 — wrap PCM in WAV. */
    getWave(loopCount: number): Packet {
        const length = this.makeSound(loopCount);
        JagFX.waveBuffer.pos = 0;
        JagFX.waveBuffer.p4(0x52494646); // "RIFF"
        JagFX.waveBuffer.ip4(length + 36);
        JagFX.waveBuffer.p4(0x57415645); // "WAVE"
        JagFX.waveBuffer.p4(0x666d7420); // "fmt "
        JagFX.waveBuffer.ip4(16);
        JagFX.waveBuffer.ip2(1);
        JagFX.waveBuffer.ip2(1);
        JagFX.waveBuffer.ip4(22050);
        JagFX.waveBuffer.ip4(22050);
        JagFX.waveBuffer.ip2(1);
        JagFX.waveBuffer.ip2(8);
        JagFX.waveBuffer.p4(0x64617461); // "data"
        JagFX.waveBuffer.ip4(length);
        JagFX.waveBuffer.pos += length;
        return JagFX.waveBuffer;
    }

    /**
     * Java Wave.method483 — mix tones into waveBytes with clip.
     * Mix: v = (sample>>8) + (unsigned byte); if (v & 0xFFFFFF00) != 0 then saturate.
     */
    private makeSound(loopCount: number): number {
        let duration = 0;
        for (let i = 0; i < 10; i++) {
            const tone = this.tones[i];
            if (tone !== null && tone.length + tone.start > duration) {
                duration = tone.length + tone.start;
            }
        }

        if (duration === 0) {
            return 0;
        }

        let sampleCount = ((duration * 22050) / 1000) | 0;
        let loopStart = ((this.loopBegin * 22050) / 1000) | 0;
        let loopStop = ((this.loopEnd * 22050) / 1000) | 0;

        // Java: if (var5 < 0 || var5 > var4 || var6 < 0 || var6 > var4 || var5 >= var6)
        if (loopStart < 0 || loopStart > sampleCount || loopStop < 0 || loopStop > sampleCount || loopStart >= loopStop) {
            loopCount = 0;
        }

        let totalSampleCount = sampleCount + (loopStop - loopStart) * (loopCount - 1);
        for (let sample = 44; sample < totalSampleCount + 44; sample++) {
            JagFX.waveBytes[sample] = 0x80; // Java -128 as unsigned (silence mid)
        }

        for (let i = 0; i < 10; i++) {
            const tone = this.tones[i];
            if (tone !== null) {
                const toneSampleCount = ((tone.length * 22050) / 1000) | 0;
                const start = ((tone.start * 22050) / 1000) | 0;
                const samples = tone.generate(toneSampleCount, tone.length);

                for (let sample = 0; sample < toneSampleCount; sample++) {
                    const idx = sample + start + 44;
                    // Java: (sample>>8) + (field1473[idx] & 0xFF)
                    let v = (samples[sample] >> 8) + (JagFX.waveBytes[idx] & 0xff);
                    // Java clip: if ((var19 & 0xFFFFFF00) != 0) var19 = ~(var19 >> 31);
                    // ≥256 → -1 (byte 0xFF); <0 → 0
                    if ((v & 0xffffff00) !== 0) {
                        v = ~(v >> 31);
                    }
                    JagFX.waveBytes[idx] = v & 0xff;
                }
            }
        }

        if (loopCount > 1) {
            loopStart += 44;
            loopStop += 44;
            sampleCount += 44;
            totalSampleCount += 44;

            const endOffset = totalSampleCount - sampleCount;
            for (let sample = sampleCount - 1; sample >= loopStop; sample--) {
                JagFX.waveBytes[sample + endOffset] = JagFX.waveBytes[sample];
            }

            for (let loop = 1; loop < loopCount; loop++) {
                const offset = (loopStop - loopStart) * loop;

                for (let sample = loopStart; sample < loopStop; sample++) {
                    JagFX.waveBytes[sample + offset] = JagFX.waveBytes[sample];
                }
            }

            totalSampleCount -= 44;
        }

        return totalSampleCount;
    }
}
