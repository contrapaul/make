/* ============================================================
   v100 — Glossary term data (single source of truth)
   ------------------------------------------------------------
   Every technical word on this site is defined exactly once,
   here. Two lengths per term:

     short: 1 to 2 sentences. Shown in the hover tooltip.
             Must stand alone: the reader is mid sentence
             somewhere else and cannot follow a link yet.
     full:  the glossary page entry. May define the idea
             properly, including why it matters here.

   Rules (see style-guide.md, which governs this file):
     - No em dash. No middot inside a sentence.
     - Expand every abbreviation on its first appearance.
     - Never define a term using another undefined term. Keep
       every sentence readable on its own.

   `links` carries the "Learn more" row shown under each entry.
   Every URL was checked live (HTTP 200) and every title is the
   article's canonical name AFTER redirects, so the label matches
   the page the reader lands on. Re-check if you add one.
   More than one link per term is fine; they render in order.

   `id` is the anchor on the glossary page and the value of
   data-term in the markup: <a class="gloss" data-term="token">.
   Keep ids kebab-case and stable; they are linkable URLs.
   ============================================================ */

export const GLOSSARY = [
  {
    id: 'api',
    term: 'API',
    short: 'A way for one program to ask another program to do something. Cloud AI companies expose their models through an API so your software can send a question and get an answer back.',
    full: 'API stands for application programming interface. It is the doorway one piece of software uses to talk to another. When an app adds an AI feature without running any AI itself, it is almost always calling a cloud provider through an API: the app sends your text over the internet, a computer in a datacenter does the work, and the answer comes back. You are billed for what you send and receive.',
    links: [
      { source: 'Wikipedia', title: 'API', url: 'https://en.wikipedia.org/wiki/API' },
    ],
  },
  {
    id: 'bandwidth',
    term: 'Memory bandwidth',
    short: 'How fast a processor can read from its memory, measured in gigabytes per second. It is the main thing that decides how quickly a model writes each word.',
    full: 'Memory bandwidth is the rate at which a chip can move data out of its memory and into the part that does arithmetic, measured in gigabytes per second (GB/s). It is a speed limit, not a size limit. To produce a single token, a model has to read most of its weights out of memory, so the time per token is roughly the size of the model divided by the bandwidth. This is why bandwidth, rather than raw processing power, is usually what decides how fast a model writes. A graphics card such as the RTX 3090 reads at about 936 GB/s, while fast system RAM manages about 96 GB/s, which is close to ten times slower.',
    links: [
      { source: 'Wikipedia', title: 'Memory bandwidth', url: 'https://en.wikipedia.org/wiki/Memory_bandwidth' },
    ],
  },
  {
    id: 'cloud-ai',
    term: 'Cloud AI',
    short: 'AI models that run on someone else’s computers in a datacenter. You send your question over the internet and the answer comes back.',
    full: 'Cloud AI means the model runs on hardware owned and operated by a company, not on your machine. ChatGPT, Claude and Gemini all work this way. Your text travels over the internet to a datacenter, a very large model produces an answer there, and the answer travels back. The advantages are that you need no hardware of your own and you always get the newest and largest models. The trade offs are that you pay for every use, you need a working internet connection, and your text leaves your control.',
    links: [
      { source: 'Wikipedia', title: 'Cloud computing', url: 'https://en.wikipedia.org/wiki/Cloud_computing' },
    ],
  },
  {
    id: 'concurrency',
    term: 'Concurrency',
    short: 'The number of separate requests a machine is answering at the same time. More at once means more total work done, but each individual answer arrives more slowly.',
    full: 'Concurrency is how many conversations the machine is handling simultaneously. It matters because the two obvious measures of speed pull apart as it rises. Total throughput goes up, because the hardware reads each weight once and uses it for every request in the batch. Per request speed goes down, because each conversation keeps its own KV cache and those compete for memory and bandwidth. Waiting also gets worse: the machine reads the prompts one after another, so with four users the fourth waits roughly four times as long for the first word.',
    links: [
      { source: 'Wikipedia', title: 'Concurrency (computer science)', url: 'https://en.wikipedia.org/wiki/Concurrency_(computer_science)' },
    ],
  },
  {
    id: 'context-window',
    term: 'Context window',
    short: 'The maximum amount of text a model can hold in mind at once, counted in tokens. Everything in the conversation has to fit inside it.',
    full: 'The context window is the total number of tokens a model can consider at one time, covering the whole conversation so far plus the answer it is currently writing. A window of 8192 tokens is roughly 6000 words of English. Two things happen when a conversation grows: text beyond the window has to be dropped, so the model genuinely forgets it, and the memory needed for the KV cache grows with every token kept, which is why a long context can take more memory than the model itself.',
    links: [
      { source: 'Wikipedia', title: 'Large language model', url: 'https://en.wikipedia.org/wiki/Large_language_model' },
    ],
  },
  {
    id: 'cpu',
    term: 'CPU',
    short: 'The central processing unit, the general purpose chip in every computer. It can run AI models, but far more slowly than a graphics card.',
    full: 'CPU stands for central processing unit. It is the main chip in a computer, designed to do a wide range of tasks one after another, very quickly. A graphics card is designed instead to do a huge number of simple calculations at the same time, which is exactly the shape of the arithmetic a model needs. A CPU can run a model perfectly well, and it can reach memory that the graphics card cannot, but it reads that memory far more slowly, so any part of a model left to the CPU becomes the slow part.',
    links: [
      { source: 'Wikipedia', title: 'Central processing unit', url: 'https://en.wikipedia.org/wiki/Central_processing_unit' },
    ],
  },
  {
    id: 'datacenter',
    term: 'Datacenter',
    short: 'A building full of computers, run by a company, where cloud services actually happen. When an app says it uses AI, the model is usually running in one of these.',
    full: 'A datacenter is a purpose built facility holding thousands of computers, with the power supply and cooling to keep them running continuously. Cloud AI runs here. The machines are nothing like a home computer: a single server may hold eight specialised accelerators, each with far more memory than a desktop graphics card, wired together so that one very large model can be spread across all of them. This is why cloud providers can offer models too large to fit on any machine you could own.',
    links: [
      { source: 'Wikipedia', title: 'Data center', url: 'https://en.wikipedia.org/wiki/Data_center' },
    ],
  },
  {
    id: 'decode',
    term: 'Decode',
    short: 'The stage where the model writes its answer, one token at a time. Each token requires reading the model’s weights from memory again, so this stage is slow and steady.',
    full: 'Decode is the answer writing stage. The model produces one token, adds it to what it has written, and repeats, so the tokens appear in a steady trickle rather than all at once. Each token requires reading most of the model’s weights out of memory, which is why decode speed is set by memory bandwidth and is measured in tokens per second. This is the visible speed of a chatbot, the pace at which words appear on screen.',
    links: [
      { source: 'Wikipedia', title: 'Transformer (deep learning)', url: 'https://en.wikipedia.org/wiki/Transformer_(deep_learning)' },
    ],
  },
  {
    id: 'gguf',
    term: 'GGUF',
    short: 'A file format for storing a model so ordinary software can load and run it. Most models you download to run at home come as a single GGUF file.',
    full: 'GGUF is a file format designed for running models on everyday hardware. One file holds the weights along with the information a program needs to use them, such as the vocabulary and the layout of the layers. Its usefulness is that it stores weights that have been compressed to smaller numbers, and it can be loaded partly onto a graphics card and partly into system memory, which is what makes it possible to run a large model on a machine that could not otherwise hold it.',
    links: [
      { source: 'Wikipedia', title: 'llama.cpp', url: 'https://en.wikipedia.org/wiki/Llama.cpp' },
    ],
  },
  {
    id: 'gpu',
    term: 'GPU',
    short: 'A graphics card. It was built to draw images, which requires doing many simple calculations at once, and that turns out to be exactly what running an AI model needs.',
    full: 'GPU stands for graphics processing unit. Where a CPU does a few things very quickly one after another, a GPU does thousands of simple calculations simultaneously. Drawing an image and running a model turn out to need the same shape of work, so graphics cards became the standard hardware for AI. A GPU also has its own dedicated memory, called VRAM, which it reads much faster than a CPU reads system RAM. That combination, many calculations at once plus fast memory, is why a model runs an order of magnitude faster on a graphics card.',
    links: [
      { source: 'Wikipedia', title: 'Graphics processing unit', url: 'https://en.wikipedia.org/wiki/Graphics_processing_unit' },
    ],
  },
  {
    id: 'inference',
    term: 'Inference',
    short: 'Using a model that has already been trained, which is what happens every time you send it a message. It is a separate activity from training the model in the first place.',
    full: 'Inference is running a finished model to get an answer. It is worth separating from training, which is the enormously expensive process of creating the model by adjusting its weights over months on thousands of machines. Training happens once. Inference happens every time anybody uses the result, and it is the only part that happens on your hardware when you run a model locally. Everything this site measures is inference.',
    links: [
      { source: 'Wikipedia', title: 'Large language model', url: 'https://en.wikipedia.org/wiki/Large_language_model' },
    ],
  },
  {
    id: 'kv-cache',
    term: 'KV cache',
    short: 'The model’s working memory for the current conversation. It stores keys and values, which are what the model worked out about each word it has already read, so it does not recalculate them for every new word.',
    full: 'As a model reads text, it computes two things for every token it has seen: a key, which is how that token gets found again later, and a value, which is what that token contributes once it is found. Recomputing these for the entire conversation each time it writes a new token would be enormously wasteful, so the model keeps them and reuses them. That store is the KV cache, named for keys and values. Its size grows with every token in the conversation, and it sits in the same memory as the model itself, so a long conversation can crowd out the model. On a long context it can end up larger than the weights.',
    links: [
      { source: 'Wikipedia', title: 'Attention (machine learning)', url: 'https://en.wikipedia.org/wiki/Attention_(machine_learning)' },
    ],
  },
  {
    id: 'latency',
    term: 'Latency',
    short: 'How long you wait for something to happen. For a chatbot the one that matters most is the wait before the first word appears.',
    full: 'Latency is delay, the time between asking and receiving. It is a different measurement from throughput, which counts how much gets done per second, and the two can move in opposite directions. A machine serving many users at once has high throughput and poor latency, because each individual request waits its turn. For a person using a chatbot, the wait before the first word appears is usually far more noticeable than the rate the rest arrives at.',
    links: [
      { source: 'Wikipedia', title: 'Latency (engineering)', url: 'https://en.wikipedia.org/wiki/Latency_(engineering)' },
    ],
  },
  {
    id: 'layer',
    term: 'Layer',
    short: 'One processing step inside a model. A model is a stack of them, and text passes through every layer in order, getting reshaped at each one.',
    full: 'A model is built as a stack of layers, each holding its own set of weights. Text enters at the bottom, and each layer transforms it before passing it upward, so the representation gets progressively more refined until the top layer produces a prediction. Llama 3.1 8B has 32 layers. Layers matter practically because they are the unit that can be split: when a model does not fit on a graphics card, some layers are placed on the card and the rest are left in system memory.',
    links: [
      { source: 'Wikipedia', title: 'Neural network (machine learning)', url: 'https://en.wikipedia.org/wiki/Neural_network_(machine_learning)' },
    ],
  },
  {
    id: 'local-ai',
    term: 'Local AI',
    short: 'Running an AI model on hardware you own, so nothing is sent over the internet. The model file sits on your drive and the work happens on your own chips.',
    full: 'Local AI means the model runs on your machine. You download a file containing the weights, and software on your computer loads it into memory and runs it. Nothing you type leaves the room, there is no per use charge, and it keeps working with the internet disconnected. The costs are different rather than absent: you need hardware with enough memory, you pay for the electricity it draws, and the models small enough to run at home are generally less capable than the largest cloud models.',
    links: [
      { source: 'Wikipedia', title: 'Open-source artificial intelligence', url: 'https://en.wikipedia.org/wiki/Open-source_artificial_intelligence' },
    ],
  },
  {
    id: 'model',
    term: 'Model',
    short: 'The AI itself: a very large collection of numbers, called weights, plus the arithmetic that uses them. It is a file you can copy, not a program that thinks.',
    full: 'A model is a large set of numbers together with a fixed recipe for combining them. The numbers are the weights, and there can be billions of them. Nothing about it is magic or alive: an answer is produced by multiplying your input through those numbers, layer by layer, to predict which token should come next, then repeating. The weights are what was learned during training, and they are also literally the file you download, which is why model size is quoted both in parameters and in gigabytes.',
    links: [
      { source: 'Wikipedia', title: 'Large language model', url: 'https://en.wikipedia.org/wiki/Large_language_model' },
    ],
  },
  {
    id: 'offloading',
    term: 'Offloading',
    short: 'Putting part of a model in ordinary system memory when it will not all fit on the graphics card. It lets you run larger models, at a large cost in speed.',
    full: 'When a model is too big for the memory on your graphics card, the software can keep some layers there and place the rest in the computer’s system RAM, where the CPU handles them. This is offloading, and it is the difference between running a model slowly and not running it at all. The penalty is severe and easy to predict: system memory is read roughly ten times more slowly than graphics card memory, and every token has to pass through every layer, so the offloaded portion sets the pace for the whole model.',
    links: [
      { source: 'Wikipedia', title: 'llama.cpp', url: 'https://en.wikipedia.org/wiki/Llama.cpp' },
    ],
  },
  {
    id: 'open-weights',
    term: 'Open weights',
    short: 'A model whose weight file has been published, so anyone can download it and run it themselves. Local AI is only possible because some models are released this way.',
    full: 'A model has open weights when the organisation that trained it publishes the numbers for anyone to download. Llama, Qwen, Mistral and DeepSeek are released this way; the models behind ChatGPT and Claude are not. This is the precondition for local AI: without a published weight file there is nothing to run on your own machine. Open weights is not the same as open source, since the training data and code are usually not released, and most such models come with a licence setting conditions on use.',
    links: [
      { source: 'Wikipedia', title: 'Open weights', url: 'https://en.wikipedia.org/wiki/Open_weights' },
    ],
  },
  {
    id: 'parameters',
    term: 'Parameters',
    short: 'Another word for the individual numbers in a model. Model sizes are quoted in billions of them, which is what the B means in a name like Llama 3.1 8B.',
    full: 'Parameters are the individual adjustable numbers a model learned during training, and the terms parameter and weight are used interchangeably. The count is how model sizes are named: 8B means eight billion parameters. The count matters directly for whether you can run something, because it sets how much memory the model needs. Multiply the parameter count by the number of bytes used per parameter and you have the size in memory, which is why the same 8B model can occupy 16 GB or 4.4 GB depending on how the numbers are stored.',
    links: [
      { source: 'Wikipedia', title: 'Neural network (machine learning)', url: 'https://en.wikipedia.org/wiki/Neural_network_(machine_learning)' },
    ],
  },
  {
    id: 'prefill',
    term: 'Prefill',
    short: 'The stage where the model reads your question. It processes the whole prompt in one fast pass, before it writes anything.',
    full: 'Prefill is the reading stage. Because the entire prompt is already known, the model can process all of its tokens at the same time rather than one after another, which makes this stage fast and limited by raw arithmetic speed rather than by memory bandwidth. It fills the KV cache for everything you wrote, which is where the name comes from. Prefill is the reason there is a pause before the first word appears: the longer your prompt, the longer that pause.',
    links: [
      { source: 'Wikipedia', title: 'Transformer (deep learning)', url: 'https://en.wikipedia.org/wiki/Transformer_(deep_learning)' },
    ],
  },
  {
    id: 'prompt',
    term: 'Prompt',
    short: 'Everything you send the model: your question, plus any conversation and instructions that come with it.',
    full: 'The prompt is the complete text the model reads before it answers. It is usually more than what you typed, since it also carries the earlier turns of the conversation and often hidden instructions from the application about how to behave. This matters for speed and cost, because prompt length is counted in tokens and both the waiting time before the first word and the memory used by the KV cache grow with it.',
    links: [
      { source: 'Wikipedia', title: 'Prompt engineering', url: 'https://en.wikipedia.org/wiki/Prompt_engineering' },
    ],
  },
  {
    id: 'quantization',
    term: 'Quantization',
    short: 'Storing a model’s numbers less precisely so the file takes less memory. It is the main trick that makes large models fit on ordinary hardware.',
    full: 'Every weight in a model is a number, and you get to choose how many bits to spend storing each one. Full precision uses 16 bits per weight. Quantization rounds them to fewer bits, commonly 8, 5 or 4, which shrinks the model proportionally: an 8B model takes about 16 GB at 16 bits and about 4.4 GB at roughly 4 bits. Two things follow. It fits in less memory, and because speed depends on how many bytes must be read per token, it also runs faster. The cost is accuracy, since the numbers are now approximations. Down to about 4 bits the loss is small enough that most people accept it, and below that it degrades quickly.',
    links: [
      { source: 'Wikipedia', title: 'Quantization (signal processing)', url: 'https://en.wikipedia.org/wiki/Quantization_(signal_processing)' },
    ],
  },
  {
    id: 'ram',
    term: 'RAM',
    short: 'The computer’s main memory, used by the CPU. There is usually much more of it than graphics card memory, but it is read far more slowly.',
    full: 'RAM stands for random access memory, the general purpose working memory of a computer. Compared with the memory on a graphics card there is typically much more of it, 32 GB or 64 GB against 12 GB or 24 GB, but it is read several times more slowly. That trade off is the whole story of offloading: moving part of a model into system RAM buys capacity and costs speed. Some machines, including Apple Silicon Macs, use a single pool of memory shared by the CPU and GPU, which avoids the split entirely.',
    links: [
      { source: 'Wikipedia', title: 'Random-access memory', url: 'https://en.wikipedia.org/wiki/Random-access_memory' },
    ],
  },
  {
    id: 'sampling',
    term: 'Sampling',
    short: 'How the model picks the next token. It does not choose one word; it produces a probability for every possible token and then draws from that list.',
    full: 'A model never outputs a single word. It outputs a probability for every token in its vocabulary, tens of thousands of numbers saying how likely each one is to come next. Sampling is the step that turns that list into one actual choice. Always taking the most likely token produces flat, repetitive text, so the usual approach adds controlled randomness, tuned by settings such as temperature and top-p. This is why the same question can give different answers each time you ask it.',
    links: [
      { source: 'Wikipedia', title: 'Softmax function', url: 'https://en.wikipedia.org/wiki/Softmax_function' },
    ],
  },
  {
    id: 'temperature',
    term: 'Temperature',
    short: 'A setting that controls how adventurous the model’s word choices are. Low keeps it predictable, high makes it varied and more likely to go off course.',
    full: 'Temperature reshapes the probability list before a token is chosen. A low value, near 0, flattens out the unlikely options so the model almost always takes its top choice, which produces consistent and somewhat repetitive text. A high value, above 1, evens the options out so less likely tokens get a real chance, which produces more varied and surprising text and more mistakes. Around 0.7 is a common middle setting. It changes nothing about the model itself, only how its output is read.',
    links: [
      { source: 'Wikipedia', title: 'Softmax function', url: 'https://en.wikipedia.org/wiki/Softmax_function' },
    ],
  },
  {
    id: 'throughput',
    term: 'Throughput',
    short: 'How much total work a machine gets done per second, counting everyone it is serving at once. Not the same as how fast any one answer arrives.',
    full: 'Throughput measures total output, usually as tokens per second across all requests being handled. It is the number that matters when you are serving many people, and it can rise while every individual person’s experience gets worse, because the hardware reads each weight once and shares that read across every request in the batch. A machine producing 40 tokens per second for one user might produce 100 in total across four users, which is 25 each. Both numbers are true, and they answer different questions.',
    links: [
      { source: 'Wikipedia', title: 'Network throughput', url: 'https://en.wikipedia.org/wiki/Network_throughput' },
    ],
  },
  {
    id: 'token',
    term: 'Token',
    short: 'The unit of text a model actually reads and writes. A token is usually a common word or a piece of a longer one, so it is a little shorter than a word on average.',
    full: 'Models do not work with letters or words. They work with tokens, a fixed list of text fragments chosen when the model was built. Common words are single tokens, and rarer words are split into pieces, so "hello" is one token while "antidisestablishmentarianism" is six. Spaces usually attach to the front of the following word, which is why " world" is a different token from "world". A rough rule for English is that 1000 tokens is about 750 words. Everything is counted in tokens: speed, context length, and what a cloud provider charges you.',
    links: [
      { source: 'Wikipedia', title: 'Byte-pair encoding', url: 'https://en.wikipedia.org/wiki/Byte-pair_encoding' },
    ],
  },
  {
    id: 'tokenization',
    term: 'Tokenization',
    short: 'The first step in running a model: chopping your text into tokens and looking up the number that stands for each one.',
    full: 'Tokenization converts your text into the numbers a model can accept. The software scans the text and matches it against the model’s vocabulary, preferring the longest fragment that fits, then replaces each fragment with its identity number. "Hello, world!" becomes four tokens rather than two words, because the comma and the exclamation mark are separate pieces. This happens before anything else, and it is why the same sentence can cost different amounts on different models: they have different vocabularies and split text differently.',
    links: [
      { source: 'Wikipedia', title: 'Byte-pair encoding', url: 'https://en.wikipedia.org/wiki/Byte-pair_encoding' },
    ],
  },
  {
    id: 'tokens-per-second',
    term: 'Tokens per second',
    short: 'The speed at which a model writes, usually shortened to tok/s. Around 10 is readable, and above 30 the text arrives faster than most people read.',
    full: 'Tokens per second, written tok/s, measures how quickly a model produces its answer. It is the most useful single number for how a model feels to use. Below about 5 it is uncomfortable to wait for. Around 10 is comfortably readable. Above 30 the words arrive faster than most people read, so more speed stops being noticeable in a conversation, though it still matters when a model is producing long output or serving several people.',
    links: [
      { source: 'Wikipedia', title: 'Network throughput', url: 'https://en.wikipedia.org/wiki/Network_throughput' },
    ],
  },
  {
    id: 'top-p',
    term: 'Top-p',
    short: 'A setting that limits the model’s choices to the shortlist of most likely tokens, discarding the long tail of unlikely ones.',
    full: 'Top-p, also called nucleus sampling, trims the list of candidate tokens before one is chosen. It sorts the tokens by probability and keeps only enough from the top to add up to the value of p, so a setting of 0.9 keeps the most likely options accounting for 90 percent of the probability and discards everything else. The size of that shortlist changes from token to token: where the model is confident it may keep only one or two options, and where it is uncertain it may keep dozens. It is used alongside temperature to allow variety while excluding genuinely bad choices.',
    links: [
      { source: 'Wikipedia', title: 'Softmax function', url: 'https://en.wikipedia.org/wiki/Softmax_function' },
    ],
  },
  {
    id: 'ttft',
    term: 'Time to first token',
    short: 'How long you wait after pressing enter before the first word appears. Shortened to TTFT. It is set by how long the model takes to read your prompt.',
    full: 'Time to first token, abbreviated TTFT, is the pause between sending your message and seeing the beginning of the reply. It is filled by the prefill stage, where the model reads your entire prompt, so it grows with the length of what you sent rather than with the length of the answer. It is worth tracking separately from writing speed because they are set by different things and people notice them differently: a long silence feels worse than words appearing slowly.',
    links: [
      { source: 'Wikipedia', title: 'Latency (engineering)', url: 'https://en.wikipedia.org/wiki/Latency_(engineering)' },
    ],
  },
  {
    id: 'vocabulary',
    term: 'Vocabulary',
    short: 'The complete fixed list of tokens a model knows, each with its own identity number. Qwen3 has 248,320 of them.',
    full: 'The vocabulary is the full set of text fragments a model can read or write, decided before training and unchangeable afterwards. Each entry has a number, and those numbers are the model’s actual input and output. Qwen3’s vocabulary holds 248,320 entries covering common words, word pieces, punctuation, and fragments from many languages. Any text at all can be represented, because anything not present as a whole gets split into smaller pieces that are.',
    links: [
      { source: 'Wikipedia', title: 'Byte-pair encoding', url: 'https://en.wikipedia.org/wiki/Byte-pair_encoding' },
    ],
  },
  {
    id: 'vram',
    term: 'VRAM',
    short: 'The memory built into a graphics card. It is much faster than the computer’s main memory but there is far less of it, and how much you have decides which models you can run.',
    full: 'VRAM stands for video RAM, the dedicated memory on a graphics card. Two properties matter. It is read very quickly, around 936 GB/s on an RTX 3090 against about 96 GB/s for fast system memory, which is why models run so much faster on a graphics card. And there is not much of it, commonly 12 GB to 24 GB on consumer cards, which makes it the binding constraint on local AI: the model weights and the KV cache both have to fit, and when they do not you either use a smaller model, compress it further, or accept the slowdown of offloading.',
    links: [
      { source: 'Wikipedia', title: 'Video random-access memory', url: 'https://en.wikipedia.org/wiki/Video_random-access_memory' },
    ],
  },
  {
    id: 'weights',
    term: 'Weights',
    short: 'The billions of numbers that make up a model. They are what was learned during training, and they are what gets read from memory to produce every token.',
    full: 'The weights are the numbers inside a model, one for each learned connection, and they are the model in every practical sense: the file you download is a list of them. They are fixed once training ends, so running a model never changes them. They matter for performance because of their sheer volume. Producing a single token requires reading nearly all of them out of memory, so their total size in bytes, set by the parameter count and the quantization, is what determines both whether a model fits and how fast it runs.',
    links: [
      { source: 'Wikipedia', title: 'Neural network (machine learning)', url: 'https://en.wikipedia.org/wiki/Neural_network_(machine_learning)' },
    ],
  },
];

/** Map of id to term, built once. */
export const GLOSSARY_BY_ID = Object.freeze(
  Object.fromEntries(GLOSSARY.map((t) => [t.id, t]))
);

/** Look up one term. Returns null for an unknown id, never throws. */
export function glossaryTerm(id) {
  return GLOSSARY_BY_ID[String(id ?? '')] ?? null;
}
