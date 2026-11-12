/** Texte d'affiche écrit mot par mot (opacité, montée, flou), mots balisés `*mot*` dans la couleur d'accent. */
import { createContext, useContext } from "react";
import type { Fond, TextePose } from "../../../../src/briques/ecrans-motion";
import { couleursDuFond, famille, graisse, planMotParMot } from "../plans/commun";
import type { StyleMotParMot } from "../plans/habillage";

/** Style du mot par mot de l'écran (« cascade », « souffle » : posé par `Habillage`) ; `null` : la v4. Même durée, mêmes pas. */
export const StyleMotParMotContexte = createContext<StyleMotParMot>(null);

export function MotParMot({ pose, fond, ecoule, pas, duree, lueur = false }: { pose: TextePose; fond: Fond; ecoule: number; pas?: number; duree?: number; lueur?: boolean }) {
  const c = couleursDuFond(fond);
  const mots = planMotParMot(pose.texte, ecoule, pas, duree, useContext(StyleMotParMotContexte));
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
        textShadow: lueur ? `0 0 ${pose.tailleRendue * 0.25}px ${c.lueur}, 0 0 ${pose.tailleRendue * 0.6}px ${c.lueurLarge}` : "none",
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
