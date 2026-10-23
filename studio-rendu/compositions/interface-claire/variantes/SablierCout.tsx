import React from "react";
/**
 * CARTE « SABLIER QUI COÛTE » (designer n° 5, 15/10 — reprise allégée du brouillon du designer n° 4).
 * Le coût cumulé du temps perdu : « à la fin du mois, ça fait… ».
 *
 * Composition (standard premium, CARTES-20-PREMIUM-2026-10-15.md) :
 *  - en-tête discret (icône nue + titre 0,026 L, filet), tampon EXEMPLE dans le coin ;
 *  - à gauche, un sablier vectoriel de 0,36 L de haut, SEUL élément en relief (verre en filet encre, reflets ivoire,
 *    sable en dégradé orange) ;
 *  - à droite, le total cumulé en héros (0,16 L, tambour) avec sa période en titre et son calcul en corps ;
 *  - dessous, UNE rangée de 5 jours en pastilles (« Lun » / « 2 h »).
 * Mouvement :
 *  - N1 : la carte tombe (animationCarte, comme toutes les cartes), la prise descend dessous (visage entier) ;
 *  - N2 : chaque jour dit allume sa pastille (flash orange 0,16 s → encre) et lance un « + 2 h » orange qui rejoint le
 *    total en arc (0,25 s) ; le total roule en tambour à l'arrivée, le bloc s'écrase de 2 % ; au mot du total, la
 *    période passe à « par mois », le calcul se complète et le sablier SE RETOURNE (180° en « pose ») ;
 *  - N3 : le sable coule en continu (filet de grains, niveaux qui bougent à chaque image).
 * Aucun chiffre présenté comme réel : tampon EXEMPLE.
 */
import { POLICES } from "../charte";
import { Icone } from "../elements";
import { bosse, claque, Coque, DEGRADE, ecrasement, encreA, fonduEntree, glisse, grille, interieurCoque, ivoireA, microOmbre, N, pose, Reflet, reliefs, Roulant, ScenePremium, STYLE_CORPS, STYLE_HEROS, STYLE_TITRE, TamponExemple, typo } from "./premium-5";

export type JourSablier = { jour: string; heures: number; /** Instant du mot (s). */ a: number };
export type DonneesSablierCout = {
  /** Titre d'en-tête (3 mots au plus). */
  titre: string;
  debut: number;
  fin: number;
  jours: JourSablier[];
  /** Total final : valeur (h), période finale, facteur expliqué dans le calcul (« × 4 semaines »), instant du mot. */
  total: { valeur: number; periode: string; facteur: string; a: number };
  /** Période pendant le cumul des jours. */
  periodeJours: string;
};

/** Phrase d'exemple : « Deux heures par jour, cinq jours par semaine : à la fin du mois, ça fait beaucoup. » */
export const EXEMPLE_PHRASE_SABLIER_COUT = "Deux heures par jour, cinq jours par semaine : à la fin du mois, ça fait beaucoup.";

/** Données d'exemple (instants calés sur la phrase d'exemple, en secondes). */
export const EXEMPLE_SABLIER_COUT: DonneesSablierCout = {
  titre: "Le temps perdu",
  debut: 0,
  fin: 5.2,
  periodeJours: "Par semaine",
  jours: [
    { jour: "Lun", heures: 2, a: 0.3 }, // « Deux heures »
    { jour: "Mar", heures: 2, a: 1.2 }, // « cinq »
    { jour: "Mer", heures: 2, a: 1.42 }, // « jours »
    { jour: "Jeu", heures: 2, a: 1.64 }, // « par »
    { jour: "Ven", heures: 2, a: 1.86 }, // « semaine »
  ],
  total: { valeur: 40, periode: "Par mois", facteur: "× 4 semaines", a: 3.45 }, // « beaucoup »
};

/** Bruitages proposés (fichiers de `interface-claire/sons/`). */
export const EXEMPLE_SONS_SABLIER_COUT = [
  { t: 0, son: "drop_002" },
  ...EXEMPLE_SABLIER_COUT.jours.map((b) => ({ t: b.a, son: "select_001" })),
  ...EXEMPLE_SABLIER_COUT.jours.map((b) => ({ t: b.a + 0.25, son: "drop_001" })),
  { t: 3.45, son: "confirmation_002" },
];

/** Instant le plus représentatif pour une image fixe (total posé, sablier retourné, sable qui coule). */
export const IMAGE_FIXE_SABLIER_COUT = 4.1;
/** Instant « en construction » (3 jours allumés, un « + 2 h » en vol). */
export const IMAGE_CONSTRUCTION_SABLIER_COUT = 1.55;

/** Bas de la carte (fraction de H). */
export const BAS_SABLIER_COUT = 0.5;

const VOL = 0.25;
const FLASH = 0.16;
const RETOURNEMENT = 0.25;

export type ProprietesSablierCout = {
  t: number;
  donnees?: DonneesSablierCout;
  largeur?: number;
  hauteur?: number;
  /** Image fixe de la prise ; présente : la scène (prise qui descend + bande) est dessinée autour de la carte. */
  prise?: string;
  /** Hauteur des yeux sur la prise, en fraction de H. */
  yeux?: number;
};

/* ------------------------------------------------------------------ Sablier vectoriel ------------------------------------------------------------------ */

/** Verre (grille 100 × 160) : deux bulbes, col étroit au centre. */
const VERRE = "M22 16 C22 50 45 66 47 80 C45 94 22 110 22 144 L78 144 C78 110 55 94 53 80 C55 66 78 50 78 16 Z";

function Sablier({ hauteur, niveau, t, id }: { hauteur: number; /** Part du sable dans le bulbe du haut (0-1). */ niveau: number; t: number; id: string }) {
  const f = Math.max(0, Math.min(1, niveau));
  const largeur = (hauteur * 100) / 160;
  // Bulbe du haut : la surface descend vers le col (creux en entonnoir au centre).
  const yh = 76 - f * 58;
  const creux = 4 + 6 * (1 - f);
  // Bulbe du bas : un tas qui monte.
  const yb = 142 - (1 - f) * 54;
  const coule = f > 0.01;
  const u = hauteur / 160; // px par unité
  const filet = (0.0018 * 1080) / u; // ≈ épaisseur d'un filet, en unités
  return (
    <svg width={largeur} height={hauteur} viewBox="0 0 100 160" style={{ overflow: "visible", display: "block" }}>
      <defs>
        <clipPath id={`${id}-verre`}>
          <path d={VERRE} />
        </clipPath>
        <linearGradient id={`${id}-sable`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={N.orangeChaud} />
          <stop offset="0.6" stopColor={N.orange} />
          <stop offset="1" stopColor={N.orangeProfond} />
        </linearGradient>
        <linearGradient id={`${id}-bois`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={N.encreDouce} />
          <stop offset="1" stopColor={N.encre} />
        </linearGradient>
        <linearGradient id={`${id}-montant`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor={N.sableProfond} />
          <stop offset="0.35" stopColor={N.encreDouce} />
          <stop offset="1" stopColor={N.encre} />
        </linearGradient>
      </defs>
      {/* Montants en bois tourné (derrière le verre) : dégradé encre-douce → encre, veines fines, reflet ivoire de 1 px. */}
      {[7, 87].map((x) => (
        <g key={x}>
          <rect x={x} y="10" width="6" height="140" rx="3" fill={`url(#${id}-montant)`} stroke={N.encre} strokeWidth={filet * 1.2} />
          {/* Veines du bois. */}
          <path d={`M${x + 3.4} 16 C${x + 4.4} 50 ${x + 2.6} 90 ${x + 3.8} 144`} fill="none" stroke={N.sableProfond} strokeWidth="0.45" opacity="0.55" />
          <path d={`M${x + 4.6} 20 C${x + 5.2} 60 ${x + 4.2} 110 ${x + 4.9} 140`} fill="none" stroke={N.sableProfond} strokeWidth="0.35" opacity="0.4" />
          {/* Nœuds tournés (bagues). */}
          {[44, 116].map((y) => (
            <rect key={y} x={x - 0.6} y={y} width="7.2" height="3" rx="1.5" fill={N.encreDouce} stroke={N.encre} strokeWidth={filet * 0.8} />
          ))}
          <rect x={x + 1.1} y="13" width="0.7" height="134" rx="0.35" fill={ivoireA(0.4)} />
        </g>
      ))}
      {/* Verre teinté. */}
      <path d={VERRE} fill={ivoireA(0.55)} />
      <g clipPath={`url(#${id}-verre)`}>
        <path d={VERRE} fill={N.ivoireCreux} opacity={0.55} />
        {/* Sable du haut. */}
        {f > 0.005 ? <path d={`M0 ${yh} L30 ${yh} Q50 ${yh + creux} 70 ${yh} L100 ${yh} L100 84 L0 84 Z`} fill={`url(#${id}-sable)`} /> : null}
        {/* Tas du bas. */}
        <path d={`M0 150 L0 ${yb + 9} C25 ${yb + 9} 38 ${yb} 50 ${yb} C62 ${yb} 75 ${yb + 9} 100 ${yb + 9} L100 150 Z`} fill={`url(#${id}-sable)`} />
        {/* Filet de sable qui coule (N3) : trait continu + grains qui descendent. */}
        {coule ? (
          <>
            <rect x="49.2" y="80" width="1.6" height={Math.max(0, yb - 80)} fill={N.orange} />
            {[0, 1, 2, 3, 4].map((k) => {
              const p = (t * 2.2 + k / 5) % 1;
              const y = 82 + p * Math.max(0, yb - 84);
              return <circle key={k} cx={50 + Math.sin((k + 1) * 2.1 + t * 9) * 1.1} cy={y} r={0.95} fill={N.orangeProfond} />;
            })}
            {/* Éclaboussure au sommet du tas. */}
            {[0, 1].map((k) => {
              const p = (t * 3.1 + k / 2) % 1;
              return <circle key={`e${k}`} cx={50 + (k ? 1 : -1) * (2 + 5 * p)} cy={yb - 2 - 3 * Math.sin(Math.PI * p)} r={0.8} fill={N.orange} opacity={1 - p} />;
            })}
          </>
        ) : null}
      </g>
      {/* Contour du verre (filet encre) et reflets ivoire. */}
      <path d={VERRE} fill="none" stroke={N.encre} strokeWidth={filet * 1.5} strokeLinejoin="round" />
      <path d="M28 22 C28 44 38 58 43 68" fill="none" stroke={ivoireA(0.85)} strokeWidth="2.4" strokeLinecap="round" />
      <path d="M43 92 C37 102 28 116 28 136" fill="none" stroke={ivoireA(0.7)} strokeWidth="2" strokeLinecap="round" />
      <path d="M70 26 C70 36 67 44 63 52" fill="none" stroke={ivoireA(0.45)} strokeWidth="1.4" strokeLinecap="round" />
      {/* Reflet ivoire de 1 px qui suit le bord intérieur du verre (lumière rasante). */}
      <path d="M24.6 18 C24.6 50 46 64 48.6 78" fill="none" stroke={ivoireA(0.95)} strokeWidth={0.55} strokeLinecap="round" />
      <path d="M75.4 140 C75.4 112 56 96 51.4 84" fill="none" stroke={ivoireA(0.6)} strokeWidth={0.45} strokeLinecap="round" />
      {/* Plateaux (encre, veines du bois, reflet ivoire, fine incrustation orange). */}
      {[2, 144].map((y) => (
        <g key={y}>
          <rect x="1" y={y} width="98" height="14" rx="4" fill={`url(#${id}-bois)`} stroke={N.encre} strokeWidth={filet * 1.2} />
          <path d={`M6 ${y + 5} C30 ${y + 4.2} 52 ${y + 6.2} 94 ${y + 5.2}`} fill="none" stroke={N.sableProfond} strokeWidth="0.4" opacity="0.45" />
          <path d={`M8 ${y + 7.2} C36 ${y + 7.8} 60 ${y + 6.6} 92 ${y + 7.4}`} fill="none" stroke={N.sableProfond} strokeWidth="0.3" opacity="0.35" />
          <rect x="6" y={y + 1.2} width="88" height="0.7" rx="0.35" fill={ivoireA(0.45)} />
          <rect x="10" y={y + 9} width="80" height="1.4" rx="0.7" fill={N.orange} opacity={0.9} />
        </g>
      ))}
    </svg>
  );
}

/* ------------------------------------------------------------------ Carte ------------------------------------------------------------------ */

export function SablierCout({ t, donnees = EXEMPLE_SABLIER_COUT, largeur = 1080, hauteur = 1920, prise, yeux }: ProprietesSablierCout) {
  const W = largeur;
  const H = hauteur;
  const d = donnees;
  const bas = BAS_SABLIER_COUT;
  const ty = typo(W);
  const g = grille(W);
  const r = reliefs(W);
  const inter = interieurCoque(W, H, bas);

  // --- Grille de la carte (px, repère intérieur de la coque).
  const hEntete = Math.round(0.072 * W);
  const zoneL = inter.l - 2 * g.marge;
  const hPastille = Math.round(0.108 * W);
  const yPastilles = inter.h - g.marge - hPastille;
  const yHaut = hEntete + Math.round(0.032 * W);
  const hHaut = yPastilles - Math.round(0.03 * W) - yHaut;
  const hSablier = Math.min(Math.round(0.36 * W), hHaut);
  const lSablier = (hSablier * 100) / 160;
  const xDroite = g.marge + lSablier + Math.round(0.05 * W);
  const lDroite = inter.l - g.marge - xDroite;
  const gPastille = Math.round(0.015 * W);
  const lPastille = (zoneL - 4 * gPastille) / 5;

  // --- Instants.
  const jours = d.jours.slice(0, 5);
  const arrivees = jours.map((j) => j.a + VOL);
  const cumul = (k: number) => jours.slice(0, k + 1).reduce((s, j) => s + j.heures, 0);
  const etatsTotal = [{ valeur: "0", a: d.debut }, ...jours.map((j, k) => ({ valeur: String(cumul(k)), a: arrivees[k] })), { valeur: String(d.total.valeur), a: d.total.a }];
  const final = t >= d.total.a;

  // --- Sablier : niveau qui baisse en continu ; retournement au total (le plein repasse en haut).
  const vitesse = 0.55 / Math.max(0.5, d.total.a - d.debut);
  const niveauAvant = (x: number) => Math.max(0.12, 0.92 - vitesse * (x - d.debut));
  const fAuRetour = niveauAvant(d.total.a);
  const rot = pose(t, d.total.a, RETOURNEMENT);
  const niveau = t < d.total.a + RETOURNEMENT ? niveauAvant(Math.min(t, d.total.a)) : Math.max(0.1, 1 - fAuRetour - vitesse * (t - d.total.a - RETOURNEMENT));
  const angle = t < d.total.a ? 0 : t < d.total.a + RETOURNEMENT ? 180 * rot : 0;

  // --- N2 : à chaque jour dit, le sablier « encaisse » : petit saut (0,022 L, borné : ne franchit jamais le filet de
  // l'en-tête), bascule de 5°, tassement à la reprise.
  const sautSablier = jours.reduce((s, j) => s + bosse(t, j.a, 0.24), 0);
  const basculeSablier = jours.reduce((s, j, k) => s + (k % 2 ? 5 : -5) * bosse(t, j.a, 0.24), 0);
  const tasseSablier = jours.reduce((s, j) => s + 0.04 * bosse(t, j.a + 0.24, 0.08), 0);

  // --- Suivi : le bloc du total s'écrase à chaque arrivée ; la carte s'écrase au total final.
  const ecraseTotal = ecrasement(t, arrivees, 0.025, 0.1) + ecrasement(t, [d.total.a], 0.04, 0.12);
  const ecraseCarte = ecrasement(t, [d.total.a + 0.02], 0.022, 0.1);

  // --- Total (héros).
  const tailleHeros = ty.heros(0.16);
  // Bloc droit (héros + période + calcul) centré verticalement sur le sablier.
  const hBloc = tailleHeros * 0.95 + ty.titre * 1.55 + ty.corps * 1.22;
  const yTotal = Math.max(0, Math.round((hHaut - hBloc) / 2));
  const yPeriode = yTotal + tailleHeros * 0.95;
  const claqueFinale = final ? claque(t, d.total.a, 0.12) : 1;
  // Flash du héros au mot du total (orange 0,2 s, puis encre).
  const flashTotal = final && t < d.total.a + 0.2;

  const contenu = (
    <div style={{ position: "absolute", inset: 0 }}>
      {/* En-tête discret : icône nue + titre d'en-tête, filet. */}
      <div style={{ position: "absolute", left: g.marge, right: g.marge, top: 0, height: hEntete, display: "flex", alignItems: "center", gap: Math.round(0.016 * W), borderBottom: `${r.filet}px solid ${N.filet}` }}>
        <Icone nom="horloge" taille={Math.round(0.04 * W)} couleur={N.orange} epaisseur={2.4} />
        <span style={{ fontFamily: POLICES.titre, fontSize: ty.entete, letterSpacing: "0.08em", textTransform: "uppercase", color: N.encreDouce, whiteSpace: "nowrap" }}>{d.titre}</span>
      </div>
      {/* Tampon EXEMPLE aligné sur la ligne de l'en-tête (centré dans sa hauteur, ne touche jamais le filet). */}
      <TamponExemple t={t} a={d.debut + 0.2} W={W} rotation={-3} style={{ right: g.marge, top: Math.round((hEntete - ty.minimum * 1.62) / 2) }} />

      {/* Sablier (seul élément en relief : ombre dure dessinée par une silhouette décalée). Zone bornée sous le filet de
          l'en-tête : le saut ne déborde jamais sur la tête. */}
      <div style={{ position: "absolute", left: 0, right: 0, top: hEntete + r.filet, bottom: 0, overflow: "hidden", pointerEvents: "none" }}>
      <div style={{ position: "absolute", left: g.marge, top: yHaut - hEntete - r.filet + (hHaut - hSablier) / 2, width: lSablier, height: hSablier, transform: `translateY(${-sautSablier * 0.022 * W}px) rotate(${basculeSablier}deg) scaleY(${1 - tasseSablier})`, transformOrigin: "50% 100%" }}>
        <div style={{ position: "absolute", inset: 0, transform: `translate(${r.ombreHeros}px, ${r.ombreHeros}px) rotate(${angle}deg)`, opacity: 0.95 }}>
          <svg width={lSablier} height={hSablier} viewBox="0 0 100 160" style={{ overflow: "visible", display: "block" }}>
            <rect x="1" y="2" width="98" height="14" rx="4" fill={N.encre} />
            <rect x="1" y="144" width="98" height="14" rx="4" fill={N.encre} />
            <path d={VERRE} fill={encreA(0.16)} />
            <rect x="7" y="10" width="6" height="140" rx="3" fill={N.encre} />
            <rect x="87" y="10" width="6" height="140" rx="3" fill={N.encre} />
          </svg>
        </div>
        <div style={{ position: "absolute", inset: 0, transform: `rotate(${angle}deg)` }}>
          <Sablier hauteur={hSablier} niveau={niveau} t={t} id="sablier-cout" />
        </div>
      </div>
      </div>

      {/* Colonne droite : total en héros, période, calcul (centrés sur le sablier). */}
      <div style={{ position: "absolute", left: xDroite, top: yHaut, width: lDroite, height: hHaut, transform: `scaleY(${1 - ecraseTotal})`, transformOrigin: "0% 100%" }}>
        <div style={{ position: "absolute", left: -Math.round(0.006 * W), top: yTotal, display: "flex", alignItems: "baseline", transform: `scale(${0.92 + 0.08 * claqueFinale})`, transformOrigin: "0% 80%" }}>
          <Roulant t={t} etats={etatsTotal} taille={tailleHeros} couleur={flashTotal ? N.orange : N.encre} duree={0.2} style={{ ...STYLE_HEROS }} />
          <span style={{ ...STYLE_HEROS, fontSize: tailleHeros * 0.62, color: flashTotal ? N.orange : N.encre, marginLeft: tailleHeros * 0.16 }}>h</span>
        </div>
        {/* Période (titre) : roule de « par semaine » à « par mois » au mot du total. */}
        <div style={{ position: "absolute", left: 0, top: yPeriode, height: ty.titre * 1.1, overflow: "hidden" }}>
          <Roulant t={t} etats={[{ valeur: d.periodeJours.toUpperCase(), a: d.debut }, { valeur: d.total.periode.toUpperCase(), a: d.total.a }]} taille={ty.titre} couleur={final ? N.orange : N.encreDouce} duree={0.18} entier style={{ letterSpacing: "0.04em" }} />
        </div>
        {/* Calcul (corps) : « 2 h × 5 jours » en encre-douce (une seule couleur), le dernier facteur arrive sur son mot. */}
        <div style={{ position: "absolute", left: 0, top: yPeriode + ty.titre * 1.55, display: "flex", gap: ty.corps * 0.35, ...STYLE_CORPS, fontSize: ty.corps, color: N.encreDouce, whiteSpace: "nowrap" }}>
          <span>{`${jours[0]?.heures ?? 0} h × ${jours.filter((j) => t >= j.a).length || "…"} jours`}</span>
          {final ? <span style={{ display: "inline-block", fontWeight: 800, color: N.encre, opacity: fonduEntree(t, d.total.a), transform: `translateX(${(1 - glisse(t, d.total.a, 0.18)) * 0.03 * W}px)` }}>{d.total.facteur}</span> : null}
        </div>
      </div>

      {/* Rangée des 5 jours. */}
      {jours.map((j, k) => {
        const x = g.marge + k * (lPastille + gPastille);
        const on = t >= j.a;
        // Tuiles PLATES (ivoire-creux + filet). Seule la tuile qui s'allume sur son mot prend l'orange pendant 0,2 s, puis
        // se pose en orange-voile ; au mot du total, toute la semaine flashe ensemble (elle « s'additionne »).
        const flash = (on && t < j.a + FLASH) || (t >= d.total.a && t < d.total.a + 0.18);
        const p = on ? pose(t, j.a, 0.2) : 0;
        const fond = !on ? N.ivoireCreux : flash ? DEGRADE.orange : N.orangeVoile;
        return (
          <div
            key={k}
            style={{
              position: "absolute",
              left: x,
              top: yPastilles,
              width: lPastille,
              height: hPastille,
              borderRadius: r.rayon,
              background: fond,
              border: `${r.filet}px solid ${on && !flash ? N.sableClair : on ? N.orange : N.filet}`,
              boxShadow: on && flash ? microOmbre(W, 0.12) : `inset 0 ${0.002 * W}px ${0.004 * W}px ${encreA(on ? 0.05 : 0.08)}`,
              boxSizing: "border-box",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: Math.round(0.002 * W),
              transform: `translateY(${-(on ? p : 0) * 0.008 * W}px) scale(${on && t < j.a + FLASH ? 1.07 : 1})`,
            }}
          >
            {on && flash ? <Reflet rayon={r.rayon} /> : null}
            <span style={{ ...STYLE_CORPS, fontSize: ty.corps, lineHeight: 1, color: !on ? N.sableProfond : flash ? N.ivoire : N.encreDouce }}>{j.jour}</span>
            <span style={{ ...STYLE_TITRE, fontSize: ty.titre, letterSpacing: 0, textTransform: "none", color: !on ? N.sable : flash ? N.ivoire : N.encre, fontVariantNumeric: "tabular-nums" }}>{on ? `${j.heures} h` : "–"}</span>
          </div>
        );
      })}

      {/* « + 2 h » qui part de la pastille et tombe dans le total (arc, 0,25 s). */}
      {jours.map((j, k) => {
        if (t < j.a || t >= j.a + VOL) return null;
        const p = glisse(t, j.a, VOL) * 0.25 + ((t - j.a) / VOL) * 0.75;
        const x0 = g.marge + k * (lPastille + gPastille) + lPastille / 2;
        const y0 = yPastilles + hPastille * 0.2;
        const x1 = xDroite + tailleHeros * 0.75;
        const y1 = yHaut + yTotal + tailleHeros * 0.35;
        const sommet = Math.min(y0, y1) - 0.06 * W;
        const x = x0 + (x1 - x0) * p;
        const y = (1 - p) * (1 - p) * y0 + 2 * (1 - p) * p * sommet + p * p * y1;
        const vx = x1 - x0;
        const vy = 2 * (1 - p) * (sommet - y0) + 2 * p * (y1 - sommet);
        const ang = (Math.atan2(vy, vx) * 180) / Math.PI;
        const echelle = 1 - 0.35 * p * p;
        return (
          <div key={`vol${k}`} style={{ position: "absolute", left: x, top: y, transform: `translate(-50%, -50%) rotate(${ang}deg) scaleX(${1.05}) rotate(${-ang}deg) scale(${echelle})`, opacity: fonduEntree(t, j.a) * (1 - bosse(t, j.a + VOL - 0.05, 0.1)) }}>
            <div style={{ position: "relative", background: DEGRADE.orange, borderRadius: 999, padding: `${ty.titre * 0.12}px ${ty.titre * 0.34}px`, boxShadow: microOmbre(W, 0.16), ...STYLE_TITRE, fontSize: ty.titre, letterSpacing: 0, textTransform: "none", color: N.ivoire }}>
              <Reflet rayon={ty.titre * 0.5} opacite={0.25} />
              {`+${j.heures} h`}
            </div>
          </div>
        );
      })}
    </div>
  );

  const carte = <Coque t={t} debut={d.debut} fin={d.fin} W={W} H={H} bas={bas} id="sablier-cout" ecrase={ecraseCarte} enfants={contenu} />;
  if (!prise) return carte;
  return (
    <ScenePremium t={t} debut={d.debut} fin={d.fin} W={W} H={H} bas={bas} prise={prise} yeux={yeux}>
      {carte}
    </ScenePremium>
  );
}
