# Network map (`/map/`)

Asked for on 2026-11-13. An interactive picture of Paul's computers, how
Tailscale joins them, and what runs on each one.

## Decisions (from Paul, 2026-11-13)

- Its own visual style, not the make theme: SVG pictures of each machine, a
  pulse travelling along each network line, lift and glow outline on hover.
- Devices are grouped by role: workstations, AI machines, servers.
- Friendly nicknames only. No real hostnames, no Tailscale addresses, no
  tailnet domain, no ports. The page is public.
- Nine computers plus the tailnet itself. Phones, the Shield and designpc are
  left out. `minecraft-server` is drawn as on the tailnet like the rest
  (Paul, 2026-11-13: everything on the page is on the tailnet).
- Paul fills in specs, notes, purposes, photos and the About and History text.
  Unknown text is a `[Paul]` placeholder.

## Behaviour

- Click or press Enter on a machine: the camera zooms in and a panel shows
  purpose, specs, services, notes and photos.
- Click a service (chip under the machine, or the list in the panel): zooms in
  further and shows that service.
- Escape, the Back link, or a click on the background zooms out one level.
- Tabs: About, History, Contact (views inside the page) and contrapaul.com
  (a link). Opening a tab pulls the camera back from the map.
- Every view has a hash URL, so the browser Back button works.
- Contact form posts to `POST /api/contact`, which sends through Resend.

## Files

- `map/js/data.js`: the only file to edit for machines and services.
- `map/js/layout.js`, `camera.js`, `route.js`, `scene.js`: pure, tested with
  `node --test` (`map/test/`).
- `map/js/main.js`, `panel.js`, `contact.js`: DOM code.
- `functions/api/contact.ts`, `functions/api/_lib/contact.ts`.

## Setup still needed

- `CONTACT_TO` must be set in the Pages project (the inbox for messages).
  `RESEND_API_KEY` is already used by the Blood Bowl site.
