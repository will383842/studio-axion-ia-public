# Sous-titres du tableau au design central (17/10/2026)

Retour de Will sur les images de #330 : « ce ne sont pas les bonnes couleurs, ce n'est pas ce qui est centralisé ».
Le tableau dessine maintenant ses sous-titres **exactement comme la face caméra et l'avocat** : style « Avocat »
(`st-avocat-v1`), texte crème, mot dit à l'orange de la marque, contour et ombre sombres, Poppins ExtraBold, Impact et
Bandeau du central. Aucune pastille. Sur le tableau blanc et le paperboard, une bande sombre de fond (couleur `fond` de
la marque, opacité 0,91, dégradé doux en haut) est posée dans la bande réservée, derrière le sous-titre inchangé ;
l'ardoise n'en a pas.

Fiche réelle `v-6616b3800357`, rendue par le moteur (Remotion) avec la chaîne de la fabrication. Aucun appel payant.

- `planche-comparaison.jpg` : la preuve — le même calque rendu pour l'**avocat** (décor N1), puis sur l'ardoise et le
  tableau blanc. Images seules : `reference-avocat-*.jpg`.
- `planche-vertical.jpg`, `planche-portrait.jpg` : 3 fonds × 4 moments (accroche, chiffre, phrase clé, texte courant)
  en 9:16 et 4:5 ; images seules : `<moment>-<fond>-<format>.jpg`.
- `video-test-ardoise-puis-tableau-blanc-vertical.mp4` : 10 s (5 s d'ardoise, 5 s de tableau blanc, 9:16) ;
  `planche-mouvement.jpg` : ses images à 6 i/s.
- `resume.json` : mesures sur l'image rendue, 3 fonds × 4 formats (9:16, 4:5, carré, 16:9) × 4 moments = 48 :
  contraste réel texte / fond ≥ 4,5:1 partout (minimum 4,79:1 ; Bandeau 16:1), 0 pixel de texte hors de la bande,
  0 pixel vert, bleu ou violet dans la bande.

Refaire : `npx tsx tests/tableau/sous-titres-design-central/apercus.mts` (≈ 1 h, après l'installation de `studio-rendu`).
