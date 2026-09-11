/**
 * v100 — Quantization levels (Tab 3 control + Tab 2 explainer cards)
 * ===================================================================
 * Blueprint §3.3. Each level carries a student-facing explainer covering:
 * what precision means → bytes/param → size vs speed vs quality trade-off →
 * why quantization is the lever that makes models fit (or not).
 *
 * `bytesPerParam` drives weightsGB in engine/perf.js — keep values honest to
 * real GGUF/AWQ block sizes, not marketing numbers.
 */

export const QUANT_DATA_AS_OF = '2026-09-01'; // Static knowledge; no external source needed

/** KV-cache element size (bytes) assumed per level. Blueprint §5: FP16 KV default for all levels; Q8_0 KV noted as a future option. */
const KV_BYTES_DEFAULT = 2;

export const QUANT_LEVELS = [
  {
    id: 'fp16',
    name: 'FP16 / BF16',
    bytesPerParam: 2.0,
    kvBytesPerElement: KV_BYTES_DEFAULT,
    qualityLabel: 'The model exactly as it was built',
    explainer: {
      whatItIs:
        'No compression at all. Every number in the model is stored using 16 bits, which is how it was stored when the model was built and tested.',
      tradeOff:
        'This gives the largest file and the slowest reading speed, and in exchange it loses nothing. Every other setting on this list is measured against it.',
      whyItMatters:
        'If a model fits at this setting, you are getting exactly the behaviour its makers intended. That is worth having when the model is small enough that size was never going to be a problem, such as a 4 billion parameter model on a 32 GB machine.',
    },
  },
  {
    id: 'int8-awq',
    name: 'INT8 / AWQ',
    bytesPerParam: 1.05, // ~8 bits + per-channel scales/zero-points overhead
    kvBytesPerElement: KV_BYTES_DEFAULT,
    qualityLabel: 'Almost the same answers, half the size',
    explainer: {
      whatItIs:
        'Each number is rounded to 8 bits instead of 16, which roughly halves the file. Small correction tables are stored alongside to limit the damage, and one method, called AWQ, keeps the numbers it judges most important at higher precision.',
      tradeOff:
        'You get half the memory use and roughly double the writing speed, and for everyday tasks the answers stay very close to full precision. Difficult reasoning can still slip a little.',
      whyItMatters:
        'A good choice when you have reasonable graphics card memory but want to leave room for a long conversation. Shrinking the weights leaves space for the conversation store to grow into.',
    },
  },
  {
    id: 'q6_k',
    name: 'Q6_K (GGUF)',
    bytesPerParam: 0.75, // ~6 bits/param in K-quants block layout
    kvBytesPerElement: KV_BYTES_DEFAULT,
    qualityLabel: 'A small drop on difficult questions',
    explainer: {
      whatItIs:
        'Six bits per number, stored in the GGUF file format used by most software for running models at home. Rather than shrinking each number on its own, it stores them in small groups that share a scaling factor, which packs them more tightly for the same accuracy.',
      tradeOff:
        'About a quarter smaller than the 8-bit setting, for a modest cost. What suffers is difficult reasoning and long multi-step tasks, not ordinary conversation.',
      whyItMatters:
        'Choose this when you want the best quality that will still fit. A 70 billion parameter model at this setting needs about 52 GB, which is the largest sensible choice for a machine with 48 to 64 GB.',
    },
  },
  {
    id: 'q5_k_m',
    name: 'Q5_K_M (GGUF)',
    bytesPerParam: 0.63, // ~5 bits/param + medium block overhead
    kvBytesPerElement: KV_BYTES_DEFAULT,
    qualityLabel: 'The usual compromise',
    explainer: {
      whatItIs:
        'Five bits per number, using a mix of finer and coarser groups so that accuracy is kept where it matters most. The M in the name stands for medium, which refers to that mix.',
      tradeOff:
        'Noticeably smaller than the 6-bit setting while staying close to full quality on most tasks. It is what most people reach for when a model is only slightly too big at a higher setting.',
      whyItMatters:
        'This is often the setting that turns a model which will not fit into one that fits with room to spare. Watch the memory bar in the Hardware Lab as you switch between settings.',
    },
  },
  {
    id: 'q4_k_m',
    name: 'Q4_K_M (GGUF)',
    bytesPerParam: 0.55, // ~4.5 bits/param effective incl. block scales — the community default
    kvBytesPerElement: KV_BYTES_DEFAULT,
    qualityLabel: 'Fits far more, gives up a little accuracy',
    explainer: {
      whatItIs:
        'The setting most people use for running models at home. Each number is packed into roughly 4 to 5 bits, again in small groups that share a scaling factor.',
      tradeOff:
        'A quarter of the size of the uncompressed model, and faster in proportion. The quality cost is real but usually acceptable. Creative writing and casual conversation hold up well, while exact reasoning and code can slip.',
      whyItMatters:
        'This setting is the only reason 70 billion parameter models can run on hardware an ordinary person owns. Without it, a large model on a single graphics card would not be possible.',
    },
  },
];

/** Convenience lookup used by engine + UI. */
export const QUANT_BY_ID = Object.fromEntries(QUANT_LEVELS.map((q) => [q.id, q]));
