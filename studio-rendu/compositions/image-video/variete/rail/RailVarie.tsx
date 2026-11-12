/**
 * Lot 3 · RAIL D'ÉTAPES : mêmes entrées que `RailSuite`. RAI-A (référence, et tout rendu sans variété) l'appelle sans le
 * modifier ; RAI-B (fil de progression), RAI-C (icônes seules) et RAI-D (segments façon stories) dessinent le rail
 * autrement, sans aucun texte. Garde les attributs `data-rail` et `data-carte-rail`.
 */
import React from "react";
import type { SchemaEntree } from "../../../../../src/briques/schema-motion";
import { codeDe } from "../../../../../src/briques/schema-motion/variete";
import { COULEURS_DUO } from "../../../../../src/briques/habillage/charte-duo";
import { Icone } from "../../../interface-claire/elements";
import { etatNoeud, railSuite, type SceneCalculee } from "../../plan";
import { COULEURS_MUET, RailSuite } from "../../Toile";
import { useVariete } from "../ContexteVariete";
import { geometrieRail, type CodeRail, type ElementRail } from "./geometrie";

type Props = { scene: SceneCalculee; schema: SchemaEntree; t: number; fond: "ivoire" | "sombre"; place: { haut: number; hauteur: number }; opacite: number };

export function RailVarie(props: Props) {
  const v = useVariete();
  const code = codeDe(v?.recette, "rail") as CodeRail;
  if (code === "RAI-A" || props.opacite <= 0) return <RailSuite {...props} />;
  return <RailAutre {...props} code={code} />;
}

function RailAutre({ scene, schema, t, fond, place, opacite, code }: Props & { code: CodeRail }) {
  const gris = COULEURS_MUET[fond].pastille;
  const icones = new Map(schema.noeuds.map((n) => [n.id, n.icone]));
  const cartes = railSuite(scene, { schema }, t).map((k) => ({ ...k, remplissage: k.etat === "actif" ? etatNoeud(scene, k.id, t).entree : k.etat === "vu" ? 1 : 0 }));
  const dedans = (e: ElementRail) => e.id.replace(/-(ligne|point)$/, "");
  return (
    <div data-rail="" style={{ position: "absolute", left: 0, top: place.haut, width: 1080, height: place.hauteur, overflow: "hidden", opacity: opacite }}>
      {geometrieRail(code, cartes, place).map((e) => {
        const dit = e.etat !== "absent";
        const base: React.CSSProperties = { position: "absolute", left: e.x, top: e.y, width: e.largeur, height: e.hauteur };
        let corps: React.ReactNode;
        if (e.genre === "ligne") corps = <div style={{ ...base, borderRadius: 2, background: dit ? COULEURS_DUO.orange : gris, opacity: dit ? 1 : 0.6 }} />;
        else if (e.genre === "point")
          corps = <div style={{ ...base, borderRadius: "50%", boxSizing: "border-box", background: dit ? COULEURS_DUO.orange : "transparent", border: dit ? "none" : `3px solid ${gris}` }} />;
        else if (e.genre === "pastille") {
          const nom = icones.get(dedans(e));
          corps = (
            <div style={{ ...base, borderRadius: "50%", boxSizing: "border-box", background: dit ? COULEURS_DUO.encre : "transparent", border: dit ? "none" : `3px solid ${COULEURS_DUO.orange}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
              {nom ? <Icone nom={nom} taille={e.hauteur * 0.5} couleur={dit ? COULEURS_DUO.blanc : COULEURS_DUO.orange} epaisseur={2.6} /> : null}
            </div>
          );
        } else
          corps = (
            <div style={{ ...base, borderRadius: e.hauteur / 2, background: gris, opacity: 0.7, overflow: "hidden" }}>
              <div style={{ width: `${Math.round(e.remplissage * 100)}%`, height: "100%", background: COULEURS_DUO.orange }} />
            </div>
          );
        return (
          <div key={e.id} data-carte-rail={dedans(e)} style={{ position: "absolute", inset: 0, opacity: e.opacite }}>
            {corps}
          </div>
        );
      })}
    </div>
  );
}
