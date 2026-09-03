/**
 * v100 — Model slider stops (Tab 3 control)
 * ==========================================
 * Blueprint §3.2: each stop is anchored to a real model whose architecture
 * metadata (layers, KV heads, head dim) drives the KV-cache formula in
 * engine/perf.js:
 *
 *   kvCacheGB = 2 × layers × kvHeads × headDim × ctxTokens × dtypeBytes / 1e9
 *
 * Stops marked `representative: true` have no single anchor model — their
 * metadata is an interpolation between neighboring anchors and MUST be shown
 * as "representative" in the UI (blueprint §3.2).
 */

export const MODELS_DATA_AS_OF = '2026-09-01';

/**
 * @typedef {Object} ModelStop
 * @property {number} paramsB        Parameter count in billions (drives weightsGB + prefill FLOPs).
 * @property {string} label          Display label on the slider.
 * @property {?{name:string, layers:number, kvHeads:number, headDim:number}} anchor
 * @property {boolean} representative True when metadata is interpolated, not from one real model.
 * @property {string[]} sources      Source ids into MODEL_SOURCES.
 */

export const MODEL_STOPS = [
  {
    paramsB: 4, label: '4B', representative: false,
    anchor: { name: 'Qwen3-4B', layers: 36, kvHeads: 8, headDim: 128 },
    sources: ['M1'],
  },
  {
    paramsB: 8, label: '8B', representative: false,
    anchor: { name: 'Llama 3.1 8B', layers: 32, kvHeads: 8, headDim: 128 },
    sources: ['M5'],
  },
  {
    paramsB: 12, label: '12B', representative: false,
    anchor: { name: 'Gemma 3 12B', layers: 48, kvHeads: 8, headDim: 256 },
    sources: ['M2'],
  },
  {
    paramsB: 14, label: '14B', representative: false,
    anchor: { name: 'Qwen3-14B', layers: 40, kvHeads: 8, headDim: 128 },
    sources: ['M3'],
  },
  {
    paramsB: 16, label: '16B', representative: true, // Interpolated between Qwen3-14B and Gemma 3 27B anchors
    anchor: { name: 'Representative (no single anchor)', layers: 50, kvHeads: 8, headDim: 128 },
    sources: [],
  },
  {
    paramsB: 27, label: '27B', representative: false,
    anchor: { name: 'Gemma 3 27B', layers: 62, kvHeads: 16, headDim: 128 },
    sources: ['M4'],
  },
  {
    paramsB: 32, label: '32B', representative: false,
    anchor: { name: 'Qwen3-32B', layers: 64, kvHeads: 8, headDim: 128 },
    sources: ['M6'],
  },
  {
    paramsB: 70, label: '70B', representative: false,
    anchor: { name: 'Llama 3.3 70B', layers: 80, kvHeads: 8, headDim: 128 },
    sources: ['M5'],
  },
  {
    paramsB: 80, label: '80B', representative: true, // Interpolated between Llama 3.3 70B and Llama 3.1 405B anchors
    anchor: { name: 'Representative (no single anchor)', layers: 96, kvHeads: 8, headDim: 128 },
    sources: [],
  },
  {
    paramsB: 405, label: '405B', representative: false,
    anchor: { name: 'Llama 3.1 405B', layers: 126, kvHeads: 8, headDim: 128 },
    sources: ['M5'],
  },
];

export const MODEL_SOURCES = [
  { id: 'M1', label: 'Qwen3-4B config.json (HF): 36 layers, GQA 8 KV heads, head dim 128', url: 'https://huggingface.co/Qwen/Qwen3-4B/blob/main/config.json' },
  { id: 'M2', label: 'Gemma 3 12B config (google/gemma_pytorch get_config_for_12b): 48 layers, GQA 8 KV heads, head dim 256', url: 'https://github.com/google/gemma_pytorch/blob/main/gemma/config.py' },
  { id: 'M3', label: 'Qwen3-14B config.json (HF): 40 layers, GQA 8 KV heads, head dim 128', url: 'https://huggingface.co/Qwen/Qwen3-14B/blob/main/config.json' },
  { id: 'M4', label: 'Gemma 3 27B config (google/gemma_pytorch get_config_for_27b_v3; matches HF fp8 mirror): 62 layers, GQA 16 KV heads, head dim 128', url: 'https://github.com/google/gemma_pytorch/blob/main/gemma/config.py' },
  { id: 'M5', label: 'Llama 3.1/3.3 architecture (Meta): 8B: 32 layers; 70B: 80 layers; 405B: 126 layers; all GQA 8 KV heads, head dim 128', url: 'https://ai.meta.com/research/publications/llama-3-model-card/' },
  { id: 'M6', label: 'Qwen3-32B config.json (HF): 64 layers, GQA 8 KV heads, head dim 128', url: 'https://huggingface.co/Qwen/Qwen3-32B/blob/main/config.json' },
];
