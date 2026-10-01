# turmbergsoftware.de

The website of Turmberg Software: plain HTML and CSS, no framework, no build step.
Every push to `main` is published to GitHub Pages by `.github/workflows/deploy.yml`.

## Structure

```
site/                    everything in here is published
  index.html             landing page
  impressum.html         legal notice (draft, see below)
  datenschutz.html       privacy policy (draft, see below)
  favicon.svg / .ico     logo mark; the SVG switches to light colors in dark mode
  apple-touch-icon.png
  assets/style.css       shared styles, brand colors as CSS variables
  assets/fonts/          DM Sans + Space Grotesk, self-hosted (SIL OFL 1.1)
.github/workflows/
  deploy.yml             uploads site/ and deploys it to GitHub Pages
```

The fonts are self-hosted on purpose. Loading them from Google's servers would
transfer visitors' IP addresses to Google, which is a GDPR problem for German sites.

All paths are relative, so the site works both at `turmbergsoftware.de` and at the
temporary `<user>.github.io/<repo>/` address.

## Preview locally

```sh
python3 -m http.server -d site 8000
```

Then open http://localhost:8000.

## One-time setup

1. **Repository → Settings → Pages → Build and deployment → Source:** select
   **GitHub Actions**. Then push to `main` (or run the workflow manually under
   Actions) and check that the site appears at the `github.io` address.
2. **Custom domain:** in the same Pages settings, enter `turmbergsoftware.de`.
   With an Actions deployment no `CNAME` file is needed.
3. **DNS** at your domain registrar: add the records from GitHub's guide
   "Managing a custom domain for your GitHub Pages site" (A/AAAA records for the
   apex domain, optionally a `www` CNAME). **Leave the MX and other mail records
   untouched**, otherwise the email accounts stop working.
4. **Verify the domain** in your GitHub account or organization settings (not the
   repository's): Pages → Add a domain. This prevents anyone else from claiming it
   on GitHub Pages.
5. Once the certificate has been issued, enable **Enforce HTTPS**.

## Before going live

Every placeholder is written in square brackets. List them with:

```sh
grep -rn '\[' site/*.html
```

- `[kontakt]@turmbergsoftware.de`: the real contact address (index, Impressum,
  Datenschutz).
- `impressum.html`: address, the representative's name, phone number. The register
  and VAT sections only apply if the company is actually registered. Otherwise
  remove them and drop "GmbH" from the name and the footers.
- `datenschutz.html`: address, the legal basis for the data transfer to GitHub
  (USA), and your email provider.

Both legal pages are templates, not legal advice. Have the final text checked.

## Changing things

- **Colors:** CSS variables at the top of `assets/style.css`.
- **Hero hill and tower:** see the comments at `.hero__card` and `.horizon` in
  `assets/style.css`. The hill's fill must equal the page background, and the
  card needs `overflow: hidden` and no bottom padding, or the seamless effect breaks.
- **Header and footer** are repeated in all three HTML files. Change all three.
