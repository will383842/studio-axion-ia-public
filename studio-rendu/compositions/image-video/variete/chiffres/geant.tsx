import React from "react";
/**
 * CHI-D · Chiffre géant (maquettes CHI-D-1, CHI-D-2, R45-CHI-D-1) : sur nuit, le chiffre occupe l'écran, il entre
 * lettre par lettre ; un filet se trace dessous, avec la légende. Appoint : le cadran, socle du chiffre. Quand le
 * chiffre suivant arrive, il rapetisse vers le haut et les autres se rangent dessous (`corps.tsx`).
 */
import type { DonneesEcranChiffresRendu } from "./donnees";
import { a, ANTON, Appoint, C, c01, chasseAnton, contreEchelle, doux, INTER, progres, pt, type CadreChiffres } from "./outils";

/** Chasse d'une ligne du géant : « % » y est dessiné à 0,62 de la taille. */
const chasseLigne = (l: string) => chasseAnton(l.replace("%", "")) + (l.includes("%") ? 0.75 * 0.62 : 0);

/**
 * Disposition du géant. Deux lignes (« 24h » / « /24 ») : sous la limite haute, comme la maquette, légende en Inter.
 * Une ligne (« 80 % ») : la légende passe en capitales Anton ivoire (≤ 2 lignes) pour tenir la hauteur ; le bloc est
 * centré dans la hauteur du contenu.
 */
export function planGeant(d: DonneesEcranChiffresRendu, cadre: CadreChiffres) {
  const lignes = d.geant?.lignes ?? [d.chiffres[d.focal].texte];
  const legende = d.geant ? d.geant.legende : d.chiffres[d.focal].legende;
  const hauteurDispo = cadre.bas - cadre.haut;
  // Largeur du texte : 9:16, x 66 → 966 ; 4:5, x 66 → 1006 (le texte va jusqu'à x = 1020 en 4:5).
  const large = cadre.appoint ? 900 : 940;
  if (lignes.length > 1) {
    const taille = Math.min(cadre.appoint ? 470 : 440, ...lignes.map((l) => large / chasseLigne(l)));
    const pas = taille * 0.92;
    const haut = cadre.appoint ? 272 : 150;
    return { lignes, legende, taille, pas, haut, filet: haut + lignes.length * pas + 24, legendeAnton: null };
  }
  // Légende Anton : la plus grande taille (≤ 150) qui tient en 2 lignes de 900 px.
  const motsLegende = legende ? legende.toUpperCase().split(/\s+/) : [];
  let legendeAnton: { lignes: string[]; taille: number } | null = null;
  if (motsLegende.length) {
    const coupe = motsLegende.length === 1 ? [motsLegende.join(" ")] : [motsLegende.slice(0, Math.ceil(motsLegende.length / 2)).join(" "), motsLegende.slice(Math.ceil(motsLegende.length / 2)).join(" ")];
    const une = motsLegende.join(" ");
    const tUne = Math.min(150, large / chasseAnton(une));
    const tDeux = Math.min(150, ...coupe.map((l) => large / chasseAnton(l)));
    legendeAnton = tUne >= tDeux * 0.9 ? { lignes: [une], taille: tUne } : { lignes: coupe, taille: tDeux };
  }
  const hLegende = legendeAnton ? 40 + legendeAnton.lignes.length * legendeAnton.taille * 1.02 : 0;
  const taille = Math.min(large / chasseLigne(lignes[0]), (hauteurDispo - 40 - hLegende) / 0.95);
  const pas = taille * 0.92;
  const bloc = pas + 24 + hLegende;
  // 4:5 : centré entre le haut utile (54) et le bas utile (1215) moins la bande des sous-titres (1042 → 1176), pour
  // que le vide au-dessus et le vide au-dessous (bande sautée) soient égaux.
  const haut = cadre.appoint ? cadre.haut + Math.max(0, (hauteurDispo - bloc) / 2) : (54 + 1042 + (1215 - 1176) - bloc) / 2;
  return { lignes, legende, taille, pas, haut, filet: haut + pas + 24, legendeAnton };
}

export function Geant({ d, t, t0, cadre, discret = 0, echelle = 1 }: { d: DonneesEcranChiffresRendu; t: number; t0: number; cadre: CadreChiffres; discret?: number; echelle?: number }) {
  const g = planGeant(d, cadre);
  const trace = doux(progres(t, t0 + 0.35, 1.2));
  const entreeLegende = doux(progres(t, t0 + 0.2, 0.3));
  let rang = 0;
  return (
    <>
      {g.lignes.map((l, i) => (
        <div key={i} style={{ position: "absolute", left: 66, top: g.haut + i * g.pas, ...ANTON, fontSize: g.taille, lineHeight: 0.9, color: C.orangeVif, whiteSpace: "nowrap", textShadow: i === 0 ? `0 0 90px ${a(C.orangeVif, 0.3)}` : undefined }}>
          {[...l].map((ch, k) => {
            // Lettre par lettre : chaque signe claque 0,06 s après le précédent ; « % » plus petit.
            const u = progres(t, t0 + 0.06 * rang++, 0.22);
            return (
              <span key={k} style={{ display: "inline-block", whiteSpace: "pre", fontSize: ch === "%" ? "0.62em" : undefined, opacity: c01(u * 3), transform: `translateY(${(1 - doux(u)) * 0.1 * g.taille}px) scale(${1.1 - 0.1 * doux(u)})`, transformOrigin: "50% 100%" }}>
                {ch}
              </span>
            );
          })}
        </div>
      ))}
      <div style={{ position: "absolute", left: 66, top: g.filet, width: 900 * trace, height: 6, background: a(C.orangeVif, 0.6), borderRadius: 3 }} />
      {trace < 1 ? <div style={{ position: "absolute", left: 66 + 900 * trace - 9, top: g.filet - 6, width: 18, height: 18, borderRadius: "50%", background: C.orangeVif }} /> : null}
      {g.legendeAnton ? (
        <div style={{ position: "absolute", left: 70, top: g.filet + 40, ...ANTON, fontSize: g.legendeAnton.taille, lineHeight: 1.02, color: C.ivoire, opacity: entreeLegende, transform: `translateY(${(1 - entreeLegende) * 30}px)` }}>
          {g.legendeAnton.lignes.map((l, i) => (
            <div key={i} style={{ whiteSpace: "nowrap" }}>{l}</div>
          ))}
        </div>
      ) : g.legende ? (
        <div style={{ position: "absolute", left: 72, width: 936, top: g.filet + 40, ...INTER, fontSize: 72, color: C.ivoire, opacity: entreeLegende, ...contreEchelle(echelle, "50% 0%") }}>{g.legende}</div>
      ) : null}
    </>
  );
}

/** Appoint du géant : le cadran (24 graduations), anneau plein qui monte du bas. */
export function AppointGeant({ t, t0, cadre }: { t: number; t0: number; cadre: CadreChiffres }) {
  const cx = 540;
  const cy = 1866 + (1 - doux(progres(t, t0 + 0.2, 0.6))) * 120;
  const r = 520;
  const ep = 90;
  const r0 = r - ep / 2 - 20;
  return (
    <Appoint cadre={cadre}>
      <svg width={1080} height={cadre.hauteur} style={{ position: "absolute", left: 0, top: 0 }}>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke={C.orangeVif} strokeWidth={ep} />
        {Array.from({ length: 24 }, (_, h) => {
          const [x0, y0] = pt(cx, cy, r0, h * 15);
          const [x1, y1] = pt(cx, cy, r0 - (h % 6 === 0 ? 70 : 36), h * 15);
          return <path key={h} d={`M${x0.toFixed(1)} ${y0.toFixed(1)}L${x1.toFixed(1)} ${y1.toFixed(1)}`} stroke={a(C.ivoire, h % 6 === 0 ? 0.9 : 0.55)} strokeWidth={h % 6 === 0 ? 10 : 7} strokeLinecap="round" />;
        })}
      </svg>
    </Appoint>
  );
}
