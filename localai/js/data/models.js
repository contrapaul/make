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
    // paramsB is TOTAL parameters, because that is what occupies memory.
    // Gemma 4 E4B is 8B total with embeddings; the "E4B" name refers to its
    // 4.5B *effective* (compute) parameters under per-layer embeddings. The
    // engine's prefill FLOPs therefore run slightly pessimistic for this stop.
    paramsB: 8, label: '8B', representative: false,
    anchor: {
      name: 'Gemma 4 E4B', layers: 42, kvHeads: 2, headDim: 256,
      kvLayers: 7, slidingLayers: 35, slidingWindow: 512,
    },
    sources: ['M7'],
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
    paramsB: 16, label: '16B', representative: true, // Interpolated between Qwen3-14B and Qwen3.8-27B anchors
    anchor: { name: 'Representative (no single anchor)', layers: 50, kvHeads: 8, headDim: 128 },
    sources: [],
  },
  {
    // 64 layers, but only the 16 Gated Attention layers hold a KV cache that
    // grows with the context; the 48 Gated DeltaNet layers keep a fixed-size
    // state instead. That is why this 27B model caches far less than the 12B
    // full-attention stop below it.
    paramsB: 27, label: '27B', representative: false,
    anchor: {
      name: 'Qwen3.8-27B', layers: 64, kvHeads: 4, headDim: 256,
      kvLayers: 16, slidingLayers: 0,
    },
    sources: ['M8'],
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
  { id: 'M5', label: 'Llama 3.1/3.3 architecture (Meta): 70B: 80 layers; 405B: 126 layers; all GQA 8 KV heads, head dim 128', url: 'https://ai.meta.com/research/publications/llama-3-model-card/' },
  { id: 'M6', label: 'Qwen3-32B config.json (HF): 64 layers, GQA 8 KV heads, head dim 128', url: 'https://huggingface.co/Qwen/Qwen3-32B/blob/main/config.json' },
  { id: 'M7', label: 'Gemma 4 E4B config.json + model card (HF): 42 layers, 2 KV heads, head dim 256, sliding window 512; layer_types gives 7 global layers (6, 12, 18, 24, 30, 36, 42 — the card notes the final layer is always global) and 35 sliding; 4.5B effective / 8B total parameters', url: 'https://huggingface.co/google/gemma-4-E4B' },
  { id: 'M8', label: 'Qwen3.8-27B config.json + model card (HF): 64 layers as 16 × (3 × Gated DeltaNet → 1 × Gated Attention); the 16 Gated Attention layers use 4 KV heads at head dim 256, so only they hold a context-growing KV cache', url: 'https://huggingface.co/Qwen/Qwen3.8-27B' },
];
