import React from "react";
/**
 * 5. LogoOutil — l'outil nommé et son rôle : tuile BLANC 180 px (logo ou pictogramme) + nom dessous (Montserrat 900, 36) + étiquette de rôle ACCENT_1 à droite avec icône.
 * Gabarit M1 (tuile x 0,10-0,30 ; rôle x 0,34-0,86). Déroulé : 0 tuile POP depuis un point (0,1 → 1) · 4 nom · instants.role étiquette de rôle s'étire ·
 * les deux sortent ensemble en S-RETRECIT 3 i. Un vrai logo tiers se passe en `logo` (sinon pictogramme maison : aucune marque reproduite).
 */
import { useCurrentFrame } from "remotion";
import { Anim, BAS_M1, COULEURS, LogoClaude, Picto, Plaque, Son, SurEtiquette, Tuile, W, accents, entreeEtire, entreePop, corpsPour } from "./commun-lot1";
import type { NomPicto, Palette } from "./commun-lot1";
import type { ReactNode } from "react";

export type LogoOutilProps = {
  palette: Palette;
  nom: string;
  role: string;
  /** Vrai logo (ReactNode, 126 px de côté) ; à défaut un pictogramme. */
  logo?: ReactNode;
  /** Rang de l'outil (« OUTIL 1/2 ») : sur-étiquette ENCRE sur le coin de la plaque de rôle. */
  rang?: string;
  picto?: NomPicto | "claude";
  pictoRole?: NomPicto;
  /** Image du mot de rôle (« rédacteur ») depuis i0. */
  instantRole?: number;
  sortie?: number;
  muet?: boolean;
};
export const DUREE_DEFAUT = 42;
export const evenements = (p: Pick<LogoOutilProps, "instantRole" | "sortie">): number[] => [0, 4, p.instantRole ?? 8, (p.instantRole ?? 8) + 5, p.sortie ?? 36];

export function LogoOutil({ palette, nom, role, logo, rang, picto = "etoile", pictoRole = "plume", instantRole = 8, sortie = 36, muet }: LogoOutilProps) {
  const i = useCurrentFrame();
  const { ACCENT_1 } = accents(palette);
  const tuile = entreePop(i, { incl: -3, depart: 0.1, sortie });
  const nomEtat = entreePop(i - 4, { depart: 0.6, sortie });
  const roleEtat = entreeEtire(i - instantRole, { sortie: sortie - instantRole });
  const icone = entreePop(i - instantRole - 4, { depart: 0.2, sortie: sortie - instantRole - 4 });
  const haut = BAS_M1 - 180 - 64;
  const corpsRole = corpsPour([role], 0.6 * W - 150, 60, 40);
  return (
    <>
      <div style={{ position: "absolute", left: 0.12 * W, top: haut }}>
        <Anim etat={tuile} origine="50% 50%">
          <Tuile taille={180}>{logo ?? (picto === "claude" ? <LogoClaude taille={126} /> : <Picto nom={picto} taille={126} fond={ACCENT_1} />)}</Tuile>
        </Anim>
        <Anim etat={nomEtat} origine="50% 0%" style={{ width: 180, display: "flex", justifyContent: "center", marginTop: 14 }}>
          <Plaque fond={COULEURS.ENCRE} texte={COULEURS.BLANC} corps={36} interl={0.03} style={{ padding: "6px 14px" }}>{nom}</Plaque>
        </Anim>
      </div>
      <Anim etat={roleEtat} origine="0% 50%" style={{ position: "absolute", left: 0.34 * W, top: haut + 40 }}>
        <Plaque fond={ACCENT_1} corps={corpsRole} style={{ transform: "rotate(-1.5deg)", gap: 14, height: 112, position: "relative" }}>
          {rang ? <SurEtiquette texte={rang} corps={34} style={{ left: 0.02 * W, top: -58 }} /> : null}
          <Anim etat={icone}><Picto nom={pictoRole} taille={Math.max(44, corpsRole)} fond={COULEURS.BLANC} /></Anim>
          <span>{role}</span>
        </Plaque>
      </Anim>
      {!muet && <Son t={0} fichier="select_001" volume={0.2} />}
      {!muet && <Son t={instantRole} fichier="select_002" volume={0.14} />}
    </>
  );
}
