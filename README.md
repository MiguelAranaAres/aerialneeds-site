# aerialneeds.com — static storefront

Fast, pre-rendered site for Aerial Needs. Product data, prices and stock come from Shopify
(Storefront API); the cart and checkout stay on Shopify, so payments, DSers and Collective keep working.

- `build.mjs` — generates every product, collection and page into `dist/` (same URLs as the old Shopify theme)
- `assets/cart.js` — cart drawer → Shopify checkout, US/CO/VE pricing, search
- `config.json` — shop domain, public Storefront token, menu, home title
- `.github/workflows/deploy.yml` — rebuilds on every push and every 4 hours; "Run workflow" for an instant refresh

Changing a product in Shopify? It shows up on the site at the next rebuild (≤4 h) or click **Actions → Build & deploy → Run workflow**.
