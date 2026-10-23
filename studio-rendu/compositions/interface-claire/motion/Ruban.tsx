/**
 * FAMILLE « RUBAN » (motion design hors cartes, designer n° 3, 15/10/2026) — ruban défilant de mots-clés.
 *
 * Quand : un passage riche en mots-clés (offre, interventions, domaines) qu'on montrerait sinon avec une carte « frise ».
 * Visage : ENTIER. Peut OUVRIR une vidéo (le visage reste libre).
 *
 *  - Une bande ORANGE inclinée de 6° (montant vers la droite) se déroule depuis le bord gauche (0,26 s, léger rebond) ;
 *    les mots-clés y défilent vers la gauche, majuscules séparées par des losanges. Le défilement n'est PAS uniforme :
 *    la bande file, puis vient se CALER pour que le mot que Will prononce s'arrête pile au centre de l'image (largeur),
 *    y glisse à peine pendant qu'il s'allume, puis repart vers le mot suivant (effet « bande de machine à écrire »).
 *  - Une seconde bande ENCRE, plus bas, se déroule depuis la droite 0,1 s après et défile en sens inverse à vitesse
 *    constante, en lettres ivoire évidées (contour seul).
 *  - Mot TERNE (pas encore dit) : encre à 38 % sur la bande orange, contour ivoire sur la bande encre. Sur son mot, toutes
 *    ses occurrences s'allument : plaque ivoire (bande orange) ou orange (bande encre) avec un pop, et les bandes
 *    « cognent » (+6 %). Ensuite le mot reste allumé (ivoire plein).
 *  - Sortie : chaque bande s'enroule vers le bord opposé à son entrée (0,2 s), terminée à `fin`.
 *
 * PLACEMENT : par défaut les bandes vivent SOUS la zone des sous-titres (0,51 → 0,72 H) et sous le micro : bande orange
 * centrée à 0,79 H, bande encre à 0,875 H. Elles croisent le buste et le haut des mains : le réalisateur évite ce
 * passage si Will fait un geste qui porte le sens à ce moment-là.
 * MOTS : uniquement des mots DITS dans la phrase (`motsClesNonDits` les contrôle). Aucun mot plaqué.
 * Dure 1,5 à 3 s. Bruitage : souffle d'entrée, roulement léger continu, « select » à chaque mot, souffle de sortie.
 */
import React from "react";
import { Easing } from "remotion";
import { COULEURS, POLICES, largeurTexte } from "../charte";
import { mesures } from "../elements";
import { progression, rebond, sortie } from "../mouvement";

export const ID_RUBAN = "ruban";
/** Durée conseillée (s). */
export const DUREE_RUBAN = Object.freeze({ min: 1.5, max: 3 });

export const FICHE_RUBAN = Object.freeze({
  id: ID_RUBAN,
  nom: "Ruban défilant de mots-clés",
  visage: "entier" as const,
  /** Garde le visage libre : peut servir dans les premières secondes de la vidéo. */
  ouvertureAutorisee: true,
  dureeMin: DUREE_RUBAN.min,
  dureeMax: DUREE_RUBAN.max,
  quandUtiliser: "Un passage riche en mots-clés DITS (offre, interventions, domaines), à la place d'une carte « frise ». 2 à 6 mots-clés.",
});

export type MotCleRuban = {
  /** Mot-clé DIT par Will (affiché en majuscules). */
  texte: string;
  /** Instant (s) où Will le prononce : il s'allume et se cale au centre à cet instant. */
  a: number;
};

export type RubanProps = {
  /** Temps courant (s), même horloge que `debut`, `fin` et les `a`. */
  t: number;
  debut: number;
  fin: number;
  largeurImage: number;
  hauteurImage: number;
  /** 2 à 6 mots-clés, dans l'ordre où ils sont dits. */
  motsCles: MotCleRuban[];
  /** Centre de la bande orange (fraction de H). Défaut 0,79 : sous les sous-titres et le micro. */
  centreY?: number;
};

/** Géométrie (fractions de H, sauf mention). */
const G = Object.freeze({
  centreOrange: 0.79,
  /** Écart vertical entre les centres des deux bandes. */
  ecart: 0.085,
  hauteurOrange: 0.068,
  hauteurEncre: 0.052,
  angleOrange: -6,
  angleEncre: -2.5,
  /** Longueur des bandes (fraction de la LARGEUR) : déborde des deux côtés malgré l'inclinaison. */
  longueur: 1.45,
  /** Vitesse de la bande encre (fraction de la LARGEUR par seconde). */
  vitesseEncre: 0.3,
  /** Bande orange : glissement lent pendant qu'un mot est calé (fraction de L / s) et avance minimale entre deux mots. */
  glisse: 0.035,
  avanceMin: 0.3,
  /** Élan d'arrivée avant le premier mot (fraction de L). */
  elan: 0.55,
  entree: 0.26,
  retardEncre: 0.1,
  sortie: 0.2,
  /** Durée de la plaque d'allumage d'un mot (s), et durée du calage au centre. */
  flash: 0.36,
});

/** Opacité d'un mot terne (encre) sur la bande orange. */
const TERNE = 0.38;

type Bande = {
  cy: number;
  h: number;
  angle: number;
  /** +1 : défile vers la gauche ; −1 : vers la droite. */
  sens: 1 | -1;
  fond: string;
  entreeA: number;
  /** Côté d'où la bande se déroule. */
  depuis: "gauche" | "droite";
  evidee: boolean;
  /** Vrai : la bande se cale sur chaque mot dit (bande orange). */
  calee: boolean;
};

type UniteRuban = { mot?: MotCleRuban; x: number; l: number };

/** Normalise un mot pour la comparaison (minuscules, sans accents ni ponctuation). */
const norme = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9' -]/g, "")
    .trim();

/**
 * Contrôle « aucun mot plaqué » : renvoie les mots-clés dont au moins un mot n'est PAS dans la transcription `mots`.
 * Le réalisateur n'emploie le ruban que si la liste est vide.
 */
export function motsClesNonDits(motsCles: MotCleRuban[], mots: { texte: string }[]): MotCleRuban[] {
  const dits = new Set(mots.map((m) => norme(m.texte)));
  return motsCles.filter((k) => norme(k.texte).split(/\s+/).some((m) => m && !dits.has(m)));
}

export function Ruban(p: RubanProps) {
  const { t, debut, fin } = p;
  if (t < debut || t >= fin || p.motsCles.length === 0) return null;
  const H = p.hauteurImage;
  const cy = (p.centreY ?? G.centreOrange) * H;
  const bandes: Bande[] = [
    { cy, h: G.hauteurOrange * H, angle: G.angleOrange, sens: 1, fond: COULEURS.orange, entreeA: debut, depuis: "gauche", evidee: false, calee: true },
    { cy: cy + G.ecart * H, h: G.hauteurEncre * H, angle: G.angleEncre, sens: -1, fond: COULEURS.encre, entreeA: debut + G.retardEncre, depuis: "droite", evidee: true, calee: false },
  ];
  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none" }}>
      {/* La bande encre passe SOUS la bande orange. */}
      <BandeDefilante p={p} b={bandes[1]} />
      <BandeDefilante p={p} b={bandes[0]} />
    </div>
  );
}

/** Motif répété : mot ◆ mot ◆ … (largeurs estimées, stables d'une image à l'autre). */
function motif(motsCles: MotCleRuban[], taille: number, espacement: number): { unites: UniteRuban[]; periode: number } {
  const pad = taille * 0.42;
  const largeurLosange = taille * 1.25;
  const unites: UniteRuban[] = [];
  let x = 0;
  for (const m of motsCles) {
    const l = largeurTexte(m.texte, taille, espacement) + 2 * pad;
    unites.push({ mot: m, x, l });
    x += l;
    unites.push({ x, l: largeurLosange });
    x += largeurLosange;
  }
  return { unites, periode: Math.max(1, x) };
}

/** Plus petite valeur ≥ `min` congrue à `c` modulo `P`. */
const auMoins = (c: number, P: number, min: number) => c + Math.ceil((min - c) / P) * P;

/**
 * Déplacement de la bande calée (px, croissant) : arrive avec élan sur le 1ᵉʳ mot, se cale sur chaque mot dit
 * (centre du mot = centre de l'image), y glisse lentement pendant l'allumage, puis file (accélération / freinage)
 * vers le mot suivant.
 */
function deplacementCale(t: number, entreeA: number, fin: number, motsCles: MotCleRuban[], unites: UniteRuban[], P: number, L: number, W: number): number {
  const glisse = G.glisse * W;
  const cibles: { a: number; d: number; tenue: number }[] = [];
  let min = -Infinity;
  const motsU = unites.filter((u) => u.mot);
  for (let j = 0; j < motsCles.length; j++) {
    const u = motsU[j];
    const a = Math.max(motsCles[j].a, entreeA + 0.12);
    const suivant = j + 1 < motsCles.length ? Math.max(motsCles[j + 1].a, entreeA + 0.12) : fin;
    const tenue = Math.max(0, Math.min(G.flash, suivant - a - 0.14));
    const c = u.x + u.l / 2 - L / 2;
    const d = j === 0 ? auMoins(c, P, G.elan * W) : auMoins(c, P, min);
    cibles.push({ a, d, tenue });
    min = d + glisse * tenue + G.avanceMin * W;
  }
  const premier = cibles[0];
  if (t <= premier.a) {
    const u = Easing.out(Easing.cubic)(Math.max(0, Math.min(1, (t - entreeA) / Math.max(0.05, premier.a - entreeA))));
    return premier.d * u;
  }
  for (let j = 0; j < cibles.length; j++) {
    const c = cibles[j];
    const finTenue = c.a + c.tenue;
    if (t <= finTenue) return c.d + glisse * (t - c.a);
    const s = cibles[j + 1];
    if (!s) return c.d + glisse * c.tenue + glisse * 1.5 * (t - finTenue);
    if (t <= s.a) {
      const depart = c.d + glisse * c.tenue;
      const u = Easing.inOut(Easing.cubic)((t - finTenue) / Math.max(0.01, s.a - finTenue));
      return depart + (s.d - depart) * u;
    }
  }
  return 0;
}

function BandeDefilante({ p, b }: { p: RubanProps; b: Bande }) {
  const { t, fin } = p;
  const W = p.largeurImage;
  const { contour, ombre } = mesures(W);
  if (t < b.entreeA) return null;

  const L = G.longueur * W;
  // Entrée : la bande se DÉROULE depuis son bord (découpe qui avance, texte jamais déformé), avec une rotation qui se
  // pose en léger rebond. Sortie : la découpe repart du même bord et la bande file vers le bord opposé, finie à `fin`.
  const e = rebond(t, b.entreeA, G.entree, 1.25);
  const s = sortie(t, fin - G.sortie, G.sortie);
  const visible = Math.min(1, Math.max(0, e));
  const cache = L * (1 - visible);
  const parti = L * s;
  const clip = b.depuis === "gauche" ? `inset(0px ${cache}px 0px ${parti}px)` : `inset(0px ${parti}px 0px ${cache}px)`;
  const angle = b.angle + (1 - e) * (b.depuis === "gauche" ? -5 : 5);

  // « Coup » : la bande cogne (+6 %) quand un mot-clé est dit.
  let coup = 0;
  for (const m of p.motsCles) coup = Math.max(coup, Math.sin(Math.PI * progression(t, m.a, 0.16)));
  const echelle = 1 + 0.06 * coup;
  // Marge de découpe au-dessus et au-dessous : l'ombre dure et le « coup » ne sont jamais rognés.
  const marge = b.h * 0.25 + ombre;

  const taille = b.h * 0.5;
  const espacement = taille * 0.05;
  const { unites, periode } = motif(p.motsCles, taille, espacement);

  // Défilement : calé sur les mots (bande orange) ou constant avec élan (bande encre).
  const dt = t - b.entreeA;
  let deplacement: number;
  if (b.calee) deplacement = deplacementCale(t, b.entreeA, fin, p.motsCles, unites, periode, L, W);
  else {
    const v = G.vitesseEncre * W;
    deplacement = v * dt + v * 0.35 * (1 - Math.exp(-dt * 5));
  }
  const decalage = ((deplacement % periode) + periode) % periode;
  const repetitions = Math.ceil(L / periode) + 2;

  const items: React.ReactNode[] = [];
  for (let k = -1; k < repetitions; k++) {
    for (let i = 0; i < unites.length; i++) {
      const u = unites[i];
      const gauche = k * periode + u.x + (b.sens === 1 ? -decalage : decalage - periode);
      if (gauche + u.l < -periode * 0.1 || gauche > L + periode * 0.1) continue;
      items.push(<Unite key={`${k}-${i}`} u={u} gauche={gauche} b={b} t={t} taille={taille} espacement={espacement} contour={contour} />);
    }
  }

  return (
    <div
      style={{
        position: "absolute",
        left: (W - L) / 2,
        top: b.cy - b.h / 2 - marge,
        width: L,
        height: b.h + 2 * marge,
        transform: `rotate(${angle}deg)`,
        transformOrigin: "50% 50%",
        clipPath: clip,
      }}
    >
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: marge,
          height: b.h,
          transform: `scale(${echelle})`,
          transformOrigin: "50% 50%",
          background: b.fond,
          borderTop: `${contour}px solid ${COULEURS.encre}`,
          borderBottom: `${contour}px solid ${COULEURS.encre}`,
          boxShadow: `0 ${ombre}px 0 ${COULEURS.encre}`,
          boxSizing: "border-box",
          overflow: "hidden",
        }}
      >
        {/* Filets intérieurs : aspect « ruban adhésif ». */}
        {[0.13, 0.87].map((f) => (
          <div key={f} style={{ position: "absolute", left: 0, right: 0, top: `${f * 100}%`, height: Math.max(2, contour * 0.6), background: b.evidee ? COULEURS.orange : COULEURS.ivoire, opacity: b.evidee ? 0.85 : 0.4 }} />
        ))}
        {items}
      </div>
    </div>
  );
}

function Unite({ u, gauche, b, t, taille, espacement, contour }: { u: UniteRuban; gauche: number; b: Bande; t: number; taille: number; espacement: number; contour: number }) {
  const base: React.CSSProperties = { position: "absolute", left: gauche, top: 0, width: u.l, height: "100%", display: "flex", alignItems: "center", justifyContent: "center" };
  if (!u.mot) {
    const c = taille * 0.42;
    return (
      <div style={base}>
        <div style={{ width: c, height: c, transform: "rotate(45deg)", background: b.evidee ? COULEURS.orange : COULEURS.ivoire, border: b.evidee ? undefined : `${Math.max(2, contour * 0.6)}px solid ${COULEURS.encre}` }} />
      </div>
    );
  }
  const m = u.mot;
  const dit = t >= m.a;
  const flash = dit && t < m.a + G.flash;
  const pop = flash ? 0.82 + 0.18 * rebond(t, m.a, 0.14, 2.6) : 1;
  const plaque = flash ? (b.evidee ? COULEURS.orange : COULEURS.ivoire) : undefined;
  let couleur: string;
  let trait: string | undefined;
  let opacite = 1;
  if (b.evidee) {
    couleur = dit ? (flash ? COULEURS.ivoire : COULEURS.orange) : "transparent";
    trait = dit ? undefined : `${Math.max(2, taille * 0.045)}px ${COULEURS.ivoire}`;
  } else if (!dit) {
    // Terne : encre transparente (jamais un orange délavé illisible).
    couleur = COULEURS.encre;
    opacite = TERNE;
  } else {
    couleur = flash ? COULEURS.orange : COULEURS.ivoire;
  }
  return (
    <div style={base}>
      {plaque ? (
        <div style={{ position: "absolute", left: taille * 0.12, right: taille * 0.12, top: "14%", bottom: "14%", background: plaque, border: `${contour}px solid ${COULEURS.encre}`, borderRadius: taille * 0.22, transform: `scale(${pop})` }} />
      ) : null}
      <span
        style={{
          position: "relative",
          fontFamily: POLICES.titre,
          fontSize: taille,
          lineHeight: 1,
          letterSpacing: espacement,
          textTransform: "uppercase",
          whiteSpace: "nowrap",
          color: couleur,
          WebkitTextStroke: trait,
          opacity: opacite,
          transform: `scale(${pop})`,
        }}
      >
        {m.texte}
      </span>
    </div>
  );
}

/** Bruitage : [instant (s), son de `sons/` sans extension, volume]. Aucune musique. */
export type BruitageMotion = [number, string, number];

/** Souffle d'entrée, roulement léger (tic sourd toutes les 0,07 s), « select » sur chaque mot, souffle de sortie. */
export function bruitagesRuban(p: Pick<RubanProps, "debut" | "fin" | "motsCles">): BruitageMotion[] {
  const s: BruitageMotion[] = [[p.debut, "whoosh-in", 0.22]];
  for (let a = p.debut + 0.12; a < p.fin - G.sortie - 1e-6; a += 0.07) s.push([+a.toFixed(3), "tick_004", 0.014]);
  for (const m of p.motsCles) if (m.a >= p.debut && m.a < p.fin) s.push([m.a, "select_002", 0.04]);
  s.push([p.fin - G.sortie, "whoosh-out", 0.2]);
  return s;
}

/** Exemple : phrase, instants des mots (s) et fenêtre de la famille. Tous les mots-clés sont DITS. */
export const EXEMPLE_RUBAN = {
  phrase: "On intervient en formation, en conseil et en automatisation, directement sur vos outils.",
  duree: 3.4,
  mots: [
    { texte: "On", a: 0.0 },
    { texte: "intervient", a: 0.12 },
    { texte: "en", a: 0.5 },
    { texte: "formation,", a: 0.6 },
    { texte: "en", a: 1.1 },
    { texte: "conseil", a: 1.2 },
    { texte: "et", a: 1.6 },
    { texte: "en", a: 1.7 },
    { texte: "automatisation,", a: 1.8 },
    { texte: "directement", a: 2.55 },
    { texte: "sur", a: 2.9 },
    { texte: "vos", a: 3.0 },
    { texte: "outils.", a: 3.1 },
  ],
  proprietes: {
    debut: 0.4,
    fin: 3.4,
    motsCles: [
      { texte: "Formation", a: 0.6 },
      { texte: "Conseil", a: 1.2 },
      { texte: "Automatisation", a: 1.8 },
      { texte: "Vos outils", a: 3.0 },
    ],
  } satisfies Omit<RubanProps, "t" | "largeurImage" | "hauteurImage">,
  /** Instants de contrôle : construction (mots ternes, bande qui file) et état complet (mot calé au centre). */
  instantConstruction: 0.5,
  instantComplet: 1.95,
};
