import { asset } from '../core/paths';

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

/**
 * Web Audio playback for the files listed in app/assets/audio/MANIFEST.md.
 *
 * None of those files exist yet, so every miss is reported once and then treated
 * as silence: an incomplete asset set never throws and never spams the console.
 * Real files dropped in at those paths start working with no code change.
 */
export class AudioManager implements AudioSink {
  sfxVolume = 0.8;

  private context: AudioContext | null = null;
  private readonly buffers = new Map<string, AudioBuffer | null>();
  private readonly pending = new Set<string>();
  private readonly reported = new Set<string>();
  private readonly loops = new Map<string, { source: AudioBufferSourceNode; gain: GainNode }>();

  /**
   * Browsers refuse to start an AudioContext without a gesture, so this is
   * called from the same click that grabs pointer lock.
   */
  unlock(): void {
    if (!this.context) this.context = new AudioContext();
    if (this.context.state === 'suspended') void this.context.resume();
  }

  playOneOf(files: string[]): void {
    if (files.length === 0) return;
    this.playOne(files[Math.floor(Math.random() * files.length)]!);
  }

  playOne(file: string): void {
    const buffer = this.buffer(file);
    if (!buffer || !this.context) return;

    const gain = this.context.createGain();
    gain.gain.value = this.sfxVolume;
    gain.connect(this.context.destination);

    const source = this.context.createBufferSource();
    source.buffer = buffer;
    source.connect(gain);
    source.start();
  }

  startLoop(id: string, file: string): void {
    this.stopLoop(id, 0);

    const buffer = this.buffer(file);
    if (!buffer || !this.context) return;

    const gain = this.context.createGain();
    gain.gain.value = this.sfxVolume;
    gain.connect(this.context.destination);

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
