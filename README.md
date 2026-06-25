# ana.mn

Single-page site for **Ana Apango** — multimedia visual artist, photographer &
high-end retoucher (San Francisco / Bay Area).

Aesthetic: **Gen X Soft Club** — cool, restrained early-2000s editorial meets Y2K
liquid chrome and a transit-terminal machine voice. Concept: *"SOFT CLUB"*, the
page as Ana's membership dossier. Color comes only from her photographs.

## Stack
- Jekyll 4.4 (single landing page), no JS frameworks — ~3KB of vanilla JS.
- Self-hosted fonts: Archivo (variable wght + width), Space Grotesk, Space Mono,
  Instrument Serif.
- All imagery is Ana's own work (Behance + Instagram), optimized to webp + jpg.
- Content lives in `_data/profile.yml` (single source of truth).

## Develop
```bash
bundle install
bundle exec jekyll serve --livereload   # http://localhost:4000
```

## Deploy
GitHub Pages builds it natively — **no Actions/CI**. In the repo:
**Settings → Pages → Build and deployment → Source: Deploy from a branch →
`main` / root.** Pages runs Jekyll for us; the only plugins (jekyll-seo-tag,
jekyll-sitemap) are on the Pages allowlist. Custom domain `ana.mn` is set via
`CNAME`; point its DNS at GitHub Pages and enable *Enforce HTTPS*.
