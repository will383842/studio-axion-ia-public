import React from "react";
/**
 * Type d'écran `lien` (R4) : titre, bulle du lien, signature qui tombe avant la fin. Dessine `plans/Lien.ts`.
 * L3a : sans `variante` dans le plan, le dessin est celui de la v4 ; composition 1 : textes à gauche ; animation 1 : la
 * bulle monte depuis le bas (enveloppe autour du biais, qui reçoit alors une entrée finie).
 */
import { AbsoluteFill, useCurrentFrame } from "remotion";
import type { Fond as NomFond, ProprietesEcran, TextePose } from "../../../../src/briques/ecrans-motion";
import { BulleLien } from "../objets/BulleLien";
import { BIAIS_BULLE, planLien } from "../plans/Lien";
import { couleursDuFond, famille, graisse, planEtiquette, planMotParMot } from "../plans/commun";
import { Biais } from "../socle/Biais";
import { Eclair } from "../socle/Eclair";
import { Etiquette } from "../socle/Etiquette";
import { Fond } from "../socle/Fond";
import { Marque } from "../socle/Marque";
import { MotParMot } from "../socle/MotParMot";

/** Titre mot par mot aligné à gauche (composition 1) : même dessin que `MotParMot`, seul l'alignement change. */
function TitreAGauche({ pose, fond, ecoule, pas }: { pose: TextePose; fond: NomFond; ecoule: number; pas: number }) {
  const c = couleursDuFond(fond);
  const mots = planMotParMot(pose.texte, ecoule, pas);
  return (
    <div
      style={{
        position: "absolute",
        left: pose.boite.x,
        top: pose.boite.y,
        width: pose.boite.largeur,
        textAlign: "left",
        fontFamily: famille(pose.police),
        fontWeight: graisse(pose.police),
        fontSize: pose.tailleRendue,
        lineHeight: pose.interligne,
        letterSpacing: `${pose.approche}em`,
        textTransform: pose.capitales ? "uppercase" : "none",
        whiteSpace: pose.lignesMax > 1 ? "normal" : "nowrap",
        color: c.texte,
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

/** Étiquette alignée à gauche (composition 1) : même dessin que `Etiquette`. */
function EtiquetteAGauche({ pose, fond, t }: { pose: TextePose; fond: NomFond; t: number }) {
  const e = planEtiquette(fond, pose, t);
  return (
    <div style={{ position: "absolute", left: e.boite.x, top: e.boite.y, width: e.boite.largeur, textAlign: "left", fontFamily: e.famille, fontSize: e.taille, letterSpacing: `${e.approcheEm}em`, textTransform: "uppercase", color: e.couleur, opacity: e.opacite, whiteSpace: "nowrap" }}>
      {e.texte.replace(/\*/g, "")}
    </div>
  );
}

export function Lien(p: Extract<ProprietesEcran, { type: "lien" }>) {
  const plan = planLien(p, useCurrentFrame());
  const c = couleursDuFond(p.fond);
  const sig = plan.signature;
  const gauche = plan.variante?.composition === 1;
  const montee = plan.variante?.animation === 1;
  const bulle = (
    <Biais boite={plan.bulle.boite} entree={montee ? 1 : plan.bulle.progres} tVideo={plan.tVideo} rotY={BIAIS_BULLE.rotY} rotX={BIAIS_BULLE.rotX}>
      <BulleLien {...plan.bulle.objet} boite={{ ...plan.bulle.boite, x: 0, y: 0 }} />
    </Biais>
  );
  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      <Fond fond={p.fond} largeur={p.largeur} hauteur={p.hauteur} />
      <AbsoluteFill style={{ opacity: plan.entree.opacite, transform: `scale(${plan.entree.echelle})` }}>
        <Marque p={p} boite={plan.marque} />
        {plan.etiquette ? gauche ? <EtiquetteAGauche pose={plan.etiquette.pose} fond={p.fond} t={plan.t} /> : <Etiquette pose={plan.etiquette.pose} fond={p.fond} t={plan.t} /> : null}
        {gauche ? <TitreAGauche pose={plan.titre.pose} fond={p.fond} ecoule={plan.titre.ecoule} pas={plan.titre.pas} /> : <MotParMot pose={plan.titre.pose} fond={p.fond} ecoule={plan.titre.ecoule} pas={plan.titre.pas} />}
        {montee ? <AbsoluteFill style={{ opacity: plan.bulle.entree.opacite, transform: `translateY(${plan.bulle.entree.decalageY}px)` }}>{bulle}</AbsoluteFill> : bulle}
        <div
          style={{
            position: "absolute",
            left: sig.pose.boite.x,
            top: sig.pose.boite.y,
            width: sig.pose.boite.largeur,
            textAlign: gauche ? "left" : "center",
            fontFamily: famille(sig.pose.police),
            fontWeight: graisse(sig.pose.police),
            fontSize: sig.pose.tailleRendue,
            lineHeight: sig.pose.interligne,
            whiteSpace: "nowrap",
            color: c.texte,
            opacity: sig.opacite,
            transform: `scale(${sig.echelle})`,
            ...(gauche ? { transformOrigin: "left center" } : {}),
          }}
        >
          {sig.segments.map((s, i) => (
            <span key={i} style={s.accent ? { color: c.accent } : undefined}>
              {s.texte}
            </span>
          ))}
        </div>
      </AbsoluteFill>
      <Eclair t={plan.t} debut={plan.eclair} />
    </AbsoluteFill>
  );
}
