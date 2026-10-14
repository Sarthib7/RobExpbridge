# exbridge brand

VERIFIED source: `pitch/ExperienceBridge-pitch.html` contains the final brand variables and the `exbridge` wordmark.
VERIFIED source: `pitch/assets/experiencebridge-mark.svg` contains the crossing navy and green mark.
The web interface follows these existing sources at the user's request.

## Correction

The previous version of this document described an independently selected navy console palette and bridge mark.
That direction did not match the supplied pitch deck. The interface now uses the deck's final palette, mark and wordmark.
Previous contrast measurements applied to the old palette. They do not attest the revised interface.

## Palette

VERIFIED Noesora tokens from /Volumes/Sarthi MAC/Noesora/noesora-landing/src/home.css:

| Use | Value | Source |
| --- | --- | --- |
| Canvas | #080b0d | /Volumes/Sarthi MAC/Noesora/noesora-landing/src/home.css:3, "--canvas: #080b0d;" |
| Surface | #12171b | /Volumes/Sarthi MAC/Noesora/noesora-landing/src/home.css:4, "--surface: #12171b;" |
| Raised surface | #1b2227 | /Volumes/Sarthi MAC/Noesora/noesora-landing/src/home.css:5, "--surface-raised: #1b2227;" |
| Divider | #293036 | /Volumes/Sarthi MAC/Noesora/noesora-landing/src/home.css:6, "--hairline: #293036;" |
| Strong divider | #465159 | /Volumes/Sarthi MAC/Noesora/noesora-landing/src/home.css:7, "--hairline-strong: #465159;" |
| Primary text | #f2f4f3 | /Volumes/Sarthi MAC/Noesora/noesora-landing/src/home.css:8, "--ink: #f2f4f3;" |
| Secondary text | #a6b0b3 | /Volumes/Sarthi MAC/Noesora/noesora-landing/src/home.css:9, "--muted: #a6b0b3;" |
| Accent | #6f92ff | /Volumes/Sarthi MAC/Noesora/noesora-landing/src/home.css:11, "--accent: #6f92ff;" |
| Soft accent | #c7d4ff | /Volumes/Sarthi MAC/Noesora/noesora-landing/src/home.css:12, "--accent-soft: #c7d4ff;" |
| Paper | #f3f5f4 | /Volumes/Sarthi MAC/Noesora/noesora-landing/src/home.css:13, "--paper: #f3f5f4;" |

## Typography and layout

VERIFIED source: /Volumes/Sarthi MAC/Noesora/noesora-landing/src/home.css:16 declares --font-display: "Iowan Old Style", "Palatino Linotype", "Book Antiqua", Georgia, serif;.
VERIFIED source: /Volumes/Sarthi MAC/Noesora/noesora-landing/src/home.css:17 declares --font-body: "Avenir Next", Avenir, "Segoe UI", system-ui, sans-serif;.
VERIFIED source: /Volumes/Sarthi MAC/Noesora/noesora-landing/src/home.css:18 declares --font-mono: "SFMono-Regular", Consolas, "Liberation Mono", monospace;.
VERIFIED source: public/styles.css:3 declares font-family: var(--font-body);. public/styles.css:54 declares h1, h2, h3 { font-family: var(--font-display); }. public/styles.css:55-58 applies font-family: var(--font-mono); to navigation and labels.

VERIFIED source: public/styles.css:65-67 defines visible focus rings for buttons, links, and selects. Lines 128, 148, 150, 162, 169, and 170 wrap long content. Lines 217-221 gate scroll behavior and transitions on the user's motion preference.

## Evidence and network labels

VERIFIED source: `public/app.js` distinguishes `public-demo`, `local`, `agung` and `solana-devnet` modes.
The public preview runs the synthetic example without a signing wallet or a payment.
Local and devnet modes retain the payment workflow. A transaction must pass backend verification before advisory access.
The interface states that peaqOS machine identity is not integrated. Demo machine identities remain synthetic.
No visual treatment implies physical robot safety, a live payment, or a hardware attestation without supporting evidence.
