// e02s07 part 2 enrichment notes (50/50). Assembled from reviewer-drafted batches;
// owner reviews before merge. One entry per card, id-ordered to match PROJECTS.
export const NOTES = [
{
  "id": "p001-flappy-bird-clone",
  "why": "The intriguing part is procedural generation. Give each new pipe a random gap height and the game never repeats itself. You will see that randomness plus collision checks is what makes every run feel alive.",
  "starter": "Draw two rectangles (pipe tops) with a random vertical gap on a Canvas, and move them left every frame with requestAnimationFrame. Add the bird as a rectangle with gravity and a flap impulse before anything looks pretty.",
  "references": [
    {
      "title": "Canvas MDN tutorial",
      "url": "https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API/Tutorial"
    },
    {
      "title": "requestAnimationFrame reference",
      "url": "https://developer.mozilla.org/en-US/docs/Web/API/Window/requestAnimationFrame"
    }
  ]
},
{
  "id": "p002-memory-card-match",
  "why": "You will practice the kinds of state a real game needs: a moves counter, a timer, and knowing when the board is cleared. CSS Grid makes the layout almost free, so your time goes into the logic.",
  "starter": "Build a 4 by 4 board with CSS grid and empty card divs. In JS, shuffle an array of pairs, render each card face down, and flip on click. Add the move counter and timer once matching works.",
  "references": [
    {
      "title": "CSS grid basic concepts on MDN",
      "url": "https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_grid_layout/Basic_concepts_of_grid_layout"
    }
  ]
},
{
  "id": "p003-simon-says",
  "why": "The Web Audio API can make real tones with no sound files at all, which is a skill that sticks. You will also watch players fail in a fun way: human memory runs out around seven items.",
  "starter": "Make four coloured buttons and use an AudioContext with a short oscillator, one frequency per colour, so one button plays one beep. Get that working, then store the growing sequence in an array and replay it.",
  "references": [
    {
      "title": "Web Audio API guide on MDN",
      "url": "https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API"
    },
    {
      "title": "OscillatorNode reference on MDN",
      "url": "https://developer.mozilla.org/en-US/docs/Web/API/OscillatorNode"
    }
  ]
},
{
  "id": "p004-wordle-clone",
  "why": "The subtle puzzle is the rule set: what counts when a letter appears twice in the answer but not your guess, or the reverse? Getting the feedback colours exactly right is real logic work with a satisfying finish.",
  "starter": "Start with a short list of five-letter words. Write a function that takes a guess and the answer and returns each letter as green, yellow, or grey, counting each answer letter only once. Test it in the console before building a page.",
  "references": [
    {
      "title": "Flask quickstart guide",
      "url": "https://flask.palletsprojects.com/en/stable/quickstart/"
    },
    {
      "title": "Wordle overview on Wikipedia",
      "url": "https://en.wikipedia.org/wiki/Wordle"
    }
  ]
},
{
  "id": "p005-mini-tower-defense",
  "why": "Enemies following a path plus a wave that gets harder is the actual design of a whole game genre. You will see how much fun you can get from one list of path points and one update loop.",
  "starter": "Define the path as an ordered list of x, y points and move one enemy point to point in a Pygame loop. Add a single turret type that shoots when an enemy is in range, and hold off on waves and menus.",
  "references": [
    {
      "title": "Pygame documentation",
      "url": "https://www.pygame.org/docs/"
    },
    {
      "title": "Pygame event module docs",
      "url": "https://www.pygame.org/docs/ref/event.html"
    }
  ]
},
{
  "id": "p006-connect-four",
  "why": "A two-move lookahead is a genuine AI: you try your move, then imagine the reply the opponent would give, and pick the line that wins. That is the smallest version of how game agents think, made visible on a board.",
  "starter": "Represent the grid as a 2D integer array with 0 for empty. Write a helper that lists every square where a piece would complete four in a row. Solve wins with it first, then have the AI try each move and keep the one with the best reply.",
  "references": [
    {
      "title": "Connect Four overview on Wikipedia",
      "url": "https://en.wikipedia.org/wiki/Connect_Four"
    },
    {
      "title": "ncurses manual page",
      "url": "https://man7.org/linux/man-pages/man3/ncurses.3ncurses.html"
    }
  ]
},
{
  "id": "p007-hangman",
  "why": "If console programs still feel fiddly, this is small enough to master one input, loop, and print statement at a time. The progressive stick figure is a nice trick that makes plain terminal output feel alive.",
  "starter": "Keep the hidden word, a set of already-guessed letters, and lives left. Print the word as underscores, loop asking for one letter, and print one more stick figure line per miss until win or lose.",
  "references": [
    {
      "title": "Python official tutorial",
      "url": "https://docs.python.org/3/tutorial/"
    },
    {
      "title": "Hangman game on Wikipedia",
      "url": "https://en.wikipedia.org/wiki/Hangman_(game)"
    }
  ]
},
{
  "id": "p008-asteroids",
  "why": "The classic detail here is wrap-around: a ship that leaves the right edge re-enters from the left. Getting collision to work across the boundary is a satisfying, real bug to reason about, and it teaches you edge handling that every position-based game needs.",
  "starter": "Give the ship a position, velocity, and direction. Update and draw it in a requestAnimationFrame loop, and wrap x and y at the canvas edges. Watch the ship cross all four sides before you add rocks or bullets.",
  "references": [
    {
      "title": "Canvas MDN tutorial",
      "url": "https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API/Tutorial"
    },
    {
      "title": "Canvas API overview on MDN",
      "url": "https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API"
    }
  ]
},
{
  "id": "p009-reaction-time-test",
  "why": "A small app, but it teaches a timing habit most people never practise: using the high-resolution clock instead of Date.now(), and knowing which trials are invalid because the tester clicked before the screen changed.",
  "starter": "Show a red box, wait a random delay, turn it green, and record the click with performance.now() minus the moment it turned green. Collect the times in an array and show the mean and best at the end.",
  "references": [
    {
      "title": "performance.now() on MDN",
      "url": "https://developer.mozilla.org/en-US/docs/Web/API/Performance/now"
    }
  ]
},
{
  "id": "p010-8-puzzle-solver",
  "why": "This is your first real AI search. A breadth-first search explores the board one move at a time and finds the shortest solution; A* adds a guess about how far away you are. Animating it means watching the machine think.",
  "starter": "Represent a board as nine numbers with 0 for the blank. Write one function that returns the boards you can slide to next, and test it by hand first. Both BFS and A* are that function repeated, with a priority queue as the only difference.",
  "references": [
    {
      "title": "A* search algorithm on Wikipedia",
      "url": "https://en.wikipedia.org/wiki/A*_search_algorithm"
    },
    {
      "title": "Breadth-first search on Wikipedia",
      "url": "https://en.wikipedia.org/wiki/Breadth-first_search"
    }
  ]
},
{
  "id": "p011-csv-json-converter",
  "why": "The hard part is type inference: is 0421 a number or a code? Is 3.0 a float or a string? Making the call column by column, consistently, is a skill that real data work depends on and very few tutorials cover.",
  "starter": "Read one file with Python csv.DictReader and print the rows before converting any types. Then write a helper that looks at every value in a column and picks int, float, boolean, or string for it.",
  "references": [
    {
      "title": "csv module docs",
      "url": "https://docs.python.org/3/library/csv.html"
    },
    {
      "title": "json module docs",
      "url": "https://docs.python.org/3/library/json.html"
    }
  ]
},
{
  "id": "p012-gitignore-generator",
  "why": "You will read real .gitignore patterns until logs/ and *.pyc stop looking like magic. And building a download is a good small server skill that a lot of tutorials skip, so this is doubly useful.",
  "starter": "Start with a JS object that maps each language name to its list of ignore rules. Render a checkbox for each language, and append the selected rules to a growing string. On submit, create a Blob and trigger a download.",
  "references": [
    {
      "title": "gitignore documentation",
      "url": "https://git-scm.com/docs/gitignore"
    }
  ]
},
{
  "id": "p013-interactive-dockerfile-builder",
  "why": "Dockerfiles feel like a foreign language until you watch one assembled from answers to plain questions. You will learn how the pieces of the base image, the port, and the run command fit in, and leave with a Dockerfile you actually understand.",
  "starter": "Make a form with four or five questions: base image, exposed port, install command, start command. Keep one JS function that takes the picked options and stitches the Dockerfile string in order, and display it in a copyable block.",
  "references": [
    {
      "title": "Dockerfile reference in Docker docs",
      "url": "https://docs.docker.com/reference/dockerfile/"
    }
  ]
},
{
  "id": "p014-cron-expression-explainer",
  "why": "Cron hides inside every server job scheduler, and its five fields are keyless. Explaining */5 9-17 in plain English proves the parser, and computing the next five run times is the aha moment that tells you it is right, not just plausible.",
  "starter": "Split the expression into five fields and validate each against its domain: minutes 0 to 59, hours 0 to 23, days, months, weekdays. Then write the next run function that steps a clock forward minute by minute until all five fields match.",
  "references": [
    {
      "title": "crontab manual page",
      "url": "https://man7.org/linux/man-pages/man5/crontab.5.html"
    }
  ]
},
{
  "id": "p015-json-schema-validator",
  "why": "Modern APIs quietly depend on JSON Schema, and most people never peek inside one. Turning a flat string of errors into a tree, grouped under the field that failed, is a genuinely useful shape for debugging real data.",
  "starter": "Install the jsonschema Python package and validate a sample payload against a sample schema in a script first. Study the shape of the error. Then on the page, show the errors as a nested tree with one node per failing field.",
  "references": [
    {
      "title": "python-jsonschema documentation",
      "url": "https://python-jsonschema.readthedocs.io/"
    },
    {
      "title": "JSON Schema site",
      "url": "https://json-schema.org/"
    }
  ]
},
{
  "id": "p016-batch-file-renamer",
  "why": "The killer feature is the preview: a table of old to new names before anything touches disk. Nearly every real rename tool does this, and building a two-step flow is a safety habit you will keep for every script you ever write.",
  "starter": "List the folder with os.listdir and only compute the new file names, storing old and new as pairs. Print them as a table, and add a flag that performs the rename loop only after the user confirms the list.",
  "references": [
    {
      "title": "pathlib module docs",
      "url": "https://docs.python.org/3/library/pathlib.html"
    },
    {
      "title": "os.rename docs",
      "url": "https://docs.python.org/3/library/os.html#os.rename"
    }
  ]
},
{
  "id": "p017-image-format-converter",
  "why": "You will answer the real question of why this file is WebP and that one is JPEG, and you will be choosing by size and quality. The drag-and-drop or folder-watch mode is where this stops being an exercise and starts being a tool you keep.",
  "starter": "Convert one PNG to WebP with Pillow and compare the size to the file on disk. Then wrap it in a loop over the folder, skipping files that are already the target format, and keep the quality constant under one name everywhere.",
  "references": [
    {
      "title": "Pillow handbook",
      "url": "https://pillow.readthedocs.io/en/stable/handbook/index.html"
    },
    {
      "title": "ImageMagick documentation",
      "url": "https://imagemagick.org/script/documentation.php"
    }
  ]
},
{
  "id": "p018-video-gif-maker",
  "why": "ffmpeg is the tool underneath all video processing, and its command line is a one-time skill that pays rent forever. The subtlety is that a GIF only supports 256 colours, so scaling and palette choice are what makes the output look clean.",
  "starter": "Call ffmpeg as a Python subprocess, cut a five-second window, and save just that part as a video first. Then add the GIF filter chain: scale to around 320 pixels wide and let it derive the palette from the same clip.",
  "references": [
    {
      "title": "ffmpeg documentation",
      "url": "https://ffmpeg.org/ffmpeg.html"
    },
    {
      "title": "ffmpeg GIF conversion wiki",
      "url": "https://trac.ffmpeg.org/wiki/ExportingEncodeGIF"
    }
  ]
},
{
  "id": "p019-markdown-pdf",
  "why": "PDF is the hardest everyday document format: it cares about page breaks, fonts, and styles, so your CSS choices actually show up. It is a small project, but it forces you to think like a layout engineer.",
  "starter": "Render a .md file to HTML with the Python markdown library and view it in a browser with a small CSS file setting page size and margins. Then hand the same HTML to weasyprint and iterate on that file only until the page break looks right.",
  "references": [
    {
      "title": "WeasyPrint site",
      "url": "https://weasyprint.org/"
    },
    {
      "title": "markdown package on PyPI",
      "url": "https://pypi.org/project/markdown/"
    }
  ]
},
{
  "id": "p020-pdf-text-extractor",
  "why": "PDF is deceptively hard: inside, the position of a word matters as much as the word itself, because the format stores drawings, not text. Pulling out clean text teaches you why PDF extraction is such a common data-cleaning chore.",
  "starter": "Open one PDF with pdfplumber and dump each page text and the document metadata into JSON. Study that structure before deciding your output format, keeping pages as a numbered list and metadata under a separate key.",
  "references": [
    {
      "title": "pdfplumber on PyPI",
      "url": "https://pypi.org/project/pdfplumber/"
    },
    {
      "title": "PDF overview on Wikipedia",
      "url": "https://en.wikipedia.org/wiki/Portable_Document_Format"
    }
  ]
},
{
  "id": "p021-url-metadata-scraper",
  "why": "Every link preview in every chat app is reading the same handful of tags, and most people have never looked at them. Walking through title, description, and image is the clearest way to see how a site describes itself to the outside world.",
  "starter": "Fetch a page with requests and parse it with BeautifulSoup, printing the title, meta description, og:title, and og:image. Test on three different sites, and note how missing tags behave before you add Twitter card fields.",
  "references": [
    {
      "title": "BeautifulSoup 4 documentation",
      "url": "https://www.crummy.com/software/BeautifulSoup/bs4/doc/"
    },
    {
      "title": "Open Graph on Wikipedia",
      "url": "https://en.wikipedia.org/wiki/OpenGraph"
    }
  ]
},
{
  "id": "p022-open-graph-preview-generator",
  "why": "This is a pocket-sized version of the link preview feature every chat app uses. Rendering a real URL plus a chosen image onto one card is a small project of pure satisfaction, and the whole thing fits in one clean Flask route.",
  "starter": "Start in a plain Python script with Pillow: paste the image onto a fixed-size canvas and draw the domain name and description at a sensible font size. Get the composition right on a PNG, then hang it on a Flask route that takes the URL and the image.",
  "references": [
    {
      "title": "Pillow ImageDraw reference",
      "url": "https://pillow.readthedocs.io/en/stable/reference/ImageDraw.html"
    },
    {
      "title": "Flask quickstart guide",
      "url": "https://flask.palletsprojects.com/en/stable/quickstart/"
    }
  ]
},
{
  "id": "p023-multi-size-favicon-generator",
  "why": "A favicon is a tiny file every website needs and almost nobody wants to make by hand. Building the full set of sizes and learning that .ico is a binary multi-image format is a fun detour through image formats.",
  "starter": "Load one source image with Pillow and loop, saving each size (16, 32, 48, 192, 512 pixels) centred. Then check that Pillow ICO save supports several sizes in one call and group the set into a single .ico file.",
  "references": [
    {
      "title": "Pillow Image.save reference",
      "url": "https://pillow.readthedocs.io/en/stable/reference/Image.html"
    }
  ]
},
{
  "id": "p024-sitemap-xml-builder",
  "why": "A sitemap is a real signal that search engines read, and the crawl that builds it is the junior to classic web-crawler work. At the end of an afternoon you own a working tool that a site owner might actually use on their own site.",
  "starter": "Start from the homepage, collect all links on the same domain, dedupe with a Python set as you visit, and queue the next batch. Write the XML section early, because it is just one line per visited URL.",
  "references": [
    {
      "title": "Scrapy documentation",
      "url": "https://docs.scrapy.org/en/latest/"
    },
    {
      "title": "Sitemaps site",
      "url": "https://www.sitemaps.org/"
    }
  ]
},
{
  "id": "p025-broken-link-checker",
  "why": "You will crawl a site, follow every link, and report the rot: 404s, 500s, and links that hang forever. Timeouts are the real trap, because a dead link fails differently from an error page, and handling both cleanly is operations-minded thinking.",
  "starter": "Take a page URL, extract same-domain links, and request each with requests with a five second timeout, recording the status. Mark 2xx and 3xx as pass, 4xx and 5xx as fail, and timeouts as a warning in the report.",
  "references": [
    {
      "title": "requests documentation",
      "url": "https://docs.python-requests.org/en/latest/"
    }
  ]
},
{
  "id": "p026-http-response-inspector",
  "why": "Browsers hide the boring part: how long DNS took, how long the connection took, how long the body took. Building this makes it all visible, and you will finally be able to read a performance summary with understanding instead of vibes.",
  "starter": "Wrap the server-side request with a high-resolution timer, and keep three numbers: total time, time until the first header, and time until the full content. Present the status, every header, and the three timings in a tidy list.",
  "references": [
    {
      "title": "HTTP semantics, RFC 9110",
      "url": "https://www.rfc-editor.org/rfc/rfc9110"
    },
    {
      "title": "requests documentation",
      "url": "https://docs.python-requests.org/en/latest/"
    }
  ]
},
{
  "id": "p027-jwt-decoder-and-inspector",
  "why": "A JWT is just base64 JSON with an expiry claim. Decode one by hand and the mysterious session token becomes plain data. Checking the algorithm for the unsafe none value is a real security habit, not a decoration.",
  "starter": "Split the token at the dots, base64url-decode the first two parts, and parse each as JSON. Show the header and payload side by side, then compare the exp claim with the current time to flag expired tokens.",
  "references": [
    {
      "title": "JSON Web Token, RFC 7519",
      "url": "https://www.rfc-editor.org/rfc/rfc7519"
    }
  ]
},
{
  "id": "p028-curl-code-generator",
  "why": "cURL pastes are dense and hard to parse, but they are also the best way to reproduce a failing request in an API. Turning one into clean Python, Node, or Go code will pay for itself the first time you use it to debug a live thing.",
  "starter": "Parse the command flag by flag and assemble a plain object: the url, headers into a map, the method, and the body. Then render the target language from one short template string, and get that one language exactly right before adding others.",
  "references": [
    {
      "title": "curl manual page",
      "url": "https://curl.se/docs/manpage.html"
    }
  ]
},
{
  "id": "p029-regex-nfa-dfa-visualizer",
  "why": "Every regular expression is a small state machine, and this project makes it visible in a picture: states as nodes, character moves as arrows. Once you have looked at a*bc drawn out, the claim that the engine matched stops sounding like magic.",
  "starter": "Compile a tiny regex like a*bc to an NFA with pythomaut and print its states and moves in the console so you can read them. Then draw each state as a labelled circle in SVG and each move as a labelled arrow.",
  "references": [
    {
      "title": "Finite automaton on Wikipedia",
      "url": "https://en.wikipedia.org/wiki/Finite_state_automaton"
    },
    {
      "title": "Deterministic finite automaton on Wikipedia",
      "url": "https://en.wikipedia.org/wiki/Deterministic_finite_automaton"
    }
  ]
},
{
  "id": "p030-dns-lookup-explorer",
  "why": "When you type a name, a quiet system of zone servers answers in sequence: A records hand you an IP, MX show where mail goes, NS show who is in charge of the name. Watching the chain resolve is a genuine aha moment.",
  "starter": "Query one well-known domain for A records with dnspython and print the answer. Then loop a list of record types (A, AAAA, MX, NS, TXT) and present each answer in a table, noting what comes back empty.",
  "references": [
    {
      "title": "dnspython documentation",
      "url": "https://www.dnspython.org/"
    },
    {
      "title": "DNS overview on Wikipedia",
      "url": "https://en.wikipedia.org/wiki/Domain_Name_System"
    }
  ]
},
{
  "id": "p031-kaleidoscope-image-generator",
  "why": "A kaleidoscope is pure pixel geometry: slice an image into eighths, mirror and rotate the copies, and a photo becomes mandala art. The fun is tuning: slice width, mirror order, and colour until the result looks alive.",
  "starter": "Crop one eighth slice from a test image, and paste rotated copies around the centre. Mirror every other copy so the eight slices tile perfectly. Play with the slice width until it looks good, and only then take user uploads.",
  "references": [
    {
      "title": "Pillow Image reference",
      "url": "https://pillow.readthedocs.io/en/stable/reference/Image.html"
    },
    {
      "title": "Kaleidoscope on Wikipedia",
      "url": "https://en.wikipedia.org/wiki/Kaleidoscope"
    }
  ]
},
{
  "id": "p032-perlin-noise-terrain-generator",
  "why": "Perlin noise sits behind a hundred natural effects: terrain, smoke, texture, clouds. It is not random: it lays a grid of gradient vectors and interpolates smoothly between them. Once you have seen a heightmap, the word noise never reads as random again.",
  "starter": "Start by generating a 256 by 256 grid of smoothed random values and plot it as a grayscale image with matplotlib before adding anything else. Then double the grid and mix two octaves of different frequency, and watch it read as terrain.",
  "references": [
    {
      "title": "Noise functions on Wikipedia",
      "url": "https://en.wikipedia.org/wiki/Noise_functions"
    },
    {
      "title": "Matplotlib gallery",
      "url": "https://matplotlib.org/stable/users/gallery/index.html"
    }
  ]
},
{
  "id": "p033-mandelbrot-julia-explorer",
  "why": "A two-line loop, z = z squared plus c, produces an image with infinite detail. It is the poster child of mathematical computing, and watching a pan and zoom expose new structure at every level of the boundary rewires how you think about iteration.",
  "starter": "First, in Python or pure JS, map each pixel of a small grid to a complex number c, iterate z = z squared + c up to a cap, colour by iteration count, and render the grid. Add pan and zoom before touching Julia sets or WebGL.",
  "references": [
    {
      "title": "Mandelbrot set on Wikipedia",
      "url": "https://en.wikipedia.org/wiki/Mandelbrot_set"
    },
    {
      "title": "Jupyter documentation",
      "url": "https://numba.readthedocs.io/stable/index.html"
    }
  ]
},
{
  "id": "p034-colour-blindness-simulator",
  "why": "Colour blindness is a matrix, not a vibe: multiply an image by the protanopia, deuteranopia, or tritanopia matrix and the swaps become visible. If you build an interface, this is the one that changes how you handle red-green-heavy design.",
  "starter": "Load an image into a PIL array and apply one matrix at a time. Save the original and the transformed output side by side, and check the difference is visible and plausible before accepting more than one matrix type.",
  "references": [
    {
      "title": "Colour vision deficiency on Wikipedia",
      "url": "https://en.wikipedia.org/wiki/Color_vision_deficiency"
    },
    {
      "title": "Pillow Image reference",
      "url": "https://pillow.readthedocs.io/en/stable/reference/Image.html"
    }
  ]
},
{
  "id": "p035-css-gradient-palette-generator",
  "why": "Gradients look trivial until you have to explain why two CSS lines look different. Dragging stops around a live preview teaches you where the colour stops sit, and leaves you with a design tool that emits copy-paste CSS for your own projects.",
  "starter": "Keep a list of colour and stop-percentage pairs in JS and rebuild the background string every time one changes. Render the result on a preview div, and mirror the same CSS into a text field the user can copy.",
  "references": [
    {
      "title": "Using CSS gradients on MDN",
      "url": "https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_image_values/Using_CSS_gradients"
    },
    {
      "title": "radial-gradient on MDN",
      "url": "https://developer.mozilla.org/en-US/docs/Web/CSS/radial-gradient"
    }
  ]
},
{
  "id": "p036-svg-geometric-pattern-generator",
  "why": "SVG is a format you will actually ship in production, and you will build it out of primitives: circles, polygons, paths, transforms. Turning one function that places the tile into a full-bleed pattern is one of the fastest satisfying payoffs in generative design.",
  "starter": "Build a grid of circles in an SVG element with document.createElementNS, varying radius and colour from the column and row. Get one tiling (triangles, hexagons) working, then export the whole element as an .svg file.",
  "references": [
    {
      "title": "SVG tutorial on MDN",
      "url": "https://developer.mozilla.org/en-US/docs/Web/SVG/Tutorial"
    }
  ]
},
{
  "id": "p037-l-system-plant-visualizer",
  "why": "An L-system is a rewrite rule that describes growth, and it is one of the most surprising results you can run in an afternoon: a string of Fs iterated four times coasts a whole branching tree. Watching depth three turn into a meadow is a genuine aha moment.",
  "starter": "Start from an axiom like X and two production rules, and expand the string one iteration at a time in depth two. In turtle, map each letter to a movement or a turn, and print the shape from depth three upward until it grows and branches.",
  "references": [
    {
      "title": "L-system on Wikipedia",
      "url": "https://en.wikipedia.org/wiki/L-system"
    },
    {
      "title": "Python turtle documentation",
      "url": "https://docs.python.org/3/library/turtle.html"
    }
  ]
},
{
  "id": "p038-pixel-art-editor",
  "why": "A grid, a palette, layers. It is a small graphics editor, and the interesting part in practice is the state: what is on each cell, which layer is active. Get that tight, and you have done the same architecture a real editor does, with more pixels.",
  "starter": "Keep the canvas as a 16 by 16 2D array and draw each cell enlarged to the Canvas with image smoothing off. Replace the cell on click. Get the palette and export working, then add layers as parallel 16 by 16 arrays.",
  "references": [
    {
      "title": "Canvas MDN tutorial",
      "url": "https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API/Tutorial"
    },
    {
      "title": "imageSmoothingEnabled on MDN",
      "url": "https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/imageSmoothingEnabled"
    }
  ]
},
{
  "id": "p039-flow-field-generative-art",
  "why": "A flow field is a grid of directions, and it is one of the clearest cases of a simple rule producing a complex image: sample an angle per point from noise and have a thousand particles leave organic trails. The whole look comes from following, not drawing.",
  "starter": "Draw a small arrow grid first: for each cell, sample one noise value at x, y for the angle and draw a short line. When the field reads, let a thousand particles step along their arrows, adding one segment per step at a time.",
  "references": [
    {
      "title": "Noise functions on Wikipedia",
      "url": "https://en.wikipedia.org/wiki/Noise_functions"
    },
    {
      "title": "Canvas MDN tutorial",
      "url": "https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API/Tutorial"
    }
  ]
},
{
  "id": "p040-photo-mosaic-collage-maker",
  "why": "For you, a thousand small photos add up to one big picture. This is image-processing fundamentals (average colour per patch, nearest neighbour in colour space), and the finished mosaic is a legitimate output you can show off for the afternoon.",
  "starter": "Compute the average RGB of each palette image at small size and keep it in an array. For every region on the mosaic, find the palette image with the closest average by squared distance and paste the scaled tile. Start at 80 by 100 regions.",
  "references": [
    {
      "title": "Pillow Image reference",
      "url": "https://pillow.readthedocs.io/en/stable/reference/Image.html"
    },
    {
      "title": "Nearest-neighbour method on Wikipedia",
      "url": "https://en.wikipedia.org/wiki/K-nearest_neighbors_algorithm"
    }
  ]
},
{
  "id": "p041-big-o-complexity-visualizer",
  "why": "Big O is the interview question and the language of speed. Plotting n, n squared, n log n, 2 to the n, and n! on a drag slider pins down permanently why n log n versus n squared is only a visual difference unless you are at the scale of billions.",
  "starter": "Define the five curves as functions of n. Plot them in Chart.js, with a slider from 1 to 1,000, and display the current value in the chart title. Add a toggle for log scale, and watch what the linear scale hides.",
  "references": [
    {
      "title": "Chart.js documentation",
      "url": "https://www.chartjs.org/docs/latest/"
    },
    {
      "title": "Big O notation on Wikipedia",
      "url": "https://en.wikipedia.org/wiki/Big_O_notation"
    }
  ]
},
{
  "id": "p042-sorting-algorithm-visualizer",
  "why": "You have used sorted lists all your life, but can you say why one sort is fast and one is slow? Watching bubble sort crawl while merge sort sweeps a hundred elements is the visual version of that answer, and it sticks.",
  "starter": "Record every comparison and swap separately, not just the mutated array. Implement bubble sort so each change appends a step, and do the same for merge and quick sorts using the same step format. Then render the array frame by frame at a chosen speed.",
  "references": [
    {
      "title": "Sorting algorithms on Wikipedia",
      "url": "https://en.wikipedia.org/wiki/Sorting_algorithm"
    },
    {
      "title": "Comparison of sorting algorithms",
      "url": "https://en.wikipedia.org/wiki/Comparison_of_sorting_algorithms"
    }
  ]
},
{
  "id": "p043-graph-traversal-visualizer",
  "why": "Graph search sits behind map apps, recommendations, and nearly every find-this feature you use. BFS keeps distance order and DFS dives before width, and watching both highlight nodes in different orders is where the difference stops being a diagram.",
  "starter": "Fix a small graph of about ten nodes as SVG circles with lines between them. Implement BFS on the map of nodes, and record the visit order and the edges you took. On each turn, highlight that node, and draw the DFS version with the same highlight code.",
  "references": [
    {
      "title": "NetworkX documentation",
      "url": "https://networkx.org/documentation/stable/"
    },
    {
      "title": "Breadth-first search on Wikipedia",
      "url": "https://en.wikipedia.org/wiki/Breadth-first_search"
    }
  ]
},
{
  "id": "p044-binary-search-tree-visualizer",
  "why": "Insert is a walk, and search is a shrink, and a balanced tree is O(log n) for both. Insert powers of two in order and watch the tree tilt into a linked list: that is the best first lesson in why balance matters.",
  "starter": "Model nodes as plain JS objects with a value, left, right, and position. Make insert recursive, and drive the SVG from the tree each time: a circle per node, a line per branch. Highlight the search path on click, before you add the balance rotation.",
  "references": [
    {
      "title": "Binary search tree on Wikipedia",
      "url": "https://en.wikipedia.org/wiki/Binary_search_tree"
    }
  ]
},
{
  "id": "p045-stack-and-queue-visualizer",
  "why": "Last-in-first-out and first-in-first-out sound easy until you explain why the undo button is a stack and the print queue is one of the other. Seeing both side by side, with animated boxes, ends the which-is-which confusion for good.",
  "starter": "Render each element as a CSS box in a row. Push appends it, pop takes the last one from the stack, enqueue appends and takes from the front of the queue. Give each box a short CSS transition so the moves are visible, and flag the capacity limit.",
  "references": [
    {
      "title": "Stack on Wikipedia",
      "url": "https://en.wikipedia.org/wiki/Stack_(abstract_data_type)"
    },
    {
      "title": "Queue on Wikipedia",
      "url": "https://en.wikipedia.org/wiki/Queue_(abstract_data_type)"
    }
  ]
},
{
  "id": "p046-finite-state-machine-builder",
  "why": "State machines drive UI flows, network handshakes, and the string matching you will build anyway. Drawing a machine by dragging states and arrows, and watching an input string light up character by character, makes an Accept/Reject call concrete in a way a slide never could.",
  "starter": "Represent the machine as plain JS: a states array and a transitions array of from, symbol, and to. Hand-draw it in SVG with circles for states and arrows for transitions. Then add the simulation that steps one symbol at a time.",
  "references": [
    {
      "title": "Finite state machine on Wikipedia",
      "url": "https://en.wikipedia.org/wiki/Finite_state_automaton"
    },
    {
      "title": "vis-network documentation",
      "url": "https://visjs.github.io/vis-network/docs/network/"
    }
  ]
},
{
  "id": "p047-sql-join-visualizer",
  "why": "The join is the one topic developers say they know and still mix up in a review, and it is the interview question at the top of the list. Let INNER, LEFT, and FULL fill different rows in the two Venn circles, and half the rule set stops being memorised.",
  "starter": "Build two small tables of about six rows that share a small key. Write one function that pairs rows by key and returns them in the match version per join type. Draw the two sets as overlapping circles in SVG and colour the joined rows.",
  "references": [
    {
      "title": "SQL join examples on W3Schools",
      "url": "https://www.w3schools.com/sql/sql_join.asp"
    }
  ]
},
{
  "id": "p048-hash-table-visualizer",
  "why": "A hash table gets you O(1) average lookups, but only until the keys collide. Watching buckets pile up, toggling between chained lists and open addressing, and seeing the table re-hash is the intuition most documentation skips over.",
  "starter": "Keep an array of bucket arrays, letting a small hash function that modulo on the key land each insert. Colour the collision path as it grows. Then add open addressing with the next bucket and show both modes filling up from the same insert list.",
  "references": [
    {
      "title": "Hash table on Wikipedia",
      "url": "https://en.wikipedia.org/wiki/Hash_table"
    }
  ]
},
{
  "id": "p049-recursion-tree-visualizer",
  "why": "Recursion is the topic that is hard to say and easy to show. The call tree makes it concrete: each node is a function call, for Fibonacci with two children per call, and simply counting the nodes makes the exponential blow-up obvious.",
  "starter": "Describe the function as a plain JS object: a name, a base case, and how many children each step has. Make a recursive tree builder, place each node at a fixed x, y per depth, and print the total call count next to it.",
  "references": [
    {
      "title": "Recursion on Wikipedia",
      "url": "https://en.wikipedia.org/wiki/Recursion"
    },
    {
      "title": "D3.js site",
      "url": "https://d3js.org/"
    }
  ]
},
{
  "id": "p050-dynamic-programming-grid-walk",
  "why": "Dynamic programming is the name people recognise but cannot explain, and the path grid makes it visible: every cell is a subproblem, and memoization just fills it once. Watching memoized and tabular arrive at the same answer with different cell counts is the whole subject in one demo.",
  "starter": "Show the grid as an HTML table, and compute the minimum path value bottom-up, filling cell by cell. Colour the memoized-recursion call as it builds, and count the calls on the right, then swap in the tabular version and compare the counts.",
  "references": [
    {
      "title": "Dynamic programming on Wikipedia",
      "url": "https://en.wikipedia.org/wiki/Dynamic_programming"
    }
  ]
}
];
