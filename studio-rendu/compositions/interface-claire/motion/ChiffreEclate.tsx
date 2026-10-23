import React from "react";
/**
 * FAMILLE DE MOTION « CHIFFRE QUI ÉCLATE » (hors cartes, designer n° 2 — refonte du 15/10/2026 après la critique).
 *
 * Un nombre DIT par Will arrive EN GRAND sous la tête (jamais devant : tout vit sous le menton, de 0,54 H à 0,95 H, sur
 * la moitié basse libre de l'image, soit 40 à 50 % de la largeur) :
 *  1. un DISQUE orange (dégradé, anneau sable intérieur, aucun contour ni ombre dure : rien de la grammaire des cartes)
 *     s'ouvre, et le nombre S'ÉCRASE dessus en venant de l'objectif (×2,3 → ×1), avec des traits de vitesse ivoire ;
 *  2. le disque ÉCLATE : il se brise en 9 quartiers dentelés et en éclats sable projetés vers l'extérieur et vers le BAS
 *     (rien ne monte vers le visage, rien n'est coupé par le bord : la course de chaque éclat est bornée au cadre) ; une
 *     onde orange part en même temps et se fige en ANNEAU qui tourne lentement autour du nombre (rappel graphique),
 *     avec trois traits de vitesse ;
 *  3. l'UNITÉ (« minutes ») se dévoile sous l'anneau, de gauche à droite, sur un trait orange qui se tend.
 * Une suite dite (« un, deux, trois ») : chaque nouveau nombre fait éclater le disque du précédent et arrive sur le sien.
 *
 *  - Visage : ENTIER (zone calculée depuis la boîte du visage de la prise, marge comprise).
 *  - SOUS-TITRES : MASQUÉS pendant la motion (sinon le nombre apparaît deux fois : `FICHE.sousTitres`).
 *  - Prise : immobile.
 *  - INTERDIT pour un nombre que Will n'a pas prononcé (seulement des nombres lus dans la transcription, à leur instant).
 *  - EXCLUSIF avec l'HORLOGE (designer 3) quand le nombre est une durée : une seule des deux sur la même phrase.
 *  - Bruitage : souffle d'arrivée, « pop » + éclats à l'éclatement, petit claquement pour l'unité.
 *  - Durée conseillée : 0,8 à 1,5 s (un nombre) ; + 0,4 s par nombre supplémentaire d'une suite.
 */
import { COULEURS, POLICES } from "../charte";
import { avanceEm } from "../SousTitres";
import { progression, rebond, sortie } from "../mouvement";

export type NombreDit = { texte: string; a: number };
export type BoiteVisage = { x0: number; x1: number; y0: number; y1: number };

export type DonneesChiffreEclate = {
  debut: number;
  fin: number;
  /** Le ou les nombres DITS, chacun à son instant (une suite « un, deux, trois » = plusieurs entrées). */
  nombres: NombreDit[];
  /** Signe collé au nombre (« % », « € », « h »), s'il est dit. */
  suffixe?: string;
  /** Unité dite (« minutes », « clients »…), dévoilée après l'éclatement du dernier nombre. */
  unite?: NombreDit;
  /** Instant de l'éclatement du dernier nombre (défaut : 0,42 s après son arrivée). */
  eclatA?: number;
  /** Boîte du visage sur la prise, cheveux et oreilles compris (fractions de l'image). */
  visage?: BoiteVisage;
};

export const FICHE_CHIFFRE_ECLATE = Object.freeze({
  id: "chiffre-eclate",
  nom: "Chiffre qui éclate",
  visage: "entier" as const,
  dureeMin: 0.8,
  dureeMax: 1.5,
  sousTitres: "masques" as const,
  exclusifAvec: ["horloge:duree"] as readonly string[],
  quandUtiliser: "Seulement pour un nombre prononcé dans la phrase (« 45 minutes », « un, deux, trois »). Interdit pour un nombre que Will n'a pas dit.",
});

/**
 * Boîte du visage de `prise-large.mp4` (la prise de la vidéo 5), mesurée aux images 4 s, 20 s, 45 s et 70 s : le visage
 * bouge de 0,17 à 0,67 L, cheveux à 0,13 H, menton à 0,51 H au plus bas.
 */
export const VISAGE_PRISE_LARGE = Object.freeze({ x0: 0.17, x1: 0.67, y0: 0.13, y1: 0.51 });
/** Boîte du visage déduite du champ `prise` du plan (yeux, centre, largeur du visage). */
export function visageDepuisPrise(p: { yeux: number; centreX: number; largeurVisage: number }): BoiteVisage {
  return { x0: p.centreX - 0.65 * p.largeurVisage, x1: p.centreX + 0.65 * p.largeurVisage, y0: p.yeux - 0.17, y1: p.yeux + 0.21 };
}

export const EXEMPLE_PHRASE_CHIFFRE_ECLATE = "Un devis vous prend 45 minutes.";
export const EXEMPLE_CHIFFRE_ECLATE: DonneesChiffreEclate = {
  debut: 0.6,
  fin: 2.0,
  nombres: [{ texte: "45", a: 0.6 }],
  unite: { texte: "minutes", a: 1.05 },
};
/** Instants de contrôle : éclatement en plein vol, puis état complet (anneau, unité posée). */
export const INSTANT_CONSTRUCTION_CHIFFRE_ECLATE = 1.12;
export const INSTANT_CHIFFRE_ECLATE = 1.6;

/** Contenu de la famille dans le plan (`SCHEMAS_CONTENU_MOTION["chiffre-eclate"]`). */
export type ContenuPlanChiffreEclate = { valeur: number; a: number; suffixe?: string; legende?: string; eclatA?: number };
/** Écrit un nombre à la française (virgule décimale, espace des milliers). */
export const ecrireNombre = (v: number) => (Number.isInteger(v) ? String(v).replace(/\B(?=(\d{3})+(?!\d))/g, " ") : String(v).replace(".", ","));
/** Passe du plan du réalisateur aux données du composant. */
export function chiffreEclateDepuisPlan(c: ContenuPlanChiffreEclate, debut: number, fin: number, visage?: BoiteVisage): DonneesChiffreEclate {
  const eclat = c.eclatA ?? c.a + T.eclateApres;
  return { debut, fin, nombres: [{ texte: ecrireNombre(c.valeur), a: c.a }], suffixe: c.suffixe, eclatA: c.eclatA, unite: c.legende ? { texte: c.legende, a: eclat + 0.06 } : undefined, visage };
}

const T = Object.freeze({ disque: 0.14, ecrase: 0.14, eclateApres: 0.42, gerbe: 0.46, onde: 0.22, unite: 0.16, sortie: 0.12 });
const ORANGE_CLAIR = "#CF6A3F";

/** Pseudo-hasard déterministe dans [0, 1[. */
const alea = (n: number) => {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};

/** Mise en page : centre, rayon du disque, taille du nombre, zone autorisée (px). */
function poser(d: DonneesChiffreEclate, W: number, H: number) {
  const v = d.visage ?? VISAGE_PRISE_LARGE;
  const zone = { x0: W * 0.035, x1: W * 0.965, y0: (v.y1 + 0.03) * H, y1: H * 0.955 };
  const hUnite = d.unite ? H * 0.085 : 0;
  const R = Math.max(W * 0.12, Math.min(W * 0.25, (zone.y1 - zone.y0 - hUnite) / 2.2));
  // Un peu à droite du centre du visage (le nombre « répond » à Will), sans jamais sortir du cadre.
  const cx = Math.min(zone.x1 - R * 1.2, Math.max(zone.x0 + R * 1.2, W * Math.max(0.5, (v.x0 + v.x1) / 2 + 0.1)));
  const cy = zone.y0 + R * 1.1;
  const suff = d.suffixe ? avanceEm(d.suffixe.toUpperCase()) * 0.5 : 0;
  const avance = Math.max(...d.nombres.map((x) => avanceEm(x.texte.toUpperCase()))) + suff;
  const taille = Math.min((1.62 * R) / Math.max(0.6, avance), 1.3 * R);
  return { zone, R, cx, cy, taille };
}

/** Course maximale depuis (x, y) dans la direction `ang` avant de toucher la zone, moins `marge`. */
function course(x: number, y: number, ang: number, zone: { x0: number; x1: number; y0: number; y1: number }, marge: number): number {
  const c = Math.cos(ang);
  const s = Math.sin(ang);
  const lim = [c > 1e-6 ? (zone.x1 - marge - x) / c : Infinity, c < -1e-6 ? (zone.x0 + marge - x) / c : Infinity, s > 1e-6 ? (zone.y1 - marge - y) / s : Infinity, s < -1e-6 ? (zone.y0 + marge - y) / s : Infinity];
  return Math.max(0, Math.min(...lim));
}

/** Direction aplatie : ce qui partait vers le haut part sur le côté (rien ne monte vers le visage). */
const versLeBas = (ang: number) => (Math.sin(ang) < 0 ? Math.atan2(Math.sin(ang) * 0.2, Math.cos(ang)) : ang);

/** Disque plein : dégradé orange, anneau sable intérieur. */
function Disque({ cx, cy, r }: { cx: number; cy: number; r: number }) {
  return (
    <>
      <defs>
        <radialGradient id="ce-disque" cx="42%" cy="38%" r="70%">
          <stop offset="0%" stopColor={ORANGE_CLAIR} />
          <stop offset="100%" stopColor={COULEURS.orange} />
        </radialGradient>
      </defs>
      <circle cx={cx} cy={cy} r={r} fill="url(#ce-disque)" />
      <circle cx={cx} cy={cy} r={r * 0.88} fill="none" stroke={COULEURS.sable} strokeOpacity={0.75} strokeWidth={Math.max(3, r * 0.022)} strokeDasharray={`${r * 0.05} ${r * 0.035}`} />
    </>
  );
}

/** Quartiers dentelés du disque et éclats sable, projetés vers l'extérieur et le bas, bornés au cadre. */
function Eclatement({ t, a, cx, cy, R, zone, graine }: { t: number; a: number; cx: number; cy: number; R: number; zone: { x0: number; x1: number; y0: number; y1: number }; graine: number }) {
  if (t < a || t > a + T.gerbe) return null;
  const p = progression(t, a, T.gerbe);
  const vol = 1 - (1 - p) ** 3;
  const N = 9;
  const quartiers = Array.from({ length: N }, (_, k) => {
    const a0 = (k / N) * 2 * Math.PI + alea(graine + k) * 0.2;
    const a1 = ((k + 1) / N) * 2 * Math.PI + alea(graine + k + 1) * 0.2;
    const mi = (a0 + a1) / 2;
    const rin = R * (0.12 + 0.18 * alea(graine + k * 2.3));
    // Contour du quartier, relatif à son centroïde (bord extérieur arrondi + cassure au milieu).
    const pts: [number, number][] = [
      [Math.cos(a0) * rin, Math.sin(a0) * rin],
      [Math.cos(a0) * R, Math.sin(a0) * R],
      [Math.cos(mi - 0.12) * R, Math.sin(mi - 0.12) * R],
      [Math.cos(mi) * R * (0.82 + 0.1 * alea(graine + k * 4.1)), Math.sin(mi) * R * (0.82 + 0.1 * alea(graine + k * 4.1))],
      [Math.cos(mi + 0.12) * R, Math.sin(mi + 0.12) * R],
      [Math.cos(a1) * R, Math.sin(a1) * R],
      [Math.cos(a1) * rin, Math.sin(a1) * rin],
    ];
    const gx = pts.reduce((s, q) => s + q[0], 0) / pts.length;
    const gy = pts.reduce((s, q) => s + q[1], 0) / pts.length;
    const dir = versLeBas(mi);
    const echelleFin = 0.42;
    const rayonQuartier = R * 0.55 * echelleFin;
    const voulu = R * (0.9 + 0.7 * alea(graine + k * 3.7));
    const portee = Math.min(voulu, course(cx + gx, cy + gy, dir, zone, rayonQuartier));
    const echelle = 1 - (1 - echelleFin) * p;
    const x = cx + gx + Math.cos(dir) * portee * vol;
    const y = cy + gy + Math.sin(dir) * portee * vol;
    const tour = (alea(graine + k * 5.7) - 0.5) * 140 * vol;
    const d = pts.map((q, j) => `${j ? "L" : "M"} ${(q[0] - gx).toFixed(1)} ${(q[1] - gy).toFixed(1)}`).join(" ") + " Z";
    return <path key={`q${k}`} d={d} fill={k % 4 === 2 ? COULEURS.sable : k % 2 ? ORANGE_CLAIR : COULEURS.orange} opacity={1 - progression(t, a + T.gerbe * 0.6, T.gerbe * 0.4)} transform={`translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${tour.toFixed(1)}) scale(${echelle.toFixed(3)})`} />;
  });
  const M = 14;
  const eclats = Array.from({ length: M }, (_, k) => {
    const dir = versLeBas((k / M) * 2 * Math.PI + alea(graine + k * 9.1) * 0.4);
    const taille = R * (0.05 + 0.06 * alea(graine + k * 7.3)) * (1 - 0.6 * p);
    const portee = Math.min(R * (1.5 + 0.6 * alea(graine + k * 3.1)), course(cx, cy, dir, zone, taille * 2));
    const x = cx + Math.cos(dir) * portee * vol;
    const y = cy + Math.sin(dir) * portee * vol;
    return <polygon key={`e${k}`} points={`0,${-taille} ${taille * 0.8},${taille * 0.7} ${-taille * 0.8},${taille * 0.5}`} fill={k % 3 ? COULEURS.sable : COULEURS.ivoire} opacity={1 - p * p} transform={`translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${(alea(graine + k) * 720 * p).toFixed(1)})`} />;
  });
  return (
    <>
      {quartiers}
      {eclats}
    </>
  );
}

/** Traits de vitesse rayonnants (ivoire), coupés s'ils sortiraient de la zone. */
function TraitsVitesse({ cx, cy, r0, longueur, angles, zone, epaisseur, opacite }: { cx: number; cy: number; r0: number; longueur: number; angles: number[]; zone: { x0: number; x1: number; y0: number; y1: number }; epaisseur: number; opacite: number }) {
  return (
    <g stroke={COULEURS.ivoire} strokeWidth={epaisseur} strokeLinecap="round" opacity={opacite}>
      {angles.map((ang, k) => {
        const x0 = cx + Math.cos(ang) * r0;
        const y0 = cy + Math.sin(ang) * r0;
        const l = Math.min(longueur, course(x0, y0, ang, zone, epaisseur));
        if (l < longueur * 0.4) return null;
        return <line key={k} x1={x0} y1={y0} x2={x0 + Math.cos(ang) * l} y2={y0 + Math.sin(ang) * l} />;
      })}
    </g>
  );
}

export function ChiffreEclate({ t, largeurImage: W, hauteurImage: H, donnees = EXEMPLE_CHIFFRE_ECLATE }: { t: number; largeurImage: number; hauteurImage: number; donnees?: DonneesChiffreEclate }) {
  const d = donnees;
  if (t < d.debut || t >= d.fin || d.nombres.length === 0) return null;
  const { zone, R, cx, cy, taille } = poser(d, W, H);
  const der = d.nombres.length - 1;
  const eclatDe = (j: number) => (j < der ? d.nombres[j + 1].a : d.eclatA ?? Math.min(d.nombres[der].a + T.eclateApres, d.unite ? d.unite.a - 0.06 : Infinity));
  // Nombre courant : le dernier dit à l'instant t.
  const i = d.nombres.reduce((k, n, j) => (t >= n.a ? j : k), 0);
  const n = d.nombres[i];
  const eI = eclatDe(i);
  const eDer = eclatDe(der);
  const fin = sortie(t, d.fin - T.sortie, T.sortie);
  // Le nombre s'écrase depuis l'objectif, puis encaisse l'éclatement (coup de poing 1 → 1,14 → 1).
  const ecrase = progression(t, n.a, T.ecrase);
  const arrivee = 2.3 - 1.3 * (1 - (1 - ecrase) ** 3);
  const coup = t >= eI ? Math.sin(Math.PI * progression(t, eI, 0.16)) * 0.14 : 0;
  const echelleNombre = (arrivee + coup) * (1 - fin);
  // Disque du nombre courant : s'ouvre avec dépassement, disparaît à l'éclatement (remplacé par ses quartiers).
  const disque = t < eI ? rebond(t, n.a, T.disque, 2.2) : 0;
  // Anneau rémanent : l'onde part à l'éclatement du dernier nombre et se fige à 1,02 R, puis tourne lentement.
  const onde = t >= eDer ? 1 - (1 - progression(t, eDer, T.onde)) ** 2 : 0;
  const rAnneau = R * (0.55 + 0.47 * onde) * (1 - 0.3 * fin);
  const epAnneau = Math.max(6, R * (0.1 - 0.04 * onde));
  const tourne = (t - eDer) * 40;
  // Traits de vitesse de l'arrivée (rentrent en 0,2 s), puis trois traits fixes à droite de l'anneau.
  const vitesse = 1 - progression(t, n.a, 0.22);
  const unite = d.unite && t >= d.unite.a ? d.unite : undefined;
  const pU = unite ? progression(t, unite.a, T.unite) : 0;
  const tailleU = d.unite ? Math.min(H * 0.056, (W * 0.78) / Math.max(1, avanceEm(d.unite.texte.toUpperCase()) * 1.12)) : 0;
  const yU = cy + R * 1.06 + tailleU * 0.15;
  const contour = Math.max(4, taille * 0.045);
  return (
    <div style={{ position: "absolute", left: 0, top: 0, width: W, height: H, pointerEvents: "none" }}>
      <svg width={W} height={H} style={{ position: "absolute", left: 0, top: 0 }}>
        {disque > 0 ? (
          <g transform={`translate(${cx} ${cy}) scale(${disque * (1 - fin)}) translate(${-cx} ${-cy})`}>
            <Disque cx={cx} cy={cy} r={R} />
          </g>
        ) : null}
        {vitesse > 0 && t >= n.a ? <TraitsVitesse cx={cx} cy={cy} r0={R * (1.08 + 0.15 * (1 - vitesse))} longueur={R * 0.42 * vitesse} angles={Array.from({ length: 12 }, (_, k) => (k / 12) * 2 * Math.PI + 0.13)} zone={zone} epaisseur={Math.max(4, R * 0.035)} opacite={0.95} /> : null}
        {d.nombres.map((_, j) => (
          <Eclatement key={j} t={t} a={eclatDe(j)} cx={cx} cy={cy} R={R} zone={zone} graine={j * 17 + 5} />
        ))}
        {onde > 0 ? (
          <g transform={`rotate(${tourne} ${cx} ${cy})`} opacity={1 - fin}>
            <circle cx={cx} cy={cy} r={rAnneau} fill="none" stroke={COULEURS.orange} strokeWidth={epAnneau} strokeLinecap="round" strokeDasharray={`${rAnneau * 2 * Math.PI * 0.62} ${rAnneau * 2 * Math.PI * 0.06} ${rAnneau * 2 * Math.PI * 0.2} ${rAnneau * 2 * Math.PI * 0.12}`} />
            <circle cx={cx} cy={cy} r={rAnneau + epAnneau * 1.6} fill="none" stroke={COULEURS.sable} strokeWidth={Math.max(3, epAnneau * 0.35)} strokeLinecap="round" strokeDasharray={`${rAnneau * 0.5} ${rAnneau * 0.9}`} />
          </g>
        ) : null}
        {onde >= 1 ? <TraitsVitesse cx={cx} cy={cy} r0={rAnneau + epAnneau * 3} longueur={R * 0.2} angles={[-0.45, 0, 0.45]} zone={zone} epaisseur={Math.max(4, R * 0.04)} opacite={1 - fin} /> : null}
      </svg>
      <div
        style={{
          position: "absolute",
          left: cx,
          top: cy,
          transform: `translate(-50%, -50%) scale(${echelleNombre}) rotate(${-3 * ecrase}deg)`,
          opacity: progression(t, n.a, 0.04),
          display: "flex",
          alignItems: "flex-start",
          fontFamily: POLICES.titre,
          lineHeight: 0.8,
          whiteSpace: "nowrap",
          filter: `drop-shadow(0 ${taille * 0.04}px ${taille * 0.06}px rgba(17, 10, 5, 0.55))`,
        }}
      >
        <span style={{ fontSize: taille, color: COULEURS.ivoire, WebkitTextStroke: `${contour * 2}px ${COULEURS.encre}`, paintOrder: "stroke fill", letterSpacing: -taille * 0.02 }}>{n.texte}</span>
        {d.suffixe ? <span style={{ fontSize: taille * 0.5, marginLeft: taille * 0.04, color: COULEURS.orange, WebkitTextStroke: `${contour * 1.4}px ${COULEURS.encre}`, paintOrder: "stroke fill" }}>{d.suffixe}</span> : null}
      </div>
      {unite ? (
        <div style={{ position: "absolute", left: cx, top: yU, transform: `translateX(-50%) scale(${1 - fin})`, transformOrigin: "50% 0%", display: "flex", flexDirection: "column", alignItems: "center" }}>
          <div style={{ clipPath: `inset(-20% ${(1 - pU) * 100}% -20% -5%)`, fontFamily: POLICES.titre, fontSize: tailleU, lineHeight: 1, color: COULEURS.ivoire, textTransform: "uppercase", letterSpacing: tailleU * 0.12, whiteSpace: "nowrap", WebkitTextStroke: `${Math.max(5, tailleU * 0.14)}px ${COULEURS.encre}`, paintOrder: "stroke fill" }}>{unite.texte}</div>
          <div style={{ marginTop: tailleU * 0.18, height: Math.max(6, tailleU * 0.14), width: `${100 * (1 - (1 - pU) ** 2)}%`, borderRadius: 999, background: COULEURS.orange }} />
        </div>
      ) : null}
    </div>
  );
}

/** Bruitage : [instant (s), son de `sons/` sans extension, volume] — le format que lit `VideoAnimee`. */
export type BruitageMotion = [number, string, number];

/** Souffle d'arrivée, « pop » + éclats à chaque éclatement, petit claquement de l'unité. */
export function bruitagesChiffreEclate(d: DonneesChiffreEclate = EXEMPLE_CHIFFRE_ECLATE): BruitageMotion[] {
  const s: BruitageMotion[] = [];
  const der = d.nombres.length - 1;
  d.nombres.forEach((n, j) => {
    s.push([n.a - 0.04, "maximize_006", 0.07]);
    const a = j < der ? d.nombres[j + 1].a : d.eclatA ?? Math.min(n.a + T.eclateApres, d.unite ? d.unite.a - 0.06 : Infinity);
    s.push([a, "drop_002", 0.14], [a + 0.02, "eclats", 0.08]);
  });
  if (d.unite) s.push([d.unite.a, "click_002", 0.08]);
  return s;
}
