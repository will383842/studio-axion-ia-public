import React from "react";
/**
 * En-tête d'un moment (charte v4, comme la maquette validée) : la marque en haut, une étiquette en capitales espacées
 * couleur d'accent, un titre Anton mot par mot dont le mot balisé `*mot*` est orange. Fixe à l'écran (hors caméra).
 * Le titre ne descend JAMAIS sous le plancher de lisibilité (0,03 × hauteur) : il passe sur 2 lignes, et si même 2 lignes
 * ne tiennent pas, le rendu est refusé (`planTitre`, alerte bloquante).
 * 4:5 (lot F45, hauteur 1350) : en-tête REMONTÉ comme toute la mise en page du 9:16 (étiquette et titre de y 199 à 410),
 * marque à y 54 (sous les 54 px masqués) à la taille du cadre, comme sur les écrans v4 en 4:5 ; étiquette et titre à la
 * taille du 9:16 (hauteur de référence des textes : 1920). Le 9:16 est inchangé.
 */
import type { Fond } from "../../../src/briques/ecrans-motion";
import { COULEURS_DUO, TAILLES_DUO } from "../../../src/briques/habillage/charte-duo";
import { couleursDuFond, famille, graisse, planMarque, planMotParMot } from "../cas-concret/plans/commun";
import type { EnteteSceneIV, ProprietesSceneIV } from "../../../src/briques/schema-motion";
import { ECART_ETIQUETTE, HAUT_ENTETE, planTitre } from "./plan-objets";
import { miseEnPageDeHauteurIV } from "./mise-en-page";

export { TAILLE_TITRE_IV } from "./plan-objets";

export function Entete({ entete, ecoule, sortie, fond, marque, largeur, hauteur, couleursTitre, tailleTitre, hauteurEtiquetteMin }: { hauteurEtiquetteMin?: number; tailleTitre?: number; couleursTitre?: { texte: string; accent: string }; entete: EnteteSceneIV | null; ecoule: number; sortie: number; fond: Fond; marque: ProprietesSceneIV["marque"]; largeur: number; hauteur: number }) {
  const c = couleursDuFond(fond);
  const m = miseEnPageDeHauteurIV(hauteur);
  // Hauteur de référence des textes (1920 dans les deux formats) et haut de l'en-tête (9:16 : `HAUT_ENTETE`, inchangé).
  const ht = m.format === "9:16" ? hauteur : m.hauteurTexte;
  const haut = (m.format === "9:16" ? HAUT_ENTETE : m.entete.haut) * hauteur;
  const mots = entete ? planMotParMot(entete.titre, ecoule) : [];
  const titre = entete ? planTitre(entete.titre, largeur, ht) : null;
  // Alerte bloquante : un titre illisible n'est jamais rendu en silence.
  if (titre?.alerte) throw new Error(titre.alerte);
  const accent = fond === "sombre" ? COULEURS_DUO.orangeVif : COULEURS_DUO.orange;
  let k = 0;
  return (
    <>
      {/* Marque à la taille du cadre (en 4:5, comme celle des écrans v4 du même cadre) ; textes de l'en-tête à celle du 9:16. */}
      <MarqueIV marque={marque} fond={fond} largeur={largeur} hauteur={hauteur} haut={m.hautMarque * hauteur} accent={accent} />
      {entete && titre ? (
        <div style={{ position: "absolute", left: 0, top: haut, width: largeur, textAlign: "center", opacity: 1 - sortie }}>
          <div style={{ fontFamily: famille("inter-gras"), fontWeight: graisse("inter-gras"), fontSize: TAILLES_DUO.etiquette * ht, letterSpacing: m.format === "4:5" ? "0.24em" : "0.32em", minHeight: hauteurEtiquetteMin, textTransform: "uppercase", color: c.accent, opacity: Math.min(1, ecoule / 0.2) }}>
            {/* Étiquette vide : l'espace insécable garde la hauteur de la ligne (le titre ne remonte pas d'une ligne). */}
            {entete.etiquette || "\u00a0"}
          </div>
          <div style={{ marginTop: ECART_ETIQUETTE * ht, fontFamily: famille("anton"), fontWeight: graisse("anton"), fontSize: tailleTitre ?? titre.taille, lineHeight: 1.05, textTransform: "uppercase", color: couleursTitre?.texte ?? c.texte }}>
            {titre.lignes.map((ligne, l) => (
              <div key={l} style={{ whiteSpace: "nowrap" }}>
                {ligne.map(() => {
                  const m = mots[k++];
                  return m ? (
                    <span key={k} style={{ display: "inline-block", marginRight: "0.22em", opacity: m.opacite, transform: `translateY(${m.decalageY}px)`, filter: m.flou > 0 ? `blur(${m.flou}px)` : undefined, color: m.accent ? (couleursTitre?.accent ?? accent) : (couleursTitre?.texte ?? c.texte) }}>
                      {m.mot}
                    </span>
                  ) : null;
                })}
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </>
  );
}

/** La marque v4 (`planMarque`), « ia » en orange comme sur la maquette validée ; `hauteur` : celle des textes, `haut` : sa ligne. */
function MarqueIV({ marque, fond, largeur, hauteur, haut, accent }: { marque: ProprietesSceneIV["marque"]; fond: Fond; largeur: number; hauteur: number; haut: number; accent: string }) {
  const m = planMarque({ marque, fond, hauteur }, { x: 0, y: haut, largeur, hauteur: 0.03 * hauteur });
  const [avant, apres] = m.texte.split("ia");
  return (
    <div style={{ position: "absolute", left: m.boite.x, top: m.boite.y, width: m.boite.largeur, textAlign: "center", fontFamily: m.famille, fontSize: m.taille, letterSpacing: `${m.approcheEm}em`, color: m.couleur, whiteSpace: "nowrap" }}>
      {avant}
      <span style={{ color: accent }}>ia</span>
      {apres}
    </div>
  );
}
