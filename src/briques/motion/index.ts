/**
 * BRIQUE COMMUNE `motion` (facecam lot C, correctif du 09/10 « qualité extrême et centralisé ») — pour TOUS les formats.
 *   - `jetons.ts` : charte motion imposée (couleurs, Poppins, 4 tailles, grille, zones sûres, courbes, durées) ;
 *   - `courbes.ts` : Bézier signature, ressort, flou de mouvement ; `mesure.ts` : texte mesuré sur Poppins ;
 *   - `catalogue.ts` : les 6 modèles d'excellence (compositions Remotion `Motion…`) et `CarteSurMesure` ;
 *   - `types.ts` / `schemas.ts` : données de chaque modèle ; `textes.ts` : pont avec l'opération `ajouterCarte` ;
 *   - `choix.ts` : choix automatique d'un modèle d'après une phrase ; `calage.ts` : chaque élément au mot dit ;
 *   - `sur-mesure.ts` : garde-fous et document de l'iframe isolée ; `demande.ts` : demande pour l'opération
 *     `composition` EXISTANTE (sans mode), repli sur le modèle fixe.
 * Compositions : `studio-rendu/compositions/commune/motion/`. Planche de validation : `studio-rendu/scripts/planche-motion.ts`.
 */
export * from "./jetons";
export * from "./types";
// Mission H : API unique pour tous les formats (avocat, face caméra, formats futurs). Le rendu des cartes
// (`rendu-cartes.ts`, service de rendu injecté) s'importe par son chemin : il n'est pas lu par Remotion.
export { cartesPourFormat, ratiosMotion, CATALOGUE_ACTIF, CATALOGUE_ACTIF_BASE, RATIOS_MOTION, type CarteFormat, type CatalogueMotionActif, type DemandeCartesFormat, type PhraseMotion } from "./pourFormat";
export { CATALOGUE_MOTION, COMPOSITION_SUR_MESURE, DUREE_CARTE_SEC, IDS_MODELES_MOTION, carteExemple, ficheModele, type FicheModele } from "./catalogue";
export { calerCarte, instantDit, horairesParDefaut, type MotCalage } from "./calage";
export { choisirModele, iconePour, type ChoixModele } from "./choix";
export { carteDepuisTextes, CONVENTION_TEXTES, lireValeur } from "./textes";
export { verifierSurMesure, documentSurMesure, couleursHorsCharte, POLITIQUE_IFRAME, type CodeSurMesure, type VerdictSurMesure } from "./sur-mesure";
export { miseEnPage, parametresCarteModele, parametresCarteSurMesure, preparerCarte, type ParametresRenduCarte } from "./demande";
export { choisirStyleMotion, lireDemandeStyle, placementDe, facteurTaille, FICHES_STYLE_MOTION, STYLES_MOTION, STYLE_MOTION_DEFAUT, type IntensiteMotion, type PlacementCarte, type StyleMotion } from "./style";
export { ICONES, NOMS_ICONES, type NomIcone } from "./icones";
export { poserCartesPleinEcran, type CartePleinEcran } from "./pose";
// Lot F2 — modèles 7 à 13 (ajouts : les 6 modèles validés et leurs exports ci-dessus sont inchangés).
export * from "./types-etendus";
export { CATALOGUE_MOTION_ETENDU, CATALOGUE_MOTION_TOUS, IDS_MODELES_MOTION_ETENDUS, IDS_MODELES_MOTION_TOUS, carteExempleEtendue, estModeleEtendu, ficheModeleTous, type FicheModeleEtendu, type FicheMotion } from "./catalogue-etendu";
export { carteDuModeleDepuisPhrase, choisirModeleEtendu, choisirModeleTous, lireDemandeModele, varianteGraphique, type ChoixModeleTous, type ContexteChoixMotion } from "./choix-etendu";
export { carteDepuisTextesEtendus, carteDepuisTextesTous, CONVENTION_TEXTES_ETENDUS, CONVENTION_TEXTES_TOUS } from "./textes-etendus";
export { calerCarteEtendue, calerCarteTous } from "./calage-etendu";
export { parametresCarteModeleEtendu, parametresCarteTous, preparerCarteTous } from "./demande-etendue";
export { contientNomOuBandeau } from "./documentaire";
export { tientEnMoitieHaute } from "./disposition-etendue";
export { CATALOGUE_ACTIF_ETENDU, catalogueActifEtendu } from "./catalogue-actif-etendu";
