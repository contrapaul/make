# Screenshot shot list

Every screenshot the site uses. Save each one in this folder **with exactly
the file name given**. The page picks it up by itself: no code change needed.
Until a file exists, the page shows a dashed placeholder frame with the
description below.

`test/links.test.mjs` fails if the page uses a file name that is not in this
list, so a typo cannot fail silently. Add a row here first, then the `<img>`.

## Before you start

- **English UI.** Leave VS Code in English. (See Setup step 2: the site
  recommends English menus, so the pictures must match.)
- **A clean profile.** No extra extensions, no custom theme. Use the theme a
  fresh install chooses. In VS Code: gear icon → **Profiles** → **New
  Profile…**, start from empty, and use that profile for every shot.
- **Window size 1280 × 800**, zoom at 100%. A high-resolution screen will save
  at 2× (2560 × 1600). That is fine; the page scales it.
- **Nothing personal.** Check that no real name, email, school account or other
  file names appear in the Explorer, title bar or terminal.
- **PNG**, cropped as described. Full-window shots keep the whole window,
  title bar included. "Small" shots are cropped tight to the one thing the
  student must find.
- **Use the starter code from Setup step 4** for every shot that shows the
  editor, so the code matches what students typed.

## Setup tab (M3: steps 2 to 6)

| File | System | Shows | Frame |
|---|---|---|---|
| `setup-02-tasks-win.png` | Windows | The installer's **Select Additional Tasks** page. **Add to PATH** and both **Add "Open with Code" action** boxes ticked. | The installer window only |
| `setup-02-applications-mac.png` | Mac | A Finder window with **Visual Studio Code** being dragged into **Applications**. | The Finder window only |
| `setup-02-checkpoint.png` | Either | VS Code open for the first time, on the **Welcome** page. | Full window, small |
| `setup-03-window.png` | Either | `my-site` open, `index.html` in the editor, the terminal open in the Panel (<kbd>Ctrl</kbd>+<kbd>`</kbd>), Explorer showing in the Side Bar. Activity Bar, Side Bar, Editor, Panel and Status Bar all visible. | **Full window, 1280 × 800, no crop.** The numbered callouts are placed for the default layout; after adding this file, check them and adjust `--x` / `--y` in `index.html` (step 3) if needed. |
| `setup-04-new-file.png` | Either | The Explorer, mouse over **MY-SITE**, with the **New File…** icon showing (its tooltip visible if you can). | Small: the Side Bar only |
| `setup-04-checkpoint.png` | Either | `index.html` in the Explorer, the starter code in the editor, the tab with **no** dot (saved). | Small: Side Bar and editor |
| `setup-05-extension.png` | Either | The Extensions view, search box showing `Live Preview`, **Live Preview** by **Microsoft** at the top, **Install** button visible. | Small: the Side Bar only |
| `setup-05-checkpoint.png` | Either | `index.html` on the left and the Live Preview on the right, showing **Hello! This is my page.** | Small: editor and preview |
| `setup-06-checkpoint.png` | Either | The same, after changing the `<h1>` text (to anything that is not a real name). | Small: editor and preview |

"Either" means Windows or Mac. Use whichever you have; the VS Code window is
the same on both apart from the title bar.
