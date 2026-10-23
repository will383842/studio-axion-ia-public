import React from "react";
/**
 * Pièces des maquettes de variété (lot L1) : fonds (dont le 3ᵉ fond terracotta), marque, texte d'affiche mot par mot
 * aligné à volonté, étiquette, ligne, pilule, sous-titre d'illustration et objet de la banque posé dans une boîte.
 * Prototypes : réutilisent la charte `charte-duo/1`, le fond, la marque et le mot par mot du format, sans les modifier.
 */
import { AbsoluteFill } from "remotion";
import type { CSSProperties, ReactNode } from "react";
import { motsBalises, type Fond as NomFond, type IdObjet } from "../../../../src/briques/ecrans-motion";
import { COULEURS_DUO, TAILLES_DUO } from "../../../../src/briques/habillage/charte-duo";
import { OBJETS } from "../objets/registre";
import { couleursDuFond, doux, famille, graisse, planBiais, planEntreeObjet, planMotParMot, progres, teinte } from "../plans/commun";
import { Fond } from "../socle/Fond";
import { boiteMarque, CENTRE_SOUS_TITRES_PX } from "./donnees";

/** Fond d'une maquette : les deux fonds du format, ou le 3ᵉ fond « terracotta » plein (moment fort, à valider). */
export type FondMaquette = NomFond | "terracotta";

/** Couleurs d'un fond de maquette : texte, accent (mot fort), secondaire, marque. */
export function couleursMaquette(fond: FondMaquette) {
  if (fond === "terracotta") return { texte: COULEURS_DUO.ivoireHaut, accent: COULEURS_DUO.nuit, secondaire: COULEURS_DUO.ivoire, marque: COULEURS_DUO.blanc, lueur: teinte(COULEURS_DUO.nuit, 0) };
  const c = couleursDuFond(fond);
  return { texte: c.texte, accent: c.accent, secondaire: c.secondaire, marque: c.marque, lueur: c.lueur };
}

export function FondMaquette({ fond }: { fond: FondMaquette }) {
  if (fond !== "terracotta") return <Fond fond={fond} largeur={1080} hauteur={1920} />;
  const image = `radial-gradient(1000px 1100px at 50% 42%, ${COULEURS_DUO.orangeVif} 0%, ${COULEURS_DUO.orange} 62%, ${teinte(COULEURS_DUO.nuitLueur, 1)} 120%)`;
  return <AbsoluteFill style={{ backgroundColor: COULEURS_DUO.orange, backgroundImage: image }} />;
}

/** La marque « axion-ia.com », à la même place que dans les écrans du format. */
export function MarqueMaquette({ fond }: { fond: FondMaquette }) {
  const b = boiteMarque();
  return (
    <div style={{ position: "absolute", left: b.x, top: b.y, width: b.largeur, height: b.hauteur, textAlign: "center", fontFamily: famille("inter-gras"), fontWeight: graisse("inter-gras"), fontSize: TAILLES_DUO.marque * 1920, letterSpacing: "0.083em", color: couleursMaquette(fond).marque, whiteSpace: "nowrap" }}>
      axion-ia.com
    </div>
  );
}

/**
 * Texte d'affiche (Anton, capitales) écrit mot par mot (grammaire du format : montée, flou), mots `*balisés*` dans la
 * couleur d'accent. `alignement` : centré (v4) ou à gauche ; le texte n'est jamais rogné (il peut sortir du cadre).
 */
export function Affiche({
  lignes,
  fond,
  x,
  y,
  largeur,
  taille,
  ecoule,
  alignement = "center",
  interligne = 0.98,
  pas = 0.09,
  lueur = false,
  couleurAccent,
}: {
  lignes: string[];
  fond: FondMaquette;
  x: number;
  y: number;
  largeur: number;
  taille: number;
  ecoule: number;
  alignement?: "center" | "left";
  interligne?: number;
  pas?: number;
  lueur?: boolean;
  couleurAccent?: string;
}) {
  const c = couleursMaquette(fond);
  // Rang du premier mot de chaque ligne (le mot par mot court sur toutes les lignes, dans l'ordre).
  const departs = lignes.map((_, li) => lignes.slice(0, li).reduce((n, l) => n + motsBalises(l).length, 0));
  return (
    <div style={{ position: "absolute", left: x, top: y, width: largeur, textAlign: alignement, fontFamily: famille("anton"), fontWeight: graisse("anton"), fontSize: taille, lineHeight: interligne, textTransform: "uppercase", color: c.texte, whiteSpace: "nowrap", overflow: "visible" }}>
      {lignes.map((ligne, li) => {
        const debut = departs[li];
        const mots = planMotParMot(ligne, ecoule - debut * pas, pas);
        return (
          <div key={li}>
            {mots.map((m, i) => (
              <span key={i}>
                {i > 0 ? " " : null}
                <span
                  style={{
                    display: "inline-block",
                    opacity: m.opacite,
                    transform: `translateY(${m.decalageY}px)`,
                    filter: m.flou ? `blur(${m.flou}px)` : "none",
                    color: m.accent ? (couleurAccent ?? c.accent) : undefined,
                    textShadow: lueur && m.accent ? `0 0 ${taille * 0.18}px ${teinte(COULEURS_DUO.orangeVif, 0.7)}, 0 0 ${taille * 0.5}px ${teinte(COULEURS_DUO.orangeVif, 0.4)}` : "none",
                  }}
                >
                  {m.mot}
                </span>
              </span>
            ))}
          </div>
        );
      })}
    </div>
  );
}

/** Étiquette en capitales espacées (Inter Bold), couleur d'accent du fond. */
export function EtiquetteMaquette({ texte, fond, x, y, largeur, alignement = "center", couleur }: { texte: string; fond: FondMaquette; x: number; y: number; largeur: number; alignement?: "center" | "left"; couleur?: string }) {
  return (
    <div style={{ position: "absolute", left: x, top: y, width: largeur, textAlign: alignement, fontFamily: famille("inter-gras"), fontWeight: graisse("inter-gras"), fontSize: 34, letterSpacing: "0.22em", textTransform: "uppercase", color: couleur ?? couleursMaquette(fond).accent, whiteSpace: "nowrap" }}>
      {texte}
    </div>
  );
}

/** Ligne de texte (Inter Bold) qui monte de 20 px en 0,3 s. */
export function LigneMaquette({ texte, fond, x, y, largeur, t, debut, taille = 44, alignement = "center", couleur }: { texte: string; fond: FondMaquette; x: number; y: number; largeur: number; t: number; debut: number; taille?: number; alignement?: "center" | "left"; couleur?: string }) {
  const v = progres(t, debut, 0.3);
  return (
    <div style={{ position: "absolute", left: x, top: y, width: largeur, textAlign: alignement, fontFamily: famille("inter-gras"), fontWeight: graisse("inter-gras"), fontSize: taille, lineHeight: 1.25, whiteSpace: "pre-line", color: couleur ?? couleursMaquette(fond).secondaire, opacity: v, transform: `translateY(${(1 - doux(v)) * 20}px)` }}>
      {texte}
    </div>
  );
}

/** Pilule (pastille de texte) : fond plein, texte Inter Bold. */
export function Pilule({ children, x, y, fond, couleur, taille = 40, style }: { children: ReactNode; x: number; y: number; fond: string; couleur: string; taille?: number; style?: CSSProperties }) {
  return (
    <div style={{ position: "absolute", left: x, top: y, padding: `${taille * 0.42}px ${taille * 0.8}px`, borderRadius: taille * 2, background: fond, color: couleur, fontFamily: famille("inter-gras"), fontWeight: graisse("inter-gras"), fontSize: taille, whiteSpace: "nowrap", boxShadow: `0 ${taille * 0.3}px ${taille * 0.9}px ${teinte(COULEURS_DUO.nuit, 0.28)}`, ...style }}>
      {children}
    </div>
  );
}

/**
 * Sous-titre d'illustration (style du format : Inter Bold blanc, contour sombre, mot fort orange), à la hauteur réelle
 * des sous-titres (≈ 85 %). Montré pour juger l'équilibre de l'image ; jamais sur un titre.
 */
export function SousTitre({ texte, fond }: { texte: string; fond: FondMaquette }) {
  const encre = fond === "ivoire";
  return (
    <div style={{ position: "absolute", left: 60, width: 960, top: CENTRE_SOUS_TITRES_PX - 36, textAlign: "center", fontFamily: famille("inter-gras"), fontWeight: graisse("inter-gras"), fontSize: 50, lineHeight: 1.2, color: encre ? COULEURS_DUO.encre : COULEURS_DUO.blanc }}>
      {motsBalises(texte).map((m, i) => (
        <span key={i}>
          {i > 0 ? " " : null}
          <span style={{ color: m.accent ? (fond === "terracotta" ? COULEURS_DUO.nuit : encre ? COULEURS_DUO.orange : COULEURS_DUO.orangeVif) : undefined, textDecoration: m.accent ? "underline" : "none", textDecorationThickness: 5, textUnderlineOffset: 10 }}>{m.mot}</span>
        </span>
      ))}
    </div>
  );
}

/** Un objet de la banque (`objets/registre.ts`) posé dans une boîte, avec son entrée et son biais 3D lent. */
export function ObjetPose({ objet, textes, fond, x, y, largeur, hauteur, t, rotY = -9, rotX = 4, debut = 0 }: { objet: IdObjet; textes?: string[]; fond: NomFond; x: number; y: number; largeur: number; hauteur: number; t: number; rotY?: number; rotX?: number; debut?: number }) {
  const Visuel = OBJETS[objet];
  const e = planEntreeObjet(progres(t, debut, 0.5));
  const b = planBiais(t, rotY, rotX);
  return (
    <div style={{ position: "absolute", left: x, top: y, width: largeur, height: hauteur, opacity: e.opacite, transform: `translateY(${e.decalageY}px) scale(${e.echelle}) perspective(${b.perspective}px) rotateY(${b.rotY}deg) rotateX(${b.rotX}deg)` }}>
      <Visuel boite={{ x: 0, y: 0, largeur, hauteur }} t={t - debut} tVideo={t} fond={fond} textes={textes} />
    </div>
  );
}

/** Particules orange douces (fond sombre) : positions fixes, pour la profondeur. */
export function Particules({ graine = 3 }: { graine?: number }) {
  const points = Array.from({ length: 14 }, (_, i) => {
    const a = (i * 137.5 + graine * 41) % 360;
    const r = 0.18 + ((i * 53 + graine * 17) % 100) / 260;
    return { x: 540 + Math.cos((a * Math.PI) / 180) * r * 1080, y: 1250 + Math.sin((a * Math.PI) / 180) * r * 1300, d: 4 + ((i * 7) % 6) };
  });
  return (
    <AbsoluteFill>
      {points.map((p, i) => (
        <div key={i} style={{ position: "absolute", left: p.x, top: p.y, width: p.d, height: p.d, borderRadius: p.d, background: COULEURS_DUO.orangeVif, opacity: 0.35, boxShadow: `0 0 ${p.d * 3}px ${teinte(COULEURS_DUO.orangeVif, 0.6)}` }} />
      ))}
    </AbsoluteFill>
  );
}
