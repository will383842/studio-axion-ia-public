/**
 * NOYAU DU MOTION DESIGN (Remotion) : le système de design commun à tous les modèles (correctif du 09/10).
 *   - contexte de la carte (instant, durée, chute, zones sûres, tailles) ;
 *   - fond vivant (lumière qui dérive, particules en profondeur, grain, vignette) ;
 *   - caméra (poussée lente et parallaxe) ;
 *   - flou de mouvement DIRECTIONNEL (déplacement pendant l'obturateur 180°) ;
 *   - typographie cinétique (mots ou lettres qui se construisent) ;
 *   - icônes qui se dessinent trait par trait ; chiffres qui comptent ; panneaux en relief.
 * Tout se calcule depuis l'instant `t` (s) : rendu image par image déterministe, 25 i/s.
 */
import { createContext, useContext, useId, type CSSProperties, type ReactNode } from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { courbe, cycle, derive, deplacementObturateur, flouDeplacement, hasard, mixer, progres, ressort } from "../../../../src/briques/motion/courbes";
import { ICONES, type NomIcone } from "../../../../src/briques/motion/icones";
import { APPROCHE_EM, avecOpacite, CAMERA, COULEURS, DUREES, FORMES, GRAISSES, INTERLIGNE, POLICE_MOTION, taillePx, ZONES_SURES, type NiveauTexte } from "../../../../src/briques/motion/jetons";
import { hauteurTexte, tailleQuiTient } from "../../../../src/briques/motion/mesure";
import type { MiseEnPageCarte } from "../../../../src/briques/motion/types";
import { facteurTaille, placementDe, ZONES_PLEIN } from "../../../../src/briques/motion/style";
import { chargerPolicesMotion } from "./polices";

/* ------------------------------------------------------------------ */
/* Contexte de la carte                                                  */
/* ------------------------------------------------------------------ */

export interface Zone {
  x: number;
  y: number;
  largeur: number;
  hauteur: number;
}

export interface ContexteMotion {
  t: number;
  duree: number;
  /** Début de la chute (sortie de tous les éléments, dans la dernière seconde). */
  chute: number;
  largeur: number;
  hauteur: number;
  hauteurVideo: number;
  /** Unité : 1 px à 1080 de large. */
  u: number;
  /** Zone sûre du contenu aligné à gauche (listes, lignes de temps). */
  zone: Zone;
  /** Zone sûre du contenu centré (marges égales). */
  zoneCentree: Zone;
  moitie: boolean;
  taille: (n: NiveauTexte) => number;
  /** Hauteur (px) d'un texte d'un niveau, coupé dans `largeur` (mesure réelle de Poppins). */
  mesurer: (texte: string, n: NiveauTexte, largeur: number, graisse?: number, taillePx?: number) => number;
}

/** Graisse par défaut d'un niveau. */
export const graisseDe = (n: NiveauTexte) => (n === "affiche" ? GRAISSES.affiche : n === "titre" ? GRAISSES.titre : n === "corps" ? GRAISSES.appui : GRAISSES.corps);

const Contexte = createContext<ContexteMotion | null>(null);

export function useMotion(): ContexteMotion {
  const c = useContext(Contexte);
  if (!c) throw new Error("Carte motion sans contexte.");
  return c;
}

/** Zones sûres de la carte (px de la carte) : celles de la vidéo, ramenées à la carte (moitié haute : le haut seul). */
export function zonesCarte(mp: Pick<MiseEnPageCarte, "ratio" | "largeur" | "hauteur" | "hauteurVideo" | "disposition" | "placement">): { zone: Zone; zoneCentree: Zone } {
  const z = placementDe(mp) === "plein" ? ZONES_PLEIN[mp.ratio] : ZONES_SURES[mp.ratio];
  const hv = mp.hauteurVideo;
  const haut = z.haut * hv;
  const bas = mp.disposition === "moitie-haute" ? mp.hauteur - 0.035 * hv : mp.hauteur - z.bas * hv;
  const gauche = Math.max(z.gauche, 0.075) * mp.largeur;
  const droite = z.droite * mp.largeur;
  const marge = Math.max(gauche, droite * 0.75);
  return {
    zone: { x: gauche, y: haut, largeur: mp.largeur - gauche - droite, hauteur: bas - haut },
    zoneCentree: { x: marge, y: haut, largeur: mp.largeur - 2 * marge, hauteur: bas - haut },
  };
}

/* ------------------------------------------------------------------ */
/* Coquille d'une carte : fond vivant + caméra + contenu                 */
/* ------------------------------------------------------------------ */

export function CarteMotion({ mp, children, intensiteLumiere = 1 }: { mp: MiseEnPageCarte; children: ReactNode; intensiteLumiere?: number }) {
  chargerPolicesMotion();
  const image = useCurrentFrame();
  const t = image / mp.fps;
  const duree = mp.images / mp.fps;
  const { zone, zoneCentree } = zonesCarte(mp);
  const ctx: ContexteMotion = {
    t,
    duree,
    chute: Math.max(0.8, duree - DUREES.chute - 0.12),
    largeur: mp.largeur,
    hauteur: mp.hauteur,
    hauteurVideo: mp.hauteurVideo,
    u: mp.largeur / 1080,
    zone,
    zoneCentree,
    moitie: mp.disposition === "moitie-haute",
    taille: (n) => Math.round(taillePx(n, mp.hauteurVideo) * facteurTaille(placementDe(mp), n)),
    mesurer: (texte, n, largeur, graisse, taille) => hauteurTexte(texte, n, taille ?? Math.round(taillePx(n, mp.hauteurVideo) * facteurTaille(placementDe(mp), n)), graisse ?? graisseDe(n), largeur),
  };
  return (
    <Contexte.Provider value={ctx}>
      <AbsoluteFill style={{ backgroundColor: COULEURS.fond, overflow: "hidden", fontFamily: `"${POLICE_MOTION}", sans-serif`, color: COULEURS.creme }}>
        <FondVivant intensite={intensiteLumiere} />
        <Camera>{children}</Camera>
        <Grain />
      </AbsoluteFill>
    </Contexte.Provider>
  );
}

/** Caméra : poussée lente (≤ 3 %/s) et dérive de quelques pixels ; le contenu respire, jamais figé. */
function Camera({ children }: { children: ReactNode }) {
  const { t, u, largeur, hauteur } = useMotion();
  const s = 1 + CAMERA.pousseeParSec * t;
  const dx = derive(t * 0.6, 3) * 6 * u;
  const dy = derive(t * 0.5, 7) * 5 * u;
  return (
    <AbsoluteFill style={{ transform: `translate(${dx.toFixed(2)}px, ${dy.toFixed(2)}px) scale(${s.toFixed(5)})`, transformOrigin: `${largeur / 2}px ${hauteur * 0.45}px` }}>
      {children}
    </AbsoluteFill>
  );
}

/* ------------------------------------------------------------------ */
/* Fond vivant                                                           */
/* ------------------------------------------------------------------ */

const NB_PARTICULES = 46;

/** Fond sombre chaud qui vit : deux lumières qui dérivent, une trame en perspective, des particules en 3 profondeurs. */
export function FondVivant({ intensite = 1 }: { intensite?: number }) {
  const { t, largeur: L, hauteur: H, u } = useMotion();
  const lx = 0.72 + derive(t * 0.35, 1) * 0.1;
  const ly = 0.22 + derive(t * 0.3, 2) * 0.07;
  const l2x = 0.18 + derive(t * 0.28, 5) * 0.08;
  const l2y = 0.86 + derive(t * 0.33, 6) * 0.05;
  const poussee = 1 + CAMERA.pousseeParSec * CAMERA.parallaxe[0] * t;
  return (
    <AbsoluteFill style={{ transform: `scale(${poussee.toFixed(5)})` }}>
      <AbsoluteFill
        style={{
          background: [
            `radial-gradient(ellipse ${(0.95 * L).toFixed(0)}px ${(0.62 * H).toFixed(0)}px at ${(lx * 100).toFixed(2)}% ${(ly * 100).toFixed(2)}%, ${avecOpacite(COULEURS.orange, 0.36 * intensite)}, ${avecOpacite(COULEURS.orange, 0)} 70%)`,
            `radial-gradient(ellipse ${(0.8 * L).toFixed(0)}px ${(0.45 * H).toFixed(0)}px at ${(l2x * 100).toFixed(2)}% ${(l2y * 100).toFixed(2)}%, ${avecOpacite(COULEURS.orangeProfond, 0.3 * intensite)}, ${avecOpacite(COULEURS.orangeProfond, 0)} 70%)`,
            `radial-gradient(ellipse at 50% 40%, ${COULEURS.surface} 0%, ${COULEURS.fond} 55%, ${COULEURS.fondProfond} 100%)`,
          ].join(", "),
        }}
      />
      <TramePerspective />
      {Array.from({ length: NB_PARTICULES }, (_, i) => {
        const prof = i % 3; // 0 loin, 1 milieu, 2 près
        const vitesse = [6, 13, 24][prof] * u;
        const taille = [2.2, 3.4, 6][prof] * u * (0.7 + hasard(i + 3) * 0.6);
        const x0 = hasard(i) * L;
        const y0 = hasard(i + 99) * H;
        const y = (((y0 - t * vitesse) % H) + H) % H;
        const x = x0 + derive(t * 0.4 + i, i) * 14 * u;
        const scintille = 0.55 + 0.45 * Math.sin(t * (1.1 + hasard(i + 7)) + i);
        const orange = hasard(i + 51) < 0.32;
        const opacite = [0.16, 0.24, 0.2][prof] * scintille;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: x,
              top: y,
              width: taille,
              height: taille,
              borderRadius: "50%",
              background: prof === 2 ? `radial-gradient(circle, ${orange ? COULEURS.orangeVif : COULEURS.creme} 0%, ${avecOpacite(orange ? COULEURS.orangeVif : COULEURS.creme, 0)} 70%)` : orange ? COULEURS.orangeVif : COULEURS.creme,
              opacity: opacite,
            }}
          />
        );
      })}
      {/* Vignette : les coins tombent dans le fond profond. */}
      <AbsoluteFill style={{ background: `radial-gradient(ellipse 75% 70% at 50% 45%, ${avecOpacite(COULEURS.fondProfond, 0)} 55%, ${avecOpacite(COULEURS.fondProfond, 0.75)} 100%)` }} />
    </AbsoluteFill>
  );
}

/** Trame en perspective très discrète (profondeur) qui glisse lentement vers le spectateur. */
function TramePerspective() {
  const { t, largeur: L, hauteur: H, u } = useMotion();
  const pas = 120 * u;
  const decalage = (t * 18 * u) % pas;
  return (
    <AbsoluteFill style={{ perspective: `${(900 * u).toFixed(0)}px`, perspectiveOrigin: "50% 30%", opacity: 0.55 }}>
      <div
        style={{
          position: "absolute",
          left: -L * 0.5,
          width: L * 2,
          top: H * 0.55,
          height: H * 0.9,
          transform: "rotateX(72deg)",
          transformOrigin: "50% 0%",
          backgroundImage: `linear-gradient(${avecOpacite(COULEURS.creme, 0.07)} ${Math.max(1, u * 1.5)}px, transparent ${Math.max(1, u * 1.5)}px), linear-gradient(90deg, ${avecOpacite(COULEURS.creme, 0.05)} ${Math.max(1, u * 1.5)}px, transparent ${Math.max(1, u * 1.5)}px)`,
          backgroundSize: `${pas}px ${pas}px`,
          backgroundPosition: `0px ${decalage.toFixed(2)}px`,
          maskImage: "linear-gradient(to bottom, rgba(0,0,0,0.9), rgba(0,0,0,0) 70%)",
          WebkitMaskImage: "linear-gradient(to bottom, rgba(0,0,0,0.9), rgba(0,0,0,0) 70%)",
        }}
      />
    </AbsoluteFill>
  );
}

const cacheGrain: { tuile?: string } = {};

/** Tuile de bruit 512 × 512 (déterministe), calculée une fois par page : bien moins coûteuse qu'un filtre SVG plein cadre. */
function tuile(): string {
  if (cacheGrain.tuile !== undefined || typeof document === "undefined") return cacheGrain.tuile ?? "";
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 512;
  const ctx = c.getContext("2d");
  if (!ctx) return (cacheGrain.tuile = "");
  const img = ctx.createImageData(512, 512);
  for (let i = 0; i < 512 * 512; i++) {
    const v = Math.round(128 + (hasard(i) + hasard(i + 7919) - 1) * 110);
    img.data[i * 4] = v;
    img.data[i * 4 + 1] = v;
    img.data[i * 4 + 2] = v;
    img.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return (cacheGrain.tuile = c.toDataURL("image/png"));
}

/** Grain fin en luminance (se déplace à chaque image) : évite les bandes du dégradé à la compression 8 bits. */
function Grain() {
  const image = useCurrentFrame();
  const src = tuile();
  if (!src) return null;
  const dx = Math.floor(hasard(image * 2 + 1) * 512);
  const dy = Math.floor(hasard(image * 2 + 2) * 512);
  return <AbsoluteFill style={{ pointerEvents: "none", mixBlendMode: "overlay", opacity: 0.16, backgroundImage: `url(${src})`, backgroundPosition: `${dx}px ${dy}px` }} />;
}

/* ------------------------------------------------------------------ */
/* Flou de mouvement directionnel                                        */
/* ------------------------------------------------------------------ */

/**
 * Pose `children` avec un flou DIRECTIONNEL proportionnel au déplacement pendant l'obturateur (`dx`, `dy` en px).
 * Sans mouvement, aucun filtre (rendu vectoriel net).
 */
export function FlouMouvement({ dx = 0, dy = 0, style, children }: { dx?: number; dy?: number; style?: CSSProperties; children: ReactNode }) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, "");
  const sx = flouDeplacement(dx);
  const sy = flouDeplacement(dy);
  return (
    <div style={{ ...style, filter: sx || sy ? `url(#fm${id})` : style?.filter }}>
      {(sx > 0 || sy > 0) && (
        <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden>
          <filter id={`fm${id}`} x="-40%" y="-80%" width="180%" height="260%" colorInterpolationFilters="sRGB">
            <feGaussianBlur stdDeviation={`${sx.toFixed(2)} ${sy.toFixed(2)}`} />
          </filter>
        </svg>
      )}
      {children}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Typographie cinétique                                                 */
/* ------------------------------------------------------------------ */

export interface ProprietesTexte {
  texte: string;
  niveau: NiveauTexte;
  /** Instant où le premier mot arrive (s). */
  debut: number;
  /** « mots » (par défaut) ou « lettres » (titres). */
  mode?: "mots" | "lettres";
  couleur?: string;
  /** Mots (sans casse ni ponctuation) mis en orange. */
  accents?: string[];
  graisse?: number;
  alignement?: "left" | "center";
  largeurMax?: number;
  /** Taille imposée (px) ; sinon celle du niveau. */
  taillePx?: number;
  /** Début de la chute de ce texte (par défaut : celle de la carte). */
  chute?: number;
  /** Opacité finale (texte secondaire, élément passé). */
  opacite?: number;
  style?: CSSProperties;
}

const nettoyer = (m: string) =>
  m
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]/g, "");

/** `*mot*` (ou `*deux mots*`) = mot mis en orange, comme les gros titres de la fiche de style. */
export function lireBalises(texte: string): { mots: string[]; marques: Set<number> } {
  const marques = new Set<number>();
  const mots: string[] = [];
  let dedans = false;
  for (const brut of texte.split(/\s+/).filter(Boolean)) {
    let mot = brut;
    if (mot.startsWith("*")) {
      dedans = true;
      mot = mot.slice(1);
    }
    if (dedans) marques.add(mots.length);
    if (/\*[.,!?;:…]*$/.test(mot)) {
      dedans = false;
      mot = mot.replace(/\*(?=[.,!?;:…]*$)/, "");
    }
    mots.push(mot);
  }
  return { mots, marques };
}

/** Mots qui se construisent : chacun monte, se redresse (3D) et se précise, avec 60 ms d'écart ; puis la chute. */
export function TexteCinetique(p: ProprietesTexte) {
  const ctx = useMotion();
  const { t } = ctx;
  const graisse = p.graisse ?? graisseDe(p.niveau);
  const base = p.taillePx ?? ctx.taille(p.niveau);
  // Le mot le plus long tient toujours sur une ligne (jamais sous le plancher de 3 % de la hauteur).
  const taille = p.largeurMax ? tailleQuiTient(p.texte, base, graisse, p.largeurMax, ctx.taille("legende")) : base;
  const { mots, marques } = lireBalises(p.texte);
  const accents = new Set((p.accents ?? []).flatMap((a) => a.split(/\s+/)).map(nettoyer));
  const chute = p.chute ?? ctx.chute;
  const lettres = p.mode === "lettres";
  let rang = 0;
  const elements = mots.map((mot, i) => {
    const couleurMot = marques.has(i) || accents.has(nettoyer(mot)) ? COULEURS.orangeVif : (p.couleur ?? COULEURS.creme);
    const morceaux = lettres ? Array.from(mot) : [mot];
    const enfants = morceaux.map((m, j) => {
      const r = rang++;
      const debut = p.debut + (lettres ? r * DUREES.decalageLettre : i * DUREES.decalageMot);
      const dureeE = lettres ? DUREES.entreeLongue : DUREES.entree;
      const y = (x: number) => {
        const e = progres(x, debut, dureeE, "signature");
        const s = progres(x, chute + (lettres ? r * 0.008 : i * 0.03), DUREES.sortie, "sortie");
        return (1 - e) * 0.62 * taille - s * 0.45 * taille;
      };
      const e = progres(t, debut, dureeE, "signature");
      const s = progres(t, chute + (lettres ? r * 0.008 : i * 0.03), DUREES.sortie, "sortie");
      const opacite = Math.min(1, progres(t, debut, dureeE * 0.55, "douce")) * (1 - s) * (p.opacite ?? 1);
      const rot = (1 - e) * (lettres ? -62 : -38);
      const dy = deplacementObturateur(y, t);
      return (
        <FlouMouvement key={`${i}-${j}`} dy={dy} style={{ display: "inline-block", opacity: opacite, transform: `translateY(${y(t).toFixed(2)}px) rotateX(${rot.toFixed(2)}deg)`, transformOrigin: "50% 100%" }}>
          <span style={{ color: couleurMot }}>{m}</span>
        </FlouMouvement>
      );
    });
    return (
      <span key={i} style={{ display: "inline-flex", whiteSpace: "nowrap", marginRight: i < mots.length - 1 ? "0.27em" : 0 }}>
        {enfants}
      </span>
    );
  });
  return (
    <div
      style={{
        fontSize: taille,
        fontWeight: graisse,
        lineHeight: INTERLIGNE[p.niveau],
        letterSpacing: `${APPROCHE_EM[p.niveau]}em`,
        textAlign: p.alignement ?? "left",
        maxWidth: p.largeurMax,
        perspective: `${(taille * 8).toFixed(0)}px`,
        display: "flex",
        flexWrap: "wrap",
        justifyContent: p.alignement === "center" ? "center" : "flex-start",
        rowGap: `${(taille * (INTERLIGNE[p.niveau] - 1) + taille * 0.04).toFixed(1)}px`,
        ...p.style,
      }}
    >
      {elements}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Icônes qui se dessinent                                               */
/* ------------------------------------------------------------------ */

/** Icône Lucide dessinée trait par trait (chaque tracé avec 80 ms d'écart), puis qui respire légèrement. */
export function IconeTracee({ nom, taille, debut, couleur = COULEURS.creme, epaisseur = 2, duree = 0.62, chute }: { nom: NomIcone; taille: number; debut: number; couleur?: string; epaisseur?: number; duree?: number; chute?: number }) {
  const ctx = useMotion();
  const { t } = ctx;
  const noeuds = ICONES[nom];
  const s = progres(t, chute ?? ctx.chute, DUREES.sortie, "sortie");
  const respire = 1 + 0.025 * Math.sin((t - debut) * 2.6) * progres(t, debut + duree, 0.4);
  return (
    <svg width={taille} height={taille} viewBox="0 0 24 24" fill="none" stroke={couleur} strokeWidth={epaisseur} strokeLinecap="round" strokeLinejoin="round" style={{ overflow: "visible", opacity: 1 - s, transform: `scale(${respire.toFixed(4)})` }}>
      {(noeuds as readonly (readonly [string, Record<string, string | number>])[]).map(([balise, attrs], i) => {
        const k = progres(t, debut + i * 0.08, duree, "glisse");
        const commun = { key: i, pathLength: 1, strokeDasharray: "1 1", strokeDashoffset: (1 - k).toFixed(4), opacity: k > 0.06 ? 1 : 0 };
        const a = attrs as Record<string, string | number>;
        switch (balise) {
          case "circle":
            return <circle {...commun} cx={a.cx} cy={a.cy} r={a.r} />;
          case "rect":
            return <rect {...commun} x={a.x} y={a.y} width={a.width} height={a.height} rx={a.rx} ry={a.ry} />;
          case "line":
            return <line {...commun} x1={a.x1} y1={a.y1} x2={a.x2} y2={a.y2} />;
          case "polyline":
            return <polyline {...commun} points={String(a.points)} />;
          case "polygon":
            return <polygon {...commun} points={String(a.points)} />;
          case "ellipse":
            return <ellipse {...commun} cx={a.cx} cy={a.cy} rx={a.rx} ry={a.ry} />;
          default:
            return <path {...commun} d={String(a.d)} />;
        }
      })}
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* Chiffres qui comptent                                                 */
/* ------------------------------------------------------------------ */

/** Nombre à la française (espace fine insécable entre les milliers, virgule décimale). */
export function formaterNombre(v: number, decimales = 0): string {
  return new Intl.NumberFormat("fr-FR", { minimumFractionDigits: decimales, maximumFractionDigits: decimales }).format(v);
}

/** Valeur d'un compteur à l'instant t : sortie expo (vite puis se pose), durée 1,2 s par défaut. */
export function valeurCompteur(t: number, debut: number, depuis: number, vers: number, duree = 1.2): number {
  return mixer(depuis, vers, courbe("signature")(Math.min(1, Math.max(0, (t - debut) / duree))));
}

/* ------------------------------------------------------------------ */
/* Panneaux, pastilles, traits                                           */
/* ------------------------------------------------------------------ */

/** Panneau en relief : dégradé chaud, filet clair en haut, ombre portée profonde. */
export function stylePanneau(u: number, actif = 0): CSSProperties {
  return {
    background: `linear-gradient(180deg, ${COULEURS.surfaceHaute}, ${COULEURS.surface})`,
    borderRadius: FORMES.rayon * 1080 * u,
    boxShadow: [
      `0 ${(18 * u).toFixed(1)}px ${(48 * u).toFixed(1)}px ${avecOpacite(COULEURS.fondProfond, 0.6)}`,
      `inset 0 ${(1.5 * u).toFixed(1)}px 0 ${avecOpacite(COULEURS.creme, 0.07 + 0.05 * actif)}`,
      `0 0 0 ${(1.5 * u).toFixed(1)}px ${avecOpacite(actif > 0 ? COULEURS.orange : COULEURS.filet, actif > 0 ? 0.55 * actif : 0.9)}`,
      `0 0 ${(60 * u).toFixed(1)}px ${avecOpacite(COULEURS.orange, 0.22 * actif)}`,
    ].join(", "),
  };
}

/** Trait qui se dessine (soulignement, liaison) : largeur de 0 à 100 % avec la courbe « glisse ». */
export function Trait({ debut, largeur, epaisseur, couleur = COULEURS.orange, duree = 0.55, style }: { debut: number; largeur: number; epaisseur: number; couleur?: string; duree?: number; style?: CSSProperties }) {
  const ctx = useMotion();
  const k = progres(ctx.t, debut, duree, "glisse");
  const s = progres(ctx.t, ctx.chute, DUREES.sortie, "sortie");
  return <div style={{ width: largeur * k * (1 - s), height: epaisseur, borderRadius: epaisseur, background: couleur, boxShadow: `0 0 ${epaisseur * 3}px ${avecOpacite(couleur, 0.55)}`, ...style }} />;
}

/**
 * Filigrane : très grand texte en contour orange (chiffre, symbole), à l'arrière-plan, qui dérive en parallaxe. Il
 * donne la profondeur et remplit l'espace sans rien dire de plus.
 */
export function Filigrane({ texte, x, y, taille, debut = 0 }: { texte: string; x: number; y: number; taille: number; debut?: number }) {
  const { t, u, chute } = useMotion();
  const e = progres(t, debut, 1.1, "signature");
  const s = progres(t, chute, DUREES.sortie * 1.5, "sortie");
  const dy = derive(t * 0.4, 11) * 18 * u - t * 9 * u;
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        fontSize: taille,
        fontWeight: 900,
        lineHeight: 0.8,
        color: "transparent",
        WebkitTextStroke: `${Math.max(2, 3 * u)}px ${avecOpacite(COULEURS.orange, 0.5)}`,
        opacity: 0.32 * e * (1 - s),
        transform: `translateY(${(dy + (1 - e) * 120 * u).toFixed(2)}px) scale(${(0.92 + 0.08 * e + 0.01 * t).toFixed(4)})`,
        transformOrigin: "50% 50%",
        letterSpacing: "-0.05em",
        pointerEvents: "none",
      }}
    >
      {texte}
    </div>
  );
}

/** Échelle d'entrée au ressort (petit dépassement puis repos) et de chute. */
export function echelleRessort(t: number, debut: number, chute: number): number {
  const e = t <= debut ? 0 : ressort(t - debut, "chute");
  const s = progres(t, chute, DUREES.sortie, "sortie");
  return Math.max(0, e * (1 - s));
}

export { avecOpacite, COULEURS, cycle, derive, DUREES, GRAISSES, progres, ressort, mixer, deplacementObturateur };
