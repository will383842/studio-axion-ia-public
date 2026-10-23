/** Type d'écran `titre` (R1) : une ou deux lignes d'affiche, la dernière dans la lueur, et les particules du fond sombre. */
import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import type { BoitePx, Fond as NomFond, ProprietesEcran, TextePose } from "../../../../src/briques/ecrans-motion";
import { famille, graisse, planEtiquette, planMarque, planMotParMot } from "../plans/commun";
import { couleursFortes, proprietesFond } from "../plans/fond-fort";
import { planTitre, type ProprietesTitre } from "../plans/Titre";
import { Etiquette } from "../socle/Etiquette";
import { Fond } from "../socle/Fond";
import { Marque } from "../socle/Marque";
import { MotParMot } from "../socle/MotParMot";

/** Particules lumineuses (fond sombre) : petits ronds qui montent doucement. */
export function Particules({ particules }: { particules: ReturnType<typeof planTitre>["particules"] }) {
  return (
    <>
      {particules.map((q, i) => (
        <div key={i} style={{ position: "absolute", left: q.x - q.rayon, top: q.y - q.rayon, width: q.rayon * 2, height: q.rayon * 2, borderRadius: "50%", background: q.couleur, opacity: q.opacite }} />
      ))}
    </>
  );
}

/* ------------------------------------------------------------------ */
/* L3c · pièces de texte du 3ᵉ fond terracotta (couleurs de la maquette   */
/* validée : texte ivoire haut, accent nuit, marque blanche, sans lueur)  */
/* Le socle n'est pas touché : sans fond fort, ce sont SES composants.    */
/* ------------------------------------------------------------------ */

type PropsMotParMot = { pose: TextePose; fond: NomFond; ecoule: number; pas?: number; duree?: number; lueur?: boolean };

/** Mot par mot du fond fort (même grammaire que `socle/MotParMot`, couleurs du fond fort, aucune lueur orange). */
export function MotParMotFort({ pose, ecoule, pas, duree }: PropsMotParMot) {
  const c = couleursFortes();
  const mots = planMotParMot(pose.texte, ecoule, pas, duree);
  return (
    <div
      style={{
        position: "absolute",
        left: pose.boite.x,
        top: pose.boite.y,
        width: pose.boite.largeur,
        textAlign: "center",
        fontFamily: famille(pose.police),
        fontWeight: graisse(pose.police),
        fontSize: pose.tailleRendue,
        lineHeight: pose.interligne,
        letterSpacing: `${pose.approche}em`,
        textTransform: pose.capitales ? "uppercase" : "none",
        whiteSpace: pose.lignesMax > 1 ? "normal" : "nowrap",
        color: c.texte,
        textShadow: "none",
      }}
    >
      {mots.map((m, i) => (
        <span key={i}>
          {i > 0 ? " " : null}
          <span style={{ display: "inline-block", opacity: m.opacite, transform: `translateY(${m.decalageY}px)`, filter: m.flou ? `blur(${m.flou}px)` : "none", color: m.accent ? c.accent : undefined }}>{m.mot}</span>
        </span>
      ))}
    </div>
  );
}

/** Marque du fond fort (blanche). */
export function MarqueFort({ p, boite }: { p: Pick<ProprietesEcran, "marque" | "fond" | "hauteur">; boite: BoitePx; fond?: NomFond }) {
  const m = planMarque(p, boite);
  return (
    <div style={{ position: "absolute", left: m.boite.x, top: m.boite.y, width: m.boite.largeur, height: m.boite.hauteur, textAlign: "center", fontFamily: m.famille, fontSize: m.taille, letterSpacing: `${m.approcheEm}em`, color: couleursFortes().marque, whiteSpace: "nowrap" }}>
      {m.texte}
    </div>
  );
}

/** Étiquette du fond fort (accent nuit). */
export function EtiquetteFort({ pose, fond, t }: { pose: TextePose; fond: NomFond; t: number }) {
  const e = planEtiquette(fond, pose, t);
  return (
    <div style={{ position: "absolute", left: e.boite.x, top: e.boite.y, width: e.boite.largeur, textAlign: "center", fontFamily: e.famille, fontSize: e.taille, letterSpacing: `${e.approcheEm}em`, textTransform: "uppercase", color: couleursFortes().accent, opacity: e.opacite, whiteSpace: "nowrap" }}>
      {e.texte.replace(/\*/g, "")}
    </div>
  );
}

/** Pièces de texte d'un écran : celles du socle (v4), ou celles du fond fort. */
export function piecesTexte(fort: boolean) {
  return fort ? { MotParMot: MotParMotFort, Marque: MarqueFort, Etiquette: EtiquetteFort } : { MotParMot, Marque, Etiquette };
}

export function Titre(p: ProprietesTitre) {
  const plan = planTitre(p, useCurrentFrame());
  const fond = proprietesFond(p.jeu);
  const { MotParMot: Mots, Marque: LaMarque } = piecesTexte(fond.fort === true);
  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      <Fond fond={p.fond} largeur={p.largeur} hauteur={p.hauteur} {...fond} />
      <AbsoluteFill style={{ opacity: plan.entree.opacite, transform: `scale(${plan.entree.echelle})` }}>
        <Particules particules={plan.particules} />
        <LaMarque p={p} boite={plan.marque.boite} />
        {plan.lignes.map((l) => (
          <Mots key={l.nom} pose={l.pose} fond={p.fond} ecoule={l.ecoule} pas={l.pas} lueur={l.lueur} />
        ))}
      </AbsoluteFill>
    </AbsoluteFill>
  );
}
