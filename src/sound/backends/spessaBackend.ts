/**
 * SpessaSynth (Apache-2.0) backend — stock WorkletSynthesizer + Sequencer.
 * Processor must be served at /client/spessasynth_processor.min.js
 */
import { WorkletSynthesizer, Sequencer } from 'spessasynth_lib';
import { BasicMIDI } from 'spessasynth_core';

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
        this.gainNode.gain.value = midivolToGain(96);
        this.gainNode.connect(this.ctx.destination);

        this.synth = new WorkletSynthesizer(this.ctx);
        // Route synth through our gain for setGain parity
        this.synth.connect(this.gainNode);
        await this.synth.isReady;

        this.seq = new Sequencer(this.synth);
        this.seq.eventHandler.addEvent(
            'songEnded',
            'midi-backend',
            () => {
                this.playing = false;
            }
        );

        this.ready = true;
        console.info('[midi:spessa] ready');
    }

    private copyToArrayBuffer(data: ArrayBuffer | Uint8Array): ArrayBuffer {
        if (data instanceof ArrayBuffer) {
            return data.slice(0);
        }
        return data.slice().buffer as ArrayBuffer;
    }

    async setSoundfont(data: ArrayBuffer | Uint8Array): Promise<void> {
        await this.ensure();
        // Worklet may transfer (detach) the buffer — log size before await
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
        // loadNewSongList is async via worklet — wait for songChange before play
        // (duration is 0 while isLoading; early play races empty sequence)
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
                // Stock path: worklet parses SMF
                this.seq!.loadNewSongList([{ binary: ab, fileName: 'song.mid' }]);
            } catch (e) {
                clearTimeout(timer);
                cleanup();
                reject(e);
            }
        });

        // -1 infinite (Java midifade song); 0 = no remaining loops after current (play once)
        this.seq!.loopCount = loop ? -1 : 0;
        this.seq!.play();
        this.playing = true;
        console.info(
            `[midi:spessa] play smf=${smf.byteLength}B loop=${loop} duration=${(this.seq!.duration ?? 0).toFixed(2)}s`
        );
    }

    stop(): void {
        if (!this.seq) {
            return;
        }
        try {
            this.seq.pause();
            // Jump past end so a later play always starts clean (stock API only)
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

    setGain(gain: number): void {
        if (!this.gainNode) {
            return;
        }
        const g = Math.max(0, Math.min(1, gain));
        const t = this.ctx?.currentTime ?? 0;
        this.gainNode.gain.cancelScheduledValues(t);
        this.gainNode.gain.setValueAtTime(g, t);
    }

    isPlaying(): boolean {
        return this.playing && !!this.seq && !this.seq.paused && !this.seq.isFinished;
    }
}
