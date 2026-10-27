import React from "react";
/**
 * Pièces communes des écrans de texte de la variété (TYP-B, C, D) : fond de la charte et marque, couleurs selon le
 * fond, carte d'appoint (zone y 1306 → 1520, sous les sous-titres, sans mot), points de saisie. Aucun JSX ni calcul
 * au niveau module.
 */
import { AbsoluteFill } from "remotion";
import { COULEURS_DUO } from "../../../../../src/briques/habillage/charte-duo";
import { FondIV } from "../fond/FondVarie";
import { FAMILLE_ANTON } from "../../../commune/polices";
import { Icone } from "../../../interface-claire/elements";
import { Entete } from "../../Entete";

export const C = COULEURS_DUO;
export type FondTexte = "ivoire" | "sombre";

/** Teinte avec opacité (#RRGGBBAA). */
export const teinteA = (c: string, o: number) => `${c}${Math.round(Math.max(0, Math.min(1, o)) * 255).toString(16).padStart(2, "0")}`;
/** Couleur du texte et de l'accent (mot orange) selon le fond (contraste du standard). */
export const encreDe = (f: FondTexte) => (f === "sombre" ? C.ivoire : C.encre);
export const accentDe = (f: FondTexte) => (f === "sombre" ? C.orangeVif : C.orange);

/** Style d'affiche : Anton en capitales. */
export const styleAnton = (taille: number, couleur: string): React.CSSProperties => ({ fontFamily: FAMILLE_ANTON, fontWeight: 400, textTransform: "uppercase", fontSize: taille, lineHeight: 1, color: couleur, whiteSpace: "nowrap" });

/** Fond de la charte, contenu, puis marque par-dessus. */
export function CadreTexte({ fond, largeur, hauteur, marque, children }: { fond: FondTexte; largeur: number; hauteur: number; marque: "axion-ia.com"; children?: React.ReactNode }) {
  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      <FondIV fond={fond} largeur={largeur} hauteur={hauteur} />
      {children}
      <Entete entete={null} ecoule={0} sortie={0} fond={fond} marque={marque} largeur={largeur} hauteur={hauteur} />
    </AbsoluteFill>
  );
}

/** Trois points de saisie qui battent (contenu muet d'une carte). */
export function Points({ taille, couleur, t }: { taille: number; couleur: string; t: number }) {
  return (
    <div style={{ display: "flex", gap: taille * 0.55 }}>
      {[0, 1, 2].map((i) => (
        <div key={i} style={{ width: taille, height: taille, borderRadius: "50%", background: couleur, opacity: 0.3 + 0.7 * (0.5 + 0.5 * Math.cos(2 * Math.PI * (t * 1.6 - i / 3))) }} />
      ))}
    </div>
  );
}

/**
 * Carte d'appoint PLEINE (vraie carte du schéma, opaque, sans texte) : pastille de l'icône de la carte, points de
 * saisie. Elle monte du bas à l'entrée de l'écran, et s'efface en fondu avant y = bas (interface des réseaux).
 */
export function CarteAppoint({ y, h, fond, icone, t }: { y: number; h: number; fond: FondTexte; icone: string; t: number }) {
  const d = Math.round(h * 0.62);
  const entree = Math.min(1, Math.max(0, t / 0.35));
  const montee = (1 - (1 - entree) ** 3) * 1;
  const masque = `linear-gradient(180deg, black ${y + h - 30}px, transparent ${y + h}px)`;
  return (
    <div style={{ position: "absolute", left: 0, top: 0, width: 1080, height: y + h, maskImage: masque, WebkitMaskImage: masque }}>
      <div
        style={{
          position: "absolute",
          left: 150,
          top: y + (1 - montee) * 60,
          width: 780,
          height: h,
          opacity: montee,
          boxSizing: "border-box",
          borderRadius: 40,
          background: C.blanc,
          border: fond === "ivoire" ? `6px solid ${C.encre}` : undefined,
          display: "flex",
          alignItems: "center",
          gap: 34,
          paddingLeft: (h - d) / 2,
          boxShadow: `0 14px 36px ${teinteA(C.encre, 0.1)}`,
        }}
      >
        <div style={{ width: d, height: d, flex: "none", borderRadius: "50%", background: C.encre, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Icone nom={icone} taille={d * 0.52} couleur={C.blanc} epaisseur={2.4} />
        </div>
        <Points taille={24} couleur={C.encre} t={t} />
      </div>
    </div>
  );
}
