import React from "react";
/**
 * K08 · ÉcranPartagé : l'avant (panneau noir) occupe d'abord tout l'écran, ses lignes posées sur leurs mots ; au mot
 * de bascule (« Maintenant… »), un volet orange entre par la droite et l'avant se range à gauche. Les deux colonnes se
 * répondent ligne à ligne (même rang, même hauteur). Pixels de l'écran de référence (1080 × 1920).
 */
import { COULEURS_DUO, TAILLES_DUO } from "../../../src/briques/habillage/charte-duo";
import { ECRAN_IV } from "../../../src/briques/schema-motion";
import { famille, graisse, planEntreeObjet, teinte } from "../cas-concret/plans/commun";
import { Icone } from "../interface-claire/elements";
import { MARGE_COLONNE, MESURES_ECRAN_PARTAGE, planEcranPartage, ZONE_OBJETS_IV, type LignePosee, type ProprietesEcranPartage } from "./plan-objets";

/** Écart entre les deux panneaux une fois le volet passé (pixels). */
const ECART_PANNEAUX = 16;

export function EcranPartage({ t, ...p }: ProprietesEcranPartage & { t: number }) {
  const z = p.zone ?? ZONE_OBJETS_IV;
  const plan = planEcranPartage(p, t);
  const demi = z.largeur / 2;
  // Deux panneaux arrondis séparés d'un léger écart (jamais collés au bord : la zone garde les marges de 5 %).
  const largeurAvant = z.largeur - (demi + ECART_PANNEAUX / 2) * plan.volet;
  const colonne = (cote: "avant" | "apres") => (
    <div
      style={{
        position: "absolute",
        left: cote === "avant" ? z.x + plan.decalageAvant : z.x + demi,
        top: z.y,
        width: demi,
        height: z.hauteur,
        boxSizing: "border-box",
        padding: `${MESURES_ECRAN_PARTAGE.margeHaut}px ${MARGE_COLONNE}px`,
        display: "grid",
        gridTemplateRows: `auto repeat(${plan.rangs.length}, 1fr)`,
        alignItems: "center",
        rowGap: MESURES_ECRAN_PARTAGE.ecartRangs,
      }}
    >
      <div
        style={{
          textAlign: "center",
          fontFamily: famille("inter-gras"),
          fontWeight: graisse("inter-gras"),
          fontSize: TAILLES_DUO.etiquette * ECRAN_IV.hauteur,
          letterSpacing: "0.32em",
          textTransform: "uppercase",
          color: cote === "avant" ? COULEURS_DUO.orangeVif : COULEURS_DUO.encre,
          opacity: plan.titres[cote],
        }}
      >
        {p[cote].titre}
      </div>
      {plan.rangs.map((r, i) => (
        <Ligne key={i} l={r[cote]} cote={cote} />
      ))}
    </div>
  );
  return (
    <>
      <div style={{ position: "absolute", left: z.x, top: z.y, width: largeurAvant, height: z.hauteur, background: COULEURS_DUO.encre, borderRadius: 34 }} />
      {plan.volet > 0 ? (
        <div
          style={{
            position: "absolute",
            left: z.x + largeurAvant + ECART_PANNEAUX * plan.volet,
            top: z.y,
            width: z.largeur - largeurAvant - ECART_PANNEAUX * plan.volet,
            height: z.hauteur,
            background: COULEURS_DUO.orangeVif,
            borderRadius: 34,
            boxShadow: `-24px 0 60px ${teinte(COULEURS_DUO.encre, 0.35)}`,
          }}
        />
      ) : null}
      {colonne("avant")}
      {plan.volet > 0 ? colonne("apres") : null}
    </>
  );
}

/** Une ligne : rangée d'icônes, texte Inter, valeur Anton (avec coche verte côté après). */
function Ligne({ l, cote }: { l: LignePosee | null; cote: "avant" | "apres" }) {
  if (!l || l.entree <= 0) return <div />;
  const e = planEntreeObjet(l.entree, 40);
  const texte = cote === "avant" ? COULEURS_DUO.ivoire : COULEURS_DUO.encre;
  return (
    <div style={{ textAlign: "center", opacity: e.opacite, transform: `translateY(${e.decalageY}px) scale(${e.echelle})` }}>
      {l.icones ? (
        <div style={{ display: "flex", justifyContent: "center", gap: 10, flexWrap: "wrap" }}>
          {l.icones.map((nom, k) => (
            <div key={k} style={{ width: l.icone, height: l.icone, borderRadius: l.icone * 0.27, background: cote === "avant" ? teinte(COULEURS_DUO.ivoire, 0.12) : COULEURS_DUO.blanc, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Icone nom={nom} taille={l.icone * 0.6} couleur={cote === "avant" ? COULEURS_DUO.ivoire : COULEURS_DUO.encre} epaisseur={2.4} />
            </div>
          ))}
        </div>
      ) : null}
      {l.texte ? <div style={{ fontFamily: famille("inter-gras"), fontWeight: graisse("inter-gras"), fontSize: l.tailleTexte, lineHeight: MESURES_ECRAN_PARTAGE.interligneTexte, color: texte }}>{l.texte}</div> : null}
      {l.valeur ? (
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 14, marginTop: l.texte ? 4 : 0 }}>
          {l.coche ? (
            <span style={{ width: l.tailleValeur * 0.8, height: l.tailleValeur * 0.8, borderRadius: "50%", background: COULEURS_DUO.vert, display: "inline-flex", alignItems: "center", justifyContent: "center", flex: "none" }}>
              <svg width={l.tailleValeur * 0.55} height={l.tailleValeur * 0.55} viewBox="0 0 24 24" fill="none" stroke={COULEURS_DUO.blanc} strokeWidth={3.6} strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12.5l4.5 4.5L19 7.5" />
              </svg>
            </span>
          ) : null}
          <span style={{ fontFamily: famille("anton"), fontWeight: graisse("anton"), fontSize: l.tailleValeur, lineHeight: MESURES_ECRAN_PARTAGE.interligneValeur, textTransform: "uppercase", color: cote === "avant" ? COULEURS_DUO.orangeVif : COULEURS_DUO.encre, whiteSpace: "nowrap" }}>
            {l.valeur}
          </span>
        </div>
      ) : null}
    </div>
  );
}
