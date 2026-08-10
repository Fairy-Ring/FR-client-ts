/**
 * SpessaSynth (Apache-2.0) backend — stock WorkletSynthesizer + Sequencer.
 *
 * Volume: master GainNode only, Java midivol relative curve (Decision 012).
 * Spessa plays the SMF as-is (including song CC7 automation). midivol is the
 * outer options fader — not CC injection (lock muted us; intercept thrashed FPS).
 *
 * Processor: /client/spessasynth_processor.min.js
 */
import { WorkletSynthesizer, Sequencer } from 'spessasynth_lib';

import type { MidiBackend } from '#/sound/MidiBackend.js';
import { midivolToGain } from '#/sound/MidiBackend.js';

const PROCESSOR_URL = '/client/spessasynth_processor.min.js';

export class SpessaBackend implements MidiBackend {
    readonly id = 'spessa' as const;

    private ctx: AudioContext | null = null;
    private gainNode: GainNode | null = null;
    private synth: WorkletSynthesizer | null = null;
    private seq: Sequencer | null = null;
    private ready = false;
    private playing = false;
    private soundfontLoaded = false;
    private midivol = 96;

    private async ensure(): Promise<void> {
        if (this.ready && this.synth && this.seq) {
            return;
        }
        if (!window.audioContext) {
            window.AudioContext = window.AudioContext || (window as any).webkitAudioContext;
            window.audioContext = new window.AudioContext({ sampleRate: 22050 });
        }
        this.ctx = window.audioContext;
        if (this.ctx.state === 'suspended') {
            await this.ctx.resume().catch(() => {});
        }

        await this.ctx.audioWorklet.addModule(PROCESSOR_URL);

        this.gainNode = this.ctx.createGain();
        this.gainNode.gain.value = midivolToGain(this.midivol);
        this.gainNode.connect(this.ctx.destination);

        // eventsEnabled MUST be true: Spessa only posts sequencerReturn (songChange,
        // songListChange, …) when enabled. With false, loadNewSongList never completes
        // on the main thread → play waits forever → mute.
        this.synth = new WorkletSynthesizer(this.ctx, { eventsEnabled: true });
        this.synth.connect(this.gainNode);
        await this.synth.isReady;

        this.seq = new Sequencer(this.synth);
        this.seq.eventHandler.addEvent('songEnded', 'midi-backend', () => {
            this.playing = false;
        });

        this.ready = true;
        console.info('[midi:spessa] ready (master midivol gain only)');
    }

    private applyMasterGain(): void {
        if (!this.gainNode || !this.ctx) {
            return;
        }
        const g = midivolToGain(this.midivol);
        const t = this.ctx.currentTime;
        this.gainNode.gain.cancelScheduledValues(t);
        this.gainNode.gain.setValueAtTime(g, t);
    }

    private copyToArrayBuffer(data: ArrayBuffer | Uint8Array): ArrayBuffer {
        if (data instanceof ArrayBuffer) {
            return data.slice(0);
        }
        return data.slice().buffer as ArrayBuffer;
    }

    async setSoundfont(data: ArrayBuffer | Uint8Array): Promise<void> {
        await this.ensure();
        const ab = this.copyToArrayBuffer(data);
        const nbytes = ab.byteLength;
        await this.synth!.soundBankManager.addSoundBank(ab, 'main');
        this.soundfontLoaded = true;
        console.info(`[midi:spessa] soundfont loaded (${nbytes} bytes)`);
    }

    async play(smf: Uint8Array, loop: boolean): Promise<void> {
        await this.ensure();
        if (!this.soundfontLoaded) {
            throw new Error('[midi:spessa] setSoundfont before play');
        }
        if (this.ctx!.state === 'suspended') {
            await this.ctx!.resume().catch(() => {});
        }

        this.stop();

        const ab = this.copyToArrayBuffer(smf);
        await new Promise<void>((resolve, reject) => {
            const tid = 'midi-backend-load';
            const eid = 'midi-backend-err';
            const cleanup = () => {
                try {
                    this.seq!.eventHandler.removeEvent('songChange', tid);
                } catch {
                    /* ignore */
                }
                try {
                    this.seq!.eventHandler.removeEvent('midiError', eid);
                } catch {
                    /* ignore */
                }
            };
            const timer = setTimeout(() => {
                cleanup();
                reject(new Error('[midi:spessa] loadNewSongList timed out'));
            }, 15000);
            this.seq!.eventHandler.addEvent('songChange', tid, () => {
                clearTimeout(timer);
                cleanup();
                resolve();
            });
            this.seq!.eventHandler.addEvent('midiError', eid, (err: unknown) => {
                clearTimeout(timer);
                cleanup();
                reject(err instanceof Error ? err : new Error(String(err)));
            });
            try {
                this.seq!.loadNewSongList([{ binary: ab, fileName: 'song.mid' }]);
            } catch (e) {
                clearTimeout(timer);
                cleanup();
                reject(e);
            }
        });

        this.seq!.loopCount = loop ? -1 : 0;
        this.applyMasterGain();
        this.seq!.play();
        this.playing = true;
        this.applyMasterGain();
        console.info(
            `[midi:spessa] play smf=${smf.byteLength}B loop=${loop} duration=${(this.seq!.duration ?? 0).toFixed(2)}s midivol=${this.midivol} gain=${midivolToGain(this.midivol).toFixed(3)}`
        );
    }

    stop(): void {
        if (!this.seq) {
            return;
        }
        try {
            this.seq.pause();
            if (this.seq.duration > 0) {
                this.seq.currentTime = this.seq.duration;
            }
        } catch {
            /* ignore */
        }
        try {
            this.synth?.stopAll(true);
        } catch {
            /* ignore */
        }
        this.playing = false;
    }

    setMidivol(midivol: number): void {
        let v = midivol | 0;
        if (v < 0) {
            v = 0;
        }
        if (v > 128) {
            v = 128;
        }
        this.midivol = v;
        this.applyMasterGain();
    }

    isPlaying(): boolean {
        return this.playing && !!this.seq && !this.seq.paused && !this.seq.isFinished;
    }
}
