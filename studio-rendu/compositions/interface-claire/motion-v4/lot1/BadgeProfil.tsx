import React from "react";
/**
 * 4. BadgeProfil — carte de personne : pastille ronde 120 px (INITIALES sur ACCENT_1 — jamais de faux visage) + prénom ou rôle (Montserrat 900, 48)
 * + puce métier (ACCENT_1, 34) + mini-titre « AGENT 3/12 » (décor, Inter 700, 26) ; le « point vert » des références devient un point ACCENT_2.
 * Gabarit M1, 0,48 L × 0,10 H, centré au-dessus de la tête. Déroulé par badge : 0 entre par la gauche (GLISSE) · 5 pastille POP · 8 nom · 16 puce métier
 * s'étire · le badge suivant entre dans l'image où le précédent finit de sortir (S-RETRECIT 3 i). Variante « avant / après » : `avantApres`.
 */
import { useCurrentFrame } from "remotion";
import { Anim, BAS_M1, COULEURS, INTER, MONTSERRAT, Picto, Puce, Son, TRAIT, W, accents, courbe, entreeCote, entreeEtire, entreePop, melange, ressort, ombre, RAYON } from "./commun-lot1";
import type { Palette } from "./commun-lot1";

export type Profil = { nom: string; metier: string; /** « AGENT 1/3 » (décor) */ rang: string };
export type BadgeProfilProps = {
  palette: Palette;
  profils: Profil[];
  /** Durée d'un badge en images, du début de son entrée au début de l'entrée du suivant (défaut 30 = 1 s). */
  pas?: number;
  /** Variante : sur le dernier badge, silhouette GRIS « BASIQUE » → ACCENT_1 « EXPERT » + 5 étoiles qui se remplissent, à l'image `a` du dernier badge. */
  avantApres?: { a: number };
  muet?: boolean;
};
export const DUREE_PAR_BADGE = 30;
export const evenements = (p: Pick<BadgeProfilProps, "profils" | "pas" | "avantApres">): number[] => {
  const pas = p.pas ?? DUREE_PAR_BADGE;
  const e: number[] = [];
  p.profils.forEach((_, k) => e.push(k * pas, k * pas + 3, k * pas + 5, k * pas + 8, k * pas + 14, k * pas + 22));
  if (p.avantApres) e.push((p.profils.length - 1) * pas + p.avantApres.a);
  e.push(p.profils.length * pas - 3);
  return e.sort((a, b) => a - b);
};

function Carte({ palette, profil, i, sortie, k, avantApres }: { palette: Palette; profil: Profil; i: number; sortie: number; k: number; avantApres?: { a: number } }) {
  const { ACCENT_1, ACCENT_2 } = accents(palette);
  const cote = entreeCote(i, -1, { sortie, nSortie: 3, inclFinale: k % 2 === 0 ? -2.5 : 2 });
  const pastille = entreePop(i - 3, { nom: "POP", depart: 0.5 });
  const nom = entreePop(i - 5, { nom: "POP", depart: 0.6 });
  const metier = entreeEtire(i - 8);
  const bascule = avantApres ? courbe(i, avantApres.a, 3) : 0;
  const fondPastille = melange(COULEURS.GRIS, ACCENT_1, avantApres ? bascule : 1);
  const mini = avantApres ? (bascule > 0.5 ? "EXPERT" : "BASIQUE") : profil.metier;
  return (
    <Anim etat={cote} origine="50% 100%" style={{ position: "absolute", left: W / 2 - 0.28 * W + (k % 2 ? 0.03 : -0.03) * W, top: BAS_M1 - 0.115 * 1920 }}>
      <div style={{ boxSizing: "border-box", width: 0.56 * W, height: 0.115 * 1920, background: COULEURS.IVOIRE_CLAIR, border: `${TRAIT.MOYEN}px solid ${COULEURS.ENCRE}`, borderRadius: RAYON.CARTE, boxShadow: ombre("M"), display: "flex", alignItems: "center", gap: 20, padding: "0 20px" }}>
        <Anim etat={pastille} style={{ position: "relative", flex: "none" }}>
          <div style={{ boxSizing: "border-box", width: 136, height: 136, borderRadius: 999, background: fondPastille, border: `${TRAIT.MOYEN}px solid ${COULEURS.ENCRE}`, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: `${MONTSERRAT}, sans-serif`, fontWeight: 900, fontSize: 68, color: COULEURS.ENCRE }}>
            <Picto nom="personne" taille={72} fond={fondPastille} />
          </div>
          <div style={{ position: "absolute", right: -2, bottom: 2, width: 32, height: 32, boxSizing: "border-box", borderRadius: 999, background: ACCENT_2, border: `${TRAIT.FIN}px solid ${COULEURS.ENCRE}` }} />
        </Anim>
        <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-start", minWidth: 0 }}>
          {profil.rang ? <div style={{ fontFamily: `${INTER}, sans-serif`, fontWeight: 700, fontSize: 28, color: COULEURS.ENCRE, letterSpacing: "0.03em", whiteSpace: "nowrap" }}>{profil.rang}</div> : null}
          <Anim etat={nom} origine="0% 50%">
            <div style={{ fontFamily: `${MONTSERRAT}, sans-serif`, fontWeight: 900, fontSize: 56, lineHeight: 1, color: COULEURS.ENCRE, whiteSpace: "nowrap", textTransform: "uppercase" }}>{profil.nom}</div>
          </Anim>
          <Anim etat={metier} origine="0% 50%">
            <Puce fond={ACCENT_1} corps={40} style={{ padding: "5px 20px" }}>
              {avantApres ? (
                <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                  {mini}
                  {bascule > 0.5 ? Array.from({ length: 5 }, (_, s) => <span key={s} style={{ display: "inline-block", transform: `scale(${Math.min(1.2, ressort("POP", i - avantApres.a - 3 - 2 * s))})` }}><Picto nom="etoile" taille={26} fond={COULEURS.BLANC} /></span>) : null}
                </span>
              ) : mini}
            </Puce>
          </Anim>
        </div>
      </div>
    </Anim>
  );
}

export function BadgeProfil({ palette, profils, pas = DUREE_PAR_BADGE, avantApres, muet }: BadgeProfilProps) {
  const i = useCurrentFrame();
  return (
    <>
      {profils.map((p, k) => {
        const local = i - k * pas;
        if (local < 0 || local >= pas) return null;
        return <Carte key={k} palette={palette} profil={p} i={local} sortie={pas - 3} k={k} avantApres={k === profils.length - 1 ? avantApres : undefined} />;
      })}
      {!muet && profils.map((_, k) => <Son key={k} t={k * pas} fichier={k % 2 ? "select_002" : "select_001"} volume={0.18} />)}
    </>
  );
}
