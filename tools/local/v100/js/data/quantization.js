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
    qualityLabel: 'Reference quality: the model as trained',
    explainer: {
      whatItIs:
        'Full precision. Every weight is stored as a 16-bit floating-point number, exactly how the model was trained and evaluated.',
      tradeOff:
        'Biggest files and slowest to move through memory, but zero quality loss from compression. This is the baseline every other level is measured against.',
      whyItMatters:
        'If a model fits at FP16, you get its full intended behavior, useful for benchmarking and for models small enough that size never matters (think 4B on a 32 GB machine).',
    },
  },
  {
    id: 'int8-awq',
    name: 'INT8 / AWQ',
    bytesPerParam: 1.05, // ~8 bits + per-channel scales/zero-points overhead
    kvBytesPerElement: KV_BYTES_DEFAULT,
    qualityLabel: 'Near-identical answers for most tasks',
    explainer: {
      whatItIs:
        'Weights rounded to 8-bit integers with small correction tables (AWQ keeps the "important" weights at higher precision). Roughly halves the file size of FP16.',
      tradeOff:
        'You get about half the memory footprint and roughly double the decode speed, while quality stays very close to full precision on most everyday tasks. Hard reasoning can still show small dips.',
      whyItMatters:
        'The sweet spot when you have decent VRAM but want headroom for a long context window, the KV cache gets room to grow because weights got smaller.',
    },
  },
  {
    id: 'q6_k',
    name: 'Q6_K (GGUF)',
    bytesPerParam: 0.75, // ~6 bits/param in K-quants block layout
    kvBytesPerElement: KV_BYTES_DEFAULT,
    qualityLabel: 'Small dip on hard reasoning',
    explainer: {
      whatItIs:
        'A GGUF "K-quant" at 6 bits per weight. The K-format stores groups of weights with shared scales, so it compresses better than a naive 6-bit scheme.',
      tradeOff:
        'About 25% smaller than INT8 with only a modest quality cost, the dip mostly shows up on hard reasoning and long multi-step tasks rather than everyday chat.',
      whyItMatters:
        'The pick when you want maximum quality that still fits: e.g. a 70B model at Q6_K (~52 GB) is the largest sensible size for a 48–64 GB machine.',
    },
  },
  {
    id: 'q5_k_m',
    name: 'Q5_K_M (GGUF)',
    bytesPerParam: 0.63, // ~5 bits/param + medium block overhead
    kvBytesPerElement: KV_BYTES_DEFAULT,
    qualityLabel: 'The balance pick',
    explainer: {
      whatItIs:
        'A 5-bit K-quant with "medium" block granularity, a mix of finer and coarser quantized blocks that keeps accuracy high where it counts.',
      tradeOff:
        'Noticeably smaller than Q6_K, still very close to full quality for most tasks. The community default when a model is *just* too big at higher precision.',
      whyItMatters:
        'This is often the level that turns "doesn\'t fit" into "fits with room for context"; watch the memory bar in the Lab as you switch levels.',
    },
  },
  {
    id: 'q4_k_m',
    name: 'Q4_K_M (GGUF)',
    bytesPerParam: 0.55, // ~4.5 bits/param effective incl. block scales — the community default
    kvBytesPerElement: KV_BYTES_DEFAULT,
    qualityLabel: 'Fits more, slightly dumber',
    explainer: {
      whatItIs:
        'The most popular GGUF quantization in the local-AI world. Weights are packed to roughly 4–5 bits using K-quant blocks with per-group scales.',
      tradeOff:
        'About half the size of FP16 and proportionally faster, at a real but usually acceptable quality cost, creative writing and casual chat hold up well; precise reasoning and code can slip.',
      whyItMatters:
        'Q4_K_M is what makes 70B-class models runnable on consumer hardware at all. It\'s the reason "big model on one GPU" exists in the first place.',
    },
  },
];

/** Convenience lookup used by engine + UI. */
export const QUANT_BY_ID = Object.fromEntries(QUANT_LEVELS.map((q) => [q.id, q]));
