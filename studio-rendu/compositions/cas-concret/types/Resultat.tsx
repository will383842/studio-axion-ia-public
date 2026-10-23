/** Type d'écran `resultat` (R2) : titre, barre « avant » longue, barre « maintenant » plus courte qui rebondit, ligne. Dessine `plans/Resultat.ts`. */
import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { BarresAvantApres } from "../objets/BarresAvantApres";
import { proprietesFond } from "../plans/fond-fort";
import { planResultat, type ProprietesResultat } from "../plans/Resultat";
import { Fond } from "../socle/Fond";
import { piecesTexte } from "./Titre";

type EtiquetteBarre = NonNullable<ReturnType<typeof planResultat>["etiquetteAvant"]>;

function EtiquetteGauche({ e }: { e: EtiquetteBarre }) {
  return (
    <div style={{ position: "absolute", left: e.boite.x, top: e.boite.y, width: e.boite.largeur, textAlign: "left", fontFamily: e.famille, fontSize: e.taille, letterSpacing: `${e.approcheEm}em`, textTransform: "uppercase", color: e.couleur, opacity: e.opacite, whiteSpace: "nowrap" }}>{e.texte}</div>
  );
}

export function Resultat(p: ProprietesResultat) {
  const plan = planResultat(p, useCurrentFrame());
  const fond = proprietesFond(p.jeu);
  const { MotParMot, Marque, Etiquette } = piecesTexte(fond.fort === true);
  const barre = (b: typeof plan.avant) => {
    // L3c : texte trop long pour une barre courte (proportionnelle) → posé juste après elle, dessiné ici.
    const tx = b.plan.texte;
    const dehors = "dehors" in tx && tx.dehors;
    return (
      <div style={{ position: "absolute", left: b.boite.x, top: b.boite.y, width: b.boite.largeur, height: b.boite.hauteur }}>
        <BarresAvantApres boite={{ ...b.boite, x: 0, y: 0 }} t={plan.t} tVideo={plan.t + p.debutMs / 1000} fond={p.fond} textes={[dehors ? "" : tx.texte]} variante={b.plan.variante} debut={b.plan.debut} {...("reglage" in b ? b.reglage : {})} />
        {dehors ? (
          <div style={{ position: "absolute", left: tx.boite.x, top: tx.boite.y, width: tx.boite.largeur, height: tx.boite.hauteur, display: "flex", alignItems: "center", fontFamily: tx.famille, fontWeight: tx.graisse, fontSize: tx.taille, color: tx.couleur, opacity: tx.opacite, whiteSpace: "nowrap" }}>{tx.texte}</div>
        ) : null}
      </div>
    );
  };
  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      <Fond fond={p.fond} largeur={p.largeur} hauteur={p.hauteur} {...fond} />
      <AbsoluteFill style={{ opacity: plan.entree.opacite, transform: `scale(${plan.entree.echelle})` }}>
        <Marque p={p} boite={plan.marque.boite} />
        {plan.etiquettePose ? <Etiquette pose={plan.etiquettePose} fond={p.fond} t={plan.t} /> : null}
        <MotParMot pose={plan.titre.pose} fond={p.fond} ecoule={plan.titre.ecoule} pas={plan.titre.pas} />
        {plan.etiquetteAvant ? <EtiquetteGauche e={plan.etiquetteAvant} /> : null}
        {barre(plan.avant)}
        {plan.etiquetteMaintenant ? <EtiquetteGauche e={plan.etiquetteMaintenant} /> : null}
        {barre(plan.maintenant)}
        <div style={{ position: "absolute", left: plan.ligne.boite.x, top: plan.ligne.boite.y, width: plan.ligne.boite.largeur, textAlign: "center", fontFamily: plan.ligne.famille, fontSize: plan.ligne.taille, color: plan.ligne.couleur, opacity: plan.ligne.opacite, transform: `translateY(${plan.ligne.decalageY}px)` }}>{plan.ligne.texte}</div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
}
