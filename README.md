# GAME_OVER — GitHub Pages storefront

This directory is the complete public static website. Publish its **contents** at the root of a public GitHub repository (suggested: `substr8games/game-over`). GitHub Pages should publish from `main` / `/(root)` with custom domain `gameover.philabsresearch.io`.

## Public/private boundary

The public site is an exhibition and product catalog. It contains no payment flow or checkout implementation. Its `fulfillment-origin` setting is `disabled`; ordering is unavailable. Keep the private GRIFT publisher and the fulfillment Worker outside this repository. Do not publish payment credentials, Worker source, test checkout code, or private configuration here.

## Placeholders and first publication

The starter `catalog.json` contains 30 works marked `"placeholder": true`. They are shown only until the first real item is published. As soon as any work without that marker appears, all placeholder works and their now-empty collection rows are hidden by `store.js`.

Run GRIFT separately. Use `+ Artwork` to create the first real listing, or promote a starter work to retain it. GRIFT removes all starter placeholders from its exported catalog. Export the GRIFT package, extract `grift-catalog.tar`, replace this repository's `catalog.json`, and copy the exported artwork files from `assets/` into this repository's `assets/`. Keep `assets/banner.png` and the storefront's existing HTML, JavaScript, and CSS. Commit the changes to `main`; GitHub Pages republishes automatically.

The storefront displays the catalog fields managed by GRIFT: front, back, and detail artwork; editorial lore; product specifications; spoiler text; related artwork; listing type; fictional/sold-out status; and curatorial telemetry. Garment options can be previewed through a separately configured API, but this release does not provide checkout.

Placeholder image files can be removed separately after the catalog is replaced; they cannot reappear unless their catalog records are reintroduced.
