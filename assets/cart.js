// Aerial Needs storefront script: variant picker, Shopify cart (Storefront API),
// country pricing (US / CO / VE) and search. No dependencies.
(function () {
  "use strict";
  var AN = window.AN;
  var API = "https://" + AN.shop + "/api/" + AN.api + "/graphql.json";
  var CART_KEY = "an_cart", COUNTRY_KEY = "an_country";
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var store = {
    get: function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set: function (k, v) { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch (e) {} }
  };
  var TX = AN.t, ROOT = AN.base + AN.prefix;
  var LANG = " @inContext(language: " + AN.lang.toUpperCase() + ")";
  var country = store.get(COUNTRY_KEY) || (AN.lang === "es" ? "CO" : "US");

  function gql(query, variables) {
    return fetch(API, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Shopify-Storefront-Access-Token": AN.token },
      body: JSON.stringify({ query: query, variables: variables || {} })
    }).then(function (r) { return r.json(); }).then(function (j) {
      if (j.errors) throw new Error(j.errors[0].message);
      return j.data;
    });
  }
  function money(m) {
    if (!m) return "";
    var n = Number(m.amount);
    if (m.currencyCode === "USD") return "$" + n.toFixed(2);
    return "$" + n.toLocaleString("es-CO", { maximumFractionDigits: 0 }) + " " + m.currencyCode;
  }
  function img(url, w) { return url ? url + (url.indexOf("?") > -1 ? "&" : "?") + "width=" + w : ""; }
  function esc(s) { var d = document.createElement("div"); d.textContent = s == null ? "" : s; return d.innerHTML; }
  function toast(msg) {
    var t = document.createElement("div"); t.className = "toast"; t.textContent = msg; document.body.appendChild(t);
    setTimeout(function () { t.remove(); }, 2600);
  }

  // ---------------- cart ----------------
  var CART_FIELDS = "id checkoutUrl totalQuantity cost { subtotalAmount { amount currencyCode } } " +
    "lines(first: 100) { nodes { id quantity cost { totalAmount { amount currencyCode } } merchandise { ... on ProductVariant { id title image { url } product { title handle } } } } }";
  var cart = null;
  var drawer = $(".cart-drawer"), backdrop = $(".cart-backdrop");

  function openCart() { drawer.classList.add("open"); drawer.setAttribute("aria-hidden", "false"); backdrop.hidden = false; }
  function closeCart() { drawer.classList.remove("open"); drawer.setAttribute("aria-hidden", "true"); backdrop.hidden = true; }
  $$(".cart-toggle").forEach(function (b) { b.addEventListener("click", openCart); });
  $(".cart-close").addEventListener("click", closeCart);
  backdrop.addEventListener("click", closeCart);
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") closeCart(); });

  function render() {
    var count = $(".cart-count"), lines = $(".cart-lines"), co = $(".cart-checkout");
    var n = cart ? cart.totalQuantity : 0;
    count.hidden = !n; count.textContent = n;
    if (!cart || !cart.lines.nodes.length) {
      lines.innerHTML = '<p class="muted">' + esc(TX.empty) + '</p>';
      $(".cart-total").textContent = money({ amount: 0, currencyCode: country === "CO" ? "COP" : "USD" });
      co.setAttribute("aria-disabled", "true"); co.href = "#"; return;
    }
    lines.innerHTML = cart.lines.nodes.map(function (l) {
      var m = l.merchandise, vt = m.title === "Default Title" ? "" : m.title;
      return '<div class="line" data-line="' + esc(l.id) + '">' +
        '<a href="' + ROOT + "/products/" + esc(m.product.handle) + '/"><img src="' + esc(img(m.image && m.image.url, 140)) + '" alt="" width="70" height="70"></a>' +
        "<div><p class=\"lt\">" + esc(m.product.title) + "</p>" + (vt ? '<p class="lv">' + esc(vt) + "</p>" : "") +
        '<div class="qty"><button type="button" data-d="-1" aria-label="' + esc(TX.dec) + '">−</button><input type="number" min="0" value="' + l.quantity + '" aria-label="' + esc(TX.qty) + '"><button type="button" data-d="1" aria-label="' + esc(TX.inc) + '">+</button></div>' +
        '<button type="button" class="rm">' + esc(TX.remove) + '</button></div>' +
        "<strong>" + money(l.cost.totalAmount) + "</strong></div>";
    }).join("");
    $(".cart-total").textContent = money(cart.cost.subtotalAmount);
    co.href = cart.checkoutUrl + (AN.lang === "es" ? (cart.checkoutUrl.indexOf("?") > -1 ? "&" : "?") + "locale=es" : ""); co.setAttribute("aria-disabled", "false");
  }

  function setCart(c) { cart = c; store.set(CART_KEY, c ? c.id : null); render(); }
  function busy(on) { drawer.classList.toggle("cart-busy", on); }

  function loadCart() {
    var id = store.get(CART_KEY);
    if (!id) return render();
    gql("query($id:ID!)" + LANG + "{ cart(id:$id){ " + CART_FIELDS + " } }", { id: id })
      .then(function (d) { setCart(d.cart); })
      .catch(function () { setCart(null); });
  }

  function addToCart(variantId, qty) {
    var line = { merchandiseId: variantId, quantity: qty };
    var p = cart
      ? gql("mutation($id:ID!,$l:[CartLineInput!]!)" + LANG + "{ cartLinesAdd(cartId:$id, lines:$l){ cart{ " + CART_FIELDS + " } userErrors{ message } } }", { id: cart.id, l: [line] })
          .then(function (d) { return d.cartLinesAdd; })
      : gql("mutation($i:CartInput!)" + LANG + "{ cartCreate(input:$i){ cart{ " + CART_FIELDS + " } userErrors{ message } } }", { i: { lines: [line], buyerIdentity: { countryCode: country } } })
          .then(function (d) { return d.cartCreate; });
    return p.then(function (r) {
      if (r.userErrors && r.userErrors.length) throw new Error(r.userErrors[0].message);
      setCart(r.cart);
    });
  }

  function updateLine(lineId, qty) {
    busy(true);
    gql("mutation($id:ID!,$l:[CartLineUpdateInput!]!)" + LANG + "{ cartLinesUpdate(cartId:$id, lines:$l){ cart{ " + CART_FIELDS + " } userErrors{ message } } }",
      { id: cart.id, l: [{ id: lineId, quantity: qty }] })
      .then(function (d) { setCart(d.cartLinesUpdate.cart); })
      .catch(function (e) { toast(e.message); })
      .then(function () { busy(false); });
  }

  $(".cart-lines").addEventListener("click", function (e) {
    var line = e.target.closest(".line"); if (!line) return;
    var input = $("input", line), id = line.getAttribute("data-line");
    if (e.target.matches("[data-d]")) updateLine(id, Math.max(0, Number(input.value) + Number(e.target.getAttribute("data-d"))));
    if (e.target.matches(".rm")) updateLine(id, 0);
  });
  $(".cart-lines").addEventListener("change", function (e) {
    var line = e.target.closest(".line"); if (line && e.target.matches("input")) updateLine(line.getAttribute("data-line"), Math.max(0, Number(e.target.value) || 0));
  });

  // ---------------- product page ----------------
  var form = $("form.buy");
  var variants = form ? JSON.parse($(".variants").textContent) : [];
  var pdpPrices = null; // country prices keyed by variant id

  function currentVariant() {
    var sel = {};
    $$(".opt", form).forEach(function (fs) { var c = $("input:checked", fs); if (c) sel[c.name] = c.value; });
    return variants.filter(function (v) {
      return Object.keys(sel).every(function (k) { return v.o[k] === sel[k]; });
    })[0];
  }
  function syncVariant() {
    var v = currentVariant(), btn = $(".add", form);
    $$(".opt", form).forEach(function (fs) {
      var c = $("input:checked", fs); $(".opt-val", fs).textContent = c ? c.value : "";
      // grey out values with no available variant given the other selections
      $$("input", fs).forEach(function (inp) {
        var ok = variants.some(function (x) {
          if (x.o[inp.name] !== inp.value || !x.a) return false;
          return $$(".opt", form).every(function (o2) {
            var c2 = $("input:checked", o2); return !c2 || c2.name === inp.name || x.o[c2.name] === c2.value;
          });
        });
        inp.nextElementSibling.classList.toggle("na", !ok);
      });
    });
    if (!v) { btn.disabled = true; btn.textContent = TX.unavailable; return; }
    form.variant.value = v.id;
    btn.disabled = !v.a; btn.textContent = v.a ? TX.addToCart : TX.soldOut;
    var price = (pdpPrices && pdpPrices[v.id]) || v.p;
    var cmp = country === "US" && v.c ? '<s class="was">' + money(v.c) + "</s> " : "";
    $(".pdp-price").innerHTML = cmp + "<span>" + money(price) + "</span>";
    if (v.i) {
      var g = $(".gallery"), idx = $$(".gallery img").findIndex(function (im) { return im.src.split("?")[0] === v.i.split("?")[0]; });
      if (idx > -1) g.scrollTo({ left: g.clientWidth * idx, behavior: "smooth" });
    }
  }
  if (form) {
    form.addEventListener("change", syncVariant);
    $$("[data-q]", form).forEach(function (b) {
      b.addEventListener("click", function () { form.qty.value = Math.max(1, Number(form.qty.value) + Number(b.getAttribute("data-q"))); });
    });
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var btn = $(".add", form), label = btn.textContent;
      btn.disabled = true; btn.textContent = TX.adding;
      addToCart(form.variant.value, Math.max(1, Number(form.qty.value) || 1))
        .then(function () { openCart(); })
        .catch(function (err) { toast(err.message || "Could not add to cart"); })
        .then(function () { btn.disabled = false; btn.textContent = label; });
    });
    var g = $(".gallery");
    $$(".thumbs button").forEach(function (b, i) {
      b.addEventListener("click", function () { g.scrollTo({ left: g.clientWidth * i, behavior: "smooth" }); });
    });
    g.addEventListener("scroll", function () {
      var i = Math.round(g.scrollLeft / g.clientWidth);
      $$(".thumbs button").forEach(function (b, j) { b.classList.toggle("on", i === j); });
    }, { passive: true });
    var t0 = $(".thumbs button"); if (t0) t0.classList.add("on");
    syncVariant();
    // sticky buy bar on phones: mirrors the main button once it scrolls out of view
    var sb = $(".sticky-buy");
    if (sb) {
      var main = $(".add", form), sbBtn = $(".btn", sb), sbPrice = $(".sb-price", sb);
      var mirror = function () { sbBtn.textContent = main.textContent; sbBtn.disabled = main.disabled; sbPrice.textContent = $(".pdp-price").textContent; };
      mirror();
      new MutationObserver(mirror).observe($(".pdp-info"), { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ["disabled"] });
      var place = function () { sb.hidden = main.getBoundingClientRect().bottom > 0; };
      window.addEventListener("scroll", place, { passive: true }); place();
    }
  }

  // ---------------- collection sort ----------------
  var sortSel = $("#sort"), grid = $(".sortable");
  if (sortSel && grid) {
    var orig = Array.prototype.slice.call(grid.children);
    sortSel.addEventListener("change", function () {
      var m = sortSel.value, items = orig.slice();
      var price = function (el) { return Number(el.getAttribute("data-price")); };
      if (m === "1") items.sort(function (a, b) { return price(a) - price(b); });
      if (m === "2") items.sort(function (a, b) { return price(b) - price(a); });
      if (m === "3") items.sort(function (a, b) { return a.getAttribute("data-title").localeCompare(b.getAttribute("data-title")); });
      items.forEach(function (el) { grid.appendChild(el); });
    });
  }

  // ---------------- country pricing ----------------
  function applyCountryPrices() {
    if (country === "US") return;
    var els = $$("[data-price-pid]");
    var ids = els.map(function (e) { return e.getAttribute("data-price-pid"); }).filter(function (v, i, a) { return a.indexOf(v) === i; });
    if (!ids.length) return;
    gql("query($ids:[ID!]!,$c:CountryCode) @inContext(country:$c){ nodes(ids:$ids){ ... on Product { id priceRange{ minVariantPrice{ amount currencyCode } } variants(first:100){ nodes{ id price{ amount currencyCode } } } } } }", { ids: ids, c: country })
      .then(function (d) {
        var map = {};
        d.nodes.forEach(function (p) { if (p) map[p.id] = p; });
        els.forEach(function (e) {
          var p = map[e.getAttribute("data-price-pid")]; if (!p) return;
          e.textContent = (e.getAttribute("data-from") === "1" ? TX.from : "") + money(p.priceRange.minVariantPrice);
          var s = e.previousElementSibling; if (s && s.classList.contains("was")) s.remove();
          if (form && form.getAttribute("data-product") === p.id) {
            pdpPrices = {}; p.variants.nodes.forEach(function (v) { pdpPrices[v.id] = v.price; }); syncVariant();
          }
        });
      }).catch(function () {});
  }
  var sel = $("#country");
  if (sel) {
    sel.value = country;
    sel.addEventListener("change", function () {
      country = sel.value; store.set(COUNTRY_KEY, country);
      var done = function () { location.reload(); };
      if (cart) {
        gql("mutation($id:ID!,$b:CartBuyerIdentityInput!){ cartBuyerIdentityUpdate(cartId:$id, buyerIdentity:$b){ cart{ id } } }", { id: cart.id, b: { countryCode: country } })
          .then(done, done);
      } else done();
    });
  }

  // ---------------- search ----------------
  var sForm = $(".search-form");
  if (sForm) {
    var q = $("#q"), out = $(".search-results"), meta = $(".search-meta"), index = null;
    var norm = function (s) { return (s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, ""); };
    var run = function () {
      var term = norm(q.value.trim());
      history.replaceState(null, "", term ? "?q=" + encodeURIComponent(q.value.trim()) : location.pathname);
      if (!term) { out.innerHTML = ""; meta.textContent = ""; return; }
      var words = term.split(/\s+/);
      var hits = index.filter(function (p) { var hay = norm(p.t + " " + p.k); return words.every(function (w) { return hay.indexOf(w) > -1; }); });
      meta.textContent = hits.length + " " + (hits.length === 1 ? TX.results : TX.resultsPl);
      out.innerHTML = hits.map(function (p) {
        return '<li class="card"><a href="' + ROOT + "/products/" + esc(p.h) + '/"><div class="card-img"><img src="' + esc(img(p.i, 500)) + '" alt="" loading="lazy" width="500" height="500"></div>' +
          '<p class="card-title">' + esc(p.t) + '</p><p class="card-price">' + (p.f ? TX.from : "") + esc(p.p) + "</p></a></li>";
      }).join("");
    };
    fetch(AN.base + "/assets/search-" + AN.lang + ".json").then(function (r) { return r.json(); }).then(function (d) {
      index = d; q.value = new URLSearchParams(location.search).get("q") || ""; run();
    });
    q.addEventListener("input", function () { if (index) run(); });
    sForm.addEventListener("submit", function (e) { e.preventDefault(); });
  }

  loadCart();
  applyCountryPrices();
})();
