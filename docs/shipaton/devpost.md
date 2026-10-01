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

Try it in the browser: https://rootera.byguto.com (the first load can take about 50 seconds while the free API wakes up). The Shipaton lab is on the Today tab.

### Inspiration
Every plant guide says: water when the soil is dry, not on a schedule. I still kept killing plants, because nobody tells you how deep to check or how long *your* plant takes to dry. Most apps just give you a calendar. I wanted one that learns.

### What it does
You check the soil in three layers (surface, middle, bottom). Each watering starts a cycle that ends at the first dry check. Rootera starts from a species estimate and, after three cycles, uses your plant's own drying pattern, nudged by local weather. Every suggestion shows where it came from. Pl@ntNet identifies the plant from a photo.

The Shipaton lab runs a virtual plant for up to 91 days in real climates, so you can watch Rootera learn in seconds.

### How I built it
Expo (React Native, TypeScript) and FastAPI. The engine is a small set of explainable rules calibrated against university extension guides. In tests with 16 species and 3 real climates, the learned drying time landed on average 0.52 days from the real one.

### How RevenueCat is used
Free keeps three plants. Rootera+ (monthly, quarterly or yearly) removes the limit and adds rooms and a growth diary. The paywall is a RevenueCat Paywall, subscribers manage their plan in the Customer Center, and the backend confirms every purchase with RevenueCat's REST API, so the app never unlocks anything on its own.

### What's next
User accounts, then the App Store and Google Play.

---

## Built with *(tags)*
revenuecat, react-native, expo, typescript, reanimated, react-native-svg, fastapi, python, sqlalchemy, sqlite, open-meteo, plantnet

## Links
- **Code repository (public, MIT):** https://github.com/gustavo-henriq/Rootera
- **Web demo:** https://rootera.byguto.com
- **Demo video:** https://youtu.be/mT3kwDD25DU

## Next Gen Award *(categoria)*
- **Student.** Active student, entering with an academic email. *(Confirme que o e-mail do Devpost é o acadêmico.)*
- **Submission.** Public open-source repository with an MIT license and instructions to run it (README), plus a demo video of the app running on an iPhone.
