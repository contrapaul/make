# v100 — Interactive "How Local AI Works" Page: Context Questions

Answer these to shape the build. Short answers are fine; mark anything you'd like me to decide with "your call."

## 1. Audience & Purpose

1. Who is this page primarily for? This page is for high school students and educators.
2. What should a visitor *do* or *understand* after using the page? Visitors should come away with an understanding of how local AI is run and how hardware plays a key factor. 
3. Is this for personal use, a portfolio piece, documentation for a project, or something you plan to publish/share publicly? This is a project I'll host on my website for students and teachers to explore.

## 2. Scope of "How Local AI Models Work"

4. Which parts of the pipeline should be visualized? (pick any)
   - Tokenization / prompt processing
   - Model loading into RAM/VRAM
   - Inference loop: prefill vs. token-by-token generation
   - KV cache and context window growth
   - Sampling controls (temperature, top-p, etc.)
   - Quantization and its effect on size/speed/quality

   Note: All of the above are good for exploration, but don't need equal space. 

5. How technical should it be? Conceptual animation with plain language, or real numbers (tokens/sec, GB used, ms per token) alongside the visuals?

"Real numbers" are to be used, or at least representative/predictive numbers. Much is at play and 2 users with near identical builds may end up with different performance, but the site should feel "real" enough to pass muster with seasoned local AI enthusiasts.

6. Should the page show the full stack — hardware → runtime (llama.cpp/Ollama/LM Studio) → model → output — or focus only on the model itself?

Runtime is less important here, but we need to see the interaction of hardware and model and output. 

## 3. Hardware Configuration Toggles

7. Which hardware presets should be included as toggles? All in one configs: Macbook Air 16gb, Macbook M4 Pro 48GB, DGX Spark 128GB. GPU configs 1x 2x and 4x of the following gpus: V100 SMX2 PCIe 16gb, RTX 3060 12GB, RTX 3090 24GB, RX9070XT 16GB, RTX 5070ti 16GB, RTX5090 32GB, RTX6000 48GB. Memory configs: DDR4-3200 and DDR5-6000 share capacity figures up to 128GB: 16gb, 32gb, 48gb, 64gb, 128gb. DDR5 gets 192gb and 256gb as well. We can leave off CPU unless you feel it makes enough of a difference for partial GPU offloads. 

8. Should users also be able to enter *custom* specs or are fixed presets enough? There is enough mixing and matching that we don't need to let users add custom specs.

9. What should visibly change when a hardware preset is toggled? (e.g., tokens/sec estimate, max model size that fits, time-to-first-token, power draw) Animated visual representation of tokens/sec changes if currently running. Max model size, time to first token, and power draw are all updated as printouts on the right side of the screen. 

## 4. Modifiers / Interactive Controls

10. Which knobs do you want users to turn? (pick any)
    - Model size slider (7B → 70B → 405B+)
    - Quantization level (FP16 / INT8 / INT4 / GGUF Q4_K_M, etc.)
    - Context window length
    - Prompt length vs. generation length
    - Batch size / concurrent requests
    - Number of active "users" or agents hitting the model at once

    Given that this is local-focused until we get to the comparisons below, we need model slider to be more like 4B, 7B, 12B, 16B, 27B, 70B, and a few others. Include quantization alongside clear explainers of each and what is happening when used. Include all the other factors as options/toggles rather than custom user inputs. 

11. Should there be a "run inference" simulation — an animated pass through the pipeline with live-updating metrics (tokens/sec, memory fill, cost so far)? Yes

12. What output metrics matter most to you? (e.g., tokens/sec, time-to-first-token, total generation time, VRAM/RAM used, $/million tokens, watts) All metrics matter here. 

## 5. Comparison vs. Cloud LLMs (ChatGPT, DeepSeek, etc.)

13. Which cloud systems should be the comparison baseline? (e.g., ChatGPT/GPT-4o or o-series, DeepSeek V3/R1, Claude, Gemini — name specific models if you have them) ChatGPT5+ (Use search tool/request access to search as needed), Deepseek V4, Claude Opus-5.0. 

14. What dimensions should the local-vs-cloud comparison cover? (pick any)
    - Speed: tokens/sec and latency
    - Cost: per-token pricing vs. subscription ($20/mo ChatGPT Plus) vs. hardware amortization + electricity for local
    - Privacy / data staying on-device
    - Offline capability
    - Model quality / benchmark scores (MMLU, coding, reasoning)
    - Context window size

All are good- plus a focus on agentic coding and ability to train and customize local models. 

15. Should the comparison be a side-by-side table, an animated race/progress visualization, or both? Both

16. How should cost for local be modeled — one-time hardware price + electricity only, or also include time/opportunity cost and maintenance? Hardware and electricity only. Note I am located in Shenzhen, China- so we'll use local estimated energy prices. 

## 6. Data & Accuracy

17. Where should the numbers come from? (hardcoded estimates I research now, published benchmarks you provide, or clearly-labeled rough approximations) Both- what you can find via search is good, and we can cite it, but if not- rough estimates.

18. How important is accuracy vs. illustrative value? Should sources be cited on-page? When making authoritative statements or when data is available we can have footnote citations. 

19. Are there specific real-world results of yours (e.g., tokens/sec you've measured on your own machine) that should anchor the numbers? No.

## 7. Tech & Design Constraints

20. Preferred stack: vanilla HTML/CSS/JS in a single file (like the existing `index.html` next door), or a framework (React/Svelte/Vue)? Any libraries OK for charts/animation (D3, Chart.js, Three.js)? Appropriate libraries may be used, provided animations can be created without needing to drop in or build assets. 

21. Single self-contained page, or multiple pages/tabs? Should it work on mobile? Multiple pages/tabs we can access without actually leaving the main page. 

22. Visual direction: match the existing look of `make/tools/local` (I can read its index.html/style.css), or a fresh style? Dark mode default? Any brand colors?

A fresh style with a light and dark mode. We'll add a footer later. Style should be modern, glassmorphism, engaging, and not a cookie-cutter website. 

23. Any accessibility requirements (keyboard navigation, reduced-motion support, screen-reader labels)? None

## 8. Nice-to-Haves / Out of Scope

24. Anything you definitely want included that I haven't asked about? Build the page such that elements appear and slide into place when scrolling down (and the reverse when scrolling up. Pi.dev's page is a great example of this) We want people to be encouraged and rewarded for exploring all pages/tabs for content. 

25. Anything explicitly out of scope? No
