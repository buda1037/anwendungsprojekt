# turmbergsoftware.de

The website of Turmberg Software: plain HTML and CSS plus two small scripts, one for
the view behind the hero text and one for the paper plane that turns up after 55 seconds.
No framework, no dependencies, no images or video, no build step.
Every push to `main` is published to GitHub Pages by `.github/workflows/deploy.yml`.

Turmberg Software does not exist. The company is made up for a role-play in a study
project, and the site is a prop for it: the awards are invented, the enquiry form
sends nothing, and the navigation, the buttons and the legal links lead nowhere. The
footer of every page says so, first as a news ticker that runs once, then as a short
notice that stays. Keep that notice for as long as the site is online.

## Structure

```
site/                    everything in here is published
  index.html             landing page
  impressum.html         legal notice (draft, see below)
  datenschutz.html       privacy policy (draft, see below)
  favicon.svg / .ico     logo mark; the SVG switches to light colors in dark mode
  apple-touch-icon.png
  assets/style.css       shared styles, brand colors as CSS variables
  assets/aussicht.js     the view from the Turmberg behind the hero text
  assets/flieger.js      the paper plane on the landing page
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

- `[kontakt]@turmbergsoftware.de`: the real contact address (Impressum and
  Datenschutz).
- `impressum.html`: address, the representative's name, phone number. The register
  and VAT sections only apply if the company is actually registered. Otherwise
  remove them and drop "GmbH" from the name and the footers.
- `datenschutz.html`: address, the legal basis for the data transfer to GitHub
  (USA), and your email provider.

Both legal pages are templates, not legal advice. Have the final text checked.
Neither page is linked at the moment: the two entries in the footer have no target.
The note in each footer says how to bring the links back.

## Changing things

- **Colors:** CSS variables at the top of `assets/style.css`.
- **Hero hill and tower:** see the comments at `.hero__card` and `.horizon` in
  `assets/style.css`. The hill's fill must equal the page background, and the
  card needs `overflow: hidden` and no bottom padding, or the seamless effect breaks.
  The hero text is white, so whatever is behind it has to stay dark.
- **Page width:** `--breite` at the top of `assets/style.css`. It is `none` (full
  window); set a length to cap and center the page.
- **The view:** `assets/aussicht.js` paints sky, clouds, hills, the plain with its
  towns and the foliage in the corners on small canvases that `.aussicht` in the
  stylesheet scales up and blurs. Clouds, fields and towns are generated from noise
  and laid out in perspective, lights are drawn as lens bokeh, and `.aussicht__korn`
  adds film grain; together that is what makes it read as out-of-focus footage. The
  view shows one fixed moment, 18:52 on an early October evening, set as `MOMENT` at
  the top of the script; set it to `null` and the light follows the real position of
  the sun over the Turmberg. To see another time of day, add `?time=HH:MM` to the
  address, e.g. `http://localhost:8000/?time=19:35`.
  The colors per sun elevation are in `SKIES` at the top of the script; blur and
  grain strength are `filter: blur()` at `.aussicht` and `opacity` at
  `.aussicht__korn`.
- **Paper plane:** `assets/flieger.js`. One plane glides in after a visitor has
  spent 55 seconds on the landing page. Thrown off screen, it is gone for good.
  How many planes there are (one `homes` entry each), where they circle, how big
  and how fast they are is in `LAYOUTS` at the top; the delay (`FIRST_DELAY`) and
  the throw limits are the constants right below. To see the plane without
  waiting, add `?plane=3` to the address (seconds). Visitors with reduced motion
  enabled get no plane.
- **Side margin:** `--innen` at the top of `assets/style.css` is how far everything
  stands in from the left and right edges of the window.
- **Awards and enquiry form:** the "Hero" sections of `assets/style.css`. The form
  floats over the view on the right (`.glas-platz` sets where); the awards show
  above it only in windows of at least 1280 by 800 pixels.
- **The notice in the footer:** `.hinweis` in `assets/style.css`. The ticker's delay
  and duration are in the `animation` of `.hinweis__lauf`; the short notice that
  follows it (`.hinweis__fest`) waits for the sum of the two.
- **Header and footer** are repeated in all three HTML files. Change all three.
