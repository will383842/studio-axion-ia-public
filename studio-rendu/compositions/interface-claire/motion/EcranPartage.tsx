/**
 * FAMILLE « ÉCRAN PARTAGÉ AVANT / APRÈS » (`ecran-partage`) — motion designer n° 1, 15/10/2026 (révision 2).
 *
 * Quand : une opposition DITE par Will (avant/après, sans/avec, eux/vous, soirées/week-end). Deux par vidéo au plus,
 * JAMAIS dans les 4 premières secondes (retour de Will : le visage ne doit pas être caché trop tôt).
 * Visage : COUVERT (le panneau du haut cache tout le visage, des cheveux au menton).
 *
 * Langage volontairement DIFFÉRENT des cartes : pas de tuile, pas de cadre arrondi, pas d'icône au centre d'une boîte.
 * Ce sont de GRANDS DESSINS seuls (pile de papiers, crayon, lune, sablier / soleil, transat, coche), tracés au trait épais,
 * posés directement sur le fond, comme une petite scène illustrée.
 *
 * Mouvement :
 *  - l'écran se coupe en deux panneaux le long d'une diagonale : le panneau « Avant » (encre hachurée) glisse depuis la
 *    GAUCHE, le panneau « Après » (orange, rayons de soleil qui tournent lentement) depuis la DROITE, 2 images plus tard ;
 *    un trait ivoire se tire entre les deux et une pastille « bascule » tourne au milieu ; « APRÈS » arrive avec son panneau ;
 *  - côté Avant, sur leur mot, les dessins TERNES tombent lourdement et restent de travers ;
 *  - côté Après, sur leur mot, les dessins VIFS sautent (rebond franc) avec une gerbe de traits, puis respirent ;
 *  - sortie : les deux panneaux repartent en sens contraire (croisement) et découvrent la prise.
 *  Durée bornée à 1,5-2,5 s. Bruitage : glissement double à l'entrée, glissement double à la sortie.
 *
 * Calque à poser AU-DESSUS de la prise (qui ne bouge jamais). Zone laissée aux sous-titres : rien sous 0,86 H.
 * Textes : uniquement des mots dits par Will.
 */
import React from "react";
import { COULEURS, POLICES, largeurTexte } from "../charte";
import { mesures } from "../elements";
import { progression, rebond, sortie } from "../mouvement";

export const ID_ECRAN_PARTAGE = "ecran-partage";

/** Dessins propres à cette famille (aucun n'est une icône de carte). */
export type DessinPartage = "pile-papiers" | "crayon" | "lune" | "sablier" | "soleil" | "transat" | "coche";
export const DESSINS_PARTAGE: readonly DessinPartage[] = Object.freeze(["pile-papiers", "crayon", "lune", "sablier", "soleil", "transat", "coche"]);

export type DessinDit = { dessin: DessinPartage; texte: string; a: number };

export type DonneesEcranPartage = {
  debut: number;
  /** Fin souhaitée ; la durée est ramenée dans [1,5 ; 2,5] s. */
  fin: number;
  titreAvant: string;
  titreApres: string;
  /** 1 ou 2 dessins par côté, chacun sur son mot. */
  avant: DessinDit[];
  apres: DessinDit[];
};

export const EXEMPLE_PHRASE_ECRAN_PARTAGE = "Les soirées sur les devis, les relances à la main… ses équipes ont retrouvé leur après-midi, et lui son week-end.";
export const EXEMPLE_ECRAN_PARTAGE: DonneesEcranPartage = {
  debut: 0.1,
  fin: 2.5,
  titreAvant: "Avant",
  titreApres: "Après",
  avant: [
    { dessin: "pile-papiers", texte: "Les devis", a: 0.42 },
    { dessin: "crayon", texte: "À la main", a: 0.78 },
  ],
  apres: [
    { dessin: "soleil", texte: "L'après-midi", a: 1.32 },
    { dessin: "transat", texte: "Le week-end", a: 1.7 },
  ],
};
export const INSTANTS_ECRAN_PARTAGE = Object.freeze({ construction: 0.9, complete: 2.0 });

export const FICHE_ECRAN_PARTAGE = Object.freeze({
  id: ID_ECRAN_PARTAGE,
  nom: "Écran partagé avant / après",
  visage: "couvert" as const,
  /** Jamais avant cet instant de la vidéo (s). */
  pasAvant: 4,
  parVideoMax: 2,
  dureeMin: 1.5,
  dureeMax: 2.5,
  quandUtiliser: "Opposition dite : avant/après, sans/avec, eux/vous, soirées/week-end. Deux par vidéo au plus, jamais avant 4 s.",
});

const ENTREE = 0.2;
const DECALAGE = 0.08;
const SORTIE = 0.17;
/** Diagonale de coupe (fraction de H) : 0,575 à gauche, 0,505 à droite — le panneau du haut couvre tout le visage. */
const COUPE = Object.freeze({ gauche: 0.575, droite: 0.505 });
/** Dérivés autorisés de la charte. */
const ENCRE_RELEVEE = "#2A1E15";
const ORANGE_CLAIR = "#C2603A";
const IVOIRE_70 = "rgba(233, 220, 200, 0.7)";

export function tempsEcranPartage(d: DonneesEcranPartage) {
  const duree = Math.min(FICHE_ECRAN_PARTAGE.dureeMax, Math.max(FICHE_ECRAN_PARTAGE.dureeMin, d.fin - d.debut));
  return { fin: d.debut + duree, sortie: d.debut + duree - SORTIE };
}

/** Taille (px) qui fait tenir un texte en capitales dans `largeur`. */
const tailleCapitales = (texte: string, largeur: number, max: number) => Math.min(max, largeur / Math.max(1e-6, largeurTexte(texte, 1)));

/** Petite étoile à 4 branches (centre, rayon) dans le repère 100 × 100. */
const etoile = (x: number, y: number, r: number) => `M${x} ${y - r} Q${x} ${y} ${x + r} ${y} Q${x} ${y} ${x} ${y + r} Q${x} ${y} ${x - r} ${y} Q${x} ${y} ${x} ${y - r} Z`;

/**
 * Un dessin (repère 100 × 100), au trait épais. `vif` : remplissage ivoire, trait encre, accents encre pleins ;
 * terne : remplissage encre relevée, trait sable éteint. `vie` (0..∞, s) anime les détails (rayons qui tournent…).
 */
function Dessin({ nom, taille, vif, vie }: { nom: DessinPartage; taille: number; vif: boolean; vie: number }) {
  const trait = vif ? COULEURS.encre : COULEURS.sable;
  const plein = vif ? COULEURS.ivoire : ENCRE_RELEVEE;
  const accent = vif ? COULEURS.encre : "rgba(191, 168, 139, 0.55)";
  const sw = 5;
  const p = { stroke: trait, strokeWidth: sw, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  let corps: React.ReactNode = null;
  switch (nom) {
    case "pile-papiers":
      corps = (
        <>
          {[-10, 7].map((r, i) => (
            <rect key={i} x={23} y={18} width={54} height={68} rx={4} fill={plein} {...p} transform={`rotate(${r} 50 52)`} />
          ))}
          <g transform="rotate(3 50 52)">
            <path d="M23 22 Q23 18 27 18 L64 18 L77 31 L77 82 Q77 86 73 86 L27 86 Q23 86 23 82 Z" fill={plein} {...p} />
            <path d="M64 18 L64 31 L77 31" fill="none" {...p} />
            {[42, 52, 62, 72].map((y, i) => (
              <path key={y} d={`M32 ${y} L${i === 3 ? 52 : 68} ${y}`} fill="none" {...p} stroke={accent} />
            ))}
          </g>
        </>
      );
      break;
    case "crayon":
      corps = (
        <>
          <path d="M10 88 Q18 78 26 88 T42 88 T58 88" fill="none" {...p} stroke={accent} />
          <g transform="rotate(-38 50 50)">
            <rect x={14} y={41} width={60} height={18} rx={3} fill={plein} {...p} />
            <path d="M26 41 L26 59 M74 41 L91 50 L74 59" fill="none" {...p} />
            <path d="M85 47 L91 50 L85 53 Z" fill={trait} {...p} />
            <path d="M14 47 L74 47" fill="none" {...p} stroke={accent} strokeWidth={3} />
          </g>
        </>
      );
      break;
    case "lune":
      corps = (
        <>
          <path d="M60 12 A38 38 0 1 0 88 66 A30 30 0 1 1 60 12 Z" fill={plein} {...p} />
          <path d={etoile(80, 24, 8)} fill={accent} stroke="none" />
          <path d={etoile(22, 18, 6)} fill={accent} stroke="none" />
        </>
      );
      break;
    case "sablier":
      corps = (
        <>
          <path d="M30 18 L70 18 Q70 40 53 50 Q70 60 70 82 L30 82 Q30 60 47 50 Q30 40 30 18 Z" fill={plein} {...p} />
          <path d="M36 80 Q50 62 64 80 Z" fill={accent} stroke="none" />
          <rect x={22} y={10} width={56} height={9} rx={3} fill={trait} />
          <rect x={22} y={81} width={56} height={9} rx={3} fill={trait} />
        </>
      );
      break;
    case "soleil": {
      const rot = vif ? vie * 40 : 0;
      corps = (
        <>
          <g transform={`rotate(${rot} 50 50)`}>
            {Array.from({ length: 10 }, (_, i) => {
              const a = (i / 10) * Math.PI * 2;
              const r0 = 29;
              const r1 = i % 2 ? 40 : 46;
              return <path key={i} d={`M${50 + Math.cos(a) * r0} ${50 + Math.sin(a) * r0} L${50 + Math.cos(a) * r1} ${50 + Math.sin(a) * r1}`} {...p} />;
            })}
          </g>
          <circle cx={50} cy={50} r={21} fill={plein} {...p} />
          <path d="M41 52 Q50 60 59 52" fill="none" {...p} />
        </>
      );
      break;
    }
    case "transat": {
      const balance = vif ? Math.sin(vie * 5) * 3 : 0;
      corps = (
        <>
          {/* Parasol. */}
          <g transform={`rotate(${balance} 30 90)`}>
            <path d="M30 30 L30 90" fill="none" {...p} />
            <path d="M5 34 Q30 2 55 34 Q49 30 43 34 Q36 30 30 34 Q24 30 17 34 Q11 30 5 34 Z" fill={plein} {...p} />
            <path d="M30 6 L30 34" fill="none" {...p} stroke={accent} strokeWidth={3} />
          </g>
          {/* Transat. */}
          <path d="M52 50 L72 90 M90 90 L68 62" fill="none" {...p} />
          <path d="M53 52 Q60 76 92 70 L88 64 Q66 68 60 46 Z" fill={plein} {...p} />
          <path d="M4 91 L96 91" fill="none" {...p} stroke={accent} />
        </>
      );
      break;
    }
    case "coche":
      corps = (
        <>
          <circle cx={50} cy={50} r={38} fill={plein} {...p} />
          <path d="M31 51 L45 65 L70 37" fill="none" {...p} strokeWidth={9} />
        </>
      );
      break;
  }
  return (
    <svg width={taille} height={taille} viewBox="-4 -4 108 108" style={{ overflow: "visible", display: "block" }}>
      {corps}
    </svg>
  );
}

/** Un dessin dit (dessin + son mot) : terne (Avant) ou vif (Après). Coordonnées : centre (cx, cy) en px. */
function DessinAnime({ t, p, cote, cx, cy, l, W, index }: { t: number; p: DessinDit; cote: "avant" | "apres"; cx: number; cy: number; l: number; W: number; index: number }) {
  if (t < p.a) return null;
  const m = mesures(W);
  const avant = cote === "avant";
  const tailleTexte = Math.min(l * 0.17, (l * 1.15) / Math.max(1e-6, largeurTexte(p.texte, 1)));
  if (avant) {
    // Chute LOURDE : accélère, cogne, reste de travers (aucun rebond joyeux).
    const e = progression(t, p.a, 0.16);
    const chute = e * e;
    const tasse = Math.sin(Math.PI * progression(t, p.a + 0.16, 0.12));
    const repos = index % 2 ? 7 : -6;
    return (
      <div style={{ position: "absolute", left: cx - l / 2, top: cy - l / 2, width: l, transformOrigin: "50% 100%", transform: `translateY(${-(1 - chute) * l * 1.7}px) rotate(${repos * chute}deg) scale(${1 + 0.06 * tasse}, ${1 - 0.08 * tasse})` }}>
        <div style={{ opacity: 0.85 }}>
          <Dessin nom={p.dessin} taille={l} vif={false} vie={t - p.a} />
        </div>
        <div style={{ marginTop: l * 0.06, textAlign: "center", fontFamily: POLICES.titre, fontSize: tailleTexte, color: IVOIRE_70, textTransform: "uppercase", whiteSpace: "nowrap" }}>{p.texte}</div>
      </div>
    );
  }
  // Saut VIF : surgit du bas, dépasse, se pose ; gerbe de 8 traits ivoire ; puis respire.
  const e = rebond(t, p.a, 0.2, 2.6);
  const g = progression(t, p.a + 0.04, 0.24);
  const respire = 1 + 0.025 * Math.sin((t - p.a) * 2 * Math.PI * 1.1 + index);
  const repos = index % 2 ? -4 : 4;
  return (
    <div style={{ position: "absolute", left: cx - l / 2, top: cy - l / 2, width: l, transformOrigin: "50% 70%", transform: `translateY(${(1 - e) * l * 0.9}px) scale(${(0.3 + 0.7 * e) * respire}) rotate(${repos * e + (1 - e) * -14}deg)` }}>
      {g > 0 && g < 1 ? (
        <svg width={l * 1.9} height={l * 1.9} viewBox="-100 -100 200 200" style={{ position: "absolute", left: -l * 0.45, top: -l * 0.45 }}>
          {Array.from({ length: 8 }, (_, k) => {
            const ang = (k / 8) * Math.PI * 2 - Math.PI / 2;
            const r0 = 60 + 30 * g;
            const r1 = r0 + 22 * (1 - g);
            return <line key={k} x1={Math.cos(ang) * r0} y1={Math.sin(ang) * r0} x2={Math.cos(ang) * r1} y2={Math.sin(ang) * r1} stroke={COULEURS.ivoire} strokeWidth={7} strokeLinecap="round" />;
          })}
        </svg>
      ) : null}
      <div style={{ filter: `drop-shadow(${m.ombre}px ${m.ombre}px 0 ${COULEURS.encre})` }}>
        <Dessin nom={p.dessin} taille={l} vif vie={t - p.a} />
      </div>
      <div style={{ marginTop: l * 0.05, textAlign: "center", fontFamily: POLICES.titre, fontSize: tailleTexte, color: COULEURS.ivoire, textTransform: "uppercase", whiteSpace: "nowrap", textShadow: `${m.contour}px ${m.contour}px 0 ${COULEURS.encre}` }}>{p.texte}</div>
    </div>
  );
}

/** Centres d'une rangée de 1 ou 2 dessins, en px (le 2ᵉ légèrement décalé en hauteur pour casser la grille). */
function rangee(n: number, W: number, y: number, decale: number): { cx: number; cy: number }[] {
  const k = Math.max(1, Math.min(2, n));
  if (k === 1) return [{ cx: W / 2, cy: y }];
  return [
    { cx: W * 0.29, cy: y },
    { cx: W * 0.71, cy: y + decale },
  ];
}

export function EcranPartage({ t, largeurImage: W, hauteurImage: H, donnees = EXEMPLE_ECRAN_PARTAGE }: { t: number; largeurImage: number; hauteurImage: number; donnees?: DonneesEcranPartage }) {
  const d = donnees;
  const { fin, sortie: debutSortie } = tempsEcranPartage(d);
  if (t < d.debut || t >= fin) return null;
  const m = mesures(W);
  const yG = COUPE.gauche * H;
  const yD = COUPE.droite * H;
  const angle = (Math.atan2(yD - yG, W) * 180) / Math.PI;
  const long = Math.hypot(W, yD - yG);

  // Entrée en sens contraire, sortie en croisement.
  const eH = rebond(t, d.debut, ENTREE, 1.25);
  const eB = rebond(t, d.debut + DECALAGE, ENTREE, 1.25);
  const s = sortie(t, debutSortie, SORTIE);
  const xHaut = -(1 - eH) * W * 1.05 + s * W * 1.1;
  const xBas = (1 - eB) * W * 1.05 - s * W * 1.1;
  const trait = progression(t, d.debut + DECALAGE + ENTREE * 0.7, 0.16);
  const ePastille = rebond(t, d.debut + DECALAGE + ENTREE * 0.9, 0.22, 2.2);

  const nA = Math.min(2, d.avant.length);
  const nP = Math.min(2, d.apres.length);
  const lA = nA === 1 ? W * 0.44 : W * 0.36;
  const lP = nP === 1 ? W * 0.36 : W * 0.3;
  const centresA = rangee(nA, W, H * 0.27, H * 0.03);
  const centresP = rangee(nP, W, H * 0.725, H * 0.012);
  const tTitreA = tailleCapitales(d.titreAvant, W * 0.62, H * 0.085);
  const tTitreP = tailleCapitales(d.titreApres, W * 0.5, H * 0.062);
  // « APRÈS » arrive avec son panneau (pas d'aplat orange vide).
  const aTitreP = d.debut + DECALAGE + ENTREE * 0.75;
  const eTitreP = rebond(t, aTitreP, 0.2, 2);
  const diamPastille = W * 0.15;
  const cxSoleil = W * 0.5;
  const cySoleil = H * 0.73;

  return (
    <div style={{ position: "absolute", left: 0, top: 0, width: W, height: H, overflow: "hidden" }}>
      {/* Panneau AVANT (haut, encre, hachures ternes). */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          clipPath: `polygon(0px 0px, ${W}px 0px, ${W}px ${yD}px, 0px ${yG}px)`,
          background: `repeating-linear-gradient(135deg, ${COULEURS.encre} 0px, ${COULEURS.encre} ${W * 0.03}px, #1A120C ${W * 0.03}px, #1A120C ${W * 0.06}px)`,
          transform: `translateX(${xHaut}px)`,
        }}
      >
        <div style={{ position: "absolute", left: W * 0.07, top: H * 0.07, fontFamily: POLICES.titre, fontSize: tTitreA, lineHeight: 1, color: "transparent", WebkitTextStroke: `${Math.max(3, W * 0.004)}px ${IVOIRE_70}`, textTransform: "uppercase", letterSpacing: tTitreA * 0.04 }}>
          {d.titreAvant}
        </div>
        {d.avant.slice(0, 2).map((p, i) => (
          <DessinAnime key={i} t={t} p={p} cote="avant" cx={centresA[i].cx} cy={centresA[i].cy} l={lA} W={W} index={i} />
        ))}
      </div>
      {/* Panneau APRÈS (bas, orange, rayons de soleil qui tournent lentement : jamais d'aplat vide). */}
      <div style={{ position: "absolute", inset: 0, clipPath: `polygon(0px ${yG}px, ${W}px ${yD}px, ${W}px ${H}px, 0px ${H}px)`, background: COULEURS.orange, transform: `translateX(${xBas}px)`, overflow: "hidden" }}>
        <div
          style={{
            position: "absolute",
            left: cxSoleil - H * 0.6,
            top: cySoleil - H * 0.6,
            width: H * 1.2,
            height: H * 1.2,
            background: `repeating-conic-gradient(from ${(t - d.debut) * 14}deg, ${COULEURS.orange} 0deg 9deg, ${ORANGE_CLAIR} 9deg 18deg)`,
          }}
        />
        <div style={{ position: "absolute", left: cxSoleil - W * 0.7, top: cySoleil - W * 0.7, width: W * 1.4, height: W * 1.4, borderRadius: "50%", background: "radial-gradient(circle, rgba(233, 220, 200, 0.28) 0%, rgba(233, 220, 200, 0) 62%)" }} />
        {t >= aTitreP ? (
          <div style={{ position: "absolute", right: W * 0.07, top: H * 0.565, fontFamily: POLICES.titre, fontSize: tTitreP, lineHeight: 1, color: COULEURS.ivoire, textTransform: "uppercase", letterSpacing: tTitreP * 0.04, textShadow: `${m.ombre}px ${m.ombre}px 0 ${COULEURS.encre}`, transformOrigin: "100% 50%", transform: `scale(${0.4 + 0.6 * eTitreP}) rotate(${-3 * eTitreP + 8 * (1 - eTitreP)}deg)` }}>
            {d.titreApres}
          </div>
        ) : null}
        {d.apres.slice(0, 2).map((p, i) => (
          <DessinAnime key={i} t={t} p={p} cote="apres" cx={centresP[i].cx} cy={centresP[i].cy} l={lP} W={W} index={i} />
        ))}
      </div>
      {/* Trait ivoire de séparation, tiré de gauche à droite, puis pastille de bascule. */}
      {s < 1 ? (
        <div style={{ position: "absolute", left: 0, top: yG - H * 0.006, width: long, height: H * 0.012, transformOrigin: "0% 50%", transform: `rotate(${angle}deg)`, opacity: 1 - s }}>
          <div style={{ width: `${100 * trait}%`, height: "100%", background: COULEURS.ivoire, boxShadow: `0 ${m.contour}px 0 ${COULEURS.encre}` }} />
        </div>
      ) : null}
      {ePastille > 0 && s < 1 ? (
        <div
          style={{
            position: "absolute",
            left: W / 2 - diamPastille / 2,
            top: (yG + yD) / 2 - diamPastille / 2,
            width: diamPastille,
            height: diamPastille,
            borderRadius: "50%",
            background: COULEURS.ivoire,
            border: `${m.contour}px solid ${COULEURS.encre}`,
            boxShadow: `${m.ombre}px ${m.ombre}px 0 ${COULEURS.encre}`,
            boxSizing: "border-box",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            transform: `scale(${ePastille * (1 - s)}) rotate(${(1 - ePastille) * -200}deg)`,
          }}
        >
          <svg width={diamPastille * 0.52} height={diamPastille * 0.52} viewBox="0 0 24 24" fill="none" stroke={COULEURS.orange} strokeWidth={3.4} strokeLinecap="round" strokeLinejoin="round">
            <path d="m6 6 6 6 6-6" />
            <path d="m6 13 6 6 6-6" />
          </svg>
        </div>
      ) : null}
    </div>
  );
}

/** Bruitage : [instant (s), son de `sons/` sans extension, volume]. */
export type BruitageMotion = [number, string, number];

/** Glissement double (entrée), chocs mats côté Avant, sauts côté Après, glissement double (sortie). */
export function bruitagesEcranPartage(d: DonneesEcranPartage = EXEMPLE_ECRAN_PARTAGE): BruitageMotion[] {
  const { sortie: s } = tempsEcranPartage(d);
  const l: BruitageMotion[] = [
    [d.debut - 0.02, "whoosh-in", 0.28],
    [d.debut + DECALAGE - 0.02, "whoosh-in", 0.22],
  ];
  d.avant.slice(0, 2).forEach((p) => l.push([p.a + 0.15, "drop_004", 0.12]));
  d.apres.slice(0, 2).forEach((p, i, tab) => l.push([p.a, i === tab.length - 1 ? "confirmation_002" : "maximize_004", 0.07]));
  l.push([s - 0.02, "whoosh-out", 0.22], [s + 0.04, "whoosh-out", 0.16]);
  return l;
}
