import type { ParametresPiece } from "../catalogue";
import { TOILES } from "../toiles";
import { decelerer, progression } from "../../jetons-motion";
import { BOITE_INCLUSE, apparition, palette, RACINE, round, type ProprietesBrique } from "./communs";

type P = ParametresPiece<"legende">;

/** Texte à l'écran : bandeau, étiquette ou titre ; fondu glissé et filet d'accent qui s'allonge. */
export function Legende({ image, fond, accent, parametres: p }: ProprietesBrique<P>) {
  const c = palette(fond, accent);
  const { largeur, hauteur } = TOILES.legende;
  const filet = progression(image, 8, 18, decelerer);
  const taille = p.style === "titre" ? 84 : p.style === "bandeau" ? 58 : 40;
  const bandeau = p.style === "bandeau";
  return (
    <div style={{ ...RACINE, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div
        style={{
          ...apparition(image, 0, 14, 28),
          maxWidth: largeur - 40,
          maxHeight: hauteur - 20,
          ...BOITE_INCLUSE,
          padding: bandeau ? "30px 44px" : p.style === "etiquette" ? "16px 30px" : 0,
          borderRadius: p.style === "etiquette" ? 999 : 28,
          background: bandeau ? c.texte : p.style === "etiquette" ? c.panneau : "transparent",
          boxShadow: p.style === "etiquette" ? `0 0 0 2px ${c.filet}` : "none",
          textAlign: "center",
        }}
      >
        <div style={{ fontSize: taille, fontWeight: 800, lineHeight: 1.12, letterSpacing: "-0.02em", color: bandeau ? c.fond : c.texte }}>{p.texte}</div>
        {p.sousTexte && <div style={{ marginTop: 10, fontSize: Math.round(taille * 0.5), fontWeight: 500, color: bandeau ? c.fond : c.texteDoux }}>{p.sousTexte}</div>}
        {p.style !== "etiquette" && <div style={{ margin: "16px auto 0", height: 6, borderRadius: 3, width: round(160 * filet), background: c.accent }} />}
      </div>
    </div>
  );
}
