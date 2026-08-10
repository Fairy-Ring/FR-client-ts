/**
 * Thin softsynth surface under MidiFacade (Decision 012).
 * Mirrors Java: one sequence + bank + start/stop/gain — not a multi-stream PCM player.
 */
export type MidiBackendId = 'spessa';

export interface MidiBackend {
    readonly id: MidiBackendId;

    /** Load Florestan (or other) SF2/SF3 bytes. */
    setSoundfont(data: ArrayBuffer | Uint8Array): Promise<void>;

    /**
     * Hard-stop any current sequence, then play SMF bytes.
     * @param loop if true, loop infinitely (Java midifade==1 song); else once (jingle)
     */
    play(smf: Uint8Array, loop: boolean): Promise<void>;

    /** Hard stop — no residual voices/streams if backend allows. */
    stop(): void;

    /**
     * Master gain 0..1 (facade maps Java midivol 0..128 → this).
     * Applied to a single output path.
     */
    setGain(gain: number): void;

    /** True while a sequence is actively playing (best-effort). */
    isPlaying(): boolean;
}

export function midivolToGain(midivol: number): number {
    const v = Math.max(0, Math.min(128, midivol | 0));
    if (v <= 0) {
        return 0;
    }
    // Same curve family as Java MidiPlayer.getVolume (channel 12800), scaled for Web Audio
    const channel = 12800;
    const mixed = ((channel * v) >>> 8) * channel;
    const expr = Math.sqrt(mixed) + 0.5;
    const exprMax = Math.sqrt(((12800 * 128) >>> 8) * 12800) + 0.5;
    return (expr / exprMax) * 0.2;
}
