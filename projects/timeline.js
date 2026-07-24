/* ============================================================
   contrapaul / make — /projects timeline renderer
   Reads PROJECTS (projects.js), builds one row per calendar
   month from the newest project month down to the oldest, and
   wires up the expanding card modal.
   ============================================================ */

(function () {
  const MONTH_NAMES = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN",
                       "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

  function monthLabel(date) {
    const [y, m] = date.split("-").map(Number);
    return MONTH_NAMES[m - 1] + " " + y;
  }

  /* Self-removing image, same pattern as the site's onerror slots */
  function phImage(src, alt) {
    const img = document.createElement("img");
    img.src = src;
    img.alt = alt || "";
    img.onerror = () => img.remove();
    return img;
  }

  function phSlot(className, src, alt, labelText) {
    const slot = document.createElement("div");
    slot.className = "ph " + className;
    if (src) slot.appendChild(phImage(src, alt));
    const label = document.createElement("span");
    label.className = "ph-label";
    label.textContent = labelText;
    slot.appendChild(label);
    return slot;
  }

  /* ---------- timeline ---------- */
  const timeline = document.getElementById("timeline");
  const sorted = [...PROJECTS].sort((a, b) => b.date.localeCompare(a.date));
  if (!sorted.length) return;

  /* Default sides: every other project alternates */
  sorted.forEach((p, i) => { p._side = i % 2 === 0 ? "left" : "right"; });

  /* One row per month that actually has projects, newest first —
     months with nothing in them are skipped rather than rendered empty. */
  let i = 0;
  while (i < sorted.length) {
    const key = sorted[i].date;
    const inMonth = [];
    while (i < sorted.length && sorted[i].date === key) {
      inMonth.push(sorted[i]);
      i += 1;
    }

    const row = document.createElement("div");
    row.className = "tl-month";

    const left = document.createElement("div");
    left.className = "tl-zone tl-left";
    const spine = document.createElement("div");
    spine.className = "tl-spine";
    const label = document.createElement("span");
    label.className = "tl-mlabel";
    label.textContent = monthLabel(key);
    spine.appendChild(label);
    const right = document.createElement("div");
    right.className = "tl-zone tl-right";

    inMonth.forEach((p) => {
      const card = p.type === "event" ? buildEventCard(p) : buildCard(p);
      (p._side === "left" ? left : right).appendChild(card);
    });

    row.append(left, spine, right);
    timeline.appendChild(row);
  }

  function wireOpen(card, p) {
    const open = () => openModal(p);
    card.addEventListener("click", open);
    card.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(); }
    });
  }

  function buildCard(p) {
    const card = document.createElement("article");
    card.className = "pcard";
    card.tabIndex = 0;
    card.setAttribute("role", "button");
    card.setAttribute("aria-haspopup", "dialog");

    card.appendChild(phSlot("pcard-cover", p.cover, p.title, "[ cover · photo ]"));

    const body = document.createElement("div");
    body.className = "pcard-body";
    const label = document.createElement("span");
    label.className = "label";
    label.textContent = monthLabel(p.date);
    const h3 = document.createElement("h3");
    h3.textContent = p.title;
    const teaser = document.createElement("p");
    teaser.textContent = p.description;
    body.append(label, h3, teaser);
    card.appendChild(body);

    wireOpen(card, p);
    return card;
  }

  /* Life-event marker — milestones, talks, etc. Same click-to-expand
     behavior as a project card, but no cover slot: just a tag, title,
     and description on a dark card. */
  function buildEventCard(p) {
    const card = document.createElement("article");
    card.className = "pcard pcard-event";
    card.tabIndex = 0;
    card.setAttribute("role", "button");
    card.setAttribute("aria-haspopup", "dialog");

    const body = document.createElement("div");
    body.className = "pcard-body";
    const label = document.createElement("span");
    label.className = "label";
    label.textContent = (p.tag || "Milestone").toUpperCase();
    const h3 = document.createElement("h3");
    h3.textContent = p.title;
    const teaser = document.createElement("p");
    teaser.textContent = p.description;
    body.append(label, h3, teaser);
    card.appendChild(body);

    wireOpen(card, p);
    return card;
  }

  /* ---------- modal media row + lightbox ---------- */
  function buildMediaTile(src, alt) {
    const tile = document.createElement(src ? "button" : "div");
    tile.className = "ph pmodal-media-item" + (src ? "" : " pmodal-media-item--empty");

    if (!src) {
      const label = document.createElement("span");
      label.className = "ph-label";
      label.textContent = "[ photo ]";
      tile.appendChild(label);
      return tile;
    }

    tile.type = "button";
    tile.setAttribute("aria-label", "Expand photo — " + alt);
    const img = phImage(src, alt);
    img.onerror = () => {
      tile.classList.add("pmodal-media-item--empty");
      tile.disabled = true;
      img.remove();
      const label = document.createElement("span");
      label.className = "ph-label";
      label.textContent = "[ photo ]";
      tile.appendChild(label);
    };
    tile.appendChild(img);
    tile.addEventListener("click", () => openLightbox(src, alt));
    return tile;
  }

  function buildMediaRow(p) {
    const media = [p.cover, ...(p.images || [])];
    const row = document.createElement("div");
    row.className = "pmodal-media" + (media.length === 2 ? " pmodal-media--pair" : "");
    media.forEach((src, i) => {
      const alt = i === 0 ? p.title : p.title + " " + (i + 1);
      row.appendChild(buildMediaTile(src, alt));
    });
    return row;
  }

  /* ---------- modal ---------- */
  const modal = document.getElementById("pmodal");
  const modalContent = modal.querySelector(".pmodal-content");
  const closeBtn = modal.querySelector(".pmodal-close");
  const lightbox = document.getElementById("pmodal-lightbox");
  const lightboxImg = lightbox.querySelector(".pmodal-lightbox-img");
  const lightboxClose = lightbox.querySelector(".pmodal-lightbox-close");
  let lastFocus = null;
  let lastMediaFocus = null;

  function openLightbox(src, alt) {
    lastMediaFocus = document.activeElement;
    lightboxImg.src = src;
    lightboxImg.alt = alt;
    lightbox.hidden = false;
    lightboxClose.focus();
  }

  function closeLightbox() {
    lightbox.hidden = true;
    lightboxImg.src = "";
    if (lastMediaFocus) lastMediaFocus.focus();
  }

  lightboxClose.addEventListener("click", closeLightbox);
  lightbox.addEventListener("click", closeLightbox);

  function openModal(p) {
    lastFocus = document.activeElement;
    modalContent.replaceChildren();
    lightbox.hidden = true;

    const hasMedia = p.cover || (p.images && p.images.length);
    if (p.type !== "event" || hasMedia) {
      modalContent.appendChild(buildMediaRow(p));
    }

    const body = document.createElement("div");
    body.className = "pmodal-body";
    const label = document.createElement("span");
    label.className = "label";
    label.textContent = monthLabel(p.date);
    const h2 = document.createElement("h2");
    h2.textContent = p.title;
    const desc = document.createElement("p");
    desc.textContent = p.description;
    body.append(label, h2, desc);

    if (p.links && p.links.length) {
      const links = document.createElement("div");
      links.className = "pmodal-links";
      p.links.forEach((l) => {
        const a = document.createElement("a");
        a.className = "cue";
        a.href = l.url;
        a.textContent = l.label + " →";
        links.appendChild(a);
      });
      body.appendChild(links);
    }
    modalContent.appendChild(body);

    modal.hidden = false;
    document.body.style.overflow = "hidden";
    closeBtn.focus();
  }

  function closeModal() {
    modal.hidden = true;
    lightbox.hidden = true;
    document.body.style.overflow = "";
    if (lastFocus) lastFocus.focus();
  }

  closeBtn.addEventListener("click", closeModal);
  modal.addEventListener("click", (e) => {
    if (e.target === modal) closeModal();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    if (!lightbox.hidden) closeLightbox();
    else if (!modal.hidden) closeModal();
  });
})();
