import React from "react";
/**
 * MAQUETTE « ESCALIER D'ÉTAPES » (variété, designer n° 2, 15/10/2026). Quand : « d'abord… ensuite… enfin », une méthode
 * en 3 ou 4 étapes. Panneau qui couvre TOUT le visage ; marches en diagonale de bas à gauche vers le haut à droite.
 * Contrairement à la frise, AUCUNE étape grisée à l'avance : chaque marche SORT DU SOL sur son mot.
 *  N1 : le panneau tombe, la première marche est déjà posée (personnage dessus).
 *  N2 : sur son mot, la marche jaillit du sol (flash orange plein) et le personnage SAUTE EN ARC dessus (écrasement à
 *       l'atterrissage).
 *  N3 : liseré orange en pointillés qui TOURNE autour de la marche active ; le personnage rebondit sur place.
 */
import { COULEURS, POLICES, largeurTexte } from "../charte";
import { Icone, mesures, styleBoite } from "../elements";
import { progression, rebond } from "../mouvement";
import { Panneau } from "./Scene";
import type { Mot } from "./Scene";

export type Marche = { texte: string; icone: string; a: number };

export type EscalierEtapesProps = {
  t: number;
  largeurImage: number;
  hauteurImage: number;
  titre: string;
  /** 3 ou 4 marches ; la première est posée dès l'entrée du panneau (a = 0 conseillé). */
  marches: Marche[];
};

/** Exemple : « D'abord, on regarde vos tâches ; ensuite, on choisit les outils ; enfin, on forme votre équipe. » */
export const EXEMPLE_ESCALIER_ETAPES = {
  phrase: "D'abord, on regarde vos tâches ; ensuite, on choisit les outils ; enfin, on forme votre équipe.",
  duree: 4.6,
  mots: [
    { texte: "D'abord,", a: 0.0, fort: true },
    { texte: "on", a: 0.35 },
    { texte: "regarde", a: 0.45 },
    { texte: "vos", a: 0.75 },
    { texte: "tâches ;", a: 0.85, fort: true },
    { texte: "ensuite,", a: 1.35, fort: true },
    { texte: "on", a: 1.75 },
    { texte: "choisit", a: 1.85 },
    { texte: "les", a: 2.15 },
    { texte: "outils ;", a: 2.25, fort: true },
    { texte: "enfin,", a: 2.75, fort: true },
    { texte: "on", a: 3.1 },
    { texte: "forme", a: 3.2 },
    { texte: "votre", a: 3.45 },
    { texte: "équipe.", a: 3.55, fort: true },
  ] satisfies Mot[],
  titre: "La méthode en 3 étapes",
  marches: [
    { texte: "Regarder vos tâches", icone: "loupe", a: 0 },
    { texte: "Choisir les outils", icone: "eclair", a: 1.35 },
    { texte: "Former l'équipe", icone: "former", a: 2.75 },
  ],
};

/** Délai entre la sortie d'une marche et le départ du saut (s), durée du saut (s). */
const SAUT_DEPART = 0.1;
const SAUT_DUREE = 0.34;

export function EscalierEtapes(p: EscalierEtapesProps) {
  return (
    <Panneau t={p.t} largeur={p.largeurImage} hauteur={p.hauteurImage} titre={p.titre} icone={<Icone nom="tendance" taille={p.hauteurImage * 0.032} couleur={COULEURS.ivoire} epaisseur={2.8} />} enfants={(l, h) => <Escalier {...p} l={l} h={h} />} />
  );
}

function Escalier(p: EscalierEtapesProps & { l: number; h: number }) {
  const { t, l, h } = p;
  const W = p.largeurImage;
  const { contour, ombre } = mesures(W);
  const n = p.marches.length;
  const marge = l * 0.03;
  const sol = h - h * 0.045;
  const hautLibre = h * 0.2; // place du personnage au-dessus de la dernière marche
  const lm = (l - 2 * marge) / n;
  const pas = (sol - hautLibre) / n;
  const k = Math.min(lm / 304, pas / 251);
  const haut = (i: number) => sol - pas * (i + 1);
  const cx = (i: number) => marge + lm * (i + 0.5);

  const sorties = p.marches.map((m) => m.a);
  const active = sorties.filter((a) => t >= a).length - 1;

  // Personnage : posé sur la marche `pose`, ou en vol entre deux marches.
  const hPerso = 150 * k;
  const lPerso = 96 * k;
  let px = cx(Math.max(0, active));
  let py = haut(Math.max(0, active));
  let echX = 1;
  let echY = 1;
  let rot = 0;
  let enVol = false;
  if (active >= 1) {
    const depart = p.marches[active].a + SAUT_DEPART;
    const u = progression(t, depart, SAUT_DUREE);
    if (t < depart) {
      // S'accroupit avant de sauter (anticipation, 3 images).
      px = cx(active - 1);
      py = haut(active - 1);
      const acc = progression(t, depart - SAUT_DEPART, SAUT_DEPART);
      echY = 1 - 0.22 * acc;
      echX = 1 + 0.12 * acc;
    } else if (u < 1) {
      enVol = true;
      px = cx(active - 1) + (cx(active) - cx(active - 1)) * u;
      py = haut(active - 1) + (haut(active) - haut(active - 1)) * u - pas * 1.15 * 4 * u * (1 - u);
      echY = 1.12;
      echX = 0.9;
      rot = 18 * Math.sin(Math.PI * u);
    } else {
      const atterri = depart + SAUT_DUREE;
      const e = rebond(t, atterri, 0.18, 2.5);
      echY = 0.72 + 0.28 * e;
      echX = 1.2 - 0.2 * e;
    }
  }
  // N3 : rebond sur place (période 0,5 s) une fois posé.
  const pose = active < 1 ? 0.3 : p.marches[active].a + SAUT_DEPART + SAUT_DUREE + 0.2;
  if (!enVol && t > pose) py -= Math.abs(Math.sin(((t - pose) * Math.PI) / 0.5)) * 16 * k;
  const ePerso = rebond(t, 0.22, 0.18, 2.4);

  return (
    <div style={{ position: "absolute", inset: 0 }}>
      {/* Marches : elles SORTENT DU SOL (le conteneur coupe tout ce qui est sous le sol). */}
      <div style={{ position: "absolute", left: 0, top: 0, width: l, height: sol, overflow: "hidden" }}>
        {p.marches.map((m, i) => {
          if (t < m.a) return null;
          const e = i === 0 ? 1 : rebond(t, m.a, 0.2, 1.6);
          const flash = i > 0 && t < m.a + 0.3;
          const hBloc = sol - haut(i) + ombre + 30;
          const fond = flash ? COULEURS.orange : COULEURS.ivoire;
          const encre = flash ? COULEURS.ivoire : COULEURS.encre;
          const mots = m.texte.split(" ");
          const plusLong = mots.reduce((a, x) => (largeurTexte(x, 1) > largeurTexte(a, 1) ? x : a), "");
          const taille = Math.min(40 * k, (lm - 44 * k) / largeurTexte(plusLong, 1));
          return (
            <div
              key={m.texte}
              style={{
                position: "absolute",
                left: marge + lm * i - (i > 0 ? contour : 0),
                top: haut(i),
                width: lm + (i > 0 ? contour : 0),
                height: hBloc,
                ...styleBoite(W, fond, 20 * k),
                borderBottomLeftRadius: 0,
                borderBottomRightRadius: 0,
                transform: `translateY(${(1 - e) * hBloc}px)`,
                padding: `${14 * k}px ${18 * k}px`,
                display: "flex",
                flexDirection: "column",
                gap: 6 * k,
                zIndex: i,
              }}
            >
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
                <span style={{ fontFamily: POLICES.titre, fontSize: 118 * k, lineHeight: 0.9, color: flash ? COULEURS.encre : COULEURS.orange, WebkitTextStroke: `${3 * k}px ${COULEURS.encre}` }}>{i + 1}</span>
                <div style={{ width: 84 * k, height: 84 * k, borderRadius: "50%", background: flash ? COULEURS.encre : COULEURS.orange, border: `${contour}px solid ${COULEURS.encre}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Icone nom={m.icone} taille={48 * k} couleur={COULEURS.ivoire} epaisseur={2.8} />
                </div>
              </div>
              <span style={{ fontFamily: POLICES.titre, fontSize: taille, lineHeight: 1.04, color: encre, textTransform: "uppercase" }}>{m.texte}</span>
            </div>
          );
        })}
      </div>

      {/* Sol. */}
      <div style={{ position: "absolute", left: marge * 0.4, right: marge * 0.4, top: sol - 2, height: 10 * k + 4, background: COULEURS.encre, borderRadius: 6 }} />

      {/* N3 : liseré orange en pointillés qui tourne autour de la marche active (après son flash). */}
      {active >= 0 && t >= p.marches[active].a + (active > 0 ? 0.3 : 0.2) ? (
        <svg style={{ position: "absolute", left: marge + lm * active - 12 * k, top: haut(active) - 12 * k, overflow: "visible" }} width={lm + 24 * k} height={sol - haut(active) + 12 * k}>
          <rect x={4} y={4} width={lm + 24 * k - 8} height={sol - haut(active) + 12 * k - 8} rx={24 * k} fill="none" stroke={COULEURS.orange} strokeWidth={9 * k} strokeDasharray={`${44 * k} ${26 * k}`} strokeDashoffset={-t * 320 * k} strokeLinecap="round" />
        </svg>
      ) : null}

      {/* Traînée du saut : arc en pointillés encre, visible pendant le vol. */}
      {enVol && active >= 1 ? (
        <svg style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }} width={l} height={h}>
          <path
            d={`M ${cx(active - 1)} ${haut(active - 1) - hPerso * 0.4} Q ${(cx(active - 1) + cx(active)) / 2} ${(haut(active - 1) + haut(active)) / 2 - pas * 2.3 - hPerso * 0.4} ${cx(active)} ${haut(active) - hPerso * 0.4}`}
            fill="none"
            stroke={COULEURS.sable}
            strokeWidth={7 * k}
            strokeDasharray={`${4 * k} ${18 * k}`}
            strokeLinecap="round"
            pathLength={1}
          />
        </svg>
      ) : null}

      {/* Personnage (pictogramme), pieds sur le dessus de la marche. */}
      {t >= 0.22 ? (
        <div style={{ position: "absolute", left: px - lPerso / 2, top: py - hPerso, width: lPerso, height: hPerso, transformOrigin: "50% 100%", transform: `rotate(${rot}deg) scale(${echX * ePerso}, ${echY * ePerso})`, zIndex: 10 }}>
          <Personnage l={lPerso} h={hPerso} />
        </div>
      ) : null}

      {/* Arrivée en haut : étincelles autour du personnage sur la dernière marche. */}
      {active === n - 1 && n > 1
        ? [-1, 0, 1].map((j) => {
            const a = p.marches[n - 1].a + SAUT_DEPART + SAUT_DUREE;
            if (t < a || t > a + 0.6) return null;
            const e = rebond(t, a + Math.abs(j) * 0.04, 0.2, 2.4);
            const ang = (-90 + j * 55) * (Math.PI / 180);
            const r = hPerso * (0.6 + 0.35 * e);
            return (
              <div key={j} style={{ position: "absolute", left: cx(n - 1) + Math.cos(ang) * r - 28 * k, top: haut(n - 1) - hPerso * 0.55 + Math.sin(ang) * r - 28 * k, transform: `scale(${e}) rotate(${j * 20}deg)`, zIndex: 11 }}>
                <Icone nom="etincelles" taille={56 * k} couleur={COULEURS.orange} epaisseur={3} />
              </div>
            );
          })
        : null}
    </div>
  );
}

/** Pictogramme de personne (tête, corps, jambes), encre plein, liseré ivoire pour se détacher des marches. */
function Personnage({ l, h }: { l: number; h: number }) {
  return (
    <svg width={l} height={h} viewBox="0 0 64 100" style={{ overflow: "visible" }}>
      <g fill={COULEURS.encre} stroke={COULEURS.ivoire} strokeWidth={3} strokeLinejoin="round">
        <circle cx="32" cy="15" r="13" />
        <path d="M14 36 Q14 30 20 30 H44 Q50 30 50 36 V62 Q50 66 46 66 H18 Q14 66 14 62 Z" />
        <path d="M19 62 H30 V96 Q30 99 27 99 H22 Q19 99 19 96 Z" />
        <path d="M34 62 H45 V96 Q45 99 42 99 H37 Q34 99 34 96 Z" />
      </g>
      <circle cx="32" cy="45" r="6" fill={COULEURS.orange} />
    </svg>
  );
}
