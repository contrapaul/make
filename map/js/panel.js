// The detail panel's HTML for a machine or one of its services. Pure: no DOM.

import { escapeHtml } from './scene.js';

const paragraph = (text) => `<p>${escapeHtml(text)}</p>`;

function crumbs(route) {
  const nodeName = escapeHtml(route.node.name);
  const tail = route.service
    ? `<a href="#${route.node.id}">${nodeName}</a><span>${escapeHtml(route.service.name)}</span>`
    : `<span>${nodeName}</span>`;
  return `<nav class="crumbs" aria-label="Where you are"><a href="#">Map</a>${tail}</nav>`;
}

function tags(node) {
  return `<p class="tags"><span>${escapeHtml(node.os)}</span></p>`;
}

function title(node) {
  const tag = node.tag ? ` <em>(${escapeHtml(node.tag)})</em>` : '';
  return `<h2 class="group-${node.group}">${escapeHtml(node.name)}${tag}</h2>`;
}

function specs(node) {
  if (!node.specs.length) return '';
  const rows = node.specs
    .map(([label, value]) => `<dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd>`)
    .join('');
  return `<h3>Specs</h3><dl class="specs">${rows}</dl>`;
}

function services(node) {
  if (!node.services.length) return '';
  const items = node.services
    .map((item) => `<li><a class="service-link" href="#${node.id}/${item.id}">${escapeHtml(item.name)}</a></li>`)
    .join('');
  return `<h3>Services</h3><ul class="services">${items}</ul>`;
}

function images(node) {
  if (!node.images.length) return '<h3>Photos</h3><p class="empty">[Paul] photos go here.</p>';
  const shots = node.images
    .map((image) => `<button class="shot" type="button" aria-label="Zoom in: ${escapeHtml(image.alt)}">
      <img src="${escapeHtml(image.src)}" alt="${escapeHtml(image.alt)}" loading="lazy"></button>`)
    .join('');
  return `<h3>Photos</h3><div class="shots">${shots}</div>`;
}

function nodePanel(route) {
  const node = route.node;
  return `${crumbs(route)}
    ${title(node)}
    ${tags(node)}
    ${paragraph(node.purpose)}
    ${specs(node)}
    ${services(node)}
    <h3>Notes</h3>${paragraph(node.notes)}
    ${images(node)}`;
}

function servicePanel(route) {
  const item = route.service;
  return `${crumbs(route)}
    <h2 class="group-${route.node.group}">${escapeHtml(item.name)}</h2>
    <p class="tags"><span>Runs on ${escapeHtml(route.node.name)}</span></p>
    <h3>What it is for</h3>${paragraph(item.purpose)}
    <h3>Notes</h3>${paragraph(item.notes)}
    <p><a class="back" href="#${route.node.id}">Back to ${escapeHtml(route.node.name)}</a></p>`;
}

/** `panel.innerHTML = panelHtml(parseRoute('#spark', NODES))` */
export function panelHtml(route) {
  const close = '<a class="close" href="#" aria-label="Zoom out to the map">Zoom out</a>';
  return close + (route.service ? servicePanel(route) : nodePanel(route));
}
