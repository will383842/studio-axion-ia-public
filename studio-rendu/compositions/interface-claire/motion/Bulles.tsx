/**
 * FAMILLE « BULLES » (motion design hors cartes, designer n° 3, 15/10/2026) — bulles de questions qui flottent.
 *
 * Quand : les questions posées (« où part votre temps ? »), les doutes du dirigeant, les objections.
 * Visage : ENTIER. Peut OUVRIR une vidéo (2 à 4 bulles AUTOUR de la tête, dans des places mesurées hors du visage).
 *
 *  - Chaque bulle de pensée (nuage ivoire à festons, contour encre, ombre dure) naît à son mot : ses deux petites
 *    bulles de traîne sortent d'abord de la tête, puis le nuage éclot (0,2 s, rebond franc) sur un anneau orange qui
 *    s'élargit.
 *  - Les bulles MONTENT doucement et se balancent, chacune à son rythme et à sa propre inclinaison ; le signe seul
 *    (« ? », « ! », « … ») se dandine, les mots restent droits.
 *  - À `reponseA` (quand Will donne la réponse), elles ÉCLATENT l'une après l'autre (0,05 s d'écart) : gonflement de
 *    2 images, puis gerbe de 8 éclats et de gouttelettes qui s'envolent.
 * MARGES : tout (nuage, ombre, rebond, balancement, anneau, gerbe) reste à ≥ 40 px des bords de l'image ; la gerbe
 * ne descend jamais sur le visage (boîte autorisée par place).
 * TEXTE : les mots de la question DITE, avec son point d'interrogation (« Où part votre temps ? ») ; une petite bulle
 * peut porter « ? », « ! » ou « … » — deux petites bulles ne portent jamais le même signe.
 * Dure 1,5 à 3 s. Bruitage : petit « bloup » à chaque naissance, « pop » à chaque éclatement.
 */
import React from "react";
import { COULEURS, POLICES } from "../charte";
import { mesures } from "../elements";
import { progression, rebond } from "../mouvement";

export const ID_BULLES = "bulles";
export const DUREE_BULLES = Object.freeze({ min: 1.5, max: 3 });

export const FICHE_BULLES = Object.freeze({
  id: ID_BULLES,
  nom: "Bulles de questions qui flottent",
  visage: "entier" as const,
  /** Garde le visage libre : peut servir dans les premières secondes de la vidéo. */
  ouvertureAutorisee: true,
  dureeMin: DUREE_BULLES.min,
  dureeMax: DUREE_BULLES.max,
  quandUtiliser: "Les questions posées par Will (« où part votre temps ? »), les doutes du dirigeant, les objections ; elles éclatent quand il donne la réponse.",
});

export type BulleQuestion = {
  /** Mots de la question DITE par Will (2 à 4 mots, avec « ? »), ou un signe seul : « ? », « ! » ou « … ». */
  texte: string;
  /** Instant de naissance (s). */
  a: number;
};

export type BullesProps = {
  t: number;
  debut: number;
  fin: number;
  largeurImage: number;
  hauteurImage: number;
  /** 2 à 4 bulles ; la 1ʳᵉ prend la plus grande place, la 4ᵉ la plus petite (signe seul conseillé). */
  bulles: BulleQuestion[];
  /** Instant où Will donne la réponse : les bulles éclatent. Absent : elles sortent en rétrécissant à `fin`. */
  reponseA?: number;
};

/** Marge de sécurité (px sur une image de 1080 de large, proportionnelle sinon). */
const MARGE = 40;

/**
 * Places des bulles (fractions de L et H), MESURÉES hors du visage de la prise de référence (cheveux à 0,136 H,
 * menton 0,49 H, tête 0,18 → 0,66 L, oreilles comprises). Centre, demi-largeur, demi-hauteur, inclinaison de repos,
 * les deux petites bulles de traîne (centre et rayon en fraction de H, à ≥ 8 px des cheveux et ≥ 40 px des oreilles),
 * et la boîte où la gerbe d'éclatement a le droit d'aller (jamais sur le visage).
 */
const PLACES = [
  { x: 0.3, y: 0.077, rx: 0.215, ry: 0.043, incl: -3, traine: [{ x: 0.405, y: 0.118, r: 0.01 }, { x: 0.44, y: 0.128, r: 0.006 }], gerbe: { x0: 0, x1: 1, y0: 0, y1: 0.15 } },
  { x: 0.765, y: 0.108, rx: 0.165, ry: 0.05, incl: 3, traine: [{ x: 0.655, y: 0.162, r: 0.01 }, { x: 0.63, y: 0.174, r: 0.006 }], gerbe: { x0: 0.6, x1: 1, y0: 0, y1: 0.2 } },
  { x: 0.835, y: 0.33, rx: 0.1, ry: 0.04, incl: 9, traine: [{ x: 0.74, y: 0.318, r: 0.008 }, { x: 0.718, y: 0.305, r: 0.005 }], gerbe: { x0: 0.7, x1: 1, y0: 0.24, y1: 0.42 } },
  { x: 0.11, y: 0.43, rx: 0.06, ry: 0.032, incl: -11, traine: [{ x: 0.125, y: 0.388, r: 0.007 }, { x: 0.13, y: 0.37, r: 0.0045 }], gerbe: { x0: 0, x1: 0.2, y0: 0.38, y1: 0.5 } },
] as const;

/** Dérive verticale maximale (fraction de H) : les bulles montent sans jamais entrer dans le visage ni sortir du cadre. */
const DERIVE = 0.008;
/** Balancement horizontal (fraction de L). */
const BALANCE = 0.005;
/** Dépassement maximal du rebond d'éclosion. */
const DEPASSE = 1.12;
const ECLAT = 0.26;

/** Lobes du nuage : cercles répartis sur une ellipse (rx, ry), plus un cœur. */
function lobes(rx: number, ry: number): { x: number; y: number; r: number }[] {
  const n = Math.max(7, Math.round((rx / ry) * 4.5));
  const l: { x: number; y: number; r: number }[] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const r = ry * (0.55 + 0.12 * Math.sin(i * 2.3));
    l.push({ x: Math.cos(a) * (rx - r * 0.7), y: Math.sin(a) * (ry - r * 0.7), r });
  }
  return l;
}

/** Vrai si le texte est un signe seul (« ? », « ! », « … », « ?! »). */
const estSigne = (texte: string) => /^[?!.…\s]+$/.test(texte.trim()) && texte.trim().length <= 3;

/**
 * Deux petites bulles ne portent jamais le même signe : la seconde « ? » devient « … », la troisième « ! ».
 * Les mots ne sont jamais modifiés.
 */
function signesVaries(bulles: BulleQuestion[]): BulleQuestion[] {
  const vus = new Set<string>();
  const remplacants = ["…", "!", "?!"];
  return bulles.map((b) => {
    const s = b.texte.trim();
    if (!estSigne(s)) return b;
    if (!vus.has(s)) {
      vus.add(s);
      return b;
    }
    const r = remplacants.find((x) => !vus.has(x)) ?? s;
    vus.add(r);
    return { ...b, texte: r };
  });
}

export function Bulles(p: BullesProps) {
  const { t, debut, fin } = p;
  if (t < debut || t >= fin) return null;
  const W = p.largeurImage;
  const H = p.hauteurImage;
  const bulles = signesVaries(p.bulles.slice(0, 4));
  return (
    <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
      {bulles.map((b, i) => (
        <Bulle key={i} i={i} b={b} t={t} fin={fin} W={W} H={H} eclatA={p.reponseA !== undefined ? p.reponseA + i * 0.05 : undefined} />
      ))}
    </div>
  );
}

function Bulle({ i, b, t, fin, W, H, eclatA }: { i: number; b: BulleQuestion; t: number; fin: number; W: number; H: number; eclatA?: number }) {
  if (t < b.a) return null;
  const { contour, ombre } = mesures(W);
  const marge = (MARGE * W) / 1080;
  const place = PLACES[i];
  const rx = place.rx * W;
  const ry = place.ry * H;
  // Centre de repos, ramené si besoin pour que nuage + ombre + rebond + balancement + dérive restent dans la marge.
  const extX = rx * DEPASSE + BALANCE * W + contour;
  const extY = ry * DEPASSE + contour;
  const x0 = Math.min(Math.max(place.x * W, marge + extX), W - marge - extX - ombre);
  const y0 = Math.min(Math.max(place.y * H, marge + extY + DERIVE * H), H - marge - extY - ombre);
  const dt = t - b.a;
  // Montée douce + balancement propre à chaque bulle.
  const cx = x0 + Math.sin(dt * 2.4 + i * 1.7) * W * BALANCE;
  const cy = y0 - DERIVE * H * Math.min(1, dt / 2.5) + Math.sin(dt * 3.1 + i) * H * 0.002;

  // Naissance : traîne (2 petites bulles) puis nuage.
  const traine1 = rebond(t, b.a, 0.12, 2.5);
  const traine2 = rebond(t, b.a + 0.05, 0.12, 2.5);
  const nuage = rebond(t, b.a + 0.08, 0.2, 2.2);
  // Sortie : éclatement (à la réponse) ou rétrécissement à `fin`.
  const eclate = eclatA !== undefined && t >= eclatA;
  const gonfle = eclate ? 1 + 0.1 * progression(t, eclatA!, 0.08) : 1;
  const fini = eclate && t >= eclatA! + 0.08;
  const retrait = eclatA === undefined ? 1 - progression(t, fin - 0.15, 0.15) : 1;

  // La traîne suit la dérive de sa bulle (elle ne peut donc que s'éloigner de la tête).
  const ox = cx - place.x * W;
  const oy = cy - place.y * H;
  const [p1, p2] = place.traine.map((q) => ({ x: q.x * W + ox, y: q.y * H + oy, r: q.r * H }));

  const formes = lobes(rx, ry);
  const echelle = Math.max(0, (0.15 + 0.85 * nuage) * gonfle * retrait);
  const signe = estSigne(b.texte);
  const lignes = signe ? [b.texte.trim()] : couper(b.texte);
  const plusLongue = Math.max(...lignes.map((l) => l.length));
  const taille = signe ? ry * 1.25 : Math.min(ry * (lignes.length > 1 ? 0.55 : 0.62), (rx * 1.55) / Math.max(1, plusLongue * 0.66));
  const anneau = progression(t, b.a + 0.08, 0.3);
  const inclinaison = place.incl + (1 - nuage) * (i % 2 ? 14 : -14);

  return (
    <>
      {/* Anneau orange qui s'élargit à la naissance (borné au nuage dépassé : reste dans la marge). */}
      {anneau > 0 && anneau < 1 ? (
        <div style={{ position: "absolute", left: cx - rx * (0.6 + 0.5 * anneau), top: cy - ry * (0.6 + 0.5 * anneau), width: 2 * rx * (0.6 + 0.5 * anneau), height: 2 * ry * (0.6 + 0.5 * anneau), borderRadius: "50%", border: `${contour * 2.2 * (1 - anneau) + 1}px solid ${COULEURS.orange}`, boxSizing: "border-box" }} />
      ) : null}
      {!fini ? (
        <svg width={W} height={H} style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }}>
          {/* Traîne vers la tempe (sous le nuage). */}
          {[
            { q: p2, e: traine2 },
            { q: p1, e: traine1 },
          ].map(({ q, e }, k) =>
            e > 0 && !eclate ? (
              <g key={k}>
                <circle cx={q.x + ombre * 0.5} cy={q.y + ombre * 0.5} r={q.r * e * retrait} fill={COULEURS.encre} />
                <circle cx={q.x} cy={q.y} r={q.r * e * retrait} fill={COULEURS.ivoire} stroke={COULEURS.encre} strokeWidth={contour} />
              </g>
            ) : null,
          )}
          <g transform={`translate(${cx} ${cy}) rotate(${inclinaison}) scale(${echelle})`}>
            {/* Ombre dure, contour (cercles épaissis), puis remplissage : un seul contour continu autour des festons. */}
            <g transform={`translate(${ombre} ${ombre})`}>
              {formes.map((f, k) => (
                <circle key={k} cx={f.x} cy={f.y} r={f.r + contour} fill={COULEURS.encre} />
              ))}
              <ellipse cx={0} cy={0} rx={rx * 0.78 + contour} ry={ry * 0.62 + contour} fill={COULEURS.encre} />
            </g>
            {formes.map((f, k) => (
              <circle key={k} cx={f.x} cy={f.y} r={f.r + contour} fill={COULEURS.encre} />
            ))}
            <ellipse cx={0} cy={0} rx={rx * 0.78 + contour} ry={ry * 0.62 + contour} fill={COULEURS.encre} />
            {formes.map((f, k) => (
              <circle key={k} cx={f.x} cy={f.y} r={f.r} fill={COULEURS.ivoire} />
            ))}
            <ellipse cx={0} cy={0} rx={rx * 0.78} ry={ry * 0.62} fill={COULEURS.ivoire} />
          </g>
        </svg>
      ) : null}
      {!fini && echelle > 0.05 ? (
        <div
          style={{
            position: "absolute",
            left: cx,
            top: cy,
            transform: `translate(-50%, -50%) scale(${echelle}) rotate(${signe ? place.incl * 1.4 + Math.sin(dt * 6 + i) * 10 : place.incl * 0.5}deg)`,
            fontFamily: POLICES.titre,
            fontSize: taille,
            lineHeight: 1,
            color: signe ? COULEURS.orange : COULEURS.encre,
            WebkitTextStroke: signe ? `${Math.max(2, taille * 0.04)}px ${COULEURS.encre}` : undefined,
            paintOrder: "stroke fill",
            textTransform: "uppercase",
            whiteSpace: "nowrap",
            textAlign: "center",
          }}
        >
          {lignes.map((l, k) => (
            <div key={k}>{l}</div>
          ))}
        </div>
      ) : null}
      {eclate ? <Eclats t={t} a={eclatA! + 0.08} cx={cx} cy={cy} rx={rx} ry={ry} contour={contour} graine={i} boite={{ x0: Math.max(marge, place.gerbe.x0 * W), x1: Math.min(W - marge, place.gerbe.x1 * W), y0: Math.max(marge, place.gerbe.y0 * H), y1: Math.min(H - marge, place.gerbe.y1 * H) }} /> : null}
    </>
  );
}

/**
 * Coupe un texte de plus de 12 signes en deux lignes équilibrées (au mot près, sur les espaces ORDINAIRES seulement :
 * l'espace insécable avant « ? » garde le point d'interrogation collé à son mot).
 */
function couper(texte: string): string[] {
  const mots = texte.trim().split(/ +/);
  if (mots.length < 2 || texte.length <= 12) return [texte.trim()];
  let meilleur = 1;
  let ecart = Infinity;
  for (let k = 1; k < mots.length; k++) {
    const d = Math.abs(mots.slice(0, k).join(" ").length - mots.slice(k).join(" ").length);
    if (d < ecart) [ecart, meilleur] = [d, k];
  }
  return [mots.slice(0, meilleur).join(" "), mots.slice(meilleur).join(" ")];
}

/**
 * Gerbe d'éclatement : 8 traits encre/orange qui jaillissent et 6 gouttelettes ivoire qui s'envolent. Chaque direction
 * est comprimée pour que la gerbe reste dans sa `boite` (marges de l'image, jamais sur le visage).
 */
function Eclats({ t, a, cx, cy, rx, ry, contour, graine, boite }: { t: number; a: number; cx: number; cy: number; rx: number; ry: number; contour: number; graine: number; boite: { x0: number; x1: number; y0: number; y1: number } }) {
  const u = progression(t, a, ECLAT);
  if (u <= 0 || u >= 1) return null;
  const k = 1 - (1 - u) ** 3;
  // Portée maximale de la gerbe dans chaque direction (traits 1,5 rx / 2,1 ry ; gouttes 1,4 rx / 2,0 ry).
  const portX = rx * 1.55 + contour * 2;
  const portY = ry * 2.3 + contour * 2;
  const kG = Math.max(0, Math.min(1, (cx - boite.x0) / portX));
  const kD = Math.max(0, Math.min(1, (boite.x1 - cx) / portX));
  const kH = Math.max(0, Math.min(1, (cy - boite.y0) / portY));
  const kB = Math.max(0, Math.min(1, (boite.y1 - cy) / portY));
  const pos = (dx: number, dy: number) => [cx + dx * (dx < 0 ? kG : kD), cy + dy * (dy < 0 ? kH : kB)] as const;
  return (
    <svg width={1} height={1} style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }}>
      {Array.from({ length: 8 }, (_, i) => {
        const ang = (i / 8) * Math.PI * 2 + graine * 0.4;
        const r0 = 0.55 + 0.6 * k;
        const r1 = r0 + 0.35 * (1 - u);
        const [x1, y1] = pos(Math.cos(ang) * rx * r0, Math.sin(ang) * ry * r0 * 1.4);
        const [x2, y2] = pos(Math.cos(ang) * rx * r1, Math.sin(ang) * ry * r1 * 1.4);
        return <line key={`t${i}`} x1={x1} y1={y1} x2={x2} y2={y2} stroke={i % 2 ? COULEURS.orange : COULEURS.encre} strokeWidth={contour * 2} strokeLinecap="round" />;
      })}
      {Array.from({ length: 6 }, (_, i) => {
        const ang = ((i + 0.5) / 6) * Math.PI * 2 + graine;
        const r = 0.5 + 0.9 * k;
        const [x, y] = pos(Math.cos(ang) * rx * r, Math.sin(ang) * ry * r * 1.3 - ry * 0.6 * k);
        return <circle key={`g${i}`} cx={x} cy={y} r={ry * 0.13 * (1 - u)} fill={COULEURS.ivoire} stroke={COULEURS.encre} strokeWidth={contour * 0.8} />;
      })}
    </svg>
  );
}

/** Bruitage : [instant (s), son de `sons/` sans extension, volume]. Aucune musique. */
export type BruitageMotion = [number, string, number];

/** « Bloup » à chaque naissance (sons de goutte, alternés), « pop » à chaque éclatement. */
export function bruitagesBulles(p: Pick<BullesProps, "bulles" | "reponseA">): BruitageMotion[] {
  const gouttes = ["drop_002", "drop_003", "drop_001", "drop_004"];
  const s: BruitageMotion[] = p.bulles.slice(0, 4).map((b, i) => [b.a + 0.06, gouttes[i], 0.05]);
  if (p.reponseA !== undefined) p.bulles.slice(0, 4).forEach((_, i) => s.push([+(p.reponseA! + i * 0.05 + 0.08).toFixed(3), i % 2 ? "click_002" : "click_003", 0.06]));
  return s;
}

/** Espace fine insécable (typographie française avant « ? » et « ! »). */
const FINE = " ";

export const EXEMPLE_BULLES = {
  phrase: "Où part votre temps ? Par où commencer ? La réponse : vos tâches qui se répètent.",
  duree: 3.4,
  mots: [
    { texte: "Où", a: 0.0 },
    { texte: "part", a: 0.14 },
    { texte: "votre", a: 0.3 },
    { texte: "temps ?", a: 0.46 },
    { texte: "Par", a: 1.0 },
    { texte: "où", a: 1.12 },
    { texte: "commencer ?", a: 1.22 },
    { texte: "La", a: 1.95 },
    { texte: "réponse :", a: 2.05 },
    { texte: "vos", a: 2.55 },
    { texte: "tâches", a: 2.66 },
    { texte: "qui", a: 2.95 },
    { texte: "se", a: 3.02 },
    { texte: "répètent.", a: 3.08 },
  ],
  proprietes: {
    debut: 0.0,
    fin: 2.95,
    bulles: [
      { texte: `Où part votre temps${FINE}?`, a: 0.1 },
      { texte: `Par où commencer${FINE}?`, a: 1.05 },
      { texte: "?", a: 0.6 },
      { texte: "?", a: 1.5 },
    ],
    reponseA: 2.55,
  } satisfies Omit<BullesProps, "t" | "largeurImage" | "hauteurImage">,
  /** Instants de contrôle : construction (2ᵉ bulle qui éclot), état complet (4 bulles), éclatement en gerbe. */
  instantConstruction: 1.15,
  instantComplet: 1.9,
  instantEclat: 2.72,
};
