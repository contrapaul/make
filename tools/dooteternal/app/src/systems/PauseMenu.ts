import { SENSITIVITY_RANGE, type Settings } from './SaveSystem';

/**
 * Pause menu and settings, plans.md §17. It doubles as the unlocked state: the
 * spec asks for the menu to open whenever pointer lock is lost, and ESC is how
 * browsers release pointer lock, so the two are the same screen.
 *
 * Every control applies live and reports the change so it can be saved.
 */
export interface PauseMenuHandlers {
  onResume(): void;
  onRestart(): void;
  onReturnToMap(): void;
  onSettingsChanged(): void;
}

export class PauseMenu {
  private readonly root: HTMLDivElement;
  private readonly soundtrack: HTMLInputElement;
  private readonly sfxVolume: HTMLInputElement;
  private readonly sensitivity: HTMLInputElement;
  private readonly sfxValue: HTMLSpanElement;
  private readonly sensitivityValue: HTMLSpanElement;

  constructor(
    private readonly settings: Settings,
    handlers: PauseMenuHandlers,
  ) {
    this.root = document.querySelector<HTMLDivElement>('#pause')!;
    this.soundtrack = document.querySelector<HTMLInputElement>('#set-soundtrack')!;
    this.sfxVolume = document.querySelector<HTMLInputElement>('#set-sfx')!;
    this.sensitivity = document.querySelector<HTMLInputElement>('#set-sensitivity')!;
    this.sfxValue = document.querySelector<HTMLSpanElement>('#set-sfx-value')!;
    this.sensitivityValue = document.querySelector<HTMLSpanElement>('#set-sensitivity-value')!;

    this.sensitivity.min = String(SENSITIVITY_RANGE.min);
    this.sensitivity.max = String(SENSITIVITY_RANGE.max);

    this.soundtrack.addEventListener('change', () => {
      this.settings.soundtrackEnabled = this.soundtrack.checked;
      handlers.onSettingsChanged();
    });

    this.sfxVolume.addEventListener('input', () => {
      this.settings.sfxVolume = Number(this.sfxVolume.value) / 100;
      this.showValues();
      handlers.onSettingsChanged();
    });

    this.sensitivity.addEventListener('input', () => {
      this.settings.mouseSensitivity = Number(this.sensitivity.value);
      this.showValues();
      handlers.onSettingsChanged();
    });

    document.querySelector<HTMLButtonElement>('#pause-resume')!.addEventListener('click', handlers.onResume);
    document.querySelector<HTMLButtonElement>('#pause-restart')!.addEventListener('click', handlers.onRestart);
    document.querySelector<HTMLButtonElement>('#pause-map')!.addEventListener('click', handlers.onReturnToMap);
  }

  get visible(): boolean {
    return !this.root.hidden;
  }

  show(): void {
    this.syncFromSettings();
    this.root.hidden = false;
  }

  hide(): void {
    this.root.hidden = true;
  }

  private syncFromSettings(): void {
    this.soundtrack.checked = this.settings.soundtrackEnabled;
    this.sfxVolume.value = String(Math.round(this.settings.sfxVolume * 100));
    this.sensitivity.value = String(this.settings.mouseSensitivity);
    this.showValues();
  }

  private showValues(): void {
    this.sfxValue.textContent = `${Math.round(this.settings.sfxVolume * 100)}%`;
    this.sensitivityValue.textContent = `${this.settings.mouseSensitivity.toFixed(2)}x`;
  }
}
