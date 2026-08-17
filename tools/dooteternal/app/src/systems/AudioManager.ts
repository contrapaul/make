import { asset } from '../core/paths';
import type { Settings } from './SaveSystem';

/**
 * What the weapons need from audio. WeaponSystem depends on this interface, not
 * on AudioManager, so firing logic stays verifiable outside a browser.
 */
export interface AudioSink {
  /** plans.md `audioMode: "random"` — one of the set, chosen per shot. */
  playOneOf(files: string[]): void;
  /** plans.md `audioMode: "sequence"` — a specific file, in caller order. */
  playOne(file: string): void;
  /** plans.md `audioMode: "loop_restart_on_new_burst"` — restarts if already running. */
  startLoop(id: string, file: string): void;
  stopLoop(id: string, fadeSeconds: number): void;
}

export const SOUNDTRACK_FILE = 'audio/soundtrack/music_hell_loop.ogg';
export const BREATH_LOOP_ID = 'breath_recharge';
export const BREATH_LOOP_FILE = 'audio/sfx/breath_recharge.ogg';

/**
 * Web Audio playback for the files listed in app/assets/audio/MANIFEST.md.
 *
 * None of those files exist yet, so every miss is reported once and then treated
 * as silence: an incomplete asset set never throws and never spams the console.
 * Real files dropped in at those paths start working with no code change.
 *
 * Effects and music run through separate buses, which is what lets the SFX
 * slider and the soundtrack toggle in §17 act independently and take effect live.
 */
export class AudioManager implements AudioSink {
  private context: AudioContext | null = null;
  private sfxBus: GainNode | null = null;
  private musicBus: GainNode | null = null;
  private soundtrack: AudioBufferSourceNode | null = null;

  private readonly buffers = new Map<string, AudioBuffer | null>();
  private readonly pending = new Set<string>();
  private readonly reported = new Set<string>();
  private readonly loops = new Map<string, { source: AudioBufferSourceNode; gain: GainNode }>();

  constructor(private settings: Settings) {}

  /**
   * Browsers refuse to start an AudioContext without a gesture, so this is
   * called from the same click that grabs pointer lock.
   */
  unlock(): void {
    if (!this.context) {
      this.context = new AudioContext();

      this.sfxBus = this.context.createGain();
      this.sfxBus.gain.value = this.settings.sfxVolume;
      this.sfxBus.connect(this.context.destination);

      this.musicBus = this.context.createGain();
      this.musicBus.gain.value = this.settings.soundtrackEnabled ? 1 : 0;
      this.musicBus.connect(this.context.destination);
    }

    if (this.context.state === 'suspended') void this.context.resume();
    this.applySettings(this.settings);
  }

  /** Called whenever a slider or toggle moves, so changes are heard at once. */
  applySettings(settings: Settings): void {
    this.settings = settings;

    if (this.sfxBus) this.sfxBus.gain.value = settings.sfxVolume;
    if (this.musicBus) this.musicBus.gain.value = settings.soundtrackEnabled ? 1 : 0;

    if (settings.soundtrackEnabled) this.startSoundtrack();
    else this.stopSoundtrack();
  }

  startSoundtrack(): void {
    if (this.soundtrack || !this.context || !this.musicBus) return;

    const buffer = this.buffer(SOUNDTRACK_FILE);
    if (!buffer) return;

    const source = this.context.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    source.connect(this.musicBus);
    source.start();

    this.soundtrack = source;
  }

  stopSoundtrack(): void {
    this.soundtrack?.stop();
    this.soundtrack = null;
  }

  playOneOf(files: string[]): void {
    if (files.length === 0) return;
    this.playOne(files[Math.floor(Math.random() * files.length)]!);
  }

  playOne(file: string): void {
    const buffer = this.buffer(file);
    if (!buffer || !this.context || !this.sfxBus) return;

    const source = this.context.createBufferSource();
    source.buffer = buffer;
    source.connect(this.sfxBus);
    source.start();
  }

  startLoop(id: string, file: string): void {
    this.stopLoop(id, 0);

    const buffer = this.buffer(file);
    if (!buffer || !this.context || !this.sfxBus) return;

    const gain = this.context.createGain();
    gain.connect(this.sfxBus);

    const source = this.context.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    source.connect(gain);
    source.start();

    this.loops.set(id, { source, gain });
  }

  stopLoop(id: string, fadeSeconds: number): void {
    const loop = this.loops.get(id);
    if (!loop || !this.context) return;

    this.loops.delete(id);

    if (fadeSeconds <= 0) {
      loop.source.stop();
      return;
    }

    // Ramp rather than cut, or the loop ends on a click.
    const now = this.context.currentTime;
    loop.gain.gain.setValueAtTime(loop.gain.gain.value, now);
    loop.gain.gain.linearRampToValueAtTime(0, now + fadeSeconds);
    loop.source.stop(now + fadeSeconds);
  }

  /** Cached buffer, or null while loading or when the file isn't there. */
  private buffer(file: string): AudioBuffer | null {
    const cached = this.buffers.get(file);
    if (cached !== undefined) return cached;

    if (!this.pending.has(file)) {
      this.pending.add(file);
      void this.load(file);
    }

    return null;
  }

  private async load(file: string): Promise<void> {
    if (!this.context) return;

    try {
      const response = await fetch(asset(file));
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const decoded = await this.context.decodeAudioData(await response.arrayBuffer());
      this.buffers.set(file, decoded);

      // The soundtrack may have been asked for before it finished loading.
      if (file === SOUNDTRACK_FILE && this.settings.soundtrackEnabled) this.startSoundtrack();
    } catch {
      this.buffers.set(file, null);
      if (!this.reported.has(file)) {
        this.reported.add(file);
        console.info(`[audio] missing, playing silent: ${file} — see app/assets/audio/MANIFEST.md`);
      }
    } finally {
      this.pending.delete(file);
    }
  }
}
