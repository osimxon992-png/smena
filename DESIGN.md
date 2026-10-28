---
name: Smena
description: Bir kunlik smenalar bozori, Chorsu karton narx yorliqlari dunyosida
colors:
  kraft: "#C99A5B"
  kraft-deep: "#A57638"
  kraft-dark: "#5E3F1C"
  kraft-light: "#E2C592"
  ink: "#18160F"
  ink-soft: "#3B3123"
  paper: "#F6F0E1"
  paper-shade: "#E8DDC4"
  paper-ink: "#5A4E3C"
  red: "#C2321A"
  red-deep: "#9E240F"
  teal: "#1F6F80"
  spent: "#B9B1A3"
  twine: "#4E3820"
typography:
  display:
    fontFamily: "Permanent Marker, Segoe Print, cursive"
    fontSize: "clamp(2.6rem, 5.2vw, 4.8rem)"
    fontWeight: 400
    lineHeight: 1
    letterSpacing: "-0.015em"
  headline:
    fontFamily: "Permanent Marker, Segoe Print, cursive"
    fontSize: "clamp(2.4rem, 5.4vw, 4.6rem)"
    fontWeight: 400
    lineHeight: 1.02
    letterSpacing: "-0.01em"
  price:
    fontFamily: "Permanent Marker, Segoe Print, cursive"
    fontSize: "1.9rem"
    fontWeight: 400
    lineHeight: 1.1
    letterSpacing: "normal"
  title:
    fontFamily: "Onest, Segoe UI, system-ui, sans-serif"
    fontSize: "1.6rem"
    fontWeight: 800
    lineHeight: 1.2
    letterSpacing: "normal"
  body:
    fontFamily: "Onest, Segoe UI, system-ui, sans-serif"
    fontSize: "1.0625rem"
    fontWeight: 400
    lineHeight: 1.6
    letterSpacing: "normal"
  label:
    fontFamily: "Onest, Segoe UI, system-ui, sans-serif"
    fontSize: "0.92rem"
    fontWeight: 600
    lineHeight: 1.35
    letterSpacing: "normal"
rounded:
  cut: "3px 7px 4px 6px / 6px 3px 7px 4px"
  stamp: "6px"
spacing:
  xs: "6px"
  sm: "12px"
  md: "22px"
  lg: "34px"
  gutter: "clamp(16px, 4vw, 56px)"
  section: "clamp(84px, 11vw, 160px)"
components:
  button-primary:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper}"
    typography: "{typography.label}"
    rounded: "{rounded.cut}"
    padding: "0 22px"
    height: "48px"
  button-sale:
    backgroundColor: "{colors.red}"
    textColor: "{colors.paper}"
    rounded: "{rounded.cut}"
    padding: "0 22px"
    height: "48px"
  button-sale-hover:
    backgroundColor: "{colors.red-deep}"
  button-line:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    rounded: "{rounded.cut}"
    padding: "0 22px"
    height: "48px"
  price-tag:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    padding: "34px 18px 16px"
    width: "clamp(210px, 16.4vw, 246px)"
  price-tag-spent:
    backgroundColor: "{colors.spent}"
    textColor: "{colors.ink-soft}"
  sign-rule:
    backgroundColor: "{colors.teal}"
    textColor: "{colors.paper}"
    padding: "clamp(22px, 2.6vw, 34px)"
  field:
    backgroundColor: "#FFFDF7"
    textColor: "{colors.ink}"
    rounded: "{rounded.cut}"
    padding: "10px 14px"
    height: "50px"
---

# Design System: Smena

## Overview

**Creative North Star: "Chorsu narx taxtasi"**

Smena sells one-day shifts the way Chorsu bazaar sells goods: the price is written large on a cardboard tag, hung on twine across the stall, nothing hidden. The whole landing is drenched in kraft cardboard; paper price tags, taped notes and painted signs sit on it. The app inherits the same materials with less theatre: a lighter kraft ground, shifts as paper tags laid flat, forms on taped paper sheets.

Information never hides behind the material. Pay, time, place and seats left are on every tag; the one rule (accepted and absent means blocked) is a teal sign that appears in the first viewport and again as its own section.

**Key Characteristics:**
- Kraft cardboard ground with fibre grain and noise, never a flat beige.
- Felt-marker display voice for headlines, prices and stamps; a sturdy grotesk for everything read.
- Red marker means money and only money.
- Depth comes from tape and soft drop shadows, not from cards floating on blur.
- Spent things (full or past shifts) turn into grey card.

## Colors

Drenched strategy: kraft owns the landing; paper, ink, teal and red are materials placed on it.

### Primary
- **Kraft** (`#C99A5B`): the ground of the landing. Lighter **Kraft Light** (`#E2C592`) is the app ground; **Kraft Deep** (`#A57638`) and **Kraft Dark** (`#5E3F1C`, footer) are the darker board.

### Secondary
- **Market Red** (`#C2321A`, hover `#9E240F`): pay amounts on paper tags, the primary landing action, the 15% commission line.
- **Dome Teal** (`#1F6F80`): rules and trust: the "Kelmagan bloklanadi" sign, shift times, accepted and done states.

### Neutral
- **Marker Ink** (`#18160F`) and **Ink Soft** (`#3B3123`): text, buttons, twine-adjacent marks.
- **Tag Paper** (`#F6F0E1`), **Paper Shade** (`#E8DDC4`), **Paper Ink** (`#5A4E3C`): tag and sheet surfaces and their secondary text.
- **Spent Card** (`#B9B1A3`): full or past shifts.
- **Twine** (`#4E3820`): the string tags hang from.

### Named Rules
**The Red Is Money Rule.** Red marks pay, the sale action and the commission. Red never sits directly on kraft as text: it fails contrast there and it stops meaning money.
**The Spent Card Rule.** Only open shifts get colour. A full or past shift becomes Spent Card with Ink Soft text and an outlined, disabled action.

## Typography

**Display Font:** Permanent Marker (with Segoe Print, cursive)
**Body Font:** Onest (with Segoe UI, system-ui)

**Character:** a bazaar seller's felt marker for anything shouted, and a plain modern grotesk for anything read.

### Hierarchy
- **Display** (400, clamp(2.6rem, 5.2vw, 4.8rem), 1): the hero headline, set in two lines with the second indented, rotated about -1.2deg.
- **Headline** (400, clamp(2.4rem, 5.4vw, 4.6rem), 1.02): section titles, max 16ch; the final call goes up to 6rem.
- **Price** (400, 1.9rem on hanging tags, 3rem on the story tag, 1.75rem in the app): pay in Market Red.
- **Title** (Onest 800, 1.6rem / 1.12rem in app cards): step titles, tag roles, ticket titles.
- **Body** (Onest 400, 1.0625rem, 1.6): paragraphs; lead text 1.2rem, max 52ch.
- **Label** (Onest 600, 0.92rem): times (tabular figures, teal), seats left, form labels.

### Named Rules
**The One Marker Rule.** Permanent Marker is for headlines, prices, stamps and sign titles only. Buttons, body, form text and numbers in tables use Onest.
**The Tabular Rule.** Every time, seat count and amount uses tabular figures.

## Layout

The landing paces a bazaar walk: the stall (first viewport, full-height board with tags on twine), the row of stalls (shift types slide sideways while the page scrolls on desktop, a horizontal snap strip on phones), one tag's journey (a sticky tag gaining stamps while the steps scroll), the rules board, the business receipt, install signs, questions, a closing call and a dark board footer with a giant kraft wordmark.

- Content width: max 1360px on the landing, 1120px in the app; gutters `clamp(16px, 4vw, 56px)`.
- Section rhythm: `clamp(84px, 11vw, 160px)` top and bottom.
- Breakpoints: 760px (nav collapses), 900px (two-column story, rules, business, install; pinned row scroll), 960px (hero note beside the headline), 1200px (tags hang from the curved twine; below that they sit in a scroll-snap strip).
- Grids use `minmax(0, 1fr)` tracks so long marker numbers never widen a phone layout.

## Elevation & Depth

Things are taped or hung, not floated.

### Shadow Vocabulary
- **Hang** (`drop-shadow(0 16px 16px rgba(50, 28, 6, .4))`): tags on twine; applied on the wrapper because the tag shape is a clip-path.
- **Pinned sheet** (`0 18px 30px -20px rgba(50, 28, 6, .55)`): notes, sheets, signs, forms.
- **Stack** (`drop-shadow(0 14px 14px rgba(50, 28, 6, .32))`): the app's ticket grid.

### Named Rules
**The Taped Not Floated Rule.** Raised paper gets a soft, offset, warm shadow and often two strips of translucent tape. No zero-blur offset blocks, no glass.

## Shapes

- **Price tag:** six-point clip-path with cut top corners and a punched hole; hanging tags hang from a 2px twine string.
- **Flat ticket (app):** clip-path with cut left corners, a punched hole on the left, a dashed tear line between time and details.
- **Hand-cut corners:** buttons and fields use the uneven `cut` radius, never a uniform pill.
- **Receipt:** zigzag bottom edge drawn with a conic-gradient mask.
- **Tilt:** papers sit at -1.5 to 1.5deg; working controls inside them stay square to the reader.

## Components

### Buttons
- **Primary** (`button-primary`): ink with paper text, hand-cut corners, 48px (56px large). Hover tilts -1deg and lifts 1px.
- **Sale** (`button-sale`): Market Red; the single most important landing action.
- **Line** (`button-line`): transparent with a 3px ink inset ring; secondary actions.
- **Danger** (app): transparent, red text and ring, for "Kelmadi".

### Chips
Rubber-stamp states: 2px ring in the state colour, 5px corners, rotated -2deg. Pending ink soft, accepted teal ring, done solid teal, rejected and no-show red ring.

### Cards / Containers
Containers are paper: price tags, flat tickets, taped notes, ruled sheets, the receipt, FAQ strips. There are no generic rounded cards.

### Inputs / Fields
Near-white paper fields with a 2px ink border and hand-cut corners, 50px tall; focus draws a 3px teal outline. Forms sit on a paper sheet. Role choice is two ink-ringed tiles; the chosen one fills ink.

### Navigation
Landing: marker wordmark, Onest 600 section links, "Kirish" text link and an ink "Ro‘yxatdan o‘tish" button. App: the current page link sits on a paper chip with a soft shadow.

### Price Tag (signature)
Role, red marker pay, place, teal time, seats left and a full-width ink action. On the landing the tags hang from twine and swing with scroll velocity; live shifts replace the examples, and examples left in place carry a small "Namuna" stamp.

## Do's and Don'ts

### Do:
- **Do** show pay, time, place and seats on every shift.
- **Do** label example content "Namuna" wherever a visitor could take it for a real shift.
- **Do** keep one authored motion per idea: tags swing on scroll, headings are written in with a marker wipe, stamps hit when a step arrives.
- **Do** respect reduced motion: no swing, no wipe, no pinned row scroll.

### Don't:
- **Don't** use purple anywhere.
- **Don't** put red text on kraft, or use red for anything other than money and the sale action.
- **Don't** add kickers or eyebrow labels above headings.
- **Don't** set body copy, buttons or form text in the marker face.
- **Don't** float containers on blur or glass, or use hard offset block shadows.
- **Don't** invent statistics, partners, reviews or press; there are none yet.
