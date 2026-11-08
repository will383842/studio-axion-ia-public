import type { ParametresPiece } from "../catalogue";
import { TOILES } from "../toiles";
import { avecOpacite } from "../../jetons-motion";
import { apparition, palette, RACINE, round, type ProprietesBrique } from "./communs";

type P = ParametresPiece<"bulle-chat">;

/** Échange de messages : chaque bulle arrive à son tour ; l'assistant « écrit » d'abord (trois points doux). */
export function BulleChat({ image, dureeImages, fond, accent, parametres: p }: ProprietesBrique<P>) {
  const c = palette(fond, accent);
  const { largeur } = TOILES["bulle-chat"];
  const tranche = Math.max(8, Math.floor((dureeImages * 0.8) / p.messages.length));
  const hauteurs = p.messages.map((m) => 70 + Math.ceil(m.texte.length / 30) * 44);
  const hauts = hauteurs.map((_, i) => 40 + hauteurs.slice(0, i).reduce((a, h) => a + h + 26, 0));
  return (
    <div style={RACINE}>
      {p.messages.map((m, i) => {
        const debut = i * tranche;
        const ecrit = m.auteur === "assistant" && p.saisie ? Math.round(tranche * 0.4) : 0;
        const client = m.auteur === "client";
        const haut = hauts[i]!;
        const saisie = image >= debut && image < debut + ecrit;
        if (image < debut) return null;
        return (
          <div key={i} style={{ position: "absolute", top: haut, [client ? "left" : "right"]: 30, maxWidth: largeur * 0.74 }}>
            {saisie ? (
              <div style={{ ...apparition(image, debut, 8), display: "flex", gap: 10, padding: "26px 30px", borderRadius: 32, background: c.panneauRelief }}>
                {[0, 1, 2].map((k) => (
                  <span key={k} style={{ width: 16, height: 16, borderRadius: 8, background: c.texteDoux, opacity: round(0.35 + 0.65 * Math.abs(Math.sin(((image - debut) / 8 + k * 0.6) * 1.2))) }} />
                ))}
              </div>
            ) : (
              <div style={{ ...apparition(image, debut + ecrit, 12), padding: "24px 32px", borderRadius: client ? "32px 32px 32px 10px" : "32px 32px 10px 32px", background: client ? c.panneauRelief : c.accent, color: client ? c.texte : c.fond, fontSize: 36, fontWeight: 600, lineHeight: 1.3, boxShadow: `0 10px 30px ${avecOpacite(c.texte, 0.08)}` }}>{m.texte}</div>
            )}
          </div>
        );
      })}
    </div>
  );
}
