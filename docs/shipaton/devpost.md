# Devpost submission: Rootera (Next Gen Award)

The texts below go into the Devpost form, in English. The notes in Portuguese say where each one goes.

---

## Project name
Rootera

## Tagline *(uma frase)*
Your plant changes. Rootera learns the pattern: soil checks in three layers, local weather, and three cycles to learn each plant.

## Thumbnail *(3:2)*
`docs/shipaton/thumbnail-3x2.png`

## App icon *(1024 × 1024)*
`assets/icon.png`

## Screenshots *(1179 × 2556, sem moldura)*
`docs/shipaton/screenshots/01-today.png` … `07-rootera-plus.png`

---

## About the project *(Project Story)*

### Inspiration
Every university extension guide gives houseplant owners the same rule: water when the soil is dry, not on a schedule. I kept failing at it anyway. "Check the soil" doesn't say how deep, what to do when the top is dry and the bottom is soaked, or how long *my* plant, in *my* pot, in *this* weather, takes to dry. Most apps answer with a calendar, which is the one thing the guides tell you not to follow. I wanted an app that follows the rule and learns the answer for each plant.

### What it does
- **Three-layer soil check.** Surface (fingertip), middle (about 5 cm) and bottom (a wooden skewer or the drainage hole).
  - Each layer is dry, moist or wet; the bottom can also be "couldn't reach".
  - Each of the 16 species decides at its own depth: a peace lily at the surface, a monstera in the middle, a succulent only when the whole pot is dry.
  - The layers catch what one reading can't: *dry on top, wet at the bottom* means wait. *Still dry at the bottom after a watering* means the water never reached the roots.
- **A drying window that learns.** A cycle goes from a watering to the first dry check.
  - It starts from a species estimate adjusted for the pot, and says "still analyzing your plant".
  - It gets specific from the second cycle.
  - From the third cycle, the window is the plant's own pattern.
- **Local weather.** Open-Meteo's evapotranspiration for your approximate area (rounded to about 10 km) nudges the window, by at most 0.8× to 1.25×. The learned cycles are compared with the weather they actually had, so the weather is never counted twice.
- **Every suggestion shows its source:** what you observed, what you told the app, species notes, or the weather. There are no invented moisture percentages.
- **Photo identification** (Pl@ntNet) with three tries before the app asks for the name. You always confirm the species.
- **A Shipaton lab for judges.** It opens with a short animated story, where the watering can turns into a rain cloud and then the sun. After that, a virtual plant runs for up to 91 days in real recorded climates, so you can watch Rootera learn in seconds. Tap a day to water it or to record the soil.

### How we built it
- **Stack.** Expo SDK 57 (React Native 0.86, TypeScript) with Reanimated 4 and react-native-svg for every animation. FastAPI + SQLAlchemy on the backend (SQLite locally, PostgreSQL in production).
- **Why rules, not a black box.** The "Plant Twin" is a deterministic, explainable set of rules: the inputs are few and structured, and every suggestion has to say where it came from.
- **Calibration.** The rules are calibrated against SDSU, UConn, Clemson, Virginia Tech and Colorado State extension guidance.
- **Validation.** 16 species, 3 climates from real Open-Meteo history, 91 days each, with a simulated caregiver following the app:
  - all 48 runs stay inside the ranges the sources give;
  - the learned drying time is on average 0.52 days from the real one;
  - there are no soggy or thirsty days.
- **Testing and accessibility.**
  - The backend has 210 tests, including hard cases from a review: future dates, reused ids, plant-limit bypasses and randomized histories.
  - The app is fully in English and Portuguese, respects Reduce Motion, and has large-text layouts.

### How RevenueCat is used *(Monetization)*
- **Plans.** Free keeps three plants. **Rootera+** removes the limit and adds rooms and a dated growth diary. It is sold as monthly, yearly or lifetime, all unlocking the `rootera` entitlement through the current offering.
- **Purchase screens.**
  - The paywall is built with **RevenueCat Paywalls** and shown with `presentPaywallIfNeeded` for the `rootera` entitlement.
  - Subscribers manage their plan in the **Customer Center**.
  - Restores work, and a customer-info listener picks up renewals and expirations.
- **The server decides who is Rootera+.** After every purchase or restore, the app asks the backend, which checks RevenueCat's REST API with the secret key. An optional webhook keeps it in sync. The app never unlocks anything on its own.
- **Where the native UI can't run** (Expo Go, the web preview), the app shows its own plan picker over the same packages. Without keys, it shows a clearly labelled preview that charges nothing.

### Challenges
- **Learning without faking data.** A "dry" report must never become a number, and a check that says "not sure" must not leave an older "dry" looking current. The whole twin now comes from one set of rules, so no two parts can disagree.
- **Weather without double counting.** Learned cycles already carry the weather they had.
- **Animation that works everywhere.** Every animation uses transforms and opacity, and pivots are computed by hand, because `transformOrigin` behaved differently on the iPhone.

### What's next
Per-user accounts, then publishing on the App Store and Google Play, then photo backup for the growth diary.

---

## Built with *(tags)*
revenuecat, react-native, expo, typescript, reanimated, react-native-svg, fastapi, python, sqlalchemy, sqlite, open-meteo, plantnet

## Links
- **Code repository (public, MIT):** https://github.com/SEU-USUARIO/rootera *(troque pelo link real)*
- **Demo video (YouTube or Vimeo, public):** *(cole o link)*

## Next Gen Award *(categoria)*
- **Student.** Active student, entering with an academic email. *(Confirme que o e-mail do Devpost é o acadêmico.)*
- **Submission.** Public open-source repository with an MIT license and instructions to run it (README), plus a demo video of the app running on an iPhone.
