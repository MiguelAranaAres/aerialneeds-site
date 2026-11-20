// Aerial Needs static site generator (English + Spanish).
// Pulls catalog data from the Shopify Storefront API and writes a fully
// pre-rendered site to ./dist (for GitHub Pages). Cart + checkout stay on Shopify.
// Spanish pages live under /es/ and use the translations saved in Shopify (Translate & Adapt).
//
// Usage:
//   node build.mjs                     # live data from Shopify
//   node build.mjs --fixture f.json    # offline build from a saved snapshot ({en:{…}, es:{…}} or a single dataset)
//
// Env (all optional, defaults in config.json):
//   SITE_URL        canonical origin, e.g. https://www.aerialneeds.com
//   BASE_PATH       path prefix when served from a sub-folder (GitHub preview), e.g. /aerialneeds-site
//   PREVIEW=1       adds noindex everywhere and blocks robots (use before the domain switch)
//   FALLBACK_ORIGIN where unknown URLs (account, unlisted products…) are sent, e.g. https://shop.aerialneeds.com

import fs from "node:fs";
import path from "node:path";
import dns from "node:dns/promises";

const cfg = JSON.parse(fs.readFileSync(new URL("./config.json", import.meta.url)));
const SITE_URL = (process.env.SITE_URL || cfg.siteUrl).replace(/\/$/, "");
const GUIDES = JSON.parse(fs.readFileSync(new URL("./content/guides.json", import.meta.url)));
// BASE / PREVIEW / FALLBACK are decided at build time by resolveMode():
// with "preview": "auto" the site stays a hidden preview on github.io until www DNS points at GitHub Pages,
// then the next build goes live on its own (indexable, root paths, fallback to the Shopify checkout domain).
let BASE = "", PREVIEW = true, FALLBACK = "";
async function resolveMode(offline) {
  let live = false;
  if (process.env.PREVIEW) live = process.env.PREVIEW !== "1";
  else if (cfg.preview === "auto") {
    if (!offline) try { live = (await dns.resolveCname(new URL(SITE_URL).hostname)).some((h) => h.endsWith("github.io")); } catch {}
  } else live = !cfg.preview;
  PREVIEW = !live;
  BASE = (process.env.BASE_PATH || (live ? "" : cfg.previewBasePath) || "").replace(/\/$/, "");
  let fb = process.env.FALLBACK_ORIGIN;
  if (!fb) {
    fb = cfg.fallbackOrigin;
    if (live) {
      try { await dns.resolve(new URL(cfg.checkoutOrigin).hostname); fb = cfg.checkoutOrigin; } catch { fb = `https://${cfg.shopDomain}`; }
    }
  }
  FALLBACK = fb.replace(/\/$/, "");
}
const OUT = path.resolve("dist");
const API = `https://${cfg.shopDomain}/api/${cfg.apiVersion}/graphql.json`;
const BUILD_ID = Date.now().toString(36);

// ---------- UI text ----------
const T = {
  en: {
    skip: "Skip to content", menu: "Menu", search: "Search", openCart: "Open cart", cart: "Your cart", close: "Close cart",
    empty: "Your cart is empty.", subtotal: "Subtotal", taxes: "Shipping and taxes calculated at checkout.", checkout: "Checkout",
    tagline: "Built for Those Who Dare to Fly.", shipsTo: "Ships to the United States, Colombia and Venezuela · flat $2.99 shipping · 9–14 day delivery.",
    shop: "Shop", help: "Help", shipTo: "Ship to", country: "Country", language: "Español", contact: "Contact",
    from: "From ", soldOut: "Sold out", addToCart: "Add to cart", adding: "Adding…", unavailable: "Unavailable", remove: "Remove",
    qty: "Quantity", dec: "Decrease", inc: "Increase", image: "Image",
    assure: ["Flat $2.99 shipping", "Delivery in 9–14 days", "30-day returns"], moreFrom: "More from",
    home: "Home", allProducts: "All products",
    eyebrow: "Aerial · Circus · Fire", hero: "ELEVATE YOUR PERFORMANCE",
    lead: "Built for Those Who Dare to Fly. Wrist wraps, tape, grips, protection and fire gear chosen for aerial training.",
    shopAll: "Shop all gear", kits: "Training kits", byCat: "Shop by category", kitsH: "Aerial Essentials kits", save: "Save up to 35%",
    gear: "Training gear", viewAll: "View all", fireH: "Fire Mecca Partnership", fireSub: "American-made fire performance gear", shopFire: "Shop Fire Mecca",
    contactH: "Contact us", contactP: "Questions about sizing, orders, coach codes or studio partnerships? We answer in English and Spanish.",
    email: "Email", track: "Track an order or manage your account on our", accountPage: "account page",
    contactDesc: "Contact Aerial Needs about orders, sizing, coach codes and studio partnerships.",
    searchP: "Wrist wraps, tape, poi…", searchProducts: "Search products", searchDesc: "Search Aerial Needs products.",
    results: "result", resultsPl: "results", notFound: "Page not found", notFoundP: "Sorry, we couldn't find that page.",
    announce: "Aerial gear ships for a flat $2.99 · Delivery in 9–14 days · 30-day returns",
    fmAssure: ["American-made by Fire Mecca", "Shipping calculated at checkout", "30-day returns"],
    faqH: "Shipping, returns & safety",
    faq: [
      ["How long does delivery take?", "Orders arrive in 9 to 14 days. We email you tracking details once your order ships.", 1],
      ["How much is shipping and where do you ship?", "Aerial training gear ships for a flat $2.99 to the United States, Colombia and Venezuela.", 1],
      ["Can I return it?", "Yes, within 30 days of delivery. US orders get a replacement; Colombia and Venezuela orders get store credit. The customer pays return shipping.", 0],
      ["Is this safety equipment?", "No. Our accessories are not fall-protection systems. Always train with a qualified coach.", 1],
    ],
    coachCode: "Have a coach code? Enter it at checkout.",
    sortBy: "Sort by", sorts: ["Featured", "Price: low to high", "Price: high to low", "Name: A–Z"],
    trust: [
      ["Chosen by a working coach", "Every product is picked by an aerialist who trains, teaches and rigs every week."],
      ["Flat $2.99 shipping", "On aerial training gear to the United States, Colombia and Venezuela, delivered in 9–14 days."],
      ["30-day returns", "Not right for you? Return it within 30 days of delivery."],
    ],
    aboutH: "Built by an aerialist", aboutP: "Aerial Needs was started by Miguel Arana, an aerialist and circus coach who has spent his career in the air.", aboutLink: "Our story",
    coachH: "Coaches & studios", coachP: "Ask about our coach and studio program for you and your students.", coachLink: "Contact us",
    heroAlt: "Aerial training kits with wrist wraps, tape, chalk and a carry bag", guides: "Guides", guidesH: "Training guides", guidesDesc: "Short, practical guides to aerial training gear from Aerial Needs.", shopGear: "Shop the gear", read: "Read the guide",
    policyFor: "for Aerial Needs.",
  },
  es: {
    skip: "Saltar al contenido", menu: "Menú", search: "Buscar", openCart: "Abrir carrito", cart: "Tu carrito", close: "Cerrar carrito",
    empty: "Tu carrito está vacío.", subtotal: "Subtotal", taxes: "El envío y los impuestos se calculan al pagar.", checkout: "Pagar",
    tagline: "Hecho para quienes se atreven a volar.", shipsTo: "Enviamos a Estados Unidos, Colombia y Venezuela · envío fijo de $2.99 · entrega en 9 a 14 días.",
    shop: "Tienda", help: "Ayuda", shipTo: "Enviar a", country: "País", language: "English", contact: "Contacto",
    from: "Desde ", soldOut: "Agotado", addToCart: "Agregar al carrito", adding: "Agregando…", unavailable: "No disponible", remove: "Eliminar",
    qty: "Cantidad", dec: "Disminuir", inc: "Aumentar", image: "Imagen",
    assure: ["Envío fijo de $2.99", "Entrega en 9 a 14 días", "Devoluciones en 30 días"], moreFrom: "Más de",
    home: "Inicio", allProducts: "Todos los productos",
    eyebrow: "Aéreos · Circo · Fuego", hero: "ELEVA TU RENDIMIENTO",
    lead: "Hecho para quienes se atreven a volar. Muñequeras, cintas, grips, protección y equipo de fuego elegidos para el entrenamiento aéreo.",
    shopAll: "Ver todo el equipo", kits: "Kits de entrenamiento", byCat: "Compra por categoría", kitsH: "Kits Aerial Essentials", save: "Ahorra hasta 35%",
    gear: "Equipo de entrenamiento", viewAll: "Ver todo", fireH: "Alianza Fire Mecca", fireSub: "Equipo de fuego hecho en EE. UU.", shopFire: "Ver Fire Mecca",
    contactH: "Contáctanos", contactP: "¿Preguntas sobre tallas, pedidos, códigos de coach o alianzas con estudios? Respondemos en español e inglés.",
    email: "Escribir a", track: "Rastrea tu pedido o administra tu cuenta en nuestra", accountPage: "página de cuenta",
    contactDesc: "Contacta a Aerial Needs sobre pedidos, tallas, códigos de coach y alianzas con estudios.",
    searchP: "Muñequeras, cintas, poi…", searchProducts: "Buscar productos", searchDesc: "Busca productos de Aerial Needs.",
    results: "resultado", resultsPl: "resultados", notFound: "Página no encontrada", notFoundP: "Lo sentimos, no encontramos esa página.",
    announce: "Envío fijo de $2.99 en equipo aéreo · Entrega en 9 a 14 días · Devoluciones en 30 días",
    fmAssure: ["Hecho en EE. UU. por Fire Mecca", "Envío calculado al pagar", "Devoluciones en 30 días"],
    faqH: "Envíos, devoluciones y seguridad",
    faq: [
      ["¿Cuánto tarda la entrega?", "Los pedidos llegan en 9 a 14 días. Te enviamos el número de rastreo por correo cuando sale tu pedido.", 1],
      ["¿Cuánto cuesta el envío y a dónde envían?", "El equipo de entrenamiento aéreo tiene un envío fijo de $2.99 a Estados Unidos, Colombia y Venezuela.", 1],
      ["¿Puedo devolverlo?", "Sí, dentro de los 30 días posteriores a la entrega. Los pedidos de EE. UU. reciben un reemplazo; los de Colombia y Venezuela reciben crédito en la tienda. El cliente paga el envío de la devolución.", 0],
      ["¿Es equipo de seguridad?", "No. Nuestros accesorios no son sistemas de protección contra caídas. Entrena siempre con un coach calificado.", 1],
    ],
    coachCode: "¿Tienes un código de coach? Ingrésalo al pagar.",
    sortBy: "Ordenar por", sorts: ["Destacados", "Precio: menor a mayor", "Precio: mayor a menor", "Nombre: A–Z"],
    trust: [
      ["Elegido por un coach activo", "Cada producto lo escoge un artista aéreo que entrena, enseña y monta equipos cada semana."],
      ["Envío fijo de $2.99", "En equipo de entrenamiento aéreo a Estados Unidos, Colombia y Venezuela, con entrega en 9 a 14 días."],
      ["Devoluciones en 30 días", "¿No era lo que buscabas? Devuélvelo dentro de los 30 días posteriores a la entrega."],
    ],
    aboutH: "Creado por un artista aéreo", aboutP: "Aerial Needs fue creado por Miguel Arana, artista aéreo y coach de circo con toda una carrera en el aire.", aboutLink: "Nuestra historia",
    coachH: "Coaches y estudios", coachP: "Pregunta por nuestro programa para coaches y estudios, para ti y tus alumnos.", coachLink: "Contáctanos",
    heroAlt: "Kits de entrenamiento aéreo con muñequeras, cinta, magnesio y bolso", guides: "Guías", guidesH: "Guías de entrenamiento", guidesDesc: "Guías cortas y prácticas sobre equipo de entrenamiento aéreo, por Aerial Needs.", shopGear: "Compra el equipo", read: "Leer la guía",
    policyFor: "de Aerial Needs.",
  },
};
const LOCALES = ["en", "es"];
const PREFIX = { en: "", es: "/es" };

// ---------- per-locale state (set before rendering each language) ----------
let L = "en", t = T.en, NAV = [], POLICIES = [], PAGE_LINKS = [], LOGO = "", ABOUT = "";

// ---------- helpers ----------
const esc = (s = "") =>
  String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const strip = (h = "") => h.replace(/<style[\s\S]*?<\/style>|<script[\s\S]*?<\/script>/gi, "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
const clip = (s, n) => (s.length <= n ? s : s.slice(0, s.lastIndexOf(" ", n - 1)).replace(/[,.;:–-]+$/, "") + "…");
const lp = (p, loc = L) => PREFIX[loc] + p; // locale path (no base)
const u = (p) => BASE + lp(p); // link inside the current locale
const abs = (p) => SITE_URL + p; // p already locale-prefixed
const money = (m) => {
  if (!m) return "";
  const n = Number(m.amount);
  return m.currencyCode === "USD" ? `$${n.toFixed(2)}` : `${m.currencyCode} ${n.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
};
const img = (url, w) => (url ? url + (url.includes("?") ? "&" : "?") + "width=" + w : "");
const srcset = (url, sizes = [300, 500, 800, 1200]) => sizes.map((w) => `${img(url, w)} ${w}w`).join(", ");
const cleanHtml = (h = "") =>
  h
    .replace(/\s(style|data-mce-[\w-]+|data-start|data-end)="[^"]*"/gi, "")
    .replace(/<span>([\s\S]*?)<\/span>/gi, "$1")
    .replace(/<p>(\s|&nbsp;|<br>)*<\/p>/gi, "")
    .replace(/<h1/gi, "<h2").replace(/<\/h1>/gi, "</h2>");

async function sf(query, variables = {}) {
  const r = await fetch(API, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Shopify-Storefront-Access-Token": cfg.storefrontToken },
    body: JSON.stringify({ query, variables }),
  });
  const j = await r.json();
  if (j.errors) throw new Error(JSON.stringify(j.errors));
  return j.data;
}

const PRODUCT_FIELDS = `
  id handle title descriptionHtml vendor productType tags updatedAt availableForSale
  seo { title description }
  featuredImage { url altText width height }
  images(first: 12) { nodes { url altText width height } }
  options { name optionValues { name } }
  priceRange { minVariantPrice { amount currencyCode } maxVariantPrice { amount currencyCode } }
  variants(first: 100) { nodes { id title availableForSale price { amount currencyCode } compareAtPrice { amount currencyCode } selectedOptions { name value } image { url } } }
  collections(first: 10) { nodes { id handle } }`;

async function fetchLocale(lang) {
  const ctx = `@inContext(language: ${lang.toUpperCase()})`;
  const products = [];
  let after = null;
  do {
    const d = await sf(`query($after:String) ${ctx} { products(first:100, after:$after){ pageInfo{hasNextPage endCursor} nodes{ ${PRODUCT_FIELDS} } } }`, { after });
    products.push(...d.products.nodes);
    after = d.products.pageInfo.hasNextPage ? d.products.pageInfo.endCursor : null;
  } while (after);
  const d = await sf(`query ${ctx} {
    shop { name description brand { logo { image { url } } }
      privacyPolicy { id handle title body } refundPolicy { id handle title body }
      shippingPolicy { id handle title body } termsOfService { id handle title body } }
    collections(first: 50) { nodes { id handle title descriptionHtml updatedAt seo { title description } image { url altText }
      products(first: 250) { nodes { id } } } }
    pages(first: 50) { nodes { id handle title body updatedAt seo { title description } } }
  }`);
  // Unlisted, direct-link-only products (AN Gafas, sellers portal…) are fetched one by one by handle.
  const unlisted = [];
  for (const h of cfg.unlistedProducts || []) {
    const x = await sf(`query($h:String!) ${ctx} { product(handle:$h){ ${PRODUCT_FIELDS} } }`, { h });
    if (x.product) unlisted.push(x.product);
    else console.warn("Unlisted product not found on the Headless channel:", h);
  }
  return { products, unlisted, collections: d.collections.nodes, pages: d.pages.nodes, shop: d.shop };
}

// ---------- layout ----------
// ALT[key] = { en: "/products/x/", es: "/es/products/y/" } — used for hreflang + language switch.
let ALT = {};
function altLinks(key) {
  const a = ALT[key];
  if (!a) return "";
  return LOCALES.filter((l) => a[l]).map((l) => `<link rel="alternate" hreflang="${l}" href="${esc(abs(a[l]))}">`).join("\n") +
    (a.en ? `\n<link rel="alternate" hreflang="x-default" href="${esc(abs(a.en))}">` : "");
}

function analytics() {
  if (PREVIEW) return "";
  const ga = cfg.ga4Id, px = cfg.metaPixelId;
  const checkoutHost = new URL(cfg.checkoutOrigin).hostname;
  return [
    ga ? `<script async src="https://www.googletagmanager.com/gtag/js?id=${esc(ga)}"></script>
<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag("js",new Date());gtag("config",${JSON.stringify(ga)},{linker:{domains:[${JSON.stringify(new URL(SITE_URL).hostname)},${JSON.stringify(checkoutHost)}]}});</script>` : "",
    px ? `<script>!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version="2.0";n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,"script","https://connect.facebook.net/en_US/fbevents.js");fbq("init",${JSON.stringify(px)});fbq("track","PageView");</script>` : "",
  ].filter(Boolean).join("\n");
}

function layout({ key, title, description, canonical, body, ogImage, jsonld = [], noindex = false, ogType = "website" }) {
  const robots = PREVIEW || noindex ? `<meta name="robots" content="noindex, nofollow">` : "";
  const ld = jsonld.map((o) => `<script type="application/ld+json">${JSON.stringify(o).replace(/</g, "\\u003c")}</script>`).join("\n");
  const other = L === "en" ? "es" : "en";
  const switchHref = BASE + (ALT[key]?.[other] || lp("/", other));
  return `<!doctype html>
<html lang="${L}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${esc(canonical)}">
${altLinks(key)}
${robots}
<meta property="og:site_name" content="Aerial Needs">
<meta property="og:locale" content="${L === "es" ? "es_CO" : "en_US"}">
<meta property="og:type" content="${ogType}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${esc(canonical)}">
${ogImage ? `<meta property="og:image" content="${esc(img(ogImage, 1200))}">` : ""}
<meta name="twitter:card" content="summary_large_image">
<link rel="preconnect" href="https://cdn.shopify.com" crossorigin>
<link rel="icon" href="${BASE}/assets/favicon.svg" type="image/svg+xml">
<link rel="stylesheet" href="${BASE}/assets/style.css?v=${BUILD_ID}">
${ld}
${analytics()}
</head>
<body>
${header(switchHref)}
<main id="main">${body}</main>
${footer(switchHref)}
${cartDrawer()}
<script>window.AN=${JSON.stringify({
    shop: cfg.shopDomain, token: cfg.storefrontToken, api: cfg.apiVersion, base: BASE, prefix: PREFIX[L], lang: L,
    t: { empty: t.empty, from: t.from, soldOut: t.soldOut, addToCart: t.addToCart, adding: t.adding, unavailable: t.unavailable, remove: t.remove, dec: t.dec, inc: t.inc, qty: t.qty, results: t.results, resultsPl: t.resultsPl },
  })};</script>
<script src="${BASE}/assets/cart.js?v=${BUILD_ID}" defer></script>
</body>
</html>`;
}

function header(switchHref) {
  const links = NAV.map((n) => `<li><a href="${u(n.href)}">${esc(n.label)}</a></li>`).join("");
  const sw = `<li><a href="${esc(switchHref)}" hreflang="${L === "en" ? "es" : "en"}" class="lang">${esc(t.language)}</a></li>`;
  return `<a class="skip" href="#main">${esc(t.skip)}</a>
<p class="announce">${esc(t.announce)}</p>
<header class="site-header">
  <div class="wrap header-row">
    <details class="menu"><summary aria-label="${esc(t.menu)}"><span></span><span></span><span></span></summary>
      <nav class="menu-panel" aria-label="Main"><ul>${links}<li><a href="${u("/search/")}">${esc(t.search)}</a></li>${sw}</ul></nav></details>
    <a class="logo" href="${u("/")}" aria-label="Aerial Needs">${
      LOGO ? `<img src="${esc(img(LOGO, 400))}" alt="Aerial Needs" width="200" height="50">` : `<span class="logo-a">AERIAL</span><span class="logo-n">NEEDS</span>`
    }</a>
    <nav class="desk-nav" aria-label="Main"><ul>${links}</ul></nav>
    <div class="header-tools">
      <a href="${esc(switchHref)}" class="lang-btn" hreflang="${L === "en" ? "es" : "en"}">${L === "en" ? "ES" : "EN"}</a>
      <a href="${u("/search/")}" class="icon-btn" aria-label="${esc(t.search)}"><svg viewBox="0 0 24 24" width="22" height="22"><circle cx="10.5" cy="10.5" r="6.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M15.5 15.5 21 21" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg></a>
      <button class="icon-btn cart-toggle" aria-label="${esc(t.openCart)}"><svg viewBox="0 0 24 24" width="22" height="22"><path d="M6 7h12l-1 13H7L6 7Z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M9 7a3 3 0 0 1 6 0" fill="none" stroke="currentColor" stroke-width="2"/></svg><span class="cart-count" hidden>0</span></button>
    </div>
  </div>
</header>`;
}

function footer(switchHref) {
  const pol = POLICIES.map((p) => `<li><a href="${u(`/policies/${p.handle}/`)}">${esc(p.title)}</a></li>`).join("");
  const nav = NAV.map((n) => `<li><a href="${u(n.href)}">${esc(n.label)}</a></li>`).join("");
  return `<footer class="site-footer">
  <div class="wrap footer-grid">
    <div><p class="foot-brand">AERIAL NEEDS</p><p>${esc(t.tagline)}</p>
      <p class="muted">${esc(t.shipsTo)}</p>
      <p><a href="https://www.instagram.com/aerialneeds.store/" rel="noopener">Instagram @aerialneeds.store</a></p></div>
    <div><p class="foot-h">${esc(t.shop)}</p><ul>${nav}</ul></div>
    <div><p class="foot-h">${esc(t.help)}</p><ul>${PAGE_LINKS.map((p) => `<li><a href="${u(p.href)}">${esc(p.label)}</a></li>`).join("")}${pol}</ul></div>
    <div><p class="foot-h">${esc(t.shipTo)}</p>
      <label class="sr" for="country">${esc(t.country)}</label>
      <select id="country" class="country-select">
        <option value="US">${L === "es" ? "Estados Unidos (USD)" : "United States (USD)"}</option><option value="CO">Colombia (COP)</option><option value="VE">Venezuela (USD)</option>
      </select>
      <p><a href="${esc(switchHref)}" class="lang">${esc(t.language)}</a></p></div>
  </div>
  <div class="wrap copy">© ${new Date().getFullYear()} Aerial Needs · Ares Entertainment LLC</div>
</footer>`;
}

function cartDrawer() {
  return `<div class="cart-backdrop" hidden></div>
<aside class="cart-drawer" aria-label="${esc(t.cart)}" aria-hidden="true">
  <div class="cart-head"><h2>${esc(t.cart)}</h2><button class="icon-btn cart-close" aria-label="${esc(t.close)}">✕</button></div>
  <div class="cart-lines"><p class="muted">${esc(t.empty)}</p></div>
  <div class="cart-foot"><div class="cart-sub"><span>${esc(t.subtotal)}</span><strong class="cart-total">$0.00</strong></div>
    <p class="muted small">${esc(t.taxes)} ${esc(t.coachCode)}</p>
    <a class="btn btn-primary cart-checkout" href="#" aria-disabled="true">${esc(t.checkout)}</a></div>
</aside>`;
}

// ---------- components ----------
function priceHtml(p) {
  const min = p.priceRange.minVariantPrice, max = p.priceRange.maxVariantPrice;
  const from = Number(max.amount) > Number(min.amount) ? t.from : "";
  const cmp = p.variants.nodes
    .filter((v) => v.compareAtPrice && Number(v.compareAtPrice.amount) > Number(v.price.amount))
    .map((v) => Number(v.compareAtPrice.amount));
  const was = cmp.length && !from ? `<s class="was">${money({ amount: Math.max(...cmp), currencyCode: min.currencyCode })}</s> ` : "";
  return `${was}<span data-price-pid="${esc(p.id)}" data-from="${from ? 1 : 0}">${from}${money(min)}</span>`;
}

function card(p, eager = false) {
  const im = p.featuredImage;
  return `<li class="card" data-price="${Number(p.priceRange.minVariantPrice.amount)}" data-title="${esc(p.title)}"><a href="${u(`/products/${p.handle}/`)}">
  <div class="card-img">${
    im
      ? `<img src="${esc(img(im.url, 500))}" srcset="${esc(srcset(im.url, [300, 500, 800]))}" sizes="(max-width:600px) 50vw, 280px" alt="${esc(im.altText || p.title)}" width="500" height="500" ${eager ? 'fetchpriority="high"' : 'loading="lazy"'} decoding="async">`
      : ""
  }${p.availableForSale ? "" : `<span class="badge">${esc(t.soldOut)}</span>`}</div>
  <p class="card-title">${esc(p.title)}</p>
  <p class="card-price">${priceHtml(p)}</p></a></li>`;
}

function breadcrumbs(items) {
  const html = `<nav class="crumbs" aria-label="Breadcrumb"><ol>${items
    .map((it, i) => (i === items.length - 1 ? `<li aria-current="page">${esc(it.name)}</li>` : `<li><a href="${u(it.path)}">${esc(it.name)}</a></li>`))
    .join("")}</ol></nav>`;
  const ld = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((it, i) => ({ "@type": "ListItem", position: i + 1, name: it.name, item: abs(lp(it.path)) })),
  };
  return { html, ld };
}

// ---------- pages ----------
function productPage(p, colById, { noindex = false } = {}) {
  const path_ = `/products/${p.handle}/`;
  const desc = p.seo?.description || clip(strip(p.descriptionHtml), 155) || `${p.title} — Aerial Needs.`;
  const title = p.seo?.title || `${p.title} | Aerial Needs`;
  const mainCol = p.collections.nodes.map((c) => colById[c.id]).find((c) => c && c.handle !== "all");
  const bc = breadcrumbs([{ name: t.home, path: "/" }, ...(mainCol ? [{ name: mainCol.title, path: `/collections/${mainCol.handle}/` }] : []), { name: p.title, path: path_ }]);
  const images = p.images.nodes.length ? p.images.nodes : p.featuredImage ? [p.featuredImage] : [];
  const realOptions = p.options.filter((o) => !(o.name === "Title" && o.optionValues.length === 1 && o.optionValues[0].name === "Default Title"));
  const firstAvail = p.variants.nodes.find((v) => v.availableForSale) || p.variants.nodes[0];
  const opts = realOptions
    .map((o) => {
      const sel = firstAvail.selectedOptions.find((s) => s.name === o.name)?.value;
      return `<fieldset class="opt"><legend>${esc(o.name)}: <span class="opt-val">${esc(sel || "")}</span></legend><div class="opt-list">${o.optionValues
        .map((v) => `<label><input type="radio" name="${esc(o.name)}" value="${esc(v.name)}" ${v.name === sel ? "checked" : ""}><span>${esc(v.name)}</span></label>`)
        .join("")}</div></fieldset>`;
    })
    .join("");
  const variantsJson = p.variants.nodes.map((v) => ({
    id: v.id, a: v.availableForSale, p: v.price, c: v.compareAtPrice && Number(v.compareAtPrice.amount) > Number(v.price.amount) ? v.compareAtPrice : null,
    o: Object.fromEntries(v.selectedOptions.map((s) => [s.name, s.value])), i: v.image?.url || null,
  }));
  const gallery = images
    .map((im, i) =>
      `<li><img src="${esc(img(im.url, 800))}" srcset="${esc(srcset(im.url, [400, 800, 1200]))}" sizes="(max-width:900px) 100vw, 560px" alt="${esc(im.altText || p.title)}" width="${im.width || 800}" height="${im.height || 800}" ${i === 0 ? 'fetchpriority="high"' : 'loading="lazy"'} decoding="async"></li>`)
    .join("");
  const thumbs = images.length > 1 ? `<ul class="thumbs">${images.map((im, i) => `<li><button type="button" data-i="${i}" aria-label="${esc(t.image)} ${i + 1}"><img src="${esc(img(im.url, 120))}" alt="${esc(im.altText || p.title)}" width="60" height="60" loading="lazy"></button></li>`).join("")}</ul>` : "";
  const brand = p.vendor || "Aerial Needs";
  const own = brand === "Aerial Needs"; // partner products (Fire Mecca) ship on their own terms
  const faqs = t.faq.filter((f) => own || !f[2]);
  const url = abs(lp(path_));
  const ld = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: p.title,
    description: strip(p.descriptionHtml).slice(0, 5000),
    image: images.slice(0, 6).map((i) => i.url),
    brand: { "@type": "Brand", name: brand },
    sku: p.variants.nodes[0]?.id.split("/").pop(),
    category: mainCol?.title || p.productType || undefined,
    inLanguage: L,
    url,
    offers: p.variants.nodes.map((v) => ({
      "@type": "Offer",
      url,
      priceCurrency: v.price.currencyCode,
      price: Number(v.price.amount).toFixed(2),
      availability: v.availableForSale ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
      itemCondition: "https://schema.org/NewCondition",
      name: v.title === "Default Title" ? p.title : `${p.title} – ${v.title}`,
      seller: { "@type": "Organization", name: "Aerial Needs" },
      ...(own ? { shippingDetails: ["US", "CO", "VE"].map((cc) => ({
        "@type": "OfferShippingDetails",
        shippingRate: { "@type": "MonetaryAmount", value: "2.99", currency: "USD" },
        shippingDestination: { "@type": "DefinedRegion", addressCountry: cc },
        deliveryTime: { "@type": "ShippingDeliveryTime", handlingTime: { "@type": "QuantitativeValue", minValue: 1, maxValue: 3, unitCode: "DAY" }, transitTime: { "@type": "QuantitativeValue", minValue: 8, maxValue: 11, unitCode: "DAY" } },
      })) } : {}),
      hasMerchantReturnPolicy: { "@type": "MerchantReturnPolicy", applicableCountry: "US", returnPolicyCategory: "https://schema.org/MerchantReturnFiniteReturnWindow", merchantReturnDays: 30, returnMethod: "https://schema.org/ReturnByMail", returnFees: "https://schema.org/ReturnShippingFees" },
    })),
  };
  const faqLd = { "@context": "https://schema.org", "@type": "FAQPage", mainEntity: faqs.map((f) => ({ "@type": "Question", name: f[0], acceptedAnswer: { "@type": "Answer", text: f[1] } })) };
  const related = mainCol ? mainCol._products.filter((x) => x.id !== p.id).slice(0, 4) : [];
  const body = `<div class="wrap">${bc.html}
<article class="pdp">
  <div class="pdp-media"><ul class="gallery">${gallery}</ul>${thumbs}</div>
  <div class="pdp-info">
    ${brand !== "Aerial Needs" ? `<p class="vendor">${esc(brand)}</p>` : ""}
    <h1>${esc(p.title)}</h1>
    <p class="pdp-price" aria-live="polite">${priceHtml(p)}</p>
    <form class="buy" id="buy" data-product="${esc(p.id)}">
      ${opts}
      <div class="qty-row"><label class="sr" for="qty">${esc(t.qty)}</label>
        <div class="qty"><button type="button" data-q="-1" aria-label="${esc(t.dec)}">−</button><input id="qty" name="qty" type="number" min="1" value="1" inputmode="numeric"><button type="button" data-q="1" aria-label="${esc(t.inc)}">+</button></div>
        <button class="btn btn-primary add" type="submit" ${firstAvail.availableForSale ? "" : "disabled"}>${esc(firstAvail.availableForSale ? t.addToCart : t.soldOut)}</button></div>
      <input type="hidden" name="variant" value="${esc(firstAvail.id)}">
    </form>
    <script type="application/json" class="variants">${JSON.stringify(variantsJson).replace(/</g, "\\u003c")}</script>
    <ul class="assure">${(own ? t.assure : t.fmAssure).map((a) => `<li>${esc(a)}</li>`).join("")}</ul>
    <div class="rte">${cleanHtml(p.descriptionHtml)}</div>
    <section class="faq"><h2>${esc(t.faqH)}</h2>${faqs.map((f) => `<details><summary>${esc(f[0])}</summary><p>${esc(f[1])}</p></details>`).join("")}</section>
  </div>
</article>
<div class="sticky-buy" hidden><div class="sb-txt"><strong>${esc(p.title)}</strong><span class="sb-price"></span></div><button class="btn btn-primary" type="submit" form="buy"></button></div>
${related.length ? `<section class="related"><h2>${esc(t.moreFrom)} ${esc(mainCol.title)}</h2><ul class="grid">${related.map((r) => card(r)).join("")}</ul></section>` : ""}
</div>`;
  return { key: p.id, path: path_, noindex, html: layout({ key: p.id, title, description: desc, canonical: url, body, ogImage: images[0]?.url, ogType: "product", jsonld: [ld, bc.ld, faqLd], noindex }) };
}

function collectionPage(c) {
  const path_ = `/collections/${c.handle}/`;
  const name = c.handle === "all" ? t.allProducts : c.title;
  const title = c.seo?.title || `${name} | Aerial Needs`;
  const desc = c.seo?.description || clip(strip(c.descriptionHtml), 155) || `${name} — Aerial Needs.`;
  const bc = breadcrumbs([{ name: t.home, path: "/" }, { name, path: path_ }]);
  const url = abs(lp(path_));
  const ld = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name,
    url,
    mainEntity: { "@type": "ItemList", itemListElement: c._products.map((p, i) => ({ "@type": "ListItem", position: i + 1, url: abs(lp(`/products/${p.handle}/`)) })) },
  };
  const body = `<div class="wrap">${bc.html}
<header class="col-head"><h1>${esc(name)}</h1>${c.descriptionHtml ? `<div class="rte col-desc">${cleanHtml(c.descriptionHtml)}</div>` : ""}</header>
<div class="sortbar"><label for="sort">${esc(t.sortBy)}</label> <select id="sort">${t.sorts.map((x, i) => `<option value="${i}">${esc(x)}</option>`).join("")}</select></div>
<ul class="grid sortable">${c._products.map((p, i) => card(p, i < 4)).join("")}</ul></div>`;
  return { key: c.id, path: path_, html: layout({ key: c.id, title, description: desc, canonical: url, body, ogImage: c.image?.url, jsonld: [ld, bc.ld] }) };
}

function homePage(cols, colByHandle) {
  const show = cols.filter((c) => c.handle !== "all" && c._products.length);
  const kits = colByHandle["aerial-training-kits"]?._products || [];
  const fire = colByHandle["fire-mecca-partnership"]?._products || [];
  const kitIds = new Set(kits.map((k) => k.id));
  const best = (colByHandle["all"]?._products || []).filter((p) => !kitIds.has(p.id)).slice(0, 8);
  const heroImg = colByHandle["aerial-training-kits"]?.image?.url || show[0]?.image?.url;
  const ch = (h) => colByHandle[h]?.handle || h;
  const body = `
<section class="hero">
  ${heroImg ? `<img class="hero-img" src="${esc(img(heroImg, 1600))}" srcset="${esc(srcset(heroImg, [600, 1000, 1600]))}" sizes="100vw" alt="${esc(t.heroAlt)}" fetchpriority="high">` : ""}
  <div class="wrap hero-txt">
    <p class="eyebrow">${esc(t.eyebrow)}</p>
    <h1>${esc(t.hero)}</h1>
    <p class="lead">${esc(t.lead)}</p>
    <p><a class="btn btn-primary" href="${u(`/collections/${ch("all")}/`)}">${esc(t.shopAll)}</a> <a class="btn btn-ghost" href="${u(`/collections/${ch("aerial-training-kits")}/`)}">${esc(t.kits)}</a></p>
  </div>
</section>
<div class="wrap">
<ul class="trust">${t.trust.map((x) => `<li><strong>${esc(x[0])}</strong><span>${esc(x[1])}</span></li>`).join("")}</ul>
<section><h2 class="sec-h">${esc(t.byCat)}</h2>
<ul class="cats">${show
    .map((c) => `<li><a href="${u(`/collections/${c.handle}/`)}">${c.image ? `<img src="${esc(img(c.image.url, 500))}" srcset="${esc(srcset(c.image.url, [300, 500, 800]))}" sizes="(max-width:600px) 50vw, 300px" alt="${esc(c.image.altText || c.title)}" width="500" height="500" loading="lazy">` : ""}<span>${esc(c.title)}</span></a></li>`)
    .join("")}</ul></section>
${kits.length ? `<section><h2 class="sec-h">${esc(t.kitsH)} <small>${esc(t.save)}</small></h2><ul class="grid">${kits.map((p) => card(p)).join("")}</ul></section>` : ""}
${best.length ? `<section><h2 class="sec-h">${esc(t.gear)}</h2><ul class="grid">${best.map((p) => card(p)).join("")}</ul><p class="center"><a class="btn btn-ghost" href="${u(`/collections/${ch("all")}/`)}">${esc(t.viewAll)}</a></p></section>` : ""}
${fire.length ? `<section class="fire"><h2 class="sec-h">${esc(t.fireH)} <small>${esc(t.fireSub)}</small></h2><ul class="grid scroller">${fire.slice(0, 12).map((p) => card(p)).join("")}</ul><p class="center"><a class="btn btn-ghost" href="${u(`/collections/${ch("fire-mecca-partnership")}/`)}">${esc(t.shopFire)}</a></p></section>` : ""}
<section><h2 class="sec-h">${esc(t.guidesH)}</h2><ul class="guide-list">${GUIDES.map((g) => `<li><a href="${u(`/guides/${g[L].slug}/`)}"><strong>${esc(g[L].title)}</strong><span>${esc(g[L].description)}</span></a></li>`).join("")}</ul></section>
<section class="split">
  <div><h2>${esc(t.aboutH)}</h2><p>${esc(t.aboutP)}</p>${ABOUT ? `<p><a class="btn btn-ghost" href="${u(ABOUT)}">${esc(t.aboutLink)}</a></p>` : ""}</div>
  <div><h2>${esc(t.coachH)}</h2><p>${esc(t.coachP)}</p><p><a class="btn btn-ghost" href="${u("/pages/contact/")}">${esc(t.coachLink)}</a></p></div>
</section>
</div>`;
  const home = abs(lp("/"));
  const ld = [
    { "@context": "https://schema.org", "@type": "OnlineStore", name: "Aerial Needs", url: SITE_URL + "/", logo: LOGO || undefined, email: cfg.email, description: cfg.home[L].description,
      founder: { "@type": "Person", name: "Miguel Arana", jobTitle: "Aerialist and circus coach" }, parentOrganization: { "@type": "Organization", name: "Ares Entertainment LLC" },
      areaServed: ["US", "CO", "VE"], knowsLanguage: ["en", "es"], sameAs: ["https://www.instagram.com/aerialneeds.store/"],
      contactPoint: { "@type": "ContactPoint", contactType: "customer service", email: cfg.email, availableLanguage: ["English", "Spanish"] },
      hasMerchantReturnPolicy: { "@type": "MerchantReturnPolicy", applicableCountry: ["US", "CO", "VE"], returnPolicyCategory: "https://schema.org/MerchantReturnFiniteReturnWindow", merchantReturnDays: 30, returnMethod: "https://schema.org/ReturnByMail", returnFees: "https://schema.org/ReturnShippingFees" } },
    { "@context": "https://schema.org", "@type": "WebSite", name: "Aerial Needs", url: home, inLanguage: L, potentialAction: { "@type": "SearchAction", target: home + "search/?q={q}", "query-input": "required name=q" } },
  ];
  return { key: "home", path: "/", html: layout({ key: "home", title: cfg.home[L].title, description: cfg.home[L].description, canonical: home, body, ogImage: heroImg, jsonld: ld }) };
}

function simplePage({ key, path: p, title, heading, bodyHtml, description, noindex }) {
  const body = `<div class="wrap narrow"><h1>${esc(heading)}</h1><div class="rte">${bodyHtml}</div></div>`;
  return { key, path: p, html: layout({ key, title, description, canonical: abs(lp(p)), body, noindex }) };
}

// Direct-link landing pages (config.directPages): unadvertised sections such as the sellers portal or AN Gafas.
function directPage(dp, d) {
  const c = dp[L] || dp.en, path_ = `/pages/${dp.handle}/`;
  const items = (dp.products || []).map((h) => d.byHandle[h]).filter(Boolean);
  const body = `<div class="wrap direct direct-${esc(dp.handle)}"${dp.style ? ` style="${esc(dp.style)}"` : ""}>
${c.eyebrow ? `<p class="eyebrow">${esc(c.eyebrow)}</p>` : ""}<h1>${esc(c.title)}</h1>${c.html ? `<div class="rte">${c.html}</div>` : ""}
${items.length ? `<ul class="grid">${items.map((p) => card(p)).join("")}</ul>` : ""}${c.footer ? `<p class="muted">${esc(c.footer)}</p>` : ""}</div>`;
  return { key: "page:" + dp.handle, path: path_, noindex: !!dp.noindex,
    html: layout({ key: "page:" + dp.handle, title: `${c.title} | ${dp.brand || "Aerial Needs"}`, description: c.description || c.title, canonical: abs(lp(path_)), body, noindex: !!dp.noindex, ogImage: items[0]?.featuredImage?.url }) };
}

function guidePage(g, d) {
  const c = g[L], path_ = `/guides/${c.slug}/`, url = abs(lp(path_));
  const html = c.html.replace(/\{\{col:([\w-]+)\}\}/g, (_, h) => u(`/collections/${d.colByEnHandle[h]?.handle || h}/`));
  const cols = g.collections.map((h) => d.colByEnHandle[h]).filter((x) => x && x._products.length);
  const bc = breadcrumbs([{ name: t.home, path: "/" }, { name: t.guides, path: "/guides/" }, { name: c.title, path: path_ }]);
  const ld = { "@context": "https://schema.org", "@type": "Article", headline: c.title, description: c.description, inLanguage: L, datePublished: g.date, dateModified: g.date, mainEntityOfPage: url,
    author: { "@type": "Organization", name: "Aerial Needs", url: SITE_URL + "/" }, publisher: { "@type": "Organization", name: "Aerial Needs", logo: LOGO ? { "@type": "ImageObject", url: LOGO } : undefined } };
  const body = `<div class="wrap">${bc.html}<article class="narrow guide"><h1>${esc(c.title)}</h1><div class="rte">${html}</div></article>
<section><h2 class="sec-h">${esc(t.shopGear)}</h2><ul class="grid">${(cols[0]?._products || []).slice(0, 4).map((p) => card(p)).join("")}</ul></section></div>`;
  return { key: "guide:" + g.key, path: path_, html: layout({ key: "guide:" + g.key, title: `${c.title} | Aerial Needs`, description: c.description, canonical: url, body, ogType: "article", jsonld: [ld, bc.ld] }) };
}

function guidesIndex() {
  const bc = breadcrumbs([{ name: t.home, path: "/" }, { name: t.guides, path: "/guides/" }]);
  const body = `<div class="wrap">${bc.html}<h1>${esc(t.guidesH)}</h1><p class="muted">${esc(t.guidesDesc)}</p>
<ul class="guide-list">${GUIDES.map((g) => `<li><a href="${u(`/guides/${g[L].slug}/`)}"><strong>${esc(g[L].title)}</strong><span>${esc(g[L].description)}</span></a></li>`).join("")}</ul></div>`;
  return { key: "guides", path: "/guides/", html: layout({ key: "guides", title: `${t.guidesH} | Aerial Needs`, description: t.guidesDesc, canonical: abs(lp("/guides/")), body, jsonld: [bc.ld] }) };
}

function contactPage() {
  const body = `<div class="wrap narrow"><h1>${esc(t.contactH)}</h1>
<p>${esc(t.contactP)}</p>
<p><a class="btn btn-primary" href="mailto:${esc(cfg.email)}">${esc(t.email)} ${esc(cfg.email)}</a></p>
<p>Instagram: <a href="https://www.instagram.com/aerialneeds.store/" rel="noopener">@aerialneeds.store</a></p>
<p class="muted">${esc(t.track)} <a href="${esc(FALLBACK)}/account">${esc(t.accountPage)}</a>.</p></div>`;
  return { key: "contact", path: "/pages/contact/", html: layout({ key: "contact", title: `${t.contactH} | Aerial Needs`, description: t.contactDesc, canonical: abs(lp("/pages/contact/")), body }) };
}

function searchPage() {
  const body = `<div class="wrap"><h1>${esc(t.search)}</h1>
<form class="search-form" role="search"><label class="sr" for="q">${esc(t.searchProducts)}</label><input id="q" name="q" type="search" placeholder="${esc(t.searchP)}" autocomplete="off"></form>
<p class="muted search-meta"></p><ul class="grid search-results"></ul></div>`;
  return { key: "search", path: "/search/", html: layout({ key: "search", title: `${t.search} | Aerial Needs`, description: t.searchDesc, canonical: abs(lp("/search/")), body, noindex: true }) };
}

function notFound() {
  // GitHub Pages serves /404.html for any unknown path. Shopify-only paths (account, unlisted
  // products, old pages) are forwarded to the Shopify storefront so no link breaks.
  const body = `<div class="wrap narrow"><h1>${esc(t.notFound)}</h1><p>${esc(t.notFoundP)}</p>
<p><a class="btn btn-primary" href="${u("/collections/all/")}">${esc(t.shopAll)}</a></p></div>
<script>(function(){var b=${JSON.stringify(BASE)},p=location.pathname;if(b&&p.indexOf(b)===0)p=p.slice(b.length);
var fwd=/^(\\/es)?\\/(account|cart|checkouts?|orders|tools|apps|policies|pages|products|collections|blogs|discount|services|a\\/)/;
if(fwd.test(p)&&!sessionStorage.getItem("an404"+p)){sessionStorage.setItem("an404"+p,1);location.replace(${JSON.stringify(FALLBACK)}+p+location.search+location.hash);}})();</script>`;
  return { key: "404", path: "/404.html", file: true, html: layout({ key: "404", title: `${t.notFound} | Aerial Needs`, description: t.notFound, canonical: abs("/"), body, noindex: true }) };
}

// ---------- build ----------
function prepare(data) {
  // Only list products that live in at least one collection; unlisted / direct-link products are built separately (noindex)
  // (sellers portal, AN Gafas…) get noindex pages so their direct links work but they stay out of Google.
  const products = data.products.filter((p) => p.collections.nodes.length && !cfg.excludeProducts.includes(p.id) && !cfg.excludeProducts.includes(p.handle));
  const byId = Object.fromEntries(products.map((p) => [p.id, p]));
  const cols = data.collections.map((c) => ({ ...c, _products: c.products.nodes.map((n) => byId[n.id]).filter(Boolean) }));
  const colById = Object.fromEntries(cols.map((c) => [c.id, c]));
  // Stable (English) handle → collection, so config/nav can refer to collections by their English handle
  const pages = data.pages.filter((p) => !cfg.excludePages.includes(p.id) && !cfg.excludePages.includes(p.handle));
  const policies = ["refundPolicy", "shippingPolicy", "privacyPolicy", "termsOfService"].map((k) => data.shop[k]).filter((x) => x && x.body);
  const unlisted = (data.unlisted || []).filter((p) => !byId[p.id]);
  return { products, unlisted, byHandle: Object.fromEntries([...products, ...unlisted].map((p) => [p.handle, p])), cols, colById, pages, policies, shop: data.shop };
}

async function main() {
  const fixIdx = process.argv.indexOf("--fixture");
  await resolveMode(fixIdx > -1);
  let raw;
  if (fixIdx > -1) {
    const f = JSON.parse(fs.readFileSync(process.argv[fixIdx + 1]));
    raw = f.en ? f : { en: f, es: f };
  } else {
    raw = { en: await fetchLocale("en"), es: await fetchLocale("es") };
  }
  const D = { en: prepare(raw.en), es: prepare(raw.es) };

  // English handle for each collection/page id (config refers to English handles; contact is excluded by handle in EN)
  const enColHandle = Object.fromEntries(D.en.cols.map((c) => [c.id, c.handle]));
  const enPageHandle = Object.fromEntries(raw.en.pages.map((p) => [p.id, p.handle]));
  const enPolicyKey = (pol) => pol.id || pol.handle;
  for (const loc of LOCALES) {
    // The ES dataset can't use translated handles to apply config rules, so re-filter by English handle.
    D[loc].pages = raw[loc].pages.filter((p) => !cfg.excludePages.includes(enPageHandle[p.id] || p.handle));
    D[loc].colByEnHandle = Object.fromEntries(D[loc].cols.map((c) => [enColHandle[c.id] || c.handle, c]));
  }

  // Alternate-language map, keyed by Shopify id
  ALT = {};
  const addAlt = (key, loc, p) => ((ALT[key] ||= {})[loc] = lp(p, loc));
  for (const loc of LOCALES) {
    const d = D[loc];
    addAlt("home", loc, "/"); addAlt("contact", loc, "/pages/contact/"); addAlt("search", loc, "/search/"); addAlt("guides", loc, "/guides/");
    for (const g of GUIDES) addAlt("guide:" + g.key, loc, `/guides/${g[loc].slug}/`);
    for (const p of [...d.products, ...d.unlisted]) addAlt(p.id, loc, `/products/${p.handle}/`);
    for (const dp of cfg.directPages || []) addAlt("page:" + dp.handle, loc, `/pages/${dp.handle}/`);
    for (const c of d.cols) if (c._products.length) addAlt(c.id, loc, `/collections/${c.handle}/`);
    for (const pg of d.pages) if ((enPageHandle[pg.id] || pg.handle) !== "contact") addAlt(pg.id, loc, `/pages/${pg.handle}/`);
    for (const pol of d.policies) addAlt(enPolicyKey(pol), loc, `/policies/${pol.handle}/`);
  }

  fs.rmSync(OUT, { recursive: true, force: true });
  const written = [];
  for (const loc of LOCALES) {
    L = loc; t = T[loc];
    const d = D[loc];
    LOGO = d.shop.brand?.logo?.image?.url || "";
    NAV = cfg.nav
      .map((n) => ({ n, c: d.colByEnHandle[n.collection] }))
      .filter(({ c }) => c && c._products.length)
      .map(({ n, c }) => ({ label: n.label[loc] || n.label.en, href: `/collections/${c.handle}/` }));
    POLICIES = d.policies;
    const pages = d.pages.filter((p) => (enPageHandle[p.id] || p.handle) !== "contact");
    PAGE_LINKS = [...pages.map((p) => ({ label: p.title, href: `/pages/${p.handle}/` })), { label: t.guides, href: "/guides/" }, { label: t.contact, href: "/pages/contact/" }];
    const about = pages.find((p) => enPageHandle[p.id] === "about");
    ABOUT = about ? `/pages/${about.handle}/` : "";

    const out = [];
    out.push(homePage(d.cols, d.colByEnHandle));
    for (const c of d.cols) if (c._products.length) out.push(collectionPage(c));
    for (const p of d.products) out.push(productPage(p, d.colById));
    for (const p of d.unlisted) out.push(productPage(p, d.colById, { noindex: true }));
    for (const dp of cfg.directPages || []) out.push(directPage(dp, d));
    for (const pg of pages)
      out.push(simplePage({ key: pg.id, path: `/pages/${pg.handle}/`, title: pg.seo?.title || `${pg.title} | Aerial Needs`, heading: pg.title, bodyHtml: cleanHtml(pg.body), description: pg.seo?.description || clip(strip(pg.body), 155) }));
    out.push(contactPage());
    out.push(guidesIndex());
    for (const g of GUIDES) out.push(guidePage(g, d));
    for (const pol of POLICIES)
      out.push(simplePage({ key: enPolicyKey(pol), path: `/policies/${pol.handle}/`, title: `${pol.title} | Aerial Needs`, heading: pol.title, bodyHtml: pol.body, description: `${pol.title} ${t.policyFor}` }));
    out.push(searchPage());
    if (loc === "en") out.push(notFound());

    for (const o of out) {
      const rel = o.file ? o.path : lp(o.path) + "index.html";
      const file = path.join(OUT, rel);
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, o.html);
      written.push({ ...o, loc, url: lp(o.path) });
    }

    // Search index per language (loaded only on the search page)
    fs.mkdirSync(path.join(OUT, "assets"), { recursive: true });
    fs.writeFileSync(path.join(OUT, "assets", `search-${loc}.json`), JSON.stringify(d.products.map((p) => ({
      h: p.handle, t: p.title, k: [p.productType, p.vendor, ...p.tags, ...p.collections.nodes.map((c) => d.colById[c.id]?.title || "")].join(" "),
      i: p.featuredImage?.url || "", p: money(p.priceRange.minVariantPrice), f: Number(p.priceRange.maxVariantPrice.amount) > Number(p.priceRange.minVariantPrice.amount),
    }))));
  }
  fs.cpSync("assets", path.join(OUT, "assets"), { recursive: true });

  // Old URLs → new URLs (static redirect pages; GitHub Pages has no server-side redirects)
  for (const [from, to] of Object.entries(cfg.redirects || {})) {
    for (const loc of LOCALES) {
      const target = BASE + lp(to, loc), file = path.join(OUT, lp(from, loc), "index.html");
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, `<!doctype html><html><head><meta charset="utf-8"><title>Moved</title><link rel="canonical" href="${abs(lp(to, loc))}"><meta name="robots" content="noindex"><meta http-equiv="refresh" content="0; url=${target}"><script>location.replace(${JSON.stringify(target)}+location.search+location.hash)</script></head><body><a href="${target}">${target}</a></body></html>`);
    }
  }

  // Sitemap (with hreflang alternates) + robots
  const indexable = written.filter((o) => !o.file && o.key !== "search" && !o.noindex);
  const updated = {};
  for (const loc of LOCALES) for (const x of [...D[loc].products, ...D[loc].cols, ...D[loc].pages]) updated[x.id] = x.updatedAt;
  const xhtml = (key) =>
    LOCALES.filter((l) => ALT[key]?.[l]).map((l) => `<xhtml:link rel="alternate" hreflang="${l}" href="${abs(ALT[key][l])}"/>`).join("");
  fs.writeFileSync(path.join(OUT, "sitemap.xml"), `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${indexable.map((o) => `<url><loc>${abs(o.url)}</loc><lastmod>${(updated[o.key] || new Date().toISOString()).slice(0, 10)}</lastmod>${xhtml(o.key)}</url>`).join("\n")}
</urlset>`);
  const AI_BOTS = ["GPTBot", "OAI-SearchBot", "ChatGPT-User", "ClaudeBot", "Claude-SearchBot", "Claude-User", "PerplexityBot", "Perplexity-User", "Google-Extended", "Applebot-Extended", "Amazonbot", "meta-externalagent"];
  fs.writeFileSync(path.join(OUT, "robots.txt"), PREVIEW ? "User-agent: *\nDisallow: /\n"
    : `User-agent: *\nAllow: /\nDisallow: /search/\nDisallow: /es/search/\n\n# AI search and shopping assistants are welcome\n${AI_BOTS.map((b) => `User-agent: ${b}`).join("\n")}\nAllow: /\n\nSitemap: ${abs("/sitemap.xml")}\n`);

  // llms.txt — a plain-text map of the store for AI assistants
  const en = D.en, strip1 = (h) => clip(strip(h || ""), 160);
  fs.writeFileSync(path.join(OUT, "llms.txt"), `# Aerial Needs

> ${cfg.home.en.description}

Aerial Needs is an online store for aerial arts, circus and fire performance equipment, founded by Miguel Arana, an aerialist and circus coach. It is operated by Ares Entertainment LLC.

## Key facts
- Ships to the United States, Colombia and Venezuela
- Aerial training gear ships for a flat $2.99, delivered in 9 to 14 days
- 30-day returns: US orders get a replacement; Colombia and Venezuela orders get store credit
- Available in English (${SITE_URL}/) and Spanish (${SITE_URL}/es/); Colombian prices shown in COP
- Fire performance gear is American-made by partner Fire Mecca
- These accessories are not fall-protection equipment; always train with a qualified coach
- Contact: ${cfg.email} · Instagram @aerialneeds.store

## Collections
${en.cols.filter((c) => c._products.length && c.handle !== "all").map((c) => `- [${c.title}](${abs(`/collections/${c.handle}/`)}): ${strip1(c.descriptionHtml)}`).join("\n")}

## Products
${en.products.map((p) => `- [${p.title}](${abs(`/products/${p.handle}/`)}): ${money(p.priceRange.minVariantPrice)}${p.vendor && p.vendor !== "Aerial Needs" ? `, by ${p.vendor}` : ""}. ${strip1(p.seo?.description || p.descriptionHtml)}`).join("\n")}

## Guides
${GUIDES.map((g) => `- [${g.en.title}](${abs(`/guides/${g.en.slug}/`)}): ${g.en.description}`).join("\n")}

## Help
${[...D.en.pages.filter((p) => p.handle !== "contact").map((p) => `- [${p.title}](${abs(`/pages/${p.handle}/`)})`), `- [Contact](${abs("/pages/contact/")})`, ...en.policies.map((p) => `- [${p.title}](${abs(`/policies/${p.handle}/`)})`)].join("\n")}
`);
  if (!PREVIEW && cfg.customDomain) fs.writeFileSync(path.join(OUT, "CNAME"), cfg.customDomain + "\n");
  fs.writeFileSync(path.join(OUT, ".nojekyll"), "");
  const n = (loc) => written.filter((w) => w.loc === loc).length;
  console.log(`Built ${written.length} pages (EN ${n("en")}, ES ${n("es")}; ${D.en.products.length} products) → dist/  preview=${PREVIEW} base="${BASE}"`);
}

main().catch((e) => { console.error(e); process.exit(1); });
