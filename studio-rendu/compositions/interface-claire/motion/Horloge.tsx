/**
 * FAMILLE « HORLOGE » (motion design hors cartes, designer n° 3, 15/10/2026) — horloge qui s'emballe, ou minuteur.
 *
 * Quand : le temps qui file, les soirées, les journées sans fin, ou une durée annoncée.
 * Visage : ENTIER (un réveil rond posé à droite de la tête, dans le mur ; la prise ne bouge pas).
 *
 * Un réveil (cadran ivoire, contour encre épais, ombre dure, deux cloches orange, deux pieds) entre en tournant
 * d'un tiers de tour et en grossissant (0,26 s, rebond franc), ses 12 graduations d'heure tombent une à une.
 *  - mode « emballe »  : les aiguilles accélèrent sans cesse ; un éventail orange (flou de vitesse) les suit, des traits
 *                        de vitesse tournent autour du cadran, le réveil tremble et ses cloches s'agitent.
 *  - mode « minuteur » : un secteur ORANGE plein (minuteur de cuisine) se vide dans le sens des aiguilles ; à zéro, le
 *                        cadran flashe orange et les cloches sonnent.
 * Seule une DURÉE DITE par Will s'affiche, EN TOUTES LETTRES (« une heure », « tous les soirs ») : elle s'écrit lettre
 * à lettre EN ARC sous le cadran, sans plaque, soulignée d'un trait orange qui se dessine. Aucun autre chiffre.
 * Les aiguilles partent de midi, superposées : aucune heure lisible n'est suggérée ; en mode « emballe », dès que ça
 * accélère, des aiguilles fantômes et un éventail orange les rendent illisibles.
 * Sortie : le réveil rétrécit en tournant (0,16 s), fini à `fin`. Dure 1,2 à 2,5 s.
 * Bruitage : tic-tac qui accélère (emballe) ou régulier puis sonnerie (minuteur).
 *
 * HORLOGE ou CHIFFRE QUI ÉCLATE (designer n° 2) ? Règle du réalisateur :
 *  - le NOMBRE est le message (« 45 minutes », « 3 heures par semaine ») → Chiffre qui éclate ;
 *  - le message est le TEMPS QUI FILE, l'urgence, la répétition (« tous les soirs », « des journées sans fin ») ou une
 *    durée dite en mots sans valeur chiffrée mise en avant → Horloge (« emballe ») ;
 *  - un délai, un compte à rebours, « en une heure on fait… » → Horloge (« minuteur »).
 *  Jamais les deux sur la même phrase.
 * PLACEMENT : cadran à droite de la tête, au-dessus de l'oreille (marge ≥ 40 px avec l'oreille et les cheveux sur la
 * prise de référence, rebond d'entrée compris).
 */
import React from "react";
import { COULEURS, POLICES, largeurTexte } from "../charte";
import { mesures } from "../elements";
import { progression, rebond, sortie } from "../mouvement";

export const ID_HORLOGE = "horloge";
export const DUREE_HORLOGE = Object.freeze({ min: 1.2, max: 2.5 });

export const FICHE_HORLOGE = Object.freeze({
  id: ID_HORLOGE,
  nom: "Horloge qui s'emballe et minuteur",
  visage: "entier" as const,
  /** Garde le visage libre : peut servir dans les premières secondes de la vidéo. */
  ouvertureAutorisee: true,
  dureeMin: DUREE_HORLOGE.min,
  dureeMax: DUREE_HORLOGE.max,
  quandUtiliser: "Le temps qui file, les soirées, les journées sans fin (« emballe »), ou un délai annoncé (« minuteur »). Si le NOMBRE est le message, prendre le Chiffre qui éclate.",
});

export type HorlogeProps = {
  t: number;
  debut: number;
  fin: number;
  largeurImage: number;
  hauteurImage: number;
  mode: "emballe" | "minuteur";
  /** Durée DITE par Will (« deux heures », « 3 soirées »…), affichée à partir de `a`. Jamais une durée inventée. */
  duree?: { texte: string; a: number };
  /** Centre du cadran (fractions de L et H). Par défaut : à droite de la tête de la prise de référence. */
  centre?: { x: number; y: number };
};

const G = Object.freeze({
  /** Au-dessus de l'oreille droite, plus haut et plus à droite qu'avant : ≥ 40 px de l'oreille, rebond compris. */
  centre: { x: 0.815, y: 0.182 },
  /** Rayon du cadran (fraction de la LARGEUR) : 0,13 L. Tout (rebond, traits de vitesse) reste dans l'image. */
  rayon: 0.13,
  entree: 0.26,
  sortie: 0.16,
  /** Démarrage des aiguilles après `debut`. */
  depart: 0.15,
  /** Demi-ouverture de l'arc de texte sous le cadran (degrés). */
  arcTexte: 56,
});

const rad = (deg: number) => (deg * Math.PI) / 180;
/** Point à `r` du centre (c, c), angle en degrés (0° = midi, sens horaire). */
const pt = (c: number, r: number, deg: number) => [c + r * Math.sin(rad(deg)), c - r * Math.cos(rad(deg))] as const;

/** Secteur plein (« part de tarte ») de `a0` à `a1` degrés (0° = midi, sens horaire). */
function secteur(c: number, r: number, a0: number, a1: number): string {
  if (a1 - a0 >= 359.9) return `M ${c - r} ${c} A ${r} ${r} 0 1 1 ${c + r} ${c} A ${r} ${r} 0 1 1 ${c - r} ${c} Z`;
  const [x0, y0] = pt(c, r, a0);
  const [x1, y1] = pt(c, r, a1);
  return `M ${c} ${c} L ${x0} ${y0} A ${r} ${r} 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${x1} ${y1} Z`;
}

/** Angle de la grande aiguille (degrés) `dt` secondes après le départ : accélération continue. */
const angleEmballe = (dt: number) => (dt <= 0 ? 0 : 360 * (0.5 * dt + 1.1 * dt * dt + 0.8 * dt * dt * dt));
/** Vitesse angulaire (degrés / s). */
const vitesseEmballe = (dt: number) => (dt <= 0 ? 0 : 360 * (0.5 + 2.2 * dt + 2.4 * dt * dt));

/** Fenêtre du minuteur : il se vide de `debut + 0,25` à `fin − 0,4` (sonnerie ensuite). */
const fenetreMinuteur = (debut: number, fin: number) => ({ de: debut + 0.25, a: Math.max(debut + 0.6, fin - 0.4) });

export function Horloge(p: HorlogeProps) {
  const { t, debut, fin } = p;
  if (t < debut || t >= fin) return null;
  const W = p.largeurImage;
  const H = p.hauteurImage;
  const { contour, ombre } = mesures(W);
  const R = G.rayon * W;
  const centre = p.centre ?? G.centre;
  const cx = centre.x * W;
  const cy = centre.y * H;
  const S = R * 3;
  const c = S / 2;

  // Entrée / sortie.
  const e = rebond(t, debut, G.entree, 1.8);
  const s = sortie(t, fin - G.sortie, G.sortie);
  const echelle = (0.25 + 0.75 * e) * (1 - s);
  const tourne = (1 - e) * -120 + s * 60;

  // Vitesse normalisée (0 → 1) : pilote le tremblement, l'éventail et les traits de vitesse.
  const dt = t - (debut + G.depart);
  let vitesse = 0;
  let aiguilleM = 0;
  let aiguilleH = 0;
  let reste = 1;
  let sonne = 0;
  const minuteur = fenetreMinuteur(debut, fin);
  if (p.mode === "emballe") {
    // Les deux aiguilles partent de midi, superposées : aucune heure n'est suggérée.
    aiguilleM = angleEmballe(dt);
    aiguilleH = aiguilleM / 8;
    vitesse = Math.min(1, vitesseEmballe(dt) / 2200);
  } else {
    reste = 1 - progression(t, minuteur.de, minuteur.a - minuteur.de);
    // L'aiguille suit le bord du secteur qui recule vers midi.
    aiguilleM = 360 - 360 * reste;
    sonne = t >= minuteur.a ? 1 : 0;
    vitesse = sonne ? 0.8 : 0.1;
  }
  const tremble = Math.max(vitesse * vitesse, sonne);
  const dx = Math.sin(t * 92) * R * 0.03 * tremble;
  const dy = Math.cos(t * 77) * R * 0.02 * tremble;
  const penche = Math.sin(t * 61) * 4 * tremble;
  const cloches = Math.sin(t * 140) * 10 * tremble;
  // Flash du minuteur à zéro : 4 images de cadran orange.
  const flash = sonne && t < minuteur.a + 0.16;

  const graduations = Array.from({ length: 12 }, (_, i) => i);
  const minutes = Array.from({ length: 60 }, (_, i) => i).filter((i) => i % 5 !== 0);
  const eventail = p.mode === "emballe" ? Math.min(150, vitesseEmballe(dt) * 0.045) : 0;

  return (
    <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
      <div style={{ position: "absolute", left: cx - c + dx, top: cy - c + dy, width: S, height: S, transform: `rotate(${tourne + penche}deg) scale(${echelle})`, transformOrigin: "50% 50%" }}>
        <svg width={S} height={S} style={{ overflow: "visible" }}>
          {/* Traits de vitesse : quatre arcs épais (deux orange, deux encre) qui tournent autour du cadran et
              s'allongent avec la vitesse, plus des traits de vibration de part et d'autre des cloches. */}
          {vitesse > 0.15 && p.mode === "emballe"
            ? [0, 90, 180, 270].map((k, n) => {
                const rr = R * (n % 2 ? 1.17 : 1.1);
                const a0 = aiguilleM * 0.35 + k;
                const longueur = 26 + 44 * vitesse;
                const [x0, y0] = pt(c, rr, a0);
                const [x1, y1] = pt(c, rr, a0 + longueur);
                return <path key={k} d={`M ${x0} ${y0} A ${rr} ${rr} 0 0 1 ${x1} ${y1}`} fill="none" stroke={n % 2 ? COULEURS.encre : COULEURS.orange} strokeWidth={contour * (n % 2 ? 2.4 : 3.6)} strokeLinecap="round" opacity={Math.min(1, (vitesse - 0.15) * 3)} />;
              })
            : null}
          {tremble > 0.3
            ? [-1, 1].map((cote) =>
                [0, 1].map((k) => {
                  const ang = cote * (22 + k * 14);
                  const [x0, y0] = pt(c, R * 1.34, ang);
                  const [x1, y1] = pt(c, R * (1.5 + 0.05 * Math.sin(t * 60 + k)), ang);
                  return <line key={`${cote}${k}`} x1={x0} y1={y0} x2={x1} y2={y1} stroke={COULEURS.encre} strokeWidth={contour * 1.6} strokeLinecap="round" opacity={Math.min(1, (tremble - 0.3) * 3)} />;
                }),
              )
            : null}
          {/* Pieds. */}
          {[148, 212].map((a) => {
            const [x0, y0] = pt(c, R * 0.85, a);
            const [x1, y1] = pt(c, R * 1.14, a);
            return <line key={a} x1={x0} y1={y0} x2={x1} y2={y1} stroke={COULEURS.encre} strokeWidth={contour * 2.6} strokeLinecap="round" />;
          })}
          {/* Cloches (derrière le cadran) et marteau, agités quand ça s'emballe ou que ça sonne. */}
          <g transform={`rotate(${cloches} ${c} ${c})`}>
            <line x1={c} y1={c - R} x2={c} y2={c - R * 1.2} stroke={COULEURS.encre} strokeWidth={contour * 2} strokeLinecap="round" />
            <circle cx={c} cy={c - R * 1.24} r={R * 0.07} fill={COULEURS.encre} />
            {[-40, 40].map((a) => {
              const [x, y] = pt(c, R * 0.98, a);
              return (
                <g key={a}>
                  <circle cx={x + ombre * 0.6} cy={y + ombre * 0.6} r={R * 0.27} fill={COULEURS.encre} />
                  <circle cx={x} cy={y} r={R * 0.27} fill={COULEURS.orange} stroke={COULEURS.encre} strokeWidth={contour * 1.2} />
                </g>
              );
            })}
          </g>
          {/* Cadran : ombre dure, disque ivoire (orange 4 images quand le minuteur arrive à zéro). */}
          <circle cx={c + ombre} cy={c + ombre} r={R} fill={COULEURS.encre} />
          <circle cx={c} cy={c} r={R} fill={flash ? COULEURS.orange : COULEURS.ivoire} stroke={COULEURS.encre} strokeWidth={contour * 1.3} />
          <circle cx={c} cy={c} r={R * 0.84} fill="none" stroke={COULEURS.sable} strokeWidth={contour * 0.6} />
          {/* Minuteur : secteur orange plein qui se vide. */}
          {p.mode === "minuteur" && reste > 0.001 ? <path d={secteur(c, R * 0.8, 360 - 360 * reste, 360)} fill={COULEURS.orange} stroke={COULEURS.encre} strokeWidth={contour} strokeLinejoin="round" /> : null}
          {/* Éventail de vitesse derrière la grande aiguille (flou de mouvement franc). */}
          {eventail > 4 ? <path d={secteur(c, R * 0.8, aiguilleM - eventail, aiguilleM)} fill={COULEURS.orange} opacity={0.62} /> : null}
          {eventail > 4 ? <path d={secteur(c, R * 0.52, aiguilleH - eventail / 2.5, aiguilleH)} fill={COULEURS.sable} opacity={0.8} /> : null}
          {/* Graduations : minutes (sable), heures (encre) qui tombent une à une à l'entrée. */}
          {minutes.map((i) => {
            const [x0, y0] = pt(c, R * 0.86, i * 6);
            const [x1, y1] = pt(c, R * 0.92, i * 6);
            return <line key={`m${i}`} x1={x0} y1={y0} x2={x1} y2={y1} stroke={COULEURS.sable} strokeWidth={contour * 0.55} strokeLinecap="round" />;
          })}
          {graduations.map((i) => {
            const g = rebond(t, debut + 0.08 + i * 0.014, 0.12, 2.5);
            if (g <= 0) return null;
            const longue = i % 3 === 0;
            const [x0, y0] = pt(c, R * (longue ? 0.7 : 0.77), i * 30);
            const [x1, y1] = pt(c, R * 0.9, i * 30);
            return <line key={`h${i}`} x1={x0} y1={y0} x2={x0 + (x1 - x0) * g} y2={y0 + (y1 - y0) * g} stroke={COULEURS.encre} strokeWidth={contour * (longue ? 1.9 : 1.2)} strokeLinecap="round" />;
          })}
          {/* Aiguilles fantômes : trois copies de la grande aiguille qui traînent derrière elle quand ça accélère. */}
          {p.mode === "emballe" && eventail > 4
            ? [0.25, 0.5, 0.75].map((f, k) => <Aiguille key={k} c={c} angle={aiguilleM - eventail * f} longueur={R * 0.76} epaisseur={contour * 1.7} couleur={COULEURS.encre} opacite={0.42 - k * 0.12} />)
            : null}
          {/* Aiguilles. */}
          {p.mode === "emballe" ? <Aiguille c={c} angle={aiguilleH} longueur={R * 0.48} epaisseur={contour * 2.6} couleur={COULEURS.encre} /> : null}
          <Aiguille c={c} angle={aiguilleM} longueur={R * 0.76} epaisseur={contour * 1.7} couleur={COULEURS.encre} />
          <circle cx={c} cy={c} r={R * 0.09} fill={COULEURS.orange} stroke={COULEURS.encre} strokeWidth={contour} />
        </svg>
      </div>
      {p.duree && t >= p.duree.a ? <ArcDuree t={t} a={p.duree.a} texte={p.duree.texte} cx={cx + dx} cy={cy + dy} R={R} W={W} H={H} sortieS={s} /> : null}
    </div>
  );
}

function Aiguille({ c, angle, longueur, epaisseur, couleur, opacite = 1 }: { c: number; angle: number; longueur: number; epaisseur: number; couleur: string; opacite?: number }) {
  const [x1, y1] = pt(c, longueur, angle);
  const [x0, y0] = pt(c, longueur * 0.16, angle + 180);
  return <line x1={x0} y1={y0} x2={x1} y2={y1} stroke={couleur} strokeWidth={epaisseur} strokeLinecap="round" opacity={opacite} />;
}

/**
 * Durée dite, écrite EN ARC sous le cadran (sans plaque) : les lettres apparaissent l'une après l'autre de gauche à
 * droite, encre cerclée d'ivoire, puis un trait orange se dessine sous l'arc. Taille ajustée pour tenir dans l'arc.
 */
function ArcDuree({ t, a, texte, cx, cy, R, W, H, sortieS }: { t: number; a: number; texte: string; cx: number; cy: number; R: number; W: number; H: number; sortieS: number }) {
  const { contour } = mesures(W);
  const phi = (G.arcTexte * Math.PI) / 180;
  const lettres = [...texte.toUpperCase()];
  // Rayon de la ligne de base : le haut des lettres reste au-delà des pieds du réveil (1,18 R).
  let taille = H * 0.026;
  let r = R * 1.2 + taille * 0.74;
  for (let k = 0; k < 4; k++) {
    const dispo = r * 2 * phi * 0.9;
    const l = largeurTexte(texte, taille, taille * 0.06);
    if (l <= dispo) break;
    taille *= dispo / l;
    r = R * 1.2 + taille * 0.74;
  }
  const S = (r + taille) * 2.4;
  const c = S / 2;
  const gx = c - r * Math.sin(phi);
  const dx = c + r * Math.sin(phi);
  const y = c + r * Math.cos(phi);
  const id = `arc-duree-${Math.round(cx)}-${Math.round(cy)}`;
  const pas = Math.min(0.03, 0.32 / Math.max(1, lettres.length));
  const souligne = progression(t, a + lettres.length * pas * 0.6, 0.22);
  const ru = r + taille * 0.34;
  // Le trait ne déborde le texte que de 0,4 lettre de chaque côté (jamais plus large que l'arc).
  const phiU = Math.min(phi, (largeurTexte(texte, taille, taille * 0.06) / 2 + taille * 0.4) / ru);
  const longueurArc = ru * 2 * phiU;
  const pop = rebond(t, a, 0.18, 2);
  return (
    <svg width={S} height={S} style={{ position: "absolute", left: cx - c, top: cy - c, overflow: "visible", transform: `scale(${(0.9 + 0.1 * pop) * (1 - sortieS)})`, transformOrigin: "50% 50%" }}>
      <defs>
        <path id={id} d={`M ${gx} ${y} A ${r} ${r} 0 0 0 ${dx} ${y}`} />
      </defs>
      <path
        d={`M ${c - ru * Math.sin(phiU)} ${c + ru * Math.cos(phiU)} A ${ru} ${ru} 0 0 0 ${c + ru * Math.sin(phiU)} ${c + ru * Math.cos(phiU)}`}
        fill="none"
        stroke={COULEURS.orange}
        strokeWidth={contour * 1.6}
        strokeLinecap="round"
        strokeDasharray={longueurArc}
        strokeDashoffset={longueurArc * (1 - souligne)}
        opacity={souligne > 0 ? 1 : 0}
      />
      <text fontFamily={POLICES.titre} fontSize={taille} letterSpacing={taille * 0.06} fill={COULEURS.encre} stroke={COULEURS.ivoire} strokeWidth={contour * 1.4} strokeLinejoin="round" paintOrder="stroke fill">
        <textPath href={`#${id}`} startOffset="50%" textAnchor="middle">
          {lettres.map((l, k) => (
            <tspan key={k} opacity={progression(t, a + k * pas, 0.06)}>
              {l}
            </tspan>
          ))}
        </textPath>
      </text>
    </svg>
  );
}

/** Bruitage : [instant (s), son de `sons/` sans extension, volume]. Aucune musique. */
export type BruitageMotion = [number, string, number];

/** Emballe : tic-tac de plus en plus serré (0,22 s → 0,045 s). Minuteur : tic-tac régulier puis sonnerie à zéro. */
export function bruitagesHorloge(p: Pick<HorlogeProps, "debut" | "fin" | "mode" | "duree">): BruitageMotion[] {
  const s: BruitageMotion[] = [[p.debut, "drop_001", 0.04]];
  const finTic = p.fin - G.sortie;
  if (p.mode === "emballe") {
    let pas = 0.22;
    for (let a = p.debut + G.depart; a < finTic - 1e-6; a += pas, pas = Math.max(0.045, pas * 0.82)) s.push([+a.toFixed(3), s.length % 2 ? "tick_002" : "tick_001", 0.05]);
  } else {
    const m = fenetreMinuteur(p.debut, p.fin);
    for (let a = m.de; a < m.a - 1e-6; a += 0.2) s.push([+a.toFixed(3), s.length % 2 ? "tick_002" : "tick_001", 0.045]);
    s.push([m.a, "confirmation_002", 0.07]);
  }
  if (p.duree) s.push([p.duree.a, "select_002", 0.04]);
  return s;
}

/** Exemple « emballe » : les soirées qui filent (aucune durée chiffrée affichée : seule « tous les soirs » est dite). */
export const EXEMPLE_HORLOGE = {
  phrase: "Et le soir, au lieu de rentrer, vous êtes encore sur vos devis, tous les soirs.",
  duree: 2.9,
  mots: [
    { texte: "Et", a: 0.0 },
    { texte: "le", a: 0.1 },
    { texte: "soir,", a: 0.2 },
    { texte: "au", a: 0.62 },
    { texte: "lieu", a: 0.72 },
    { texte: "de", a: 0.86 },
    { texte: "rentrer,", a: 0.94 },
    { texte: "vous", a: 1.4 },
    { texte: "êtes", a: 1.52 },
    { texte: "encore", a: 1.64 },
    { texte: "sur", a: 1.9 },
    { texte: "vos", a: 2.0 },
    { texte: "devis,", a: 2.1 },
    { texte: "tous", a: 2.45 },
    { texte: "les", a: 2.58 },
    { texte: "soirs.", a: 2.66 },
  ],
  proprietes: { debut: 0.6, fin: 3.1, mode: "emballe", duree: { texte: "Tous les soirs", a: 2.45 } } satisfies Omit<HorlogeProps, "t" | "largeurImage" | "hauteurImage">,
  /** Instants de contrôle : entrée (réveil qui se pose) et état complet (emballé, durée écrite en arc). */
  instantConstruction: 0.75,
  instantComplet: 2.92,
};

/** Exemple « minuteur » : une durée annoncée par Will (« une heure »), le minuteur se vide. */
export const EXEMPLE_HORLOGE_MINUTEUR = {
  phrase: "En une heure, on fait le point sur vos tâches qui reviennent.",
  duree: 2.6,
  mots: [
    { texte: "En", a: 0.0 },
    { texte: "une", a: 0.1 },
    { texte: "heure,", a: 0.22 },
    { texte: "on", a: 0.7 },
    { texte: "fait", a: 0.8 },
    { texte: "le", a: 0.95 },
    { texte: "point", a: 1.02 },
    { texte: "sur", a: 1.3 },
    { texte: "vos", a: 1.4 },
    { texte: "tâches", a: 1.5 },
    { texte: "qui", a: 1.85 },
    { texte: "reviennent.", a: 1.95 },
  ],
  proprietes: { debut: 0.05, fin: 2.4, mode: "minuteur", duree: { texte: "Une heure", a: 0.22 } } satisfies Omit<HorlogeProps, "t" | "largeurImage" | "hauteurImage">,
  /** Instants de contrôle : minuteur à moitié vide, puis à zéro (flash orange). */
  instantConstruction: 1.2,
  instantComplet: 2.05,
};
