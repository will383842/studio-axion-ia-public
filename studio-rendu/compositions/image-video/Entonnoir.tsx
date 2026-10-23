import React from "react";
/**
 * K06 · Entonnoir : N objets (enveloppes) tombent un à un au rythme de la voix dans un entonnoir sombre marqué « IA »
 * dont l'anneau tourne pendant le tri ; chacun ressort vers l'une des deux sorties (la plus nombreuse à gauche), qui
 * se remplissent avec leur compte ET leur pourcentage. Cartes blanches et pastilles de la maquette validée. Pixels de
 * l'écran de référence (1080 × 1920).
 */
import { COULEURS_DUO } from "../../../src/briques/habillage/charte-duo";
import type { Fond } from "../../../src/briques/ecrans-motion";
import { famille, graisse, teinte } from "../cas-concret/plans/commun";
import { Icone } from "../interface-claire/elements";
import { couleurTrait } from "./plan";
import { geometrieEntonnoir, PADDING_BAC, planEntonnoir, ZONE_OBJETS_IV, type BacEntonnoir, type ObjetEntonnoir, type ProprietesEntonnoir } from "./plan-objets";

export function Entonnoir({ t, fond, ...p }: ProprietesEntonnoir & { t: number; fond: Fond }) {
  const plan = planEntonnoir(p, t);
  const G = geometrieEntonnoir(p.zone ?? ZONE_OBJETS_IV);
  const objet = (o: ObjetEntonnoir) => <Enveloppe key={o.i} o={o} icone={p.icone} largeur={G.objet.largeur} hauteur={G.objet.hauteur} />;
  const corps = `M ${G.cx - G.demiBouche} ${G.bouche} L ${G.cx + G.demiBouche} ${G.bouche} L ${G.cx + G.demiGoulot} ${G.goulot} L ${G.cx + G.demiGoulot} ${G.sortieGoulot} L ${G.cx - G.demiGoulot} ${G.sortieGoulot} L ${G.cx - G.demiGoulot} ${G.goulot} Z`;
  const contour = fond === "sombre" ? COULEURS_DUO.ivoire : COULEURS_DUO.encre;
  return (
    <>
      {plan.bacs.map((b, k) => (
        <Bac key={k} b={b} />
      ))}
      {/* Les objets dans le goulot passent DERRIÈRE l'entonnoir : ils y entrent. */}
      {plan.objets.filter((o) => o.phase === "goulot").map(objet)}
      <svg style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }} width={1080} height={1920}>
        <g transform={`rotate(${plan.inclinaison} ${G.cx} ${G.goulot})`}>
          <path d={corps} fill={COULEURS_DUO.encre} stroke={contour} strokeWidth={fond === "sombre" ? 4 : 0} strokeLinejoin="round" />
          <ellipse cx={G.cx} cy={G.bouche} rx={G.demiBouche} ry={34} fill={teinte(COULEURS_DUO.encre, 1)} stroke={COULEURS_DUO.orangeVif} strokeWidth={8} />
          {/* L'anneau qui tourne : pointillé orange qui défile sur la bouche pendant le tri. */}
          <ellipse
            cx={G.cx}
            cy={G.bouche}
            rx={G.demiBouche - 30}
            ry={20}
            fill="none"
            stroke={COULEURS_DUO.orangeVif}
            strokeWidth={6}
            strokeDasharray="26 22"
            strokeDashoffset={-plan.rotation}
            opacity={0.35 + 0.65 * plan.actif}
          />
          <text
            x={G.cx}
            y={(G.bouche + G.goulot) / 2 + 40}
            textAnchor="middle"
            fontFamily={famille("anton")}
            fontWeight={graisse("anton")}
            fontSize={0.045 * 1920}
            fill={COULEURS_DUO.orangeVif}
          >
            {p.moteur}
          </text>
        </g>
        {plan.bacs.map((b, k) => (
          <path
            key={k}
            d={`M ${G.cx} ${G.sortieGoulot} C ${G.cx} ${G.sortieGoulot + 20}, ${b.x + b.largeur / 2} ${G.sortieGoulot + 10}, ${b.x + b.largeur / 2} ${b.y}`}
            fill="none"
            stroke={couleurTrait(b.couleur)}
            strokeWidth={7}
            strokeLinecap="round"
            strokeDasharray="2 16"
            opacity={0.55}
          />
        ))}
      </svg>
      {plan.objets.filter((o) => o.phase !== "goulot").map(objet)}
    </>
  );
}

/** Une enveloppe : petite carte blanche à l'icône au trait, comme les nœuds. */
function Enveloppe({ o, icone, largeur, hauteur }: { o: ObjetEntonnoir; icone: string; largeur: number; hauteur: number }) {
  return (
    <div
      style={{
        position: "absolute",
        left: o.x - largeur / 2,
        top: o.y - hauteur / 2,
        width: largeur,
        height: hauteur,
        borderRadius: 14,
        background: COULEURS_DUO.blanc,
        boxShadow: `0 10px 22px ${teinte(COULEURS_DUO.encre, 0.18)}`,
        opacity: o.opacite,
        transform: `rotate(${o.rotation}deg) scale(${o.echelle})`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Icone nom={icone} taille={hauteur * 0.66} couleur={COULEURS_DUO.encre} epaisseur={2.4} />
    </div>
  );
}

/** Une sortie : carte blanche, compte qui monte, pastille du pourcentage, libellé Anton. */
function Bac({ b }: { b: BacEntonnoir }) {
  const accent = couleurTrait(b.couleur);
  return (
    <div
      style={{
        position: "absolute",
        left: b.x,
        top: b.y,
        width: b.largeur,
        height: b.hauteur,
        boxSizing: "border-box",
        padding: `22px ${PADDING_BAC}px`,
        borderRadius: 34,
        background: COULEURS_DUO.blanc,
        borderTop: `10px solid ${accent}`,
        boxShadow: `0 18px 44px ${teinte(COULEURS_DUO.encre, 0.1)}`,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 10,
        textAlign: "center",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 18, transform: `scale(${b.impulsion})` }}>
        <span style={{ fontFamily: famille("anton"), fontWeight: graisse("anton"), fontSize: b.tailleCompte, lineHeight: 1, color: COULEURS_DUO.encre, fontVariantNumeric: "tabular-nums" }}>{b.arrives}</span>
        <span
          style={{
            background: accent,
            color: COULEURS_DUO.blanc,
            borderRadius: 999,
            padding: "4px 22px 0",
            fontFamily: famille("anton"),
            fontWeight: graisse("anton"),
            fontSize: b.taillePart,
            lineHeight: 1.15,
            fontVariantNumeric: "tabular-nums",
            whiteSpace: "nowrap",
            opacity: b.arrives > 0 ? 1 : 0.35,
          }}
        >
          {b.pourcent} %
        </span>
      </div>
      <div style={{ fontFamily: famille("anton"), fontWeight: graisse("anton"), fontSize: b.tailleLibelle, lineHeight: 1.05, color: COULEURS_DUO.encre, textTransform: "uppercase" }}>{b.libelle}</div>
    </div>
  );
}
