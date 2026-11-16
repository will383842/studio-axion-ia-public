/**
 * C8-A04 : carte d'avis client (pièce neuve, non branchée). Rend `null` sans avis, sans texte ou avec une note
 * invalide ; le texte est affiché tel quel. Aucun import par alias ni du dossier domaine (non copié dans l'image de rendu).
 * Couleurs de la charte (ivoire, noir, terracotta), police Manrope.
 */
import type { CSSProperties, ReactElement } from "react";
import { geometrieAvis, type RatioAvis } from "./geometrie-avis";

/** Props structurelles : un `AvisClient` du domaine y est assignable. */
export interface AvisCarte {
  auteur: string;
  note: number;
  texte: string;
  date: string;
  exemple?: boolean;
}

const IVOIRE = "#FAF9F5";
const NOIR = "#141413";
const TERRACOTTA = "#B23F16";
const GRIS = "#E8E6DC";
const MANROPE = '"Axion Manrope Medium", "Manrope", sans-serif';
const MANROPE_GRAS = '"Axion Manrope ExtraBold", "Manrope", sans-serif';

export function CarteAvisClient({ avis, ratio }: { avis?: AvisCarte | null; ratio: RatioAvis }): ReactElement | null {
  if (!avis || typeof avis.texte !== "string" || avis.texte.trim() === "") return null;
  const g = geometrieAvis(ratio, avis.note);
  if (!g) return null;
  const { boite, marge } = g;
  const taille = Math.round(Math.min(boite.largeur, boite.hauteur) * 0.075);
  const style: CSSProperties = {
    position: "absolute", left: boite.x, top: boite.y, width: boite.largeur, height: boite.hauteur, boxSizing: "border-box",
    padding: marge, background: IVOIRE, color: NOIR, border: `4px solid ${GRIS}`, borderRadius: 32, fontFamily: MANROPE,
    display: "flex", flexDirection: "column", justifyContent: "space-between", overflow: "hidden",
  };
  return (
    <div data-avis-client style={style}>
      <div aria-label={`Note ${avis.note} sur 5`} style={{ display: "flex", gap: 8, fontSize: taille * 1.3, lineHeight: 1 }}>
        {[1, 2, 3, 4, 5].map((i) => (
          <span key={i} data-etoile={i <= g.etoilesPleines ? "pleine" : "vide"} style={{ color: i <= g.etoilesPleines ? TERRACOTTA : GRIS }}>
            {i <= g.etoilesPleines ? "★" : "☆"}
          </span>
        ))}
      </div>
      <p style={{ margin: 0, fontSize: taille, lineHeight: 1.3 }}>{avis.texte}</p>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: Math.round(taille * 0.7), fontFamily: MANROPE_GRAS }}>
        <span>{avis.auteur}</span>
        <span>{avis.date}</span>
      </div>
      {avis.exemple === true ? (
        <div data-filigrane style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", transform: "rotate(-20deg)", fontFamily: MANROPE_GRAS, fontSize: taille * 2.2, color: TERRACOTTA, opacity: 0.25, pointerEvents: "none" }}>
          EXEMPLE
        </div>
      ) : null}
    </div>
  );
}
