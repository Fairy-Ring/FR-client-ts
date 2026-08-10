/**
 * Jagex 377 MIDI control plane over stock Spessa.
 *
 * Oracle: Client-Java `sign.MidiPlayer` + `signlink` midisave / audioLoop / midivol.
 * Softsynth: Spessa (one sequencer + one SF2 bank) — browser substitute for
 * `javax.sound.midi` Sequencer/Synthesizer. We do not reimplement SoftSynth;
 * we drive a stock player with the same play/stop/loop/volume policy Java used.
 *
 * Bank: SCC1_Florestan.sf2 (Decision 012). See docs/decisions/012-*.md.
 */
import type { MidiBackend } from '#/sound/MidiBackend.js';
import { midivolToGain } from '#/sound/MidiBackend.js';
import { SpessaBackend } from '#/sound/backends/spessaBackend.js';

const DEFAULT_MIDIVOL = 96;
const AUDIO_LOOP_MS = 50;
const FLORESTAN_URLS = ['/client/SCC1_Florestan.sf2', '/harness/SCC1_Florestan.sf2'];

type EarlyOp =
    | { op: 'play'; data: Uint8Array; fade: boolean }
    | { op: 'stop' }
    | { op: 'vol'; midivol: number; applyNow: boolean | undefined };

let backend: MidiBackend | null = null;
let ready = false;
let initPromise: Promise<void> | null = null;
const earlyQueue: EarlyOp[] = [];

// --- signlink-style state (Java audioLoop) ---
let midifade = 0;
let midivol = DEFAULT_MIDIVOL;
let midiCmd: 'none' | 'stop' | 'voladjust' | 'play' = 'none';
let pendingMidi: Uint8Array | null = null;
let midiFadingIn = false;
let midiFadingOut = false;
let midiFadeVol = 0;
let loopHandle: ReturnType<typeof setInterval> | null = null;

async function loadFlorestan(b: MidiBackend): Promise<boolean> {
    for (const url of FLORESTAN_URLS) {
        try {
            const res = await fetch(url);
            if (!res.ok) {
                continue;
            }
            const buf = await res.arrayBuffer();
            if (buf.byteLength < 1000) {
                continue;
            }
            await b.setSoundfont(buf);
            console.info(`[midi] setSoundfont Florestan from ${url} (${buf.byteLength} bytes)`);
            return true;
        } catch {
            /* next */
        }
    }
    console.warn('[midi] SCC1_Florestan.sf2 missing — MIDI disabled until bank available');
    return false;
}

function applyGain(midivolJava: number): void {
    if (!backend) {
        return;
    }
    backend.setGain(midivolToGain(midivolJava));
}

function signlinkPlayMidi(): void {
    if (!backend) {
        return;
    }
    if (midiFadingOut) {
        return;
    }
    if (!midiFadingIn && midifade !== 0 && backend.isPlaying()) {
        midiFadingOut = true;
        midiFadeVol = midivol;
        return;
    }
    if (!pendingMidi) {
        return;
    }
    try {
        const loop = midifade !== 0;
        const mid = pendingMidi;
        const onErr = (e: unknown) => console.warn('[midi] play failed', e);
        if (midifade !== 0 && midiFadingIn) {
            // Java: after fade-out, start new sequence at midiFadeVol (0) then ramp midivol
            midiFadingOut = false;
            midiFadeVol = 0;
            applyGain(0);
            void backend.play(mid, loop).catch(onErr);
        } else {
            applyGain(midivol);
            void backend.play(mid, loop).catch(onErr);
        }
    } catch (e) {
        console.warn('[midi] play failed', e);
    }
}

function audioLoop(): void {
    if (!backend) {
        return;
    }
    if (midiFadingIn) {
        midiFadeVol += 8;
        if (midiFadeVol > midivol) {
            midiFadeVol = midivol;
        }
        applyGain(midiFadeVol);
        if (midiFadeVol === midivol) {
            midiFadingIn = false;
        }
    } else if (midiFadingOut) {
        midiFadeVol -= 8;
        if (midiFadeVol < 0) {
            midiFadeVol = 0;
        }
        applyGain(midiFadeVol);
        if (midiFadeVol === 0) {
            midiFadingOut = false;
            midiFadingIn = true;
        }
    }

    if (midiCmd !== 'none') {
        if (midiCmd === 'stop') {
            backend.stop();
        } else if (midiCmd === 'voladjust') {
            applyGain(midivol);
        } else if (midiCmd === 'play') {
            signlinkPlayMidi();
        }
        if (!midiFadingOut) {
            midiCmd = 'none';
        }
    }
}

async function init(): Promise<void> {
    backend = new SpessaBackend();
    const ok = await loadFlorestan(backend);
    if (!ok) {
        console.warn('[midi] continuing without soundfont — plays will fail until bank loads');
    }
    applyGain(DEFAULT_MIDIVOL);
    if (!loopHandle) {
        loopHandle = setInterval(audioLoop, AUDIO_LOOP_MS);
    }
    ready = true;
    console.info('[midi] Jagex 377 control plane ready (Spessa + Florestan, midivol scale)');

    while (earlyQueue.length) {
        const item = earlyQueue.shift()!;
        try {
            if (item.op === 'play') {
                playMidiStock(item.data, item.fade);
            } else if (item.op === 'stop') {
                stopMidiStock();
            } else if (item.op === 'vol') {
                setMidiVolumeStock(item.midivol, item.applyNow);
            }
        } catch (e) {
            console.warn('[midi] early queue item failed', e);
        }
    }
}

function ensureInit(): void {
    if (initPromise) {
        return;
    }
    initPromise = init().catch(err => {
        console.error('[midi] init failed', err);
    });
}

function playMidiStock(data: Uint8Array, fade: boolean): void {
    if (!data || data.length === 0) {
        return;
    }
    midifade = fade ? 1 : 0;
    pendingMidi = data instanceof Uint8Array ? data.slice() : new Uint8Array(data);
    midiCmd = 'play';
    audioLoop();
}

function stopMidiStock(): void {
    midifade = 0;
    midiFadingIn = false;
    midiFadingOut = false;
    midiCmd = 'stop';
    audioLoop();
}

function setMidiVolumeStock(midivolJava: number, applyNow?: boolean): void {
    midivol = midivolJava | 0;
    if (midivol < 0) {
        midivol = 0;
    }
    if (midivol > 128) {
        midivol = 128;
    }
    if (applyNow !== false) {
        midiCmd = 'voladjust';
        audioLoop();
    }
}

/**
 * Java saveMidi(fade, data) after midisave → path → play.
 * Volume is signlink.midivol (options clientcode 3), not per-call dB.
 */
export function playMidi(data: Uint8Array, _volumeIgnored?: number, fade?: boolean): void {
    ensureInit();
    if (!data || data.length === 0) {
        return;
    }
    const fading = !!fade;
    if (!ready || !backend) {
        earlyQueue.push({
            op: 'play',
            data: data instanceof Uint8Array ? data.slice() : new Uint8Array(data),
            fade: fading
        });
        return;
    }
    playMidiStock(data, fading);
}

/**
 * Java setMidiVolume(midiActive, midivol): always store midivol;
 * voladjust only when applyNow (music already active).
 */
export function setMidiVolume(midivolJava: number, applyNow?: boolean): void {
    ensureInit();
    if (!ready || !backend) {
        earlyQueue.push({ op: 'vol', midivol: midivolJava, applyNow });
        return;
    }
    setMidiVolumeStock(midivolJava, applyNow);
}

/** Java stopMidi — midifade=0, midi="stop". */
export function stopMidi(_fade?: boolean): void {
    ensureInit();
    if (!ready || !backend) {
        earlyQueue.push({ op: 'stop' });
        return;
    }
    stopMidiStock();
}

ensureInit();
