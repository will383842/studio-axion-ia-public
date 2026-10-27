import React from "react";
/**
 * En-tête varié (axe 14) : ENT-A (ou sans variété) = `Entete` d'aujourd'hui, inchangé ; ENT-B pastille, ENT-C filet,
 * ENT-D bandeau surligné. L'habillage est posé derrière le titre, dans la zone de l'en-tête d'aujourd'hui.
 */
import { codeDe } from "../../../../../src/briques/schema-motion/variete";
import { Entete } from "../../Entete";
import { useVariete } from "../ContexteVariete";
import { geometrieEntete } from "./geometrie";

type Proprietes = React.ComponentProps<typeof Entete>;

export function EnteteVarie(p: Proprietes) {
  const variete = useVariete();
  const code = codeDe(variete?.recette, "entete");
  if (code === "ENT-A" || !p.entete || !variete) return <Entete {...p} />;
  const g = geometrieEntete(code, p.entete.titre, variete.format, p.fond === "sombre" ? "sombre" : "ivoire");
  const b = g.boite;
  return (
    <>
      {b && g.couleurHabillage ? (
        <div
          style={{
            position: "absolute",
            left: b.x,
            top: b.y,
            width: b.largeur,
            height: b.hauteur,
            background: g.couleurHabillage,
            borderRadius: g.forme === "capsule" ? b.hauteur / 2 : g.forme === "bandeau" ? 6 : 2,
            boxSizing: "border-box",
            border: g.bordure ? `3px solid ${g.bordure}` : undefined,
            opacity: Math.min(1, p.ecoule / 0.2) * (1 - p.sortie),
          }}
        />
      ) : null}
      <Entete {...p} couleursTitre={g.forme === "filet" ? undefined : { texte: g.couleurTitre, accent: g.couleurAccent }} />
    </>
  );
}
