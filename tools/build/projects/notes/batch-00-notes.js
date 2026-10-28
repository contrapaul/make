// e02s07 part 1 enrichment notes (50/50). Assembled from reviewer-drafted batches;
// owner reviews before merge. One entry per card, id-ordered to match PROJECTS.
export const NOTES = [
{
  "id": "p001-snake-pong-breakout",
  "why": "One build that teaches the core of every game: the loop, collision, and score. Pong keeps the state tiny, and the geometry you write here is exactly what Breakout needs later.",
  "starter": "Copy the Pygame Quickstart boilerplate. Make one paddle a rectangle steered by keydown events, and one ball a rectangle whose velocity updates each frame, then do one collision check and draw both.",
  "references": [
    {
      "title": "Pygame Quickstart",
      "url": "https://www.pygame.org/docs/quickstart.html"
    },
    {
      "title": "Ray Wenderlich PyGame tutorial",
      "url": "https://www.pygame.org/docs/tut/"
    }
  ]
},
{
  "id": "p002-2048-puzzle",
  "why": "Looks trivial, then you spend three days on it. The grid becomes a data model, not a drawing. The real work is knowing when a move merges equal tiles, then animating the slide.",
  "starter": "Model the board as a 4 by 4 array of integers, zero for empty. Write a shift-and-merge function for one row. Render the board in a CSS grid of divs, then wire two arrow keys to that row.",
  "references": [
    {
      "title": "MDN: CSS Grid Layout",
      "url": "https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_grid_layout"
    },
    {
      "title": "MDN: Element.animate() reference",
      "url": "https://developer.mozilla.org/en-US/docs/Web/API/Element/animate"
    }
  ]
},
{
  "id": "p003-text-adventure-engine",
  "why": "A parser is a job. Type \"go north\" and the program must split the verb from the noun, check room state, and reply correctly. There are no graphics to hide behind.",
  "starter": "The first token of each line is the verb, the rest the target. Keep rooms and items in a JSON file. Write the loop that prints a prompt and reads a line; implement go, take, and drop.",
  "references": [
    {
      "title": "Python re module reference",
      "url": "https://docs.python.org/3/library/re.html"
    },
    {
      "title": "Zork, the influential text adventure",
      "url": "https://en.wikipedia.org/wiki/Zork"
    }
  ]
},
{
  "id": "p004-random-password-generator",
  "why": "The \"easy\" one that is not easy. Uniform random characters expose how much weaker a length rule is than it looks, and why crypto randomness is not the same as Math.random.",
  "starter": "Add a length input, four checkboxes for character class, and a generate button. Draw chars into a Uint32Array with window.crypto.getRandomValues, reject out-of-bounds, copy via navigator.clipboard.",
  "references": [
    {
      "title": "MDN: Web Crypto API",
      "url": "https://developer.mozilla.org/en-US/docs/Web/API/Web_Crypto_API"
    },
    {
      "title": "MDN: Crypto.getRandomValues()",
      "url": "https://developer.mozilla.org/en-US/docs/Web/API/Crypto/getRandomValues"
    }
  ]
},
{
  "id": "p005-color-palette-extractor",
  "why": "The shortest path to seeing an image as numbers. RGB is three coordinates, and printing hex values makes the colors easy to reuse in another tool.",
  "starter": "Load a jpg with Pillow and scale it small. Round each channel set to get discrete colors, count them, and print the top five as hex. Wrap it in a function: in a path, out five strings.",
  "references": [
    {
      "title": "Pillow documentation",
      "url": "https://pillow.readthedocs.io/"
    },
    {
      "title": "OpenCV official documentation",
      "url": "https://docs.opencv.org/"
    },
    {
      "title": "K-means clustering overview",
      "url": "https://en.wikipedia.org/wiki/K-means_clustering"
    }
  ]
},
{
  "id": "p006-markdown-html-blog",
  "why": "The first project where a file is a database. Files on disk hold the articles and a router picks one and renders it, so you learn that \"database\" is just organized text. The line between blog and CMS is thinner than it looks.",
  "starter": "Write a Python function that reads a markdown file and splits its leading YAML frontmatter from the body. Render eight or so tags with a library like markdown or marked. Return the whole thing as an HTML string and print it. Then wire it into the one endpoint.",
  "references": [
    {
      "title": "Flask official tutorial",
      "url": "https://flask.palletsprojects.com/en/3.0.x/tutorial/"
    },
    {
      "title": "CommonMark spec",
      "url": "https://spec.commonmark.org/"
    }
  ]
},
{
  "id": "p007-expense-tracker-cli",
  "why": "CSV almost has no type, and summarizing three months of spending means dealing with missing categories, mixed currencies, and rounding that does not sum to the total. The exercise is small, but it touches nearly every CSV edge case production data throws at you.",
  "starter": "Define a struct with serde that matches the CSV columns, one field per column. Write a command that reads the file and prints the total by month using an iterator over a grouped map. Verify on a small hand-makes file before chaining anything else.",
  "references": [
    {
      "title": "clap command line reference",
      "url": "https://docs.rs/clap"
    },
    {
      "title": "serde documentation",
      "url": "https://serde.rs/"
    }
  ]
},
{
  "id": "p008-qr-code-generator",
  "why": "A QR code is a 2D barcode whose bits you can compute by hand. Adding a library means adding one function, and rebuilding it means a second one. Seeing the matrix next to the input URL beats understanding \"error correction\" from a diagram.",
  "starter": "Drop in the official QR code library with pip. Write a function that takes a string and error-correction level and returns an image object. Build a Flask page with a form, generate on submit, and stream it back as response mimetype. Show the zeroth sample before the UI polish.",
  "references": [
    {
      "title": "QR code standard overview",
      "url": "https://en.wikipedia.org/wiki/QR_code"
    },
    {
      "title": "Flask official tutorial",
      "url": "https://flask.palletsprojects.com/en/3.0.x/"
    }
  ]
},
{
  "id": "p009-typing-speed-test",
  "why": "A new page where your keyboard is the test equipment. Simple time and click math gets you a percent, but handling autocorrect, system input throttling, and timing of the first keystroke is real UX, not filler.",
  "starter": "Put the passage in a contenteditable div, or in a span-free text node per word. Track a keystroke on input, and on the first type start a performance.now timer. Count correct and total keystrokes, and update a WPM readout on each key event.",
  "references": [
    {
      "title": "MDN: performance.now()",
      "url": "https://developer.mozilla.org/en-US/docs/Web/API/Performance/now"
    },
    {
      "title": "MDN: Keyboard.event.data",
      "url": "https://developer.mozilla.org/en-US/docs/Web/API/InputEvent/data"
    }
  ]
},
{
  "id": "p010-web-scraped-weather-widget",
  "why": "The real enemy here is the API, not the code. Reading a response, pulling out a temperature and an icon, comparing its JSON to what the docs said, and handling a missing field is exactly what you do every day.",
  "starter": "From a free weather API, grab the JSON for your own city into a Python dict with requests. Print the temperature, feels_like, and a human-friendly line with requests. Then parse only one source with a few BeautifulSoup tags. Move the rest of the fields out of the library.",
  "references": [
    {
      "title": "requests documentation",
      "url": "https://docs.python-requests.org/"
    },
    {
      "title": "BeautifulSoup documentation",
      "url": "https://www.crummy.com/software/BeautifulSoup/bs4/"
    }
  ]
},
{
  "id": "p011-file-duplicate-finder",
  "why": "A file tree is a graph and hashing a gigabyte of documents is a real I/O job. Two passes are the answer, the cheap size check first and the hash only for suspicious groups, because anything slower makes the user wait forever. That decision is the program.",
  "starter": "Walk the tree with filepath.WalkDir into a map keyed by size. For each size bucket with more than one file, walk the directory with an io copy and hash it with a hash function. Print groups of identical hashes. Use a flag if the default output is off.",
  "references": [
    {
      "title": "Go os Path documentation",
      "url": "https://pkg.go.dev/path"
    },
    {
      "title": "Go Hash Package Summary",
      "url": "https://pkg.go.dev/hash"
    }
  ]
},
{
  "id": "p012-pomodoro-timer-gui",
  "why": "A timer should not tick on the main thread, or the window will freeze during resizes. Switching between work and break modes is the smallest state machine you will ever write, and the notification hook shows how to leave the app's window frame.",
  "starter": "Create a window with a label that holds the remaining time. Start a 1-second interval that decrements a count, and update the label via after(). The label goes red when it hits zero and fires a desktop notification, and switches to a break path at 5 minutes.",
  "references": [
    {
      "title": "Tkinter documentation",
      "url": "https://docs.python.org/3/library/tkinter.html"
    },
    {
      "title": "Tkinter after() reference",
      "url": "https://tcl.tk/man/tcl8.6/TkCmd/after.htm"
    }
  ]
},
{
  "id": "p013-sudoku-solver-generator",
  "why": "Solving is backtracking, and generating is deleting cells while keeping the solution unique, which means you need a solver that can count the number of solutions. One idea, two programs, and node counts show which version wins on a stubborn puzzle.",
  "starter": "Represent the puzzle as an array of 81 characters. Write the solver as a recursive call that picks the cell with the fewest candidates, tries each candidate, and backtracks. Time it and count the nodes visited. Then convert the solved board to a string to verify the generation output.",
  "references": [
    {
      "title": "Backtracking overview",
      "url": "https://en.wikipedia.org/wiki/Backtracking"
    },
    {
      "title": "Sudoku generation article (Wikipedia)",
      "url": "https://en.wikipedia.org/wiki/Sudoku"
    }
  ]
},
{
  "id": "p014-meme-caption-generator",
  "why": "Canvas is a document, not an image. Draw a base, draw two lines of text on top, and export a PNG with a download link. The layers compose exactly like a document, and the toBlob callback is a close look at how the browser hands you back a file.",
  "starter": "Drop in a base image and a canvas. On load, use drawImage to fill the canvas and use fillStyle to add a white border and shadow to the caption. Draw the upper and lower lines with a font that insists on bold uppercase, and export the result with a link to canvas.toBlob.",
  "references": [
    {
      "title": "MDN: Canvas API",
      "url": "https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API"
    },
    {
      "title": "MDN: Canvas text reference",
      "url": "https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API/Tutorial/Drawing_text"
    }
  ]
},
{
  "id": "p015-csv-data-visualizer",
  "why": "Auto-detecting column types is 90% of the real work, and it is the least fun part. Numbers, dates, text, and a broken column that needs to be fixed by hand are all one pipeline. If you skip the detection, Matplotlib will draw everything as text.",
  "starter": "Read the CSV with pd.read_csv, and let infer_types parse the dtype for each column. For each column with numeric dtype, call Matplotlib's plt.plot. Aim for a pipeline that takes path and column name and satisfies all cells. Verified with a hand-written sample.",
  "references": [
    {
      "title": "Pandas official documentation",
      "url": "https://pandas.pydata.org/docs/"
    },
    {
      "title": "Matplotlib quick start",
      "url": "https://matplotlib.org/stable/getting_started/index.html"
    }
  ]
},
{
  "id": "p016-url-shortener",
  "why": "You need a code that gets shorter the more it is used and will not collide. That pushes you toward short base62 names, and the click counter requires a join you will never have a reason for again. A tiny API, full tour of an HTTP flow.",
  "starter": "Open a SQLite file with an sqlite3 or better-sqlite3 style API, and make a table of long, code, and clicks. Add an endpoint that inserts a row with a random 5-character code and redirects. Add an endpoint that increments clicks and streams the target length.",
  "references": [
    {
      "title": "Express official guide",
      "url": "https://expressjs.com/"
    },
    {
      "title": "SQLite official site",
      "url": "https://www.sqlite.org/"
    }
  ]
},
{
  "id": "p017-regex-playground",
  "why": "A pattern tested on ten mystery strings tells you more about an engine than a tutorial does. Highlighting matched groups means running two passes over the same text, and the speed of a bad pattern against itself is the first lesson of a manifold.",
  "starter": "Write a function that takes a string, a body, and options, and returns an array of what matches start, end, and groups. Render text as one span or another, split on the matches, and safely highlight the range. Attach a dropdown for documentation for 12 options and a single input for the text.",
  "references": [
    {
      "title": "MDN: JavaScript regex",
      "url": "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Regular_expressions"
    },
    {
      "title": "Regular expressions overview",
      "url": "https://en.wikipedia.org/wiki/Regular_expression"
    }
  ]
},
{
  "id": "p018-bulk-image-resizer",
  "why": "Throwing thousands of pictures at a one-line command is a real productivity tool, and it shows how a script makes the format option belong to the operation rather than the file. Naming the destination, preserving aspect ratio, and pruning originals is nothing small.",
  "starter": "Load an image with PIL, and have a function that takes a path to input and a scale parameter and returns the file. Then implement main to scan a source directory with glob, and skip anything that already has the size suffix. Aim for a diffable output.",
  "references": [
    {
      "title": "Pillow Image module",
      "url": "https://pillow.readthedocs.io/en/latest/handbook/concepts.html"
    },
    {
      "title": "ImageMagick documentation",
      "url": "https://imagemagick.org/script/"
    }
  ]
},
{
  "id": "p019-conway-s-game-of-life",
  "why": "Four rules and an infinite variety. You can toggle the number of live cells, but what you really learn is flipping a grid without treating the 8 neighbors, and running the grid on a canvas instead of a DOM element.",
  "starter": "Keep two circular buffers of win or loss. Write a rule function that takes two grid arrays, the length, and i egg s?, and returns the next grid. On canvas frames, move a rectangle over one cell for each pixel. Draw once per 33 milliseconds with a requestAnimationFrame loop, and add a speed slider.",
  "references": [
    {
      "title": "Conway's Game of Life",
      "url": "https://en.wikipedia.org/wiki/Conway%27s_Game_of_Life"
    },
    {
      "title": "MDN: Canvas API",
      "url": "https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API"
    }
  ]
},
{
  "id": "p020-recipe-manager-cli",
  "why": "Coefficient change is the whole trick, and the feeling is bigger than the tens-and-put it in do. Writing ingredients as 2 1/2 instead of 2.5 means a small parser, and Searching by ingredient means an inverted index, not a reshape.",
  "starter": "Express a recipe as a map or struct of name; servings; ingredients list. Write add and search commands that take argv and shush the JSON file from a data directory. Write a scale function that multiplies every quantity by n divided by servings.",
  "references": [
    {
      "title": "Ruby standard library docs",
      "url": "https://docs.ruby-lang.org/en/master/"
    },
    {
      "title": "Python json module",
      "url": "https://docs.python.org/3/library/json.html"
    }
  ]
},
{
  "id": "p021-chatbot-rule-based",
  "why": "Before modern LLMs, rule-based chatbots were the whole field, and Eliza shows how little pattern matching can feel conversational. Building one is honest NLP: you design a pattern table, capture groups, and response slots, and you see immediately where hand-crafted conversation breaks down.",
  "starter": "Keep a list of rules, each with a regex and a response template containing numbered slot markers. For user input, find the first matching rule, capture the group, and substitute it into the template slot. Add a small memory slot that stores a previous user phrase and echoes it.",
  "references": [
    {
      "title": "MDN RegExp capture groups",
      "url": "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Regular_expressions"
    },
    {
      "title": "Wikipedia Joseph Weizenbaum Eliza",
      "url": "https://en.wikipedia.org/wiki/Eliza_%28program%29"
    }
  ]
},
{
  "id": "p022-bmi-health-calculator",
  "why": "A calculator page is the cleanest possible front end, and doing it well still covers unit conversion, edge inputs, and drawing an accurate band chart. The BMI scale is also a nice case study in how a unitless number acquired real health meaning, and where the formula is actually valid.",
  "starter": "Read height in centimeters and weight in kilograms, compute weight over height squared, and map the result to the WHO bands. Draw a horizontal axis with labeled zones, place a marker at the user value, and output the band name and a plain English description.",
  "references": [
    {
      "title": "MDN Number isFinite method",
      "url": "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number"
    },
    {
      "title": "Wikipedia body mass index page",
      "url": "https://en.wikipedia.org/wiki/Body_mass_index"
    }
  ]
},
{
  "id": "p023-git-commit-message-linter",
  "why": "Conventional Commits are cheap to write and hard to enforce by hand, so tools pay for themselves fast. A linter is a small but complete parser: subject format, type and scope lists, breaking-change markers, and body length limits, each with a different error message.",
  "starter": "Read the commit message from stdin or a file, split subject and body on the blank line, and match the subject against type, scope, and colon dash space. Return a non-zero exit code with a descriptive message for each violated rule, and print a list of all violations, not just the first.",
  "references": [
    {
      "title": "Conventional Commits specification",
      "url": "https://www.conventionalcommits.org/"
    },
    {
      "title": "Rust regex crate docs",
      "url": "https://docs.rs/regex"
    }
  ]
},
{
  "id": "p024-random-story-generator",
  "why": "Template-based story generators are a miniature language: slots, list choices, conditional branches, and template composition. It makes you think about what grammatical structure actually is, and the templates are worth tuning long after the code is finished.",
  "starter": "Write a few Jinja2 templates with slots like \"There was once a NAME in PLACE.\" Load them from files, fill the slots with random list items, a random verb, a random adjective, and print the assembled paragraph with a restart loop.",
  "references": [
    {
      "title": "Jinja2 template language docs",
      "url": "https://jinja.palletsprojects.com/en/3.1.x/templates/"
    },
    {
      "title": "Python random module docs",
      "url": "https://docs.python.org/3/library/random.html"
    }
  ]
},
{
  "id": "p025-pdf-merger-splitter",
  "why": "PDFs look simple but the format is a lattice of cross-referenced objects, so any merge tool is really a network file format operation. PyPDF2 makes that gentle, and you learn the real page semantics: page ranges, zero-based indexing, and why encrypted documents break the whole pipeline.",
  "starter": "Write a function that opens each input PDF with PdfReader and appends its pages into a PdfWriter, then writes to the output path. For splitting, take a start and end argument slice and write the selected range to one file per chunk, or to a single file.",
  "references": [
    {
      "title": "PyPDF predecessor pypdf docs",
      "url": "https://pypi.org/project/PyPDF2/"
    },
    {
      "title": "PDF 1.7 specification reference",
      "url": "https://en.wikipedia.org/wiki/Portable_Document_Format"
    }
  ]
},
{
  "id": "p026-kanban-board-local",
  "why": "A kanban board is a small app that needs real interaction: dragging, reordering, and saving state the browser keeps for tomorrow. It teaches real state with only a few HTML elements.",
  "starter": "In React, build one Column component that takes a title and a card list, and render three columns side by side with flexbox. Add native HTML5 drag-and-drop: set draggable on each card, store the dragged id in dragstart, and call preventDefault on each column's dragover so drops are allowed.",
  "references": [
    {
      "title": "HTML Drag and Drop API",
      "url": "https://developer.mozilla.org/en-US/docs/Web/API/HTML_Drag_and_Drop_API"
    },
    {
      "title": "localStorage reference",
      "url": "https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage"
    }
  ]
},
{
  "id": "p027-binary-hex-converter",
  "why": "Numbers in the wrong base look like magic. Building a converter forces you to learn that decimal, hex, octal, and binary are the same value wearing different costumes.",
  "starter": "Make an HTML page with one number input and four output boxes for hex, octal, and binary. In JavaScript, use parseInt with a radix, like parseInt(text, 16), and convert out with toString(16), toString(8), and toString(2). Show a line explaining each digit as you go.",
  "references": [
    {
      "title": "Number.parseInt reference",
      "url": "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number/parseInt"
    },
    {
      "title": "Number.toString reference",
      "url": "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number/toString"
    }
  ]
},
{
  "id": "p028-music-visualizer",
  "why": "Audio is invisible, and this project turns it into bars you can see. The Web Audio API hands you live frequency data, so you are wiring a real signal chain, not faking motion with CSS.",
  "starter": "Play an uploaded file with an audio element, then build an AudioContext, a MediaElementSourceNode feeding an AnalyserNode, connected to the destination. In a requestAnimationFrame loop, call getByteFrequencyData on a Uint8Array and draw one fillRect per bin on a canvas.",
  "references": [
    {
      "title": "AnalyserNode reference",
      "url": "https://developer.mozilla.org/en-US/docs/Web/API/AnalyserNode"
    },
    {
      "title": "Web Audio API introduction",
      "url": "https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API"
    }
  ]
},
{
  "id": "p029-todo-api-cli-client",
  "why": "Most beginners build the screen or the API, never both. This one makes you write both ends of a conversation: a Go server that stores todos, and a Python client that talks to it over HTTP.",
  "starter": "In Go, write a net/http server with three handlers: GET /todos returns a JSON array, POST /todos appends one, DELETE removes by id. Guard the slice with a sync.Mutex. In Python, use the requests library to call the same three endpoints from a small CLI loop.",
  "references": [
    {
      "title": "net/http package docs",
      "url": "https://pkg.go.dev/net/http"
    },
    {
      "title": "Python requests quickstart",
      "url": "https://docs.python-requests.org/en/latest/user/quickstart/"
    }
  ]
},
{
  "id": "p030-word-frequency-counter",
  "why": "Counting words looks trivial until you decide what a word even is. Hyphens, apostrophes, and case turn a ten line script into a small language study, and the counter stays a handy tool afterwards.",
  "starter": "In Python, read the file, lowercase it, and split into words. Count with collections.Counter, print the top twenty with rank and count, and write the same rows to CSV with the csv module. Then trim a bit of punctuation and hyphens before counting so mother-in-law counts once.",
  "references": [
    {
      "title": "csv module docs",
      "url": "https://docs.python.org/3/library/csv.html"
    },
    {
      "title": "collections.Counter docs",
      "url": "https://docs.python.org/3/library/collections.html#collections.Counter"
    }
  ]
},
{
  "id": "p031-tic-tac-toe-vs-ai",
  "why": "Tic-tac-toe is the perfect size to write an unbeatable AI from scratch. Minimax is the real algorithm behind chess engines, and doing it here shows you how search depth bites as you optimize.",
  "starter": "Represent the board in JavaScript as a list of nine slots. Write an isWinner check, a legal-moves list, and a minimax function returning the best score each side can force. Difficulty toggle: easy picks a random move, hard picks the best minimax move.",
  "references": [
    {
      "title": "Minimax game theory article",
      "url": "https://en.wikipedia.org/wiki/Minimax"
    }
  ]
},
{
  "id": "p032-image-ascii-art",
  "why": "Turning a photo into a block of letters is a rare \"wow, that is how machines see pictures\" moment. You only need arithmetic on gray values, but choosing which letter matches which brightness is real art sense.",
  "starter": "In Python, open the image with Pillow, convert it to grayscale, and resize it to about 80 by 40 pixels. For every pixel, look up its 0 to 255 brightness in a ramp string from space to pound sign, and print each row. Try smaller fonts if the ratios look off.",
  "references": [
    {
      "title": "Pillow Image docs",
      "url": "https://pillow.readthedocs.io/en/stable/reference/Image.html"
    }
  ]
},
{
  "id": "p033-cron-style-job-scheduler-mini",
  "why": "Every server you ever touch runs some version of this behind the curtain. A tiny scheduler teaches how programs think about time, and that a log file is the only honest memory a background loop has.",
  "starter": "If using Bash, write a loop that checks the date every thirty seconds and runs the command when the minute matches. If using Python, call APScheduler's add_job with a cron trigger for each (minute, command) pair. After every run, append the start time, command, and exit code to a log file.",
  "references": [
    {
      "title": "APScheduler documentation",
      "url": "https://apscheduler.readthedocs.io/en/3.x/"
    }
  ]
},
{
  "id": "p034-flashcard-quiz-app",
  "why": "Spaced repetition is the whole reason flashcards work, and building the app makes the algorithm concrete instead of a marketing word. You get to choose how \"hard\" cards resurface, a real product decision.",
  "starter": "In React, model each deck as an array of cards with front, back, and wrongs, stored in localStorage. Study mode shows one card, a reveal button, and grade buttons that update wrongs. Add a shuffle button that sorts a copy with a Fisher-Yates pass over the array.",
  "references": [
    {
      "title": "Fisher-Yates shuffle",
      "url": "https://en.wikipedia.org/wiki/Fisher-Yates_shuffle"
    }
  ]
},
{
  "id": "p035-file-encryption-decryption",
  "why": "This is where \"encrypted\" stops being a word and becomes bytes you can inspect on disk. Deriving a key from a passphrase with salt, then using AES-GCM, is exactly how GPG and similar tools work.",
  "starter": "In Python with the cryptography library, try the high-level Fernet API first so round-trip encrypt/decrypt works end to end. Then switch to low-level AES-GCM: salt with os.urandom, derive a key with HKDF, generate an IV, encrypt, and store salt, IV, tag, and ciphertext in the output file.",
  "references": [
    {
      "title": "cryptography library docs",
      "url": "https://cryptography.io/en/latest/"
    }
  ]
},
{
  "id": "p036-real-time-chat-localhost",
  "why": "Two browser tabs talking to each other in real time is the moment you start to feel like you understand the internet. Socket.IO is just a friendlier way to say WebSockets.",
  "starter": "In Node.js, create a server with Socket.IO connected to an http app. On room code join, listen for message, save a {user, text, time} object, and broadcast it to the rest of that room. The client page asks for a room code and a name, then sends on form submit.",
  "references": [
    {
      "title": "Socket.IO getting started",
      "url": "https://socket.io/docs/v4/getting-started/"
    }
  ]
},
{
  "id": "p037-fibonacci-collatz-visualizer",
  "why": "Both sequences look trivial to write and hide surprising structure. Plotting and comparing iteration counts shows how fast Fibonacci explodes, and how the Collatz conjecture never obviously breaks. It is a nice fast visual to reason about.",
  "starter": "In Python with Matplotlib, write two generator or list functions: fibonacci(n) that extends the list by adding the last two, and collatz_steps(n) that loops n = n/2 or 3n+1 until 1. Plot each sequence with plt.plot in one figure with a legend, and log the scale where needed.",
  "references": [
    {
      "title": "Matplotlib documentation",
      "url": "https://matplotlib.org/stable/"
    },
    {
      "title": "Collatz conjecture",
      "url": "https://en.wikipedia.org/wiki/Collatz_conjecture"
    }
  ]
},
{
  "id": "p038-markdown-notes-app",
  "why": "A notes app feels self-evident, but it is really an exercise in indexing: how to search without a database and when to export. IndexedDB is async in a way localStorage is not, and the difference shows up fast.",
  "starter": "In vanilla JS, open IndexedDB with one object store keyed by id. Build the note editor around debounced save, meaning wait 300 ms after the user stops typing before persisting. The search box filters in memory by substring on title and body. To export, get the note and download it as a Blob.",
  "references": [
    {
      "title": "IndexedDB tutorial",
      "url": "https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API/Using_IndexedDB"
    }
  ]
},
{
  "id": "p039-text-to-speech-reader",
  "why": "Web Speech is already installed in every browser, so this is a visible bridge from code to hearing. Highlighting the spoken word is the hard part: the boundary event fires mid-word, so the highlight only feels right when the sync is tight.",
  "starter": "In JavaScript, use speechSynthesis.speak with a SpeechSynthesisUtterance built from the input text. In the utterance onboundary event, set the event name to word, and use event.charIndex to find the current word in the text and wrap it in a mark. Pick a voice with speechSynthesis.getVoices one.",
  "references": [
    {
      "title": "Web Speech API reference",
      "url": "https://developer.mozilla.org/en-US/docs/Web/API/Web_Speech_API"
    }
  ]
},
{
  "id": "p040-rock-paper-scissors-tournament",
  "why": "Rock-paper-scissors is a state machine in a trenchcoat. Tracking streaks and totals across a best-of-N tournament forces you to structure state the way a real game engine does.",
  "starter": "In HTML and JavaScript, build the game as a data model first: a record object with player wins, AI wins, streaks, and best-of-N round outcomes. Give it a play round function that picks the outcome, updates the record, and writes stats. Then wrap it in two buttons and a scoreboard div.",
  "references": [
    {
      "title": "JavaScript objects reference",
      "url": "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Working_with_objects"
    }
  ]
},
{
  "id": "p041-log-file-parser-and-alert",
  "why": "Reading a log file and knowing what it means is a real engineering skill, worth more than almost any toy app. Transforming a raw text dump into a summary with alert messages makes debugging look less like witchcraft.",
  "starter": "Start in Bash with tail-f and a while-read loop, print lines that match a pattern from a small grep list of ERROR and FATAL and WARN. Count matches with grep-count and -c. In Python, do the same with a regex per level, print a summary, and classify by severity.",
  "references": [
    {
      "title": "grep GNU documentation",
      "url": "https://www.gnu.org/software/grep/manual/grep.html"
    },
    {
      "title": "awk user guide",
      "url": "https://www.gnu.org/software/gawk/manual/gawk.html"
    }
  ]
},
{
  "id": "p042-personal-portfolio-site",
  "why": "A one-page portfolio is the most useful artifact a young developer can own. It forces choices about layout, color, and whether the mobile phone can actually read it, all with no backend.",
  "starter": "Write HTML first: header with name, a grid of three project cards, a short bio, and a contact block. Add a mailto link on a Send button. In CSS, use a media query at 640 pixels to stack the grid vertically on phones. A few JavaScript lines can add mobile scroll handling and email toast.",
  "references": [
    {
      "title": "HTML reference",
      "url": "https://developer.mozilla.org/en-US/docs/Web/HTML"
    },
    {
      "title": "CSS media queries",
      "url": "https://developer.mozilla.org/en-US/docs/Web/CSS/Media_queries"
    }
  ]
},
{
  "id": "p043-unit-converter",
  "why": "Converters look like a lookup table, but doing them cleanly means making the conversion rules themselves data. That turns \"place X here\" boilerplate into a dictionary you can extend without touching the logic.",
  "starter": "In JavaScript, put each category in a flat object with the number of base units per unit, meters per kilo and feet per inch. Convert means multiply the input by the from-unit's value-to-base, then divide by the to-unit's, with a small epsilon. Build the HTML select from the keys.",
  "references": [
    {
      "title": "Flask web framework docs",
      "url": "https://flask.palletsprojects.com/"
    }
  ]
},
{
  "id": "p044-minesweeper",
  "why": "Minesweeper is the classic game that needs real data structure thinking. Flood-fill reveal is a real algorithm, and tracking flags and first-click safety are tiny decisions that teach you how game state is managed in practice.",
  "starter": "Use a Canvas or a grid of buttons to render cells. Store booms as a 2D array, place them randomly keeping the first click safe. For flood-fill, use a queue: if a cell has zero neighboring mines and is not yet shown, push its unrevealed neighbors too. Flag mode toggles a second array.",
  "references": [
    {
      "title": "Flood fill algorithm",
      "url": "https://en.wikipedia.org/wiki/Flood_fill"
    },
    {
      "title": "Canvas tutorial",
      "url": "https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API/Tutorial"
    }
  ]
},
{
  "id": "p045-api-rate-limiter-simulator",
  "why": "Every API you call has been shaped by a rate limiter, and the shape depends on which one. Watching a token bucket fill and drain, versus a leaky bucket, makes the difference concrete.",
  "starter": "Pick a language and build the two buckets as two small structs with a capacity and a rate. Loop a millisecond, adding tokens to the bucket at an interval proportional to rate and capping at capacity. Have a request come in, check the bucket, and log allow or deny per request. ",
  "references": [
    {
      "title": "Token bucket algorithm",
      "url": "https://en.wikipedia.org/wiki/Token_bucket"
    },
    {
      "title": "Leaky bucket",
      "url": "https://en.wikipedia.org/wiki/Leaky_bucket"
    }
  ]
},
{
  "id": "p046-random-name-id-generator",
  "why": "Fake data is a real engineering job. Generating names, UUIDs, and employee IDs that look plausible means learning where randomness comes from, and where a browser's crypto API is stronger than Math.random for the parts that need it.",
  "starter": "In HTML and JavaScript, build three buttons: name, UUID, and ID. For names, pick at random from two arrays of first and last names. For UUIDs, call crypto.randomUUID. For employee IDs, format a random six digit number with a prefix, printing the result in a growing list.",
  "references": [
    {
      "title": "crypto.randomUUID reference",
      "url": "https://developer.mozilla.org/en-US/docs/Web/API/Crypto/randomUUID"
    }
  ]
},
{
  "id": "p047-markdown-cheat-sheet-app",
  "why": "A cheat sheet is the most pragmatic reference you can build for someone who uses Markdown daily. You get to write the syntax examples yourself, which means finally seeing what the syntax looked like before tools hid it.",
  "starter": "In React, model each rule as an object with the name, the syntax, an example, and tags. Render a grid of cards, and filter by search box with a substring match against name and tags. Give every card a click-to-copy button that uses navigator.clipboard on the syntax.",
  "references": [
    {
      "title": "Markdown guide",
      "url": "https://www.markdownguide.org/basic-syntax/"
    }
  ]
},
{
  "id": "p048-image-watermarker",
  "why": "Batch-processing a folder with Pillow is the most practical self-defense skill for sharing photos. Position, opacity, and font size are real design choices, and it shows why image libraries expose pixels as numbers rather than pictures.",
  "starter": "In Python with Pillow, open each image in a folder, and draw the watermark on a transparent overlay layer, meaning an RGBA image the same size as the source. Use ImageDraw to place the text with an alpha, then Image.alpha_composite. Walk the folder with the os module and save in a new directory.",
  "references": [
    {
      "title": "Pillow documentation",
      "url": "https://pillow.readthedocs.io/en/stable/"
    }
  ]
},
{
  "id": "p049-simple-http-server-from-scratch",
  "why": "You use HTTP thousands of times a day, so writing the server side is rare, fun, and humbling. Parsing a raw request and writing status lines shows what the browser has been hiding from you.",
  "starter": "In Rust or C, open a listening TCP socket on a port and loop accepting connections. Read into a buffer until you hit blank lines, and look for the request line. Parse the first token for method and the second for path, and on a GET respond with the file body and a 200 header.",
  "references": [
    {
      "title": "HTTP specification (RFC 9110)",
      "url": "https://www.rfc-editor.org/rfc/rfc9110"
    }
  ]
},
{
  "id": "p050-where-s-the-bug-code-quiz",
  "why": "Reading broken code is a superpower that makes writing good code free. Writing the quiz means writing the explanation, and that is where you learn what the bug was, and why the fix matters, not just that it does.",
  "starter": "In HTML and JavaScript, make each question an object: code lines in an array, the right index, and a hint and a reason it is the bug. Render the code lines as clickable divs with data-attributes, write a highlight function, and store score in a number. Add a Reset button.",
  "references": [
    {
      "title": "JavaScript reference",
      "url": "https://developer.mozilla.org/en-US/docs/Web/JavaScript"
    }
  ]
}
];
