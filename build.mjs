// Aerial Needs static site generator.
// Pulls catalog data from the Shopify Storefront API and writes a fully
// pre-rendered site to ./dist (for GitHub Pages). Cart + checkout stay on Shopify.
//
// Usage:
//   node build.mjs                     # live data from Shopify
//   node build.mjs --fixture f.json    # offline build from a saved snapshot
//
// Env (all optional, defaults in config.json):
//   SITE_URL       canonical origin, e.g. https://www.aerialneeds.com
//   BASE_PATH      path prefix when served from a sub-folder (GitHub preview), e.g. /aerialneeds-site
//   PREVIEW=1      adds noindex everywhere and blocks robots (use before the domain switch)
//   FALLBACK_ORIGIN where unknown URLs (account, unlisted products…) are sent, e.g. https://shop.aerialneeds.com

import fs from "node:fs";
import path from "node:path";

const cfg = JSON.parse(fs.readFileSync(new URL("./config.json", import.meta.url)));
const SITE_URL = (process.env.SITE_URL || cfg.siteUrl).replace(/\/$/, "");
const BASE = (process.env.BASE_PATH || cfg.basePath || "").replace(/\/$/, "");
const PREVIEW = process.env.PREVIEW ? process.env.PREVIEW === "1" : !!cfg.preview;
const FALLBACK = (process.env.FALLBACK_ORIGIN || cfg.fallbackOrigin).replace(/\/$/, "");
const OUT = path.resolve("dist");
const API = `https://${cfg.shopDomain}/api/${cfg.apiVersion}/graphql.json`;

// ---------- helpers ----------
const esc = (s = "") =>
  String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const strip = (h = "") => h.replace(/<style[\s\S]*?<\/style>|<script[\s\S]*?<\/script>/gi, "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
const clip = (s, n) => (s.length <= n ? s : s.slice(0, s.lastIndexOf(" ", n - 1)).replace(/[,.;:–-]+$/, "") + "…");
const u = (p) => BASE + p;
const abs = (p) => SITE_URL + p;
const money = (m) => {
  if (!m) return "";
  const n = Number(m.amount);
  return m.currencyCode === "USD" ? `$${n.toFixed(2)}` : `${m.currencyCode} ${n.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
};
const img = (url, w) => (url ? url + (url.includes("?") ? "&" : "?") + "width=" + w : "");
const srcset = (url, sizes = [300, 500, 800, 1200]) => sizes.map((w) => `${img(url, w)} ${w}w`).join(", ");
// Clean Shopify description HTML: drop inline styles, empty paragraphs, editor attributes.
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
  collections(first: 10) { nodes { handle } }`;

async function fetchAll() {
  const products = [];
  let after = null;
  do {
    const d = await sf(`query($after:String){ products(first:100, after:$after){ pageInfo{hasNextPage endCursor} nodes{ ${PRODUCT_FIELDS} } } }`, { after });
    products.push(...d.products.nodes);
    after = d.products.pageInfo.hasNextPage ? d.products.pageInfo.endCursor : null;
  } while (after);
  const d = await sf(`{
    shop { name description brand { logo { image { url } } }
      privacyPolicy { handle title body } refundPolicy { handle title body }
      shippingPolicy { handle title body } termsOfService { handle title body } }
    collections(first: 50) { nodes { handle title descriptionHtml updatedAt seo { title description } image { url altText }
      products(first: 250) { nodes { handle } } } }
    pages(first: 50) { nodes { handle title body updatedAt seo { title description } } }
  }`);
  return { products, collections: d.collections.nodes, pages: d.pages.nodes, shop: d.shop };
}

// ---------- layout ----------
function layout({ title, description, canonical, body, ogImage, jsonld = [], noindex = false, ogType = "website" }) {
  const robots = PREVIEW || noindex ? `<meta name="robots" content="noindex, nofollow">` : "";
  const ld = jsonld.map((o) => `<script type="application/ld+json">${JSON.stringify(o).replace(/</g, "\\u003c")}</script>`).join("\n");
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${esc(canonical)}">
${robots}
<meta property="og:site_name" content="Aerial Needs">
<meta property="og:type" content="${ogType}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${esc(canonical)}">
${ogImage ? `<meta property="og:image" content="${esc(img(ogImage, 1200))}">` : ""}
<meta name="twitter:card" content="summary_large_image">
<link rel="preconnect" href="https://cdn.shopify.com" crossorigin>
<link rel="icon" href="${u("/assets/favicon.svg")}" type="image/svg+xml">
<link rel="stylesheet" href="${u("/assets/style.css")}?v=${BUILD_ID}">
${ld}
</head>
<body>
${header()}
<main id="main">${body}</main>
${footer()}
${cartDrawer()}
<script>window.AN=${JSON.stringify({ shop: cfg.shopDomain, token: cfg.storefrontToken, api: cfg.apiVersion, base: BASE })};</script>
<script src="${u("/assets/cart.js")}?v=${BUILD_ID}" defer></script>
</body>
</html>`;
}

let NAV = [];
let LOGO = "";
function header() {
  const links = NAV.map((n) => `<li><a href="${u(n.href)}">${esc(n.label)}</a></li>`).join("");
  return `<a class="skip" href="#main">Skip to content</a>
<header class="site-header">
  <div class="wrap header-row">
    <details class="menu"><summary aria-label="Menu"><span></span><span></span><span></span></summary>
      <nav class="menu-panel" aria-label="Main"><ul>${links}<li><a href="${u("/search/")}">Search</a></li></ul></nav></details>
    <a class="logo" href="${u("/")}" aria-label="Aerial Needs home">${
      LOGO ? `<img src="${esc(img(LOGO, 400))}" alt="Aerial Needs" width="200" height="50">` : `<span class="logo-a">AERIAL</span><span class="logo-n">NEEDS</span>`
    }</a>
    <nav class="desk-nav" aria-label="Main"><ul>${links}</ul></nav>
    <div class="header-tools">
      <a href="${u("/search/")}" class="icon-btn" aria-label="Search"><svg viewBox="0 0 24 24" width="22" height="22"><circle cx="10.5" cy="10.5" r="6.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M15.5 15.5 21 21" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg></a>
      <button class="icon-btn cart-toggle" aria-label="Open cart"><svg viewBox="0 0 24 24" width="22" height="22"><path d="M6 7h12l-1 13H7L6 7Z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M9 7a3 3 0 0 1 6 0" fill="none" stroke="currentColor" stroke-width="2"/></svg><span class="cart-count" hidden>0</span></button>
    </div>
  </div>
</header>`;
}

let POLICIES = [];
function footer() {
  const pol = POLICIES.map((p) => `<li><a href="${u(`/policies/${p.handle}/`)}">${esc(p.title)}</a></li>`).join("");
  const nav = NAV.map((n) => `<li><a href="${u(n.href)}">${esc(n.label)}</a></li>`).join("");
  return `<footer class="site-footer">
  <div class="wrap footer-grid">
    <div><p class="foot-brand">AERIAL NEEDS</p><p>Built for Those Who Dare to Fly.</p>
      <p class="muted">Ships to the United States, Colombia and Venezuela · flat $2.99 shipping · 9–14 day delivery.</p>
      <p><a href="https://www.instagram.com/aerialneeds.store/" rel="noopener">Instagram @aerialneeds.store</a></p></div>
    <div><p class="foot-h">Shop</p><ul>${nav}</ul></div>
    <div><p class="foot-h">Help</p><ul>${PAGE_LINKS.map((p) => `<li><a href="${u(p.href)}">${esc(p.label)}</a></li>`).join("")}${pol}</ul></div>
    <div><p class="foot-h">Ship to</p>
      <label class="sr" for="country">Country</label>
      <select id="country" class="country-select">
        <option value="US">United States (USD)</option><option value="CO">Colombia (COP)</option><option value="VE">Venezuela (USD)</option>
      </select></div>
  </div>
  <div class="wrap copy">© ${new Date().getFullYear()} Aerial Needs · Ares Entertainment LLC</div>
</footer>`;
}
let PAGE_LINKS = [];

function cartDrawer() {
  return `<div class="cart-backdrop" hidden></div>
<aside class="cart-drawer" aria-label="Cart" aria-hidden="true">
  <div class="cart-head"><h2>Your cart</h2><button class="icon-btn cart-close" aria-label="Close cart">✕</button></div>
  <div class="cart-lines"><p class="muted">Your cart is empty.</p></div>
  <div class="cart-foot"><div class="cart-sub"><span>Subtotal</span><strong class="cart-total">$0.00</strong></div>
    <p class="muted small">Shipping and taxes calculated at checkout.</p>
    <a class="btn btn-primary cart-checkout" href="#" aria-disabled="true">Checkout</a></div>
</aside>`;
}

// ---------- components ----------
function priceHtml(p) {
  const min = p.priceRange.minVariantPrice, max = p.priceRange.maxVariantPrice;
  const from = Number(max.amount) > Number(min.amount) ? "From " : "";
  // Only show strike-through when compare-at is genuinely higher than the selling price.
  const cmp = p.variants.nodes
    .filter((v) => v.compareAtPrice && Number(v.compareAtPrice.amount) > Number(v.price.amount))
    .map((v) => Number(v.compareAtPrice.amount));
  const was = cmp.length && !from ? `<s class="was">${money({ amount: Math.max(...cmp), currencyCode: min.currencyCode })}</s> ` : "";
  return `${was}<span data-price-pid="${esc(p.id)}" data-from="${from ? 1 : 0}">${from}${money(min)}</span>`;
}

function card(p, eager = false) {
  const im = p.featuredImage;
  return `<li class="card"><a href="${u(`/products/${p.handle}/`)}">
  <div class="card-img">${
    im
      ? `<img src="${esc(img(im.url, 500))}" srcset="${esc(srcset(im.url, [300, 500, 800]))}" sizes="(max-width:600px) 50vw, 280px" alt="${esc(im.altText || p.title)}" width="500" height="500" ${eager ? 'fetchpriority="high"' : 'loading="lazy"'} decoding="async">`
      : ""
  }${p.availableForSale ? "" : `<span class="badge">Sold out</span>`}</div>
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
    itemListElement: items.map((it, i) => ({ "@type": "ListItem", position: i + 1, name: it.name, item: abs(it.path) })),
  };
  return { html, ld };
}

// ---------- pages ----------
function productPage(p, colByHandle) {
  const path_ = `/products/${p.handle}/`;
  const desc = p.seo?.description || clip(strip(p.descriptionHtml), 155) || `${p.title} from Aerial Needs.`;
  const title = p.seo?.title || `${p.title} | Aerial Needs`;
  const mainCol = p.collections.nodes.map((c) => colByHandle[c.handle]).find((c) => c && c.handle !== "all");
  const bc = breadcrumbs([{ name: "Home", path: "/" }, ...(mainCol ? [{ name: mainCol.title, path: `/collections/${mainCol.handle}/` }] : []), { name: p.title, path: path_ }]);
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
  const thumbs = images.length > 1 ? `<ul class="thumbs">${images.map((im, i) => `<li><button type="button" data-i="${i}" aria-label="Image ${i + 1}"><img src="${esc(img(im.url, 120))}" alt="" width="60" height="60" loading="lazy"></button></li>`).join("")}</ul>` : "";
  const brand = p.vendor || "Aerial Needs";
  const ld = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: p.title,
    description: strip(p.descriptionHtml).slice(0, 5000),
    image: images.slice(0, 6).map((i) => i.url),
    brand: { "@type": "Brand", name: brand },
    sku: p.variants.nodes[0]?.id.split("/").pop(),
    url: abs(path_),
    offers: p.variants.nodes.map((v) => ({
      "@type": "Offer",
      url: abs(path_),
      priceCurrency: v.price.currencyCode,
      price: Number(v.price.amount).toFixed(2),
      availability: v.availableForSale ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
      itemCondition: "https://schema.org/NewCondition",
      name: v.title === "Default Title" ? p.title : `${p.title} – ${v.title}`,
      shippingDetails: {
        "@type": "OfferShippingDetails",
        shippingRate: { "@type": "MonetaryAmount", value: "2.99", currency: "USD" },
        shippingDestination: { "@type": "DefinedRegion", addressCountry: "US" },
        deliveryTime: { "@type": "ShippingDeliveryTime", handlingTime: { "@type": "QuantitativeValue", minValue: 1, maxValue: 3, unitCode: "DAY" }, transitTime: { "@type": "QuantitativeValue", minValue: 8, maxValue: 11, unitCode: "DAY" } },
      },
      hasMerchantReturnPolicy: { "@type": "MerchantReturnPolicy", applicableCountry: "US", returnPolicyCategory: "https://schema.org/MerchantReturnFiniteReturnWindow", merchantReturnDays: 30, returnMethod: "https://schema.org/ReturnByMail", returnFees: "https://schema.org/ReturnShippingFees" },
    })),
  };
  const related = mainCol ? mainCol._products.filter((x) => x.handle !== p.handle).slice(0, 4) : [];
  const body = `<div class="wrap">${bc.html}
<article class="pdp">
  <div class="pdp-media"><ul class="gallery">${gallery}</ul>${thumbs}</div>
  <div class="pdp-info">
    ${brand !== "Aerial Needs" ? `<p class="vendor">${esc(brand)}</p>` : ""}
    <h1>${esc(p.title)}</h1>
    <p class="pdp-price" aria-live="polite">${priceHtml(p)}</p>
    <form class="buy" data-product="${esc(p.id)}">
      ${opts}
      <div class="qty-row"><label class="sr" for="qty">Quantity</label>
        <div class="qty"><button type="button" data-q="-1" aria-label="Decrease">−</button><input id="qty" name="qty" type="number" min="1" value="1" inputmode="numeric"><button type="button" data-q="1" aria-label="Increase">+</button></div>
        <button class="btn btn-primary add" type="submit" ${firstAvail.availableForSale ? "" : "disabled"}>${firstAvail.availableForSale ? "Add to cart" : "Sold out"}</button></div>
      <input type="hidden" name="variant" value="${esc(firstAvail.id)}">
    </form>
    <script type="application/json" class="variants">${JSON.stringify(variantsJson).replace(/</g, "\\u003c")}</script>
    <ul class="assure"><li>Flat $2.99 shipping</li><li>Delivery in 9–14 days</li><li>30-day returns</li></ul>
    <div class="rte">${cleanHtml(p.descriptionHtml)}</div>
  </div>
</article>
${related.length ? `<section class="related"><h2>More from ${esc(mainCol.title)}</h2><ul class="grid">${related.map((r) => card(r)).join("")}</ul></section>` : ""}
</div>`;
  return { path: path_, html: layout({ title, description: desc, canonical: abs(path_), body, ogImage: images[0]?.url, ogType: "product", jsonld: [ld, bc.ld] }) };
}

function collectionPage(c) {
  const path_ = `/collections/${c.handle}/`;
  const title = c.seo?.title || `${c.title} | Aerial Needs`;
  const desc = c.seo?.description || clip(strip(c.descriptionHtml), 155) || `Shop ${c.title} at Aerial Needs.`;
  const bc = breadcrumbs([{ name: "Home", path: "/" }, { name: c.title === "All" ? "All products" : c.title, path: path_ }]);
  const ld = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: c.title,
    url: abs(path_),
    mainEntity: { "@type": "ItemList", itemListElement: c._products.map((p, i) => ({ "@type": "ListItem", position: i + 1, url: abs(`/products/${p.handle}/`) })) },
  };
  const body = `<div class="wrap">${bc.html}
<header class="col-head"><h1>${esc(c.title === "All" ? "All products" : c.title)}</h1>${c.descriptionHtml ? `<div class="rte col-desc">${cleanHtml(c.descriptionHtml)}</div>` : ""}</header>
<ul class="grid">${c._products.map((p, i) => card(p, i < 4)).join("")}</ul></div>`;
  return { path: path_, html: layout({ title, description: desc, canonical: abs(path_), body, ogImage: c.image?.url, jsonld: [ld, bc.ld] }) };
}

function homePage(cols, colByHandle) {
  const show = cols.filter((c) => c.handle !== "all" && c._products.length);
  const kits = colByHandle["aerial-essentials"]?._products || [];
  const fire = colByHandle["fire-mecca-partnership"]?._products || [];
  const featuredHandles = new Set(kits.map((k) => k.handle));
  const best = (colByHandle["all"]?._products || []).filter((p) => !featuredHandles.has(p.handle)).slice(0, 8);
  const heroImg = colByHandle["aerial-essentials"]?.image?.url || show[0]?.image?.url;
  const body = `
<section class="hero">
  ${heroImg ? `<img class="hero-img" src="${esc(img(heroImg, 1600))}" srcset="${esc(srcset(heroImg, [600, 1000, 1600]))}" sizes="100vw" alt="" fetchpriority="high">` : ""}
  <div class="wrap hero-txt">
    <p class="eyebrow">Aerial · Circus · Fire</p>
    <h1>ELEVATE YOUR PERFORMANCE</h1>
    <p class="lead">Built for Those Who Dare to Fly. Wrist wraps, tape, grips, protection and fire gear chosen for aerial training.</p>
    <p><a class="btn btn-primary" href="${u("/collections/all/")}">Shop all gear</a> <a class="btn btn-ghost" href="${u("/collections/aerial-essentials/")}">Training kits</a></p>
  </div>
</section>
<div class="wrap">
<section><h2 class="sec-h">Shop by category</h2>
<ul class="cats">${show
    .map((c) => `<li><a href="${u(`/collections/${c.handle}/`)}">${c.image ? `<img src="${esc(img(c.image.url, 500))}" srcset="${esc(srcset(c.image.url, [300, 500, 800]))}" sizes="(max-width:600px) 50vw, 300px" alt="" width="500" height="500" loading="lazy">` : ""}<span>${esc(c.title)}</span></a></li>`)
    .join("")}</ul></section>
${kits.length ? `<section><h2 class="sec-h">Aerial Essentials kits <small>Save up to 35%</small></h2><ul class="grid">${kits.map((p) => card(p)).join("")}</ul></section>` : ""}
${best.length ? `<section><h2 class="sec-h">Training gear</h2><ul class="grid">${best.map((p) => card(p)).join("")}</ul><p class="center"><a class="btn btn-ghost" href="${u("/collections/all/")}">View all</a></p></section>` : ""}
${fire.length ? `<section class="fire"><h2 class="sec-h">Fire Mecca Partnership <small>American-made fire performance gear</small></h2><ul class="grid scroller">${fire.slice(0, 12).map((p) => card(p)).join("")}</ul><p class="center"><a class="btn btn-ghost" href="${u("/collections/fire-mecca-partnership/")}">Shop Fire Mecca</a></p></section>` : ""}
</div>`;
  const ld = [
    { "@context": "https://schema.org", "@type": "Organization", name: "Aerial Needs", url: SITE_URL + "/", logo: LOGO || undefined, email: cfg.email, sameAs: ["https://www.instagram.com/aerialneeds.store/"] },
    { "@context": "https://schema.org", "@type": "WebSite", name: "Aerial Needs", url: SITE_URL + "/", potentialAction: { "@type": "SearchAction", target: SITE_URL + "/search/?q={q}", "query-input": "required name=q" } },
  ];
  return { path: "/", html: layout({ title: cfg.homeTitle, description: cfg.homeDescription, canonical: abs("/"), body, ogImage: heroImg, jsonld: ld }) };
}

function simplePage({ path: p, title, heading, bodyHtml, description, noindex }) {
  const body = `<div class="wrap narrow"><h1>${esc(heading)}</h1><div class="rte">${bodyHtml}</div></div>`;
  return { path: p, html: layout({ title, description, canonical: abs(p), body, noindex }) };
}

function contactPage() {
  const body = `<div class="wrap narrow"><h1>Contact us</h1>
<p>Questions about sizing, orders, coach codes or studio partnerships? We answer in English and Spanish.</p>
<p><a class="btn btn-primary" href="mailto:${esc(cfg.email)}">Email ${esc(cfg.email)}</a></p>
<p>Instagram: <a href="https://www.instagram.com/aerialneeds.store/" rel="noopener">@aerialneeds.store</a></p>
<p class="muted">Track an order or manage your account on our <a href="${esc(FALLBACK)}/account">account page</a>.</p></div>`;
  return { path: "/pages/contact/", html: layout({ title: "Contact | Aerial Needs", description: "Contact Aerial Needs about orders, sizing, coach codes and studio partnerships.", canonical: abs("/pages/contact/"), body }) };
}

function searchPage() {
  const body = `<div class="wrap"><h1>Search</h1>
<form class="search-form" role="search"><label class="sr" for="q">Search products</label><input id="q" name="q" type="search" placeholder="Wrist wraps, tape, poi…" autocomplete="off"></form>
<p class="muted search-meta"></p><ul class="grid search-results"></ul></div>`;
  return { path: "/search/", html: layout({ title: "Search | Aerial Needs", description: "Search Aerial Needs products.", canonical: abs("/search/"), body, noindex: true }) };
}

function notFound() {
  // GitHub Pages serves this for any unknown path. Known Shopify-only paths (account, unlisted
  // products, old pages) are forwarded to the Shopify storefront so no link breaks.
  const body = `<div class="wrap narrow"><h1>Page not found</h1><p>Sorry, we couldn't find that page.</p>
<p><a class="btn btn-primary" href="${u("/collections/all/")}">Shop all gear</a></p></div>
<script>(function(){var b=${JSON.stringify(BASE)},p=location.pathname;if(b&&p.indexOf(b)===0)p=p.slice(b.length);
var fwd=/^\\/(account|cart|checkouts?|orders|tools|apps|policies|pages|products|collections|blogs|discount|services|a\\/)/;
if(fwd.test(p)&&!sessionStorage.getItem("an404"+p)){sessionStorage.setItem("an404"+p,1);location.replace(${JSON.stringify(FALLBACK)}+p+location.search+location.hash);}})();</script>`;
  return { path: "/404.html", file: true, html: layout({ title: "Page not found | Aerial Needs", description: "Page not found.", canonical: abs("/"), body, noindex: true }) };
}

// ---------- build ----------
const BUILD_ID = Date.now().toString(36);

async function main() {
  const fixIdx = process.argv.indexOf("--fixture");
  const data = fixIdx > -1 ? JSON.parse(fs.readFileSync(process.argv[fixIdx + 1])) : await fetchAll();
  const { shop } = data;
  LOGO = shop.brand?.logo?.image?.url || "";

  // Only list products that live in at least one collection; unlisted / direct-link products
  // (sellers portal, AN Gafas…) are left to the Shopify fallback and stay out of Google.
  const products = data.products.filter((p) => p.collections.nodes.length && !cfg.excludeProducts.includes(p.handle));
  const byHandle = Object.fromEntries(products.map((p) => [p.handle, p]));
  const cols = data.collections.map((c) => ({ ...c, _products: c.products.nodes.map((n) => byHandle[n.handle]).filter(Boolean) }));
  const colByHandle = Object.fromEntries(cols.map((c) => [c.handle, c]));
  // Keep the shop's nav order from config; skip empty collections.
  NAV = cfg.nav.filter((n) => !n.collection || colByHandle[n.collection]?._products.length).map((n) => ({ label: n.label, href: n.href || `/collections/${n.collection}/` }));
  POLICIES = ["refundPolicy", "shippingPolicy", "privacyPolicy", "termsOfService"].map((k) => shop[k]).filter((x) => x && x.body);
  const pages = data.pages.filter((p) => !cfg.excludePages.includes(p.handle));
  PAGE_LINKS = [...pages.filter((p) => p.handle !== "contact").map((p) => ({ label: p.title, href: `/pages/${p.handle}/` })), { label: "Contact", href: "/pages/contact/" }];

  const out = [];
  out.push(homePage(cols, colByHandle));
  for (const c of cols) if (c._products.length) out.push(collectionPage(c));
  for (const p of products) out.push(productPage(p, colByHandle));
  for (const pg of pages.filter((p) => p.handle !== "contact"))
    out.push(simplePage({ path: `/pages/${pg.handle}/`, title: pg.seo?.title || `${pg.title} | Aerial Needs`, heading: pg.title, bodyHtml: cleanHtml(pg.body), description: pg.seo?.description || clip(strip(pg.body), 155) }));
  out.push(contactPage());
  for (const pol of POLICIES)
    out.push(simplePage({ path: `/policies/${pol.handle}/`, title: `${pol.title} | Aerial Needs`, heading: pol.title, bodyHtml: pol.body, description: `${pol.title} for Aerial Needs.` }));
  out.push(searchPage());
  out.push(notFound());

  fs.rmSync(OUT, { recursive: true, force: true });
  for (const o of out) {
    const file = o.file ? path.join(OUT, o.path) : path.join(OUT, o.path, "index.html");
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, o.html);
  }
  fs.cpSync("assets", path.join(OUT, "assets"), { recursive: true });

  // Search index (small, loaded only on /search/)
  fs.writeFileSync(path.join(OUT, "assets", "search.json"), JSON.stringify(products.map((p) => ({
    h: p.handle, t: p.title, k: [p.productType, p.vendor, ...p.tags, ...p.collections.nodes.map((c) => colByHandle[c.handle]?.title || "")].join(" "),
    i: p.featuredImage?.url || "", p: money(p.priceRange.minVariantPrice), f: Number(p.priceRange.maxVariantPrice.amount) > Number(p.priceRange.minVariantPrice.amount),
  }))));

  // Sitemap + robots
  const indexable = out.filter((o) => !o.file && o.path !== "/search/");
  const lastmod = (o) => {
    const m = o.path.match(/^\/(products|collections|pages)\/([^/]+)\//);
    const src = m && (m[1] === "products" ? byHandle[m[2]] : m[1] === "collections" ? colByHandle[m[2]] : pages.find((p) => p.handle === m[2]));
    return (src?.updatedAt || new Date().toISOString()).slice(0, 10);
  };
  fs.writeFileSync(path.join(OUT, "sitemap.xml"), `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${indexable.map((o) => `<url><loc>${abs(o.path)}</loc><lastmod>${lastmod(o)}</lastmod></url>`).join("\n")}
</urlset>`);
  fs.writeFileSync(path.join(OUT, "robots.txt"), PREVIEW ? "User-agent: *\nDisallow: /\n" : `User-agent: *\nAllow: /\nDisallow: /search/\n\nSitemap: ${abs("/sitemap.xml")}\n`);
  if (!PREVIEW && cfg.customDomain) fs.writeFileSync(path.join(OUT, "CNAME"), cfg.customDomain + "\n");
  fs.writeFileSync(path.join(OUT, ".nojekyll"), "");
  console.log(`Built ${out.length} pages (${products.length} products, ${cols.filter((c) => c._products.length).length} collections) → dist/  preview=${PREVIEW} base="${BASE}"`);
}

main().catch((e) => { console.error(e); process.exit(1); });
