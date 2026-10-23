import React from "react";
/**
 * ÉLÉMENT 25 ★ `FenetrePleinCadre` (standard v4, lot 4, § F) : une fenêtre M4 qui s'ouvre jusqu'au plein cadre (M5), puis se referme.
 *
 * Mouvement (i0 = le mot déclencheur commence ; 30 i/s) : i0 E-COTE depuis la droite (`CHUTE`, rotateZ 6° → 2°) · Z couvert à ≈ i4 ·
 * i10 l'ENVELOPPE (jamais la vidéo, qui reste une couche plein cadre fixe) s'agrandit jusqu'aux bords en 6 i (`CLAQUE`), rayon 22 → 0,
 * contour 7 → 0, ombre → 0 · l'étiquette ACCENT_1 (0,40 L) chevauche le bord bas et le suit jusqu'en bas du plein cadre (`POP`, i4) ·
 * à la fin l'enveloppe se rétracte en 4 i puis sort S-COTE gauche en 4 i (visage découvert en ≤ 3 i), sans reste.
 * Visage : couvert · bruitages : `whoosh-in` (i0), `maximize_006` (ouverture), `minimize_004` (rétraction).
 */
import { Clip, CoqueFenetre, EtiquetteBord, H, L, Sons, accents, aspire, bornePuce, lerp, prog, ress, rectTourne } from "./commun-lot4";
import type { MesuresElement, Palette } from "./commun-lot4";

export const ID_FENETRE_PLEIN_CADRE = "fenetre-plein-cadre";
const M4 = { x: 0.06 * L, y: 0.09 * H, l: 0.88 * L, h: 0.54 * H };
const OUVRE = 16; // la fenêtre M4 reste lisible ≥ 10 i avant d'ouvrir (critique tour 1)
const PLEIN_MAX = 36; // plein cadre ≤ 1,2 s
export const DUREE_PLEIN_CADRE = OUVRE + PLEIN_MAX + 8;
const RETRACTE = 8; // images avant la fin : début de la rétraction (4 i) puis sortie (4 i)

export type PropsFenetrePleinCadre = { f: number; duree: number; palette: Palette; src: string; depuisSec?: number; etiquette: string; etiquette2?: string; etiquette3?: string; sens?: 1 | -1; iEtiq?: number; iEtiq2?: number; iEtiq3?: number };

/** État géométrique à l'image f : rectangle courant, rotation, déplacement, avancement d'ouverture. */
function etat(f: number, duree: number, sens: 1 | -1) {
  const iRet = duree - RETRACTE;
  const entree = 1 - Math.min(1.12, ress("CHUTE", f));
  const ouvre = Math.min(1, ress("CLAQUE", f, OUVRE));
  const ferme = prog(f, iRet, 4, aspire);
  const p = ouvre * (1 - ferme);
  const sortie = prog(f, iRet + 4, 4, aspire);
  const x = lerp(M4.x, 0, p);
  const y = lerp(M4.y, 0, p);
  const l = lerp(M4.l, L, p);
  const h = lerp(M4.h, H, p);
  const rot = lerp(2 * sens, 0, p) + (6 * sens - 2 * sens) * (1 - Math.min(1, ress("CHUTE", f))) * 1;
  const tx = sens * entree * L - sens * sortie * 1.15 * L;
  return { x, y, l, h, rot, tx, p, sortie, iRet };
}

export const mesuresFenetrePleinCadre = (sens: 1 | -1 = 1): MesuresElement => ({
  evenements: [0, 4, 10, OUVRE, OUVRE + 4, 24, 32, 40, 48, -RETRACTE, -RETRACTE + 4],
  couvre: (f, duree) => {
    const e = etat(f, duree, sens);
    if (e.sortie >= 1) return [];
    return [rectTourne(e.x, e.y, e.l, e.h, e.rot, e.tx)];
  },
});

export function FenetrePleinCadre(p: PropsFenetrePleinCadre) {
  const { ACCENT_1 } = accents(p.palette);
  const sens = p.sens ?? 1;
  const { f, duree } = p;
  const e = etat(f, duree, sens);
  if (f < 0 || e.sortie >= 1) return null;
  const iRet = e.iRet;
  const ouvert = e.p;
  // La vidéo est une couche plein cadre FIXE (position -x, -y dans l'enveloppe) : l'ouverture est un masque, pas un zoom.
  const rayon = lerp(22, 0, ouvert);
  const bord = lerp(7, 0, ouvert);
  const etiqY = e.y + e.h - lerp(0, 0.085 * H, ouvert);
  const sortieEtiq = iRet - 1;
  // une étiquette par mot fort (critique tour 1) ; chacune reprend la place de la précédente (celle-ci rétrécit 3 i avant)
  const i1 = p.iEtiq ?? 4;
  const i2 = Math.max(p.iEtiq2 ?? OUVRE + 8, i1 + 14);
  const i3 = Math.max(p.iEtiq3 ?? i2 + 16, i2 + 14);
  const etiquettes = [{ texte: p.etiquette, debut: i1 }, ...(p.etiquette2 ? [{ texte: p.etiquette2, debut: i2 }] : []), ...(p.etiquette3 ? [{ texte: p.etiquette3, debut: i3 }] : [])];
  return (
    <>
      <CoqueFenetre x={e.x} y={e.y} l={e.l} h={e.h} rot={e.rot} tx={e.tx} rayon={rayon} bord={bord} ombreK={1 - ouvert}>
        <div style={{ position: "absolute", left: -e.x, top: -e.y, width: L, height: H }}>
          <Clip nom={p.src} depuisSec={p.depuisSec ?? 0.3} />
        </div>
      </CoqueFenetre>
      {etiquettes.map((t, k) => (
        <EtiquetteBord
          key={k}
          f={f}
          debut={t.debut}
          fin={k + 1 < etiquettes.length ? etiquettes[k + 1].debut - 1 : sortieEtiq}
          x={lerp(bornePuce(e.x + 0.46 * e.l, t.texte, 72), 0.5 * L, ouvert) + e.tx}
          y={etiqY}
          texte={t.texte}
          fond={ACCENT_1}
          corps={72}
          inclinaison={(k % 2 === 0 ? -2 : 2) * sens}
          pulses={[t.debut + 12]}
        />
      ))}
      <Sons
        liste={[
          { f: 0, nom: "whoosh-in" },
          { f: OUVRE, nom: "maximize_006" },
          { f: iRet, nom: "minimize_004" },
        ]}
      />
    </>
  );
}

/** Centre vertical des sous-titres (§ C.3) : 0,72 H sous la fenêtre M4, 0,795 H une fois en plein cadre (au-dessus de l'étiquette posée à 0,915 H). Coupe sèche. */
export const sousTitresFenetrePleinCadre = (f: number): number => (f >= OUVRE + 4 ? 0.795 * H : 0.72 * H);
