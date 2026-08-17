import * as THREE from 'three';
import { asset } from './paths';
import { IMAGE_ASSETS, type ImageAsset } from './ImageManifest';

/**
 * Loads the optional images catalogued in ImageManifest.
 *
 * Files are probed once at startup. Whatever is present wins; whatever is absent
 * keeps its procedural stand-in, so a half-finished art set still runs. Nothing
 * here changes how anything is drawn — call sites ask for an image and fall back.
 *
 * A 404 in the network tab for a file you haven't made yet is expected.
 */
const BY_PATH = new Map<string, ImageAsset>(IMAGE_ASSETS.map((entry) => [entry.path, entry] as const));
const textures = new Map<string, THREE.Texture>();

export interface PreloadReport {
  loaded: string[];
  missing: string[];
}

/**
 * Probes every optional image once. Resolves when all have either loaded or
 * failed, so the first frame already shows whatever art exists.
 */
export async function preloadImages(): Promise<PreloadReport> {
  const report: PreloadReport = { loaded: [], missing: [] };

  await Promise.all(
    IMAGE_ASSETS.map(async (entry) => {
      try {
        const response = await fetch(asset(entry.path));
        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const bitmap = await createImageBitmap(await response.blob());
        const texture = new THREE.Texture(bitmap);
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.needsUpdate = true;

        if (entry.tiling) {
          texture.wrapS = THREE.RepeatWrapping;
          texture.wrapT = THREE.RepeatWrapping;
        }

        textures.set(entry.path, texture);
        report.loaded.push(entry.path);
      } catch {
        report.missing.push(entry.path);
      }
    }),
  );

  if (report.loaded.length > 0) {
    console.info(`[art] ${report.loaded.length} image(s) loaded, ${report.missing.length} still procedural`);
  }

  return report;
}

/** The loaded texture for a path, or null when the file isn't there. */
export function image(path: string): THREE.Texture | null {
  return textures.get(path) ?? null;
}

/**
 * One frame of a sheet, as its own texture sharing the same image. Row 0 is the
 * top row of the file; frame 0 is its left-most column.
 */
export function sheetFrame(path: string, row: number, column = 0): THREE.Texture | null {
  const source = textures.get(path);
  const sheet = BY_PATH.get(path)?.sheet;
  if (!source || !sheet) return null;

  const frame = source.clone();
  frame.repeat.set(1 / sheet.columns, 1 / sheet.rows);
  // Texture V runs bottom-up, so row 0 sits at the top of the image.
  frame.offset.set(column / sheet.columns, 1 - (row + 1) / sheet.rows);
  frame.needsUpdate = true;

  return frame;
}
