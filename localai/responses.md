## 0. Details
I wrote a concise prompt aiming to get similar-length results from different models while allowing for flexibility in content. Prompt and results are shared in this file, for use on the local vs. cloud tab.

## 1. Prompt
In ~2 paragraphs, explain why someone would run an open-weight AI model locally when frontier models in the cloud are generally more capable.

## 2. ChatGPT 5.6 Luna (Free tier) - 5.3 seconds
Running an open-weight AI model locally is less about beating frontier models on raw capability and more about gaining control. A local model can run without an internet connection, keep prompts and data entirely on your own hardware, avoid API costs and rate limits, and give you predictable access regardless of a provider's pricing, policies, outages, or model changes. You can also fine-tune or modify the model, integrate it deeply into your own software, and run it continuously for specialized tasks without sending every request to a third party. For sensitive information, proprietary files, classroom data, or simply experimentation, that control can be valuable even if the model itself is weaker.

The tradeoff is essentially sovereignty versus capability. Cloud frontier models give you enormous computational resources and generally superior reasoning, multimodal capabilities, reliability, and access to rapidly improving models—but you surrender some control and depend on an external service. Local models require you to buy and maintain hardware, manage software, accept lower performance or smaller models, and potentially spend more electricity and time getting things working. In practice, a good setup can use both: cloud frontier models for difficult, high-value reasoning and local open-weight models for private, repetitive, offline, cheap, or highly customized workloads.

## 3. Deepseek V4 Instant (Free tier) - 5.6 seconds
The primary driver for running open-weight models locally is **control and sovereignty**. When you use a cloud-based frontier model, every prompt and piece of data traverses a third-party server, often with opaque logging, review policies, and retention schedules. For enterprises handling proprietary source code, financial records, or patient health information, this creates an unacceptable legal and competitive risk. Local deployment guarantees that data never leaves your hardware, ensuring full compliance with regulations like HIPAA, GDPR, and ITAR without needing expensive "private instance" contracts. Furthermore, you are immune to API outages, rate limits, and pricing volatility—once you have the hardware, inference cost is a fixed, sunk expense, allowing for unlimited, high-frequency usage without a growing bill.

Beyond privacy, local models offer **deep customization and determinism** that cloud APIs rarely match. You can fine-tune a model on your specific corporate jargon, codebase, or creative style using QLoRA or full parameter updates—a process that is either impossible or exorbitantly expensive with closed APIs. You also have granular control over decoding parameters, can swap out attention mechanisms, or even modify the model's architecture for specialized tasks. This reproducibility is vital for regulated industries that require auditable, deterministic outputs. While frontier models may excel at generalist benchmarks, a smaller, fine-tuned 7B or 70B parameter model running locally can outperform GPT-4 on narrow, high-stakes tasks like legal document classification or domain-specific entity extraction, all while offering lower latency and zero network dependency. For many, the trade-off of raw capability for absolute ownership is not a compromise—it is the requirement.

## 4. Qwen3.8-27B (Ran locally)

## 5. Gemma 4 12B QAT (Ran locally)

## 6. Claude Opus 5 (High)