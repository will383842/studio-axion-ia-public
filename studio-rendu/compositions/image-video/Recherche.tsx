import React from "react";
/**
 * K14 · Recherche : une barre de recherche (loupe) dont le texte se tape (mot par mot quand chaque mot a son heure),
 * curseur qui clignote, puis le résultat qui
 * surgit dessous (« Trouvé — 3 secondes ») avec sa coche verte. Pixels de l'écran de référence 1080 × 1920.
 */
import type { Fond } from "../../../src/briques/ecrans-motion";
import { COULEURS_DUO } from "../../../src/briques/habillage/charte-duo";
import { couleursDuFond, famille, graisse, planEntreeObjet, planSurgir, teinte } from "../cas-concret/plans/commun";
import { Icone } from "../interface-claire/elements";
import { Lignes } from "./CarteBenefice";
import { planRecherche } from "./plan-objets";

export function Recherche({ requete, debut, mots, trouve, t, fond }: { requete: string; debut: number; mots?: number[]; trouve?: { texte: string; t: number }; t: number; fond: Fond }) {
  const r = planRecherche({ requete, debut, mots, trouve }, t);
  if (r.entree <= 0) return null;
  const e = planEntreeObjet(r.entree);
  const c = couleursDuFond(fond);
  const coche = planSurgir(r.coche);
  const res = r.resultatBoite;
  return (
    <>
      <div
        style={{
          position: "absolute",
          left: r.barre.x,
          top: r.barre.y,
          width: r.barre.largeur,
          height: r.barre.hauteur,
          borderRadius: r.barre.hauteur / 2,
          background: COULEURS_DUO.blanc,
          border: `6px solid ${r.frappe.fini ? COULEURS_DUO.orangeVif : COULEURS_DUO.encre}`,
          boxSizing: "border-box",
          display: "flex",
          alignItems: "center",
          padding: "0 40px",
          gap: 26,
          boxShadow: `0 22px 50px ${teinte(COULEURS_DUO.encre, 0.14)}`,
          opacity: e.opacite,
          transform: `translateY(${e.decalageY}px) scale(${e.echelle})`,
        }}
      >
        <Icone nom="loupe" taille={70} couleur={COULEURS_DUO.encre} epaisseur={2.8} />
        <div style={{ fontFamily: famille("inter-gras"), fontWeight: graisse("inter-gras"), fontSize: r.requete.taille, color: COULEURS_DUO.encre, whiteSpace: "nowrap" }}>
          {r.frappe.texte}
          <span style={{ display: "inline-block", width: 5, height: r.requete.taille * 1.05, marginLeft: 4, verticalAlign: "middle", background: COULEURS_DUO.orangeVif, opacity: r.frappe.curseur ? 1 : 0 }} />
        </div>
      </div>
      {r.trouve && r.resultat > 0 ? (
        <div
          style={{
            position: "absolute",
            left: res.x,
            top: res.y,
            width: res.largeur,
            height: res.hauteur,
            boxSizing: "border-box",
            padding: "40px 60px",
            borderRadius: 44,
            background: fond === "sombre" ? COULEURS_DUO.nuitHaut : COULEURS_DUO.blanc,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 44,
            textAlign: "center",
            boxShadow: `0 22px 50px ${teinte(COULEURS_DUO.encre, 0.12)}`,
            opacity: planEntreeObjet(r.resultat).opacite,
            transform: `translateY(${planEntreeObjet(r.resultat, 50).decalageY}px)`,
          }}
        >
          <div style={{ width: 230, height: 230, borderRadius: "50%", background: COULEURS_DUO.vert, display: "flex", alignItems: "center", justifyContent: "center", transform: `scale(${coche.echelle})`, opacity: coche.opacite, flex: "none", boxShadow: `0 0 60px ${teinte(COULEURS_DUO.vert, 0.45)}` }}>
            <Icone nom="coche" taille={140} couleur={COULEURS_DUO.blanc} epaisseur={3.2} />
          </div>
          <Lignes texte={r.trouve} couleur={c.texte} police="anton" />
        </div>
      ) : null}
    </>
  );
}
