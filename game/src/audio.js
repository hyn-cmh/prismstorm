// All of PRISMSTORM's sound is synthesized with WebAudio: no audio files.
// Short oscillator-and-noise blips make the effects, and a small step
// sequencer loops a bass line, an arpeggio and a drum pattern as music.
// The context is created only on the first user gesture (unlock), so the
// game never plays sound a browser would block, and M mutes everything.

const MUSIC_BPM = 112;
const STEP_SECONDS = 60 / MUSIC_BPM / 2; // eighth notes
// A minor synthwave loop, two bars of eighth notes. Frequencies in Hz;
// 0 is a rest. The bass walks A F C G, the arp sparkles above it.
const BASS_LINE = [55, 0, 55, 55, 0, 55, 0, 65.41, 55, 0, 55, 55, 0, 82.41, 0, 73.42,
  43.65, 0, 43.65, 43.65, 0, 43.65, 0, 55, 43.65, 0, 43.65, 43.65, 0, 65.41, 0, 55];
const ARP_NOTES = [220, 261.63, 329.63, 440, 349.23, 440, 523.25, 659.25,
  174.61, 220, 261.63, 349.23, 196, 246.94, 329.63, 392];

export function createAudio() {
  let context = null;
  let master = null;
  let musicGain = null;
  let noiseBuffer = null;
  let muted = false;
  let musicTimer = null;
  let nextStepTime = 0;
  let stepIndex = 0;

  function unlock() {
    if (context) {
      if (context.state === 'suspended') context.resume();
      return;
    }
    const AudioCtor = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtor) return;
    context = new AudioCtor();
    master = context.createGain();
    master.gain.value = muted ? 0 : 0.5;
    master.connect(context.destination);
    musicGain = context.createGain();
    musicGain.gain.value = 0.34;
    musicGain.connect(master);
    noiseBuffer = context.createBuffer(1, context.sampleRate * 0.5, context.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;
    startMusic();
  }

  function tone({ freq, end = null, type = 'square', dur = 0.12, vol = 0.2, dest = null, delay = 0 }) {
    if (!context) return;
    const t0 = context.currentTime + delay;
    const osc = context.createOscillator();
    const gain = context.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (end !== null) osc.frequency.exponentialRampToValueAtTime(Math.max(1, end), t0 + dur);
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    osc.connect(gain).connect(dest ?? master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  function noise({ dur = 0.2, vol = 0.3, freq = 1200, delay = 0 }) {
    if (!context) return;
    const t0 = context.currentTime + delay;
    const source = context.createBufferSource();
    source.buffer = noiseBuffer;
    source.loop = true;
    const filter = context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(freq, t0);
    filter.frequency.exponentialRampToValueAtTime(80, t0 + dur);
    const gain = context.createGain();
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    source.connect(filter).connect(gain).connect(master);
    source.start(t0);
    source.stop(t0 + dur + 0.02);
  }

  function scheduleStep(step, t0) {
    const delay = Math.max(0, t0 - context.currentTime);
    const bass = BASS_LINE[step % BASS_LINE.length];
    if (bass) tone({ freq: bass, type: 'sawtooth', dur: 0.16, vol: 0.16, dest: musicGain, delay });
    const arp = ARP_NOTES[step % ARP_NOTES.length];
    if (step % 2 === 0 && arp) tone({ freq: arp * 2, type: 'triangle', dur: 0.09, vol: 0.05, dest: musicGain, delay });
    if (step % 4 === 0) tone({ freq: 120, end: 40, type: 'sine', dur: 0.12, vol: 0.5, dest: musicGain, delay });
    if (step % 4 === 2) noise({ dur: 0.03, vol: 0.05, freq: 6000, delay });
  }

  function startMusic() {
    if (musicTimer !== null) return;
    nextStepTime = context.currentTime + 0.06;
    stepIndex = 0;
    musicTimer = setInterval(() => {
      if (!context) return;
      while (nextStepTime < context.currentTime + 0.18) {
        scheduleStep(stepIndex, nextStepTime);
        nextStepTime += STEP_SECONDS;
        stepIndex += 1;
      }
    }, 42);
  }

  return {
    unlock,
    get muted() {
      return muted;
    },
    toggleMute() {
      muted = !muted;
      if (master && context) master.gain.setTargetAtTime(muted ? 0 : 0.5, context.currentTime, 0.02);
      return muted;
    },
    shoot() {
      tone({ freq: 880, end: 220, type: 'square', dur: 0.07, vol: 0.055 });
    },
    hit() {
      tone({ freq: 300, end: 160, type: 'triangle', dur: 0.05, vol: 0.07 });
    },
    explode(big = false) {
      noise({ dur: big ? 0.42 : 0.2, vol: big ? 0.4 : 0.2, freq: big ? 900 : 1400 });
      tone({ freq: big ? 160 : 220, end: 40, type: 'sine', dur: big ? 0.35 : 0.18, vol: 0.25 });
    },
    pickup(combo = 0) {
      tone({ freq: 660 + Math.min(combo, 12) * 40, end: 990 + Math.min(combo, 12) * 40, type: 'sine', dur: 0.08, vol: 0.09 });
    },
    dash() {
      noise({ dur: 0.16, vol: 0.12, freq: 3000 });
    },
    hurt() {
      tone({ freq: 200, end: 60, type: 'sawtooth', dur: 0.22, vol: 0.3 });
      noise({ dur: 0.18, vol: 0.2, freq: 700 });
    },
    levelup() {
      [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => {
        tone({ freq, type: 'triangle', dur: 0.16, vol: 0.16, delay: i * 0.07 });
      });
    },
    choose() {
      tone({ freq: 740, type: 'triangle', dur: 0.1, vol: 0.14 });
      tone({ freq: 1108, type: 'triangle', dur: 0.14, vol: 0.12, delay: 0.06 });
    },
    gameOver() {
      [392, 329.63, 261.63, 196].forEach((freq, i) => {
        tone({ freq, type: 'sawtooth', dur: 0.3, vol: 0.14, delay: i * 0.16 });
      });
      noise({ dur: 0.7, vol: 0.25, freq: 500 });
    },
    waveHorn() {
      tone({ freq: 130.81, type: 'sawtooth', dur: 0.28, vol: 0.16 });
      tone({ freq: 196, type: 'sawtooth', dur: 0.28, vol: 0.12, delay: 0.02 });
    },
  };
}
