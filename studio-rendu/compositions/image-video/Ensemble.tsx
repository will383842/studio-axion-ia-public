import React from "react";
/**
 * K21 · Ensemble (B3) : la vue d'ensemble LISIBLE. Le schéma entier redessiné dans la zone utile (`planEnsemble`) :
 * un bloc par nœud (sa couleur, l'icône lue sur l'image, un LIBELLÉ COURT au plancher de lisibilité ou au-dessus),
 * les flèches, et les parts des branches (« 80 % ») en tête de leur colonne, à leur couleur, comme la maquette 08.
 * Les pastilles se posent en cascade dans l'ordre de lecture, le bloc courant est allumé (halo), le reste atténué.
 * Variante « image source en plein cadre » pour le récapitulatif final — refusée si l'image montre des personnes
 * (M3) : on redessine alors le schéma. Pixels de l'écran de référence 1080 × 1920.
 */
import { Img } from "remotion";
import { ECRAN_IV, type SchemaEntree } from "../../../src/briques/schema-motion";
import { COULEURS_DUO } from "../../../src/briques/habillage/charte-duo";
import { doux, famille, graisse, planSurgir, progres, teinte } from "../cas-concret/plans/commun";
import { Icone } from "../interface-claire/elements";
import { couleurTrait, OPACITE_VU } from "./plan";
import { entreePastille, type PlanEnsemble } from "./plan-objets";

export type ImageSourceEnsemble = { src: string; photoPersonnes: boolean };

const fondPastille = (c: string) => (c === "orange" ? COULEURS_DUO.orangeVif : c === "vert" ? COULEURS_DUO.vert : c === "neutre" ? COULEURS_DUO.gris : COULEURS_DUO.encre);

export function Ensemble({ plan, ecoule, fondu, imageSource }: { plan: PlanEnsemble; schema?: SchemaEntree; ecoule: number; fondu: number; imageSource?: ImageSourceEnsemble }) {
  if (imageSource && !imageSource.photoPersonnes) {
    return (
      <div style={{ position: "absolute", inset: 0, opacity: fondu, display: "flex", alignItems: "center", justifyContent: "center", padding: 60 }}>
        <Img src={imageSource.src} style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain", borderRadius: 24, boxShadow: `0 30px 70px ${teinte(COULEURS_DUO.encre, 0.25)}` }} />
      </div>
    );
  }
  const n = plan.blocs.length;
  const entree = (id: string) => entreePastille(plan.rang.get(id) ?? 0, n, ecoule);
  const parId = new Map(plan.blocs.map((b) => [b.id, b]));
  const halo = 0.5 + 0.5 * Math.sin(ecoule * 5);
  const tousAllumes = plan.blocs.every((b) => b.allume);
  return (
    <div style={{ position: "absolute", inset: 0, opacity: fondu, transform: `scale(${0.96 + 0.04 * fondu})` }}>
      <svg width={ECRAN_IV.largeur} height={ECRAN_IV.hauteur} style={{ position: "absolute", left: 0, top: 0 }}>
        {plan.fleches.map((f) => {
          const [de, vers] = f.extremites;
          // La flèche se dessine quand ses deux bouts sont posés.
          const trace = doux(Math.min(entree(de), progres(entree(vers), 0.2, 0.8)));
          if (trace <= 0) return null;
          const k = Math.max(10, (f.vers.y - f.de.y) / 2);
          const chemin = `M ${f.de.x} ${f.de.y} C ${f.de.x} ${f.de.y + k}, ${f.vers.x} ${f.vers.y - k}, ${f.vers.x} ${f.vers.y}`;
          const allume = parId.get(de)?.allume && parId.get(vers)?.allume;
          return <path key={f.id} d={chemin} pathLength={1} fill="none" stroke={couleurTrait(f.couleur)} strokeWidth={7} strokeLinecap="round" strokeDasharray="1 1" strokeDashoffset={1 - trace} opacity={allume ? 1 : OPACITE_VU} />;
        })}
      </svg>
      {plan.blocs.map((b) => {
        const x = entree(b.id);
        if (x <= 0) return null;
        const s = planSurgir(x);
        const fond = fondPastille(b.couleur);
        return (
          <div
            key={b.id}
            style={{
              position: "absolute",
              left: b.x,
              top: b.y,
              width: b.largeur,
              height: b.hauteur,
              boxSizing: "border-box",
              padding: "0 12px",
              borderRadius: Math.min(b.hauteur / 2, 44),
              background: fond,
              opacity: s.opacite * (b.allume ? 1 : OPACITE_VU),
              transform: `scale(${s.echelle})`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              boxShadow: b.allume && !tousAllumes ? `0 0 ${30 + 30 * halo}px ${teinte(COULEURS_DUO.orangeVif, 0.6)}` : `0 10px 26px ${teinte(fond, 0.35)}`,
            }}
          >
            {b.icone && b.badge ? (
              <div style={{ width: b.badge, height: b.badge, flex: "none", borderRadius: "50%", background: teinte(COULEURS_DUO.blanc, 0.18), display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Icone nom={b.icone} taille={b.badge * 0.62} couleur={COULEURS_DUO.blanc} epaisseur={2.6} />
              </div>
            ) : null}
            <div style={{ fontFamily: famille("anton"), fontWeight: graisse("anton"), fontSize: b.libelle.taille, lineHeight: 1.04, color: COULEURS_DUO.blanc, textTransform: "uppercase", textAlign: b.badge ? "left" : "center" }}>
              {b.libelle.lignes.map((l, i) => (
                <div key={i} style={{ whiteSpace: "nowrap" }}>
                  {l.join(" ")}
                </div>
              ))}
            </div>
          </div>
        );
      })}
      {plan.chiffres.map((c, i) => {
        const x = progres(ecoule, 0.35 + i * 0.12, 0.4);
        const s = planSurgir(x);
        const pastille = c.branche !== null;
        return (
          <div
            key={`${i}-${c.texte}`}
            style={{
              position: "absolute",
              left: c.x,
              top: c.y,
              width: c.largeur,
              height: c.hauteur,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: c.hauteur / 2,
              background: pastille ? c.couleur : "transparent",
              fontFamily: famille("anton"),
              fontWeight: graisse("anton"),
              fontSize: c.taille * ECRAN_IV.hauteur,
              lineHeight: 1,
              color: pastille ? COULEURS_DUO.blanc : c.couleur,
              whiteSpace: "nowrap",
              opacity: s.opacite,
              transform: `scale(${s.echelle})`,
              boxShadow: pastille ? `0 12px 30px ${teinte(c.couleur, 0.35)}` : undefined,
            }}
          >
            {c.texte}
          </div>
        );
      })}
    </div>
  );
}
