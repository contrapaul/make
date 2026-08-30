// ==========================================================================
// CSS Lookbook — Theme Switcher + Modal System
// ========================================================================== 

(function () {
  // Theme switching logic
  const themeSheet = document.getElementById('theme-sheet');
  const buttons = document.querySelectorAll('.style-selector button[data-theme]');
  const body = document.body;

  const themes = {
    minimal: 'themes/minimal.css',
    neon: 'themes/neon.css',
    retro: 'themes/retro.css',
    brutalist: 'themes/brutalist.css',
    glassmorphism: 'themes/glassmorphism.css',
    paper: 'themes/paper.css'
  };

  function applyTheme(name) {
    if (!themes[name]) return;

    themeSheet.href = themes[name];
    body.className = 'theme-' + name;
    buttons.forEach(function (btn) {
      btn.classList.toggle('active', btn.dataset.theme === name);
    });

    localStorage.setItem('lookbook-theme', name);
  }

  buttons.forEach(function (btn) {
    btn.addEventListener('click', function () {
      applyTheme(btn.dataset.theme);
    });
  });

  var saved = localStorage.getItem('lookbook-theme');
  if (saved && themes[saved]) {
    applyTheme(saved);
  } else {
    applyTheme('minimal');
  }

  // ========================================
  // Modal System — click cards to expand
  // ========================================

  const modalBackdrop = document.getElementById('modal-backdrop');
  const modalContent = document.getElementById('modal-content');
  const modalTitle = document.getElementById('modal-title');
  const modalBody = document.getElementById('modal-body');
  const modalCloseBtn = document.getElementById('modal-close-btn');

  // Card data — each card maps to a title + description
  var cardData = {
    headings: {
      title: 'Headings',
      content: '<p>Headings are the structural foundation of your HTML. They create hierarchy—<code>&lt;h1&gt;</code> is your main heading, <code>&lt;h2&gt;</code> for major sections, down to <code>&lt;h6&gt;</code> for fine details. Use only one <code>&lt;h1&gt;</code> per page.</p><p style="margin-top:0.5em;"><strong>Example:</strong> Start with a single <code>&lt;h1&gt;</code>, then nest headings down the hierarchy. Never skip levels—jumping from <code>&lt;h1&gt;</code> directly to <code>&lt;h3&gt;</code> creates confusing document structure.</p>'
    },
    paragraphs: {
      title: 'Paragraphs &amp; Text',
      content: '<p><code>&lt;p&gt;</code> wraps blocks of text. For emphasis use <code>&lt;strong&gt;</code> (bold) for important information and <code>&lt;em&gt;</code> (italic) for emphasis that doesn\'t imply importance.</p><p style="margin-top:0.5em;"><strong>Avoid:</strong> Using <code>&lt;b&gt;</code> or <code>&lt;i&gt;</code> when you mean semantic meaning. These are presentational tags with no accessibility benefit—use their semantic counterparts instead.</p>'
    },
    links: {
      title: 'Links',
      content: '<p><code>&lt;a href="..."&gt;</code> creates a hyperlink. Always give it descriptive text that tells the reader what to expect—"learn more" tells them nothing, but "read our documentation" guides their next action.</p><p style="margin-top:0.5em;"><strong>Best Practice:</strong> Be specific in your link text. The best description of a link is what happens when someone clicks it.</p>'
    },
    lists: {
      title: 'Lists',
      content: '<p><code>&lt;ul&gt;</code> renders unordered (bulleted) lists, <code>&lt;ol&gt;</code> renders ordered (numbered) lists. Each list item goes inside an <code>&lt;li&gt;</code> element.</p><p style="margin-top:0.5em;"><strong>Nesting:</strong> Lists can be nested inside other lists for complex structures. This creates hierarchical organization that's easy to read and navigate.</p>'
    },
    selectors: {
      title: 'Selectors',
      content: '<p>Target elements by tag (<code>p</code>), class (<code>.intro</code>), or id (<code>#header</code>). Classes are reusable across your entire document—use them liberally for consistent styling.</p><p style="margin-top:0.5em;"><strong>Rule of thumb:</strong> Use classes for visual styles, ids only when you need a unique identifier (like form labels). Avoid overusing ids as selectors—they hurt performance and accessibility.</p>'
    },
    properties: {
      title: 'Properties &amp; Values',
      content: '<p>Inside the curly braces you write declarations. Each declaration pairs a property name with a value, separated by a colon—like key-value pairs in code:<br><code>color: blue;</code></p><p style="margin-top:0.5em;"><strong>Common properties:</strong><br>• <code>color</code>, <code>font-size</code>, <code>font-family</code>—text styling<br>• <code>margin</code>, <code>padding</code>—whitespace control<br>• <code>border</code>, <code>border-radius</code>—borders and corners<br>• <code>display</code>, <code>flex-direction</code>—layout behavior</p>'
    },
    units: {
      title: 'Units',
      content: '<p><code>px</code> is a fixed pixel value—great for precise measurements. <code>rem</code> scales with the root font size, making it excellent for accessibility and responsive design. <code>%</code> is relative to its parent element, useful for fluid layouts.<br><br>A quick reference: 1 rem ≈ 16px (browser default)</p>'
    },
    boxModel: {
      title: 'The Box Model',
      content: '<p>Every HTML element is a box with four layers:<br>1. <strong>Content</strong>—the actual text or media<br>2. <strong>Padding</strong>—internal spacing between content and border<br>3. <code>border</code>—visible border line<br>4. <code>margin</code>—external space around the element<br><br>This model is fundamental to all CSS layout understanding.</p>'
    },
    flexbox: {
      title: 'Flexbox',
      content: '<p>A one-dimensional layout system for arranging items in a row or column. Set <code>display: flex;</code> on the parent and arrange children with properties like <code>flex-direction</code>, <code>justify-content</code>, and <code>align-items</code>.</br><br>Perfect for navigation bars, button rows, centered content, and complex layouts that were impossible before.</p>'
    },
    grid: {
      title: 'Grid',
      content: '<p>A two-dimensional layout system. Define rows and columns with <code>grid-template-rows</code> and <code>grid-template-columns</code>, then place items inside the grid cells using <code>grid-column</code> and <code>grid-row</code>.</br><br>Grid excels at card layouts, multi-column designs, and responsive layouts that adapt seamlessly across screen sizes.</p>'
    },
    responsive: {
      title: 'Responsive Design',
      content: '<p>Use media queries (<code>@media (max-width: 640px)</code>) to apply different styles at various breakpoints. This ensures your page looks great on phones, tablets, and desktops.<br><br>The modern approach uses fluid typography with <code>clamp()</code>, flexible grids with <code>minmax()</code>, and CSS Grid/Flexbox for layouts that adapt automatically.</p>'
    }
  };

  // Open modal when clicking a card
  var cards = document.querySelectorAll('.card');
  cards.forEach(function (card) {
    card.addEventListener('click', function () {
      var id = this.dataset.card;
      if (cardData[id]) {
        modalTitle.textContent = cardData[id].title;
        modalBody.innerHTML = cardData[id].content;
        modalBackdrop.classList.add('active');
        modalCloseBtn.focus();
      }
    });
  });

  // Close modal when clicking backdrop
  modalBackdrop.addEventListener('click', function () {
    modalBackdrop.classList.remove('active');
  });

  // Close modal when clicking the close button
  modalCloseBtn.addEventListener('click', function () {
    modalBackdrop.classList.remove('active');
    this.focus();
  });

  // Close modal when pressing Escape key
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && modalBackdrop.classList.contains('active')) {
      modalBackdrop.classList.remove('active');
      modalCloseBtn.focus();
    }
  });

})();