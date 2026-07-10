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

  /* Walk month by month from newest to oldest */
  let [y, m] = sorted[0].date.split("-").map(Number);
  const [oldY, oldM] = sorted[sorted.length - 1].date.split("-").map(Number);

  while (y > oldY || (y === oldY && m >= oldM)) {
    const key = y + "-" + String(m).padStart(2, "0");
    const inMonth = sorted.filter((p) => p.date === key);

    const row = document.createElement("div");
    row.className = "tl-month" + (inMonth.length ? "" : " tl-empty");

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
      (p._side === "left" ? left : right).appendChild(buildCard(p));
    });

    row.append(left, spine, right);
    timeline.appendChild(row);

    m -= 1;
    if (m === 0) { m = 12; y -= 1; }
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

    const open = () => openModal(p);
    card.addEventListener("click", open);
    card.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(); }
    });
    return card;
  }

  /* ---------- modal ---------- */
  const modal = document.getElementById("pmodal");
  const modalContent = modal.querySelector(".pmodal-content");
  const closeBtn = modal.querySelector(".pmodal-close");
  let lastFocus = null;

  function openModal(p) {
    lastFocus = document.activeElement;
    modalContent.replaceChildren();

    modalContent.appendChild(
      phSlot("pmodal-cover", p.cover, p.title, "[ cover · photo ]"));

    if (p.images && p.images.length) {
      const strip = document.createElement("div");
      strip.className = "pmodal-images";
      p.images.forEach((src, i) => {
        strip.appendChild(phSlot("pmodal-thumb", src, p.title + " " + (i + 2),
                                 "[ photo ]"));
      });
      modalContent.appendChild(strip);
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
    document.body.style.overflow = "";
    if (lastFocus) lastFocus.focus();
  }

  closeBtn.addEventListener("click", closeModal);
  modal.addEventListener("click", (e) => {
    if (e.target === modal) closeModal();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !modal.hidden) closeModal();
  });
})();
