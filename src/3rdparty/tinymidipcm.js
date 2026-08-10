/**
 * TinyMidiPCM backend + Jagex 377 MIDI control plane (Decision 012).
 *
 * Oracle: Client-Java sign.MidiPlayer + signlink midisave / audioLoop / midivol.
 * Bank: SCC1_Florestan.sf2 (XP GS proxy) loaded via setSoundfont at boot.
 * Browser glue only for PCM (Web Audio); fade/volume/loop match Java.
 */
import loadTinyMidiPCM from '#3rdparty/tinymidipcm/tinymidipcm.mjs';

class TinyMidiPCM {
    constructor(options = {}) {
        this.wasmModule = undefined;
        this.soundfontBufferPtr = 0;
        this.soundfontPtr = 0;
        this.midiBufferPtr = 0;
        this.renderInterval = options.renderInterval || 100;
        this.sampleRate = options.sampleRate || 44100;
        this.channels = options.channels || 2;
        this.gain = options.gain || 0;
        if (!options.bufferSize) {
            this.setBufferDuration(1);
        } else {
            this.bufferSize = options.bufferSize;
        }
        this.onPCMData = options.onPCMData || (() => {});
        this.onRenderEnd = options.onRenderEnd || (() => {});
        this.renderTimer = undefined;
    }

    async init() {
        if (this.wasmModule) {
            return;
        }
        this.wasmModule = await loadTinyMidiPCM();
        this.pcmBufferPtr = this.wasmModule._malloc(this.bufferSize);
        this.msecsPtr = this.wasmModule._malloc(8);
    }

    setBufferDuration(seconds) {
        this.bufferSize = 2 * this.sampleRate * this.channels * seconds;
    }

    ensureInitialized() {
        if (!this.wasmModule) {
            throw new Error(`${this.constructor.name} not initialized. call .init()`);
        }
    }

    setSoundfont(buffer) {
        this.ensureInitialized();
        const { _malloc, _free, _tsf_load_memory, _tsf_set_output } = this.wasmModule;
        _free(this.soundfontBufferPtr);
        this.soundfontBufferPtr = _malloc(buffer.length);
        this.wasmModule.HEAPU8.set(buffer, this.soundfontBufferPtr);
        this.soundfontPtr = _tsf_load_memory(this.soundfontBufferPtr, buffer.length);
        _tsf_set_output(this.soundfontPtr, this.channels === 2 ? 0 : 2, this.sampleRate, this.gain);
    }

    getPCMBuffer() {
        this.ensureInitialized();
        const pcm = new Uint8Array(this.bufferSize);
        pcm.set(this.wasmModule.HEAPU8.subarray(this.pcmBufferPtr, this.pcmBufferPtr + this.bufferSize));
        return pcm;
    }

    getMIDIMessagePtr(midiBuffer) {
        const { _malloc, _free, _tml_load_memory } = this.wasmModule;
        _free(this.midiBufferPtr);
        this.midiBufferPtr = _malloc(midiBuffer.length);
        this.wasmModule.HEAPU8.set(midiBuffer, this.midiBufferPtr);
        return _tml_load_memory(this.midiBufferPtr, midiBuffer.length);
    }

    renderMIDIMessage(midiMessagePtr) {
        const { _midi_render } = this.wasmModule;
        return _midi_render(this.soundfontPtr, midiMessagePtr, this.channels, this.sampleRate, this.pcmBufferPtr, this.bufferSize, this.msecsPtr);
    }

    cancelRender() {
        if (this.renderTimer !== undefined) {
            window.clearTimeout(this.renderTimer);
            this.renderTimer = undefined;
        }
    }

    render(midiBuffer) {
        this.ensureInitialized();
        if (!this.soundfontPtr) {
            throw new Error('no soundfont buffer set. call .setSoundfont');
        }
        this.cancelRender();
        const { setValue, getValue, _tsf_reset, _tsf_channel_set_bank_preset } = this.wasmModule;
        setValue(this.msecsPtr, 0, 'double');
        _tsf_reset(this.soundfontPtr);
        _tsf_channel_set_bank_preset(this.soundfontPtr, 9, 128, 0);
        let midiMessagePtr = this.getMIDIMessagePtr(midiBuffer);
        const boundRender = function () {
            midiMessagePtr = this.renderMIDIMessage(midiMessagePtr);
            const pcm = this.getPCMBuffer();
            this.onPCMData(pcm);
            if (midiMessagePtr) {
                this.renderTimer = setTimeout(boundRender, this.renderInterval);
            } else {
                this.onRenderEnd(getValue(this.msecsPtr, 'double'));
            }
        }.bind(this);
        this.renderTimer = setTimeout(() => {
            boundRender();
        }, 16);
    }
}

// ---------------------------------------------------------------------------
// Jagex 377 control plane (signlink + MidiPlayer) over TinyMidiPCM
// ---------------------------------------------------------------------------
(async () => {
    const channels = 2;
    const sampleRate = 22050;
    const flushTime = 250;
    const renderInterval = 30;
    /** Java signlink audioLoop sleep */
    const AUDIO_LOOP_MS = 50;
    /** Java midivol default */
    const DEFAULT_MIDIVOL = 96;

    if (!window.audioContext) {
        console.warn('[midi] no audioContext — ensure audio.js loads first');
        return;
    }

    let samples = new Float32Array();
    let bufferSources = [];
    let flushInterval = null;
    let lastTime = window.audioContext.currentTime;

    const gainNode = window.audioContext.createGain();
    gainNode.connect(window.audioContext.destination);

    // --- MidiPlayer-equivalent volume (Java midivol 0..128 → gain) ---
    // getVolume with channels[i]=12800: sqrt(((12800*vol)>>8)*12800)
    function midivolToLinearGain(midivol) {
        const v = Math.max(0, Math.min(128, midivol | 0));
        if (v <= 0) {
            return 0;
        }
        const channel = 12800;
        const mixed = ((channel * v) >>> 8) * channel;
        const expr = Math.sqrt(mixed) + 0.5;
        const exprMax = Math.sqrt(((12800 * 128) >>> 8) * 12800) + 0.5;
        // Scale so ~midivol 96 ≈ previous ~0.1 master
        return (expr / exprMax) * 0.133;
    }

    /** @type {number} applied output level (Java MidiPlayer.volume after setVolume) */
    let playerVolume = DEFAULT_MIDIVOL;

    function applyPlayerVolume(vol) {
        playerVolume = vol | 0;
        const g = midivolToLinearGain(playerVolume);
        const t = window.audioContext.currentTime;
        gainNode.gain.cancelScheduledValues(t);
        gainNode.gain.setValueAtTime(g, t);
    }

    // Java: setVolume(velocity, volume) with velocity usually 0
    function midiPlayerSetVolume(velocity, volume) {
        let v = volume | 0;
        v = (v * Math.pow(0.1, velocity * 0.0005) + 0.5) | 0;
        if (playerVolume === v) {
            return;
        }
        applyPlayerVolume(v);
    }

    let isRunning = false;
    let loopSong = false;
    /** @type {Uint8Array | null} */
    let activeMidiBytes = null;

    const tinyMidiPCM = new TinyMidiPCM({
        renderInterval,
        onPCMData: pcm => {
            const float32 = new Float32Array(pcm.buffer);
            const temp = new Float32Array(samples.length + float32.length);
            temp.set(samples, 0);
            temp.set(float32, samples.length);
            samples = temp;
        },
        onRenderEnd: () => {
            // Java Sequencer loopCount -1 when midifade==1 (song); jingle midifade==0 plays once
            if (loopSong && isRunning && activeMidiBytes) {
                lastTime = window.audioContext.currentTime;
                tinyMidiPCM.render(activeMidiBytes);
            } else {
                isRunning = false;
            }
        },
        bufferSize: 1024 * 100,
        sampleRate
    });

    await tinyMidiPCM.init();

    // Boot bank: Java MidiPlayer.setSoundfont — unused in 377; we load Florestan (Decision 012)
    async function loadXpSoundfont() {
        const sfUrls = [
            new URL('SCC1_Florestan.sf2', import.meta.url).href,
            '/client/SCC1_Florestan.sf2',
            '/harness/SCC1_Florestan.sf2'
        ];
        for (const url of sfUrls) {
            try {
                const res = await fetch(url);
                if (!res.ok) continue;
                const buf = new Uint8Array(await res.arrayBuffer());
                if (buf.byteLength < 1000) continue;
                tinyMidiPCM.setSoundfont(buf);
                console.info(`[midi] setSoundfont Florestan from ${url} (${buf.byteLength} bytes)`);
                return true;
            } catch {
                /* next */
            }
        }
        console.warn('[midi] SCC1_Florestan.sf2 missing — MIDI disabled until bank available');
        return false;
    }
    await loadXpSoundfont();
    applyPlayerVolume(DEFAULT_MIDIVOL);

    function flush() {
        if (!window.audioContext || !samples.length) {
            return;
        }
        const bufferSource = window.audioContext.createBufferSource();
        const length = samples.length / channels;
        const audioBuffer = window.audioContext.createBuffer(channels, length, sampleRate);
        for (let channel = 0; channel < channels; channel++) {
            const audioData = audioBuffer.getChannelData(channel);
            let offset = channel;
            for (let i = 0; i < length; i++) {
                audioData[i] = samples[offset];
                offset += channels;
            }
        }
        if (lastTime < window.audioContext.currentTime) {
            lastTime = window.audioContext.currentTime;
        }
        bufferSource.buffer = audioBuffer;
        bufferSource.connect(gainNode);
        bufferSource.start(lastTime);
        bufferSources.push(bufferSource);
        lastTime += audioBuffer.duration;
        samples = new Float32Array();
    }

    function stopPcm() {
        if (flushInterval) {
            clearInterval(flushInterval);
            flushInterval = null;
        }
        samples = new Float32Array();
        tinyMidiPCM.cancelRender();
        if (bufferSources.length) {
            const t = window.audioContext.currentTime;
            bufferSources.forEach(s => {
                try {
                    s.stop(t);
                } catch {
                    /* already stopped */
                }
            });
            bufferSources = [];
        }
    }

    /** Java MidiPlayer.play(sequence, loop, volume) — loop 1 → infinite */
    function midiPlayerPlay(midiBytes, loop, volume) {
        if (!tinyMidiPCM.soundfontPtr || !midiBytes || midiBytes.length === 0) {
            return;
        }
        stopPcm();
        activeMidiBytes = midiBytes instanceof Uint8Array ? midiBytes : new Uint8Array(midiBytes);
        loopSong = loop === 1;
        isRunning = true;
        midiPlayerSetVolume(0, volume);
        lastTime = window.audioContext.currentTime;
        flushInterval = setInterval(flush, flushTime);
        tinyMidiPCM.render(activeMidiBytes);
    }

    function midiPlayerStop() {
        isRunning = false;
        loopSong = false;
        activeMidiBytes = null;
        stopPcm();
    }

    function midiPlayerRunning() {
        return isRunning;
    }

    // --- signlink midi fields ---
    let midifade = 0;
    let midivol = DEFAULT_MIDIVOL;
    /** @type {'none' | 'stop' | 'voladjust' | 'play'} */
    let midiCmd = 'none';
    /** @type {Uint8Array | null} */
    let pendingMidi = null;
    let midiFadingIn = false;
    let midiFadingOut = false;
    let midiFadeVol = 0;

    /**
     * Java signlink.playMidi(path) — we hold bytes instead of path.
     */
    function signlinkPlayMidi() {
        if (midiFadingOut) {
            return;
        }
        if (!midiFadingIn && midifade !== 0 && midiPlayerRunning()) {
            midiFadingOut = true;
            midiFadeVol = midivol;
            return;
        }
        if (!pendingMidi) {
            return;
        }
        try {
            if (midifade !== 0 && midiFadingIn) {
                midiFadingOut = false;
                midiFadeVol = 0;
                midiPlayerPlay(pendingMidi, midifade, midiFadeVol);
            } else {
                midiPlayerPlay(pendingMidi, midifade, midivol);
            }
        } catch (e) {
            console.warn('[midi] play failed', e);
        }
    }

    /** Java signlink.audioLoop — 50ms */
    function audioLoop() {
        if (midiFadingIn) {
            midiFadeVol += 8;
            if (midiFadeVol > midivol) {
                midiFadeVol = midivol;
            }
            midiPlayerSetVolume(0, midiFadeVol);
            if (midiFadeVol === midivol) {
                midiFadingIn = false;
            }
        } else if (midiFadingOut) {
            midiFadeVol -= 8;
            if (midiFadeVol < 0) {
                midiFadeVol = 0;
            }
            midiPlayerSetVolume(0, midiFadeVol);
            if (midiFadeVol === 0) {
                midiFadingOut = false;
                midiFadingIn = true;
            }
        }

        if (midiCmd !== 'none') {
            if (midiCmd === 'stop') {
                midiPlayerStop();
            } else if (midiCmd === 'voladjust') {
                midiPlayerSetVolume(0, midivol);
            } else if (midiCmd === 'play') {
                signlinkPlayMidi();
            }
            if (!midiFadingOut) {
                midiCmd = 'none';
            }
        }
    }

    setInterval(audioLoop, AUDIO_LOOP_MS);

    // --- public API used by Client.ts (Java Client.saveMidi / stopMidi / setMidiVolume) ---

    /**
     * Java saveMidi(fade, data) after midisave → path → play.
     * @param {Uint8Array} data
     * @param {boolean} fading midifade 1 = song (loop+fade), 0 = jingle (once, no crossfade)
     */
    window._tinyMidiPlay = async (data, _volumeIgnored, fading) => {
        if (!data || data.length === 0) {
            return;
        }
        midifade = fading ? 1 : 0;
        pendingMidi = data instanceof Uint8Array ? data : new Uint8Array(data);
        midiCmd = 'play';
        // Process immediately so first frame does not wait 50ms
        audioLoop();
    };

    /** Java stopMidi */
    window._tinyMidiStop = async () => {
        midifade = 0;
        midiFadingIn = false;
        midiFadingOut = false;
        midiCmd = 'stop';
        audioLoop();
    };

    /**
     * Java setMidiVolume: always store midivol; voladjust only if applyNow.
     * @param {number} midivolJava 0..128 (not dB)
     * @param {boolean} [applyNow=true] false when music was muted (Java skips voladjust)
     */
    window._tinyMidiAdjustVolumeDb = (midivolJava, applyNow) => {
        midivol = midivolJava | 0;
        if (midivol < 0) midivol = 0;
        if (midivol > 128) midivol = 128;
        if (applyNow !== false) {
            midiCmd = 'voladjust';
            audioLoop();
        }
    };

    window._tinyMidiGetMidivol = () => midivol;
    window._tinyMidiGetSoundfontInfo = () =>
        tinyMidiPCM.soundfontPtr
            ? { name: 'SCC1_Florestan.sf2', ready: true }
            : { name: null, ready: false };

    /** Optional: replace bank (Decision 012 default is Florestan at boot). */
    window._tinyMidiSetSoundfont = async (buffer, name) => {
        const u8 = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
        tinyMidiPCM.setSoundfont(u8);
        console.info(`[midi] setSoundfont ${name || 'upload'} (${u8.byteLength} bytes)`);
        return { name: name || 'upload', bytes: u8.byteLength };
    };

    window._tinyMidiResetSoundfont = async () => {
        const ok = await loadXpSoundfont();
        return { ok };
    };

    console.info('[midi] Jagex 377 control plane ready (Florestan bank, midivol scale)');
})();

/**
 * @param {Uint8Array} data
 * @param {number} _volumeIgnored kept for call-site compatibility; midivol from setMidiVolume
 * @param {boolean} fade Java saveMidi fade → midifade
 */
export function playMidi(data, _volumeIgnored, fade) {
    if (window._tinyMidiPlay) {
        window._tinyMidiPlay(data, _volumeIgnored, fade);
    }
}

/**
 * @param {number} midivol 0..128 (Java signlink.midivol)
 * @param {boolean} [applyNow=true] Java only voladjust when already midiActive
 */
export function setMidiVolume(midivol, applyNow) {
    if (window._tinyMidiAdjustVolumeDb) {
        window._tinyMidiAdjustVolumeDb(midivol, applyNow);
    }
}

export function stopMidi(_fade) {
    if (window._tinyMidiStop) {
        window._tinyMidiStop();
    }
}
