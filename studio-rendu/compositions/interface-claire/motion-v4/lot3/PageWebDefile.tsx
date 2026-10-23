import React from "react";
/**
 * 21 — `PageWebDefile` : la preuve, une page qui défile, standard v4 § F.21 (M4 : x 0,06 → 0,94, y 0,09 → 0,63 H, couvre le visage).
 * Fenêtre de navigateur (3 pastilles ENCRE/ACCENT_1/ACCENT_2, barre d'adresse BLANC) ; E-COTE depuis la droite (visage couvert à i3) ;
 * défilement continu 0,35 H/s ; au mot cité : arrêt 6 i, clic (anneau ACCENT_1 de 0,04 → 0,10 L en 8 i), surlignage ACCENT_1 12 i puis filet ;
 * étiquette « FAIT EN 1 HEURE » en E-POP qui chevauche le bord bas ; sortie S-COTE gauche 4 i.
 * CONTENU : maquette NEUTRE (« VOTRE ENTREPRISE », « votre-site.fr », aucune entreprise ni chiffre inventé) dessinée en CSS. À remplacer par une vraie capture fournie par Will (console Axion-IA) avant diffusion.
 */
import { useCurrentFrame } from "remotion";
import { accents, Anim, COULEURS, courbe, DESCENTE, INTER, MONTSERRAT, ombre, Plaque, RAYON, Son, TRAIT, W } from "./commun-lot3";
import type { ClePrise, Palette } from "./commun-lot3";

export type PropsPageWebDefile = {
  palette: Palette;
  etiquette?: string;
  adresse?: string;
  duree?: number;
  /** Étiquette du 2ᵉ mot fort (posée à `mots[3]`). */
  etiquette2?: string;
  /** Images locales des mots : [fenêtre (0), mot cité → clic, étiquette, 2ᵉ étiquette (facultative)]. */
  mots?: number[];
};

export const dureePageWebDefile = (p: PropsPageWebDefile): number => p.duree ?? 92;
export const clesPrisePageWebDefile = (): ClePrise[] => [{ i: 0, D: 0 }];
const VITESSE = 22.4; // px/i = 0,35 H/s
const I_DEBUT_DEFILE = 3;
const POSE = 6;

export function evenementsPageWebDefile(p: PropsPageWebDefile): number[] {
  const ic = p.mots?.[1] ?? 30, il = p.mots?.[2] ?? ic + 10;
  const ev = [0, 3, 8, 14, 20, 26, ic - 1, ic, ic + 2, ic + POSE, ic + 12, il];
  if (p.mots?.[3] !== undefined) ev.push(p.mots[3] - 3, p.mots[3]);
  for (let t = il + 6; t < dureePageWebDefile(p) - 4; t += 12) ev.push(t);
  return [...ev, dureePageWebDefile(p) - 4];
}

const X = 80, Y = 173, LF = 920, HF = 1037;
const BARRE = 84;

/** Défilement (px) : constant, avec un arrêt de 6 i au clic. */
function defile(i: number, ic: number): number {
  const k = Math.max(0, i - I_DEBUT_DEFILE);
  const arret = Math.max(0, Math.min(POSE, i - ic));
  return VITESSE * Math.max(0, k - arret);
}

export function PageWebDefile(props: PropsPageWebDefile) {
  const i = useCurrentFrame();
  const { palette, etiquette = "FAIT EN 1 HEURE", etiquette2 = "TOUT SEUL", adresse = "votre-site.fr" } = props;
  const { ACCENT_1, ACCENT_2 } = accents(palette);
  const E = COULEURS.ENCRE;
  const ic = props.mots?.[1] ?? 30, il = props.mots?.[2] ?? ic + 10, il2 = props.mots?.[3];
  const duree = dureePageWebDefile(props);
  const iS = duree - 4;
  const s = defile(i, ic);
  const sStop = defile(ic, ic);
  const yCible = sStop + 560; // ligne citée : à 560 px du haut de la zone, au moment de l'arrêt
  const surligne = courbe(i, ic + 2, 1);
  const surFond = i >= ic + 2 && i < ic + 14;
  const filet = i >= ic + 14;
  // curseur : arrive du bas-droit vers la ligne citée
  const cx0 = 760, cy0 = 880, cx1 = 330, cy1 = 560 + 26;
  const pc = courbe(i, ic - 14, 14, (x) => 1 - Math.pow(1 - x, 3));
  // après le clic le curseur flotte (geste de vie : jamais figé)
  const flotte = i > ic + 8 ? Math.sin(((i - ic) * Math.PI) / 6) : 0;
  const curseurX = cx0 + (cx1 - cx0) * pc + 6 * flotte, curseurY = cy0 + (cy1 - cy0) * pc + 9 * flotte;
  const clic = courbe(i, ic, 8);
  const sons: React.ReactNode[] = [<Son key="w" i0={0} fichier="whoosh-in" volume={0.45} />, <Son key="c" i0={ic} fichier="click_002" volume={0.5} />, <Son key="t" i0={il} fichier="select_001" volume={0.3} />, ...(il2 !== undefined ? [<Son key="t2" i0={il2} fichier="select_002" volume={0.3} />] : [])];

  const bloc = (k: number) => {
    const top = 760 + k * 330;
    return (
      <div key={k} style={{ position: "absolute", left: 40, right: 40, top, height: 280, display: "flex", gap: 24 }}>
        {[0, 1, 2].map((c) => (
          <div key={c} style={{ flex: 1, boxSizing: "border-box", border: `${TRAIT.FIN}px solid ${E}`, borderRadius: RAYON.CARTE, background: c % 2 ? COULEURS.BLANC : COULEURS.IVOIRE, padding: 18, position: "relative" }}>
            <div style={{ width: 70, height: 70, borderRadius: 16, border: `${TRAIT.FIN}px solid ${E}`, background: [ACCENT_1, ACCENT_2, COULEURS.GRIS][(c + k) % 3], boxSizing: "border-box" }} />
            <div style={{ marginTop: 18, height: 18, width: "80%", background: E, borderRadius: 4 }} />
            <div style={{ marginTop: 12, height: 12, width: "95%", background: COULEURS.GRIS, borderRadius: 4 }} />
            <div style={{ marginTop: 10, height: 12, width: "70%", background: COULEURS.GRIS, borderRadius: 4 }} />
          </div>
        ))}
      </div>
    );
  };

  return (
    <>
      {sons}
      <Anim i={i} i0={0} iSortie={iS} sortie="coteG" entree="coteD" incl={-2} x={X} y={Y} w={LF} h={HF} z={4} id="fenetre-web">
        <div style={{ position: "relative", width: LF, height: HF, boxSizing: "border-box", border: `${TRAIT.FORT}px solid ${E}`, borderRadius: RAYON.FENETRE, boxShadow: ombre("L"), background: COULEURS.IVOIRE_CLAIR, overflow: "hidden" }}>
          {/* barre de titre du navigateur */}
          <div style={{ position: "absolute", left: 0, right: 0, top: 0, height: BARRE, boxSizing: "border-box", background: COULEURS.IVOIRE, borderBottom: `${TRAIT.MOYEN}px solid ${E}`, display: "flex", alignItems: "center", gap: 14, padding: "0 24px", zIndex: 5 }}>
            {[E, ACCENT_1, ACCENT_2].map((c, k) => <div key={k} style={{ width: 22, height: 22, borderRadius: 11, background: c, border: `${TRAIT.FIN}px solid ${E}`, boxSizing: "border-box" }} />)}
            <div style={{ marginLeft: 14, flex: 1, height: 46, boxSizing: "border-box", background: COULEURS.BLANC, border: `${TRAIT.FIN}px solid ${E}`, borderRadius: 23, display: "flex", alignItems: "center", paddingLeft: 22, fontFamily: INTER, fontWeight: 600, fontSize: 26, color: E }}>{adresse}</div>
          </div>
          {/* page qui défile (capture factice) */}
          <div style={{ position: "absolute", left: 0, right: 0, top: BARRE, bottom: 0, overflow: "hidden" }}>
            <div style={{ position: "absolute", left: 0, right: 0, top: -s, height: 4600 }}>
              <div style={{ position: "absolute", left: 0, right: 0, top: 0, height: 96, background: COULEURS.BLANC, borderBottom: `${TRAIT.FIN}px solid ${E}`, display: "flex", alignItems: "center", padding: "0 36px", gap: 30, fontFamily: INTER, fontWeight: 700, fontSize: 28, color: E }}>
                <div style={{ fontFamily: MONTSERRAT, fontWeight: 900, fontSize: 36 }}>VOTRE ENTREPRISE</div>
                <div style={{ flex: 1 }} /> <span>Services</span><span>Réalisations</span><span>Contact</span>
              </div>
              <div style={{ position: "absolute", left: 40, top: 150, width: 560, fontFamily: MONTSERRAT, fontWeight: 900, fontSize: 70, lineHeight: 1.02, color: E }}>VOTRE PROJET, CLÉ EN MAIN</div>
              <div style={{ position: "absolute", left: 40, top: 360, width: 520, fontFamily: INTER, fontWeight: 600, fontSize: 30, color: E }}>Décrivez ici votre activité en une phrase.</div>
              <div style={{ position: "absolute", left: 40, top: 450, padding: "16px 30px", background: ACCENT_1, border: `${TRAIT.MOYEN}px solid ${E}`, borderRadius: RAYON.PLAQUE, boxShadow: ombre("S"), fontFamily: MONTSERRAT, fontWeight: 900, fontSize: 30, color: E }}>VOIR NOS SERVICES</div>
              <div style={{ position: "absolute", right: 36, top: 140, width: 270, height: 340, background: ACCENT_1, border: `${TRAIT.MOYEN}px solid ${E}`, borderRadius: RAYON.CARTE, boxShadow: ombre("M"), boxSizing: "border-box" }}>
                <div style={{ position: "absolute", left: 40, top: 60, width: 190, height: 190, borderRadius: "50%", background: COULEURS.BLANC, border: `${TRAIT.MOYEN}px solid ${E}`, boxSizing: "border-box" }} />
                <div style={{ position: "absolute", left: 80, top: 100, width: 110, height: 110, background: ACCENT_2, border: `${TRAIT.MOYEN}px solid ${E}`, borderRadius: 14, boxSizing: "border-box", transform: "rotate(12deg)" }} />
              </div>
              {Array.from({ length: 10 }, (_, k) => bloc(k))}
              {/* bloc d'appel posé à la hauteur d'arrêt : la ligne citée y est intégrée (rien ne « flotte ») */}
              <div style={{ position: "absolute", left: 24, right: 24, top: yCible - 62, height: 206, boxSizing: "border-box", border: `${TRAIT.MOYEN}px solid ${E}`, borderRadius: RAYON.CARTE, background: COULEURS.IVOIRE, boxShadow: ombre("S"), zIndex: 2 }}>
                <div style={{ position: "absolute", left: 28, top: 14, fontFamily: MONTSERRAT, fontWeight: 900, fontSize: 30, color: E }}>VOTRE DEVIS</div>
              </div>
              <div style={{ position: "absolute", left: 48, right: 48, top: yCible, height: 78, boxSizing: "border-box", border: `${TRAIT.FIN}px solid ${E}`, borderRadius: RAYON.CHAMP, background: surFond ? ACCENT_1 : COULEURS.BLANC,
                display: "flex", alignItems: "center", paddingLeft: 30, fontFamily: INTER, fontWeight: 800, fontSize: 36, color: E, zIndex: 3, overflow: "hidden" }}>
                {filet ? <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 8, background: ACCENT_1 }} /> : null}
                <span style={{ marginLeft: filet ? 8 : 0 }}>Demandez votre devis en ligne</span>
              </div>
            </div>
          </div>
        </div>
      </Anim>
      {/* curseur + clic (par-dessus la fenêtre, posés en coordonnées d'écran, suivent la fenêtre) */}
      <Anim i={i} i0={0} iSortie={iS} sortie="coteG" entree="coteD" incl={-2} x={X} y={Y} w={LF} h={HF} z={6} id="curseur-web">
        <div style={{ position: "absolute", left: 0, top: BARRE, width: LF, height: HF - BARRE, pointerEvents: "none", opacity: i >= ic - 14 ? 1 : 0 }}>
          {clic > 0 && clic < 1 ? <div style={{ position: "absolute", left: curseurX - (0.04 + 0.06 * clic) * W / 2, top: curseurY - (0.04 + 0.06 * clic) * W / 2, width: (0.04 + 0.06 * clic) * W, height: (0.04 + 0.06 * clic) * W, borderRadius: "50%", boxSizing: "border-box", border: `8px solid ${ACCENT_1}`, boxShadow: `0 0 0 3px ${E}` }} /> : null}
          <svg width={54} height={66} viewBox="0 0 54 66" style={{ position: "absolute", left: curseurX - 6, top: curseurY - 6, transform: `scale(${i >= ic && i < ic + 3 ? 0.88 : 1})`, transformOrigin: "6px 6px" }}>
            <path d="M6 4 L6 52 L18 41 L27 61 L36 57 L27 38 L44 38 Z" fill={E} stroke={COULEURS.BLANC} strokeWidth={4} strokeLinejoin="round" />
          </svg>
        </div>
      </Anim>
      <Anim i={i} i0={il} iSortie={il2 !== undefined ? il2 - 3 : iS} incl={-3} x={W * 0.5 - 270} y={Y + HF - 40} z={8} vie={{ debut: il + 8 }} id="etiquette-1">
        <Plaque fond={ACCENT_1} corps={60}>{etiquette}</Plaque>
      </Anim>
      {il2 !== undefined ? (
        <Anim i={i} i0={il2} iSortie={iS} incl={3} x={W * 0.5 - 200} y={Y + HF - 40} z={8} vie={{ debut: il2 + 8 }} id="etiquette-2">
          <Plaque fond={COULEURS.BLANC} corps={60}>{etiquette2}</Plaque>
        </Anim>
      ) : null}
    </>
  );
}
