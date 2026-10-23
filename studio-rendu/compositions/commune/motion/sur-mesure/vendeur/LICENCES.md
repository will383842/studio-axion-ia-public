# Bibliothèques locales de la carte sur mesure

Chargées DANS l'iframe isolée de `CarteSurMesure` (aucun réseau) : jamais téléchargées au rendu.

| Fichier | Version | Licence |
|---|---|---|
| `gsap.min.js`, `SplitText.min.js`, `DrawSVGPlugin.min.js`, `MorphSVGPlugin.min.js`, `CustomEase.min.js`, `MotionPathPlugin.min.js` | GSAP 3.13.0 (npm `gsap`) | « Standard No Charge License » de GSAP (gratuite, usage commercial compris, plugins compris depuis la 3.13) — https://gsap.com/standard-license |
| `three.min.js` | three.js r159 (npm `three@0.159.0`, dernière version livrée avec `build/three.min.js`) | MIT |

Polices : Poppins (SIL OFL 1.1), reprises de `src/briques/motion/polices/`.

Régénérer le module des chaînes après une mise à jour : `node scripts/motion/generer-bibliotheques.mjs`.
