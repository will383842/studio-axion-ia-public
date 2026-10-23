/**
 * NOYAU DU STYLE « SPECTACULAIRE » (facecam lot C2, décision du 09/10 après la planche). Même charte que le style
 * Sobre (sombre chaud, orange, crème, Poppins, 25 i/s), plus d'impact :
 *   - vraie profondeur 3D en perspective CSS (scène en `preserve-3d` : couches à des profondeurs différentes, caméra
 *     qui tourne légèrement : la parallaxe vient de la 3D elle-même) ;
 *   - fond en couches : lueurs lointaines, rayons de lumière, poussières lumineuses (bokeh près de l'objectif) ;
 *   - entrée en ZOOM À TRAVERS (on traverse la scène), sortie en MASQUE QUI SE DÉCHIRE (fente lumineuse) ;
 *   - typographie cinétique géante (mots qui s'écrasent, s'étirent, rebondissent), balayage de lumière et halo sur
 *     les mots clés ; éclats (chiffre qui explose à l'arrivée), onde de choc ; flou de mouvement MARQUÉ.
 * Règles : toujours lisible (rien de flou une fois posé), un seul effet fort à la fois, rien de figé plus de 1,5 s
 * (caméra et poussières toujours en mouvement). Déterministe : tout dépend de l'image (aucun hasard non graine).
 */
import { createContext, useContext, useId, type CSSProperties, type ReactNode } from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { courbe, derive, hasard, progres, ressort } from "../../../../../src/briques/motion/courbes";
import { ICONES, type NomIcone } from "../../../../../src/briques/motion/icones";
import { avecOpacite, COULEURS, DUREES, POLICE_MOTION, taillePx, type NiveauTexte } from "../../../../../src/briques/motion/jetons";
import { hauteurTexte, tailleQuiTient } from "../../../../../src/briques/motion/mesure";
import { facteurTaille, placementDe } from "../../../../../src/briques/motion/style";
import type { MiseEnPageCarte } from "../../../../../src/briques/motion/types";
import { chargerPolicesMotion } from "../polices";
import { zonesCarte, type Zone } from "../noyau";

/* ------------------------------------------------------------------ */
/* Contexte                                                              */
/* ------------------------------------------------------------------ */

export interface ContexteSpec {
  t: number;
  duree: number;
  /** Fin de l'entrée « zoom à travers » (s) : le contenu commence ici. */
  entree: number;
  /** Début de la déchirure de sortie (s). */
  sortie: number;
  largeur: number;
  hauteur: number;
  hauteurVideo: number;
  u: number;
  zone: Zone;
  zoneCentree: Zone;
  moitie: boolean;
  /** Taille d'un niveau (même hiérarchie que le style Sobre, agrandie en plein écran). */
  taille: (n: NiveauTexte) => number;
  mesurer: (texte: string, taillePx: number, graisse: number, largeur: number, niveau?: NiveauTexte) => number;
}

const Contexte = createContext<ContexteSpec | null>(null);

export function useSpec(): ContexteSpec {
  const c = useContext(Contexte);
  if (!c) throw new Error("Carte spectaculaire sans contexte.");
  return c;
}

/** Durées propres au style : entrée et sortie plus fortes que le style Sobre. */
export const DUREES_SPEC = { entree: 0.5, sortie: 0.5, eclats: 0.95, impact: 0.3 } as const;

/* ------------------------------------------------------------------ */
/* Petits outils de mouvement                                            */
/* ------------------------------------------------------------------ */

export const borne = (x: number, a = 0, b = 1) => Math.min(b, Math.max(a, x));

/** Rebond amorti après un impact à `ti` : 0 avant, puis oscillation qui s'éteint (écrasement / étirement). */
export function rebondImpact(t: number, ti: number, frequence = 21, amorti = 8.5): number {
  if (t < ti) return 0;
  const x = t - ti;
  return Math.exp(-x * amorti) * Math.cos(x * frequence);
}

/** Flou de mouvement MARQUÉ (directionnel) : écart-type ≈ 0,9 × déplacement pendant l'obturateur, plafond 60 px. */
export function FlouFort({ dx = 0, dy = 0, style, children }: { dx?: number; dy?: number; style?: CSSProperties; children: ReactNode }) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, "");
  const f = (d: number) => {
    const v = Math.abs(d) * 0.9;
    return v < 0.5 ? 0 : Math.min(60, v);
  };
  const sx = f(dx);
  const sy = f(dy);
  return (
    <div style={{ ...style, filter: sx || sy ? `url(#ff${id})` : style?.filter }}>
      {(sx > 0 || sy > 0) && (
        <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden>
          <filter id={`ff${id}`} x="-60%" y="-120%" width="220%" height="340%" colorInterpolationFilters="sRGB">
            <feGaussianBlur stdDeviation={`${sx.toFixed(2)} ${sy.toFixed(2)}`} />
          </filter>
        </svg>
      )}
      {children}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Scène : fond en couches, caméra 3D, entrée et sortie                  */
/* ------------------------------------------------------------------ */

/** Caméra (degrés et px) à l'instant t : légère orbite continue et poussée lente. */
export function camera(t: number, u: number) {
  return {
    ry: -4 + 6 * courbe("glisse")(borne(t / 5)) + derive(t * 0.5, 4) * 1.6,
    rx: 4 - 3 * courbe("glisse")(borne(t / 5)) + derive(t * 0.45, 9) * 1.1,
    z: 12 * u * t,
  };
}

export function SceneSpectaculaire({ mp, children, decor }: { mp: MiseEnPageCarte; children: ReactNode; decor?: ReactNode }) {
  chargerPolicesMotion();
  const image = useCurrentFrame();
  const t = image / mp.fps;
  const duree = mp.images / mp.fps;
  const { zone, zoneCentree } = zonesCarte(mp);
  const placement = placementDe(mp);
  const tailleDe = (n: NiveauTexte) => Math.round(taillePx(n, mp.hauteurVideo) * facteurTaille(placement, n));
  const ctx: ContexteSpec = {
    t,
    duree,
    entree: DUREES_SPEC.entree,
    sortie: Math.max(1.2, duree - DUREES_SPEC.sortie),
    largeur: mp.largeur,
    hauteur: mp.hauteur,
    hauteurVideo: mp.hauteurVideo,
    u: mp.largeur / 1080,
    zone,
    zoneCentree,
    moitie: mp.disposition === "moitie-haute",
    taille: tailleDe,
    mesurer: (texte, taille, graisse, largeur, niveau = "corps") => hauteurTexte(texte, niveau, taille, graisse, largeur),
  };
  return (
    <Contexte.Provider value={ctx}>
      <AbsoluteFill style={{ backgroundColor: COULEURS.fondProfond, overflow: "hidden", fontFamily: `"${POLICE_MOTION}", sans-serif`, color: COULEURS.creme }}>
        <Dechirure>
          <EntreeZoom>
            <FondEnCouches />
            <Camera3D decor={decor}>{children}</Camera3D>
            <Poussieres proches />
          </EntreeZoom>
        </Dechirure>
        <Vignette />
      </AbsoluteFill>
    </Contexte.Provider>
  );
}

/** Caméra : perspective, orbite légère, poussée. Le décor (filigrane) vit loin derrière : la parallaxe est réelle. */
function Camera3D({ children, decor }: { children: ReactNode; decor?: ReactNode }) {
  const { t, u, largeur, hauteur } = useSpec();
  const c = camera(t, u);
  return (
    <AbsoluteFill style={{ perspective: `${(1500 * u).toFixed(0)}px`, perspectiveOrigin: `50% 46%` }}>
      <AbsoluteFill style={{ transformStyle: "preserve-3d", transformOrigin: `${largeur / 2}px ${hauteur * 0.48}px`, transform: `translateZ(${c.z.toFixed(2)}px) rotateX(${c.rx.toFixed(3)}deg) rotateY(${c.ry.toFixed(3)}deg)` }}>
        {decor && <AbsoluteFill style={{ transform: `translateZ(${(-700 * u).toFixed(0)}px) scale(1.47)`, transformStyle: "preserve-3d" }}>{decor}</AbsoluteFill>}
        <Poussieres profondeur={-380} />
        <AbsoluteFill style={{ transformStyle: "preserve-3d" }}>{children}</AbsoluteFill>
      </AbsoluteFill>
    </AbsoluteFill>
  );
}

/** Entrée « zoom à travers » : la scène arrive de derrière l'objectif (échelle 2,6 → 1), floue puis nette. */
function EntreeZoom({ children }: { children: ReactNode }) {
  const { t, entree, largeur, hauteur, u } = useSpec();
  const k = courbe("signature")(borne(t / entree));
  const k2 = courbe("signature")(borne((t - 1 / 25) / entree));
  const echelle = 2.6 - 1.6 * k;
  const vitesse = Math.abs(2.6 - 1.6 * k2 - echelle);
  const flou = Math.min(26, vitesse * 70) * u;
  return (
    <AbsoluteFill style={{ transform: `scale(${echelle.toFixed(4)})`, transformOrigin: `${largeur / 2}px ${hauteur * 0.47}px`, opacity: borne(t / (entree * 0.45)), filter: flou > 0.4 ? `blur(${flou.toFixed(2)}px)` : undefined }}>
      {children}
      {/* Traînées de vitesse pendant la traversée. */}
      {k < 0.98 && <TraineesVitesse k={k} />}
    </AbsoluteFill>
  );
}

function TraineesVitesse({ k }: { k: number }) {
  const { largeur: L, hauteur: H, u } = useSpec();
  const cx = L / 2;
  const cy = H * 0.47;
  return (
    <svg width={L} height={H} style={{ position: "absolute", left: 0, top: 0, opacity: (1 - k) * 0.9, mixBlendMode: "screen" }}>
      {Array.from({ length: 34 }, (_, i) => {
        const a = (i / 34) * Math.PI * 2 + hasard(i + 400) * 0.18;
        const r1 = (0.18 + hasard(i + 410) * 0.25) * H * (0.4 + k);
        const r2 = r1 + (0.12 + hasard(i + 420) * 0.22) * H * (1 - k);
        return (
          <line
            key={i}
            x1={cx + Math.cos(a) * r1}
            y1={cy + Math.sin(a) * r1}
            x2={cx + Math.cos(a) * r2}
            y2={cy + Math.sin(a) * r2}
            stroke={i % 3 === 0 ? COULEURS.orangeVif : COULEURS.creme}
            strokeOpacity={0.35 + 0.4 * hasard(i + 430)}
            strokeWidth={(2 + hasard(i + 440) * 4) * u}
            strokeLinecap="round"
          />
        );
      })}
    </svg>
  );
}

/** Ligne brisée de la déchirure (fraction de la largeur, de haut en bas), fixe pour une carte. */
const POINTS_DECHIRURE = Array.from({ length: 13 }, (_, i) => ({ y: i / 12, x: 0.5 + (i === 0 || i === 12 ? 0 : (hasard(i + 777) - 0.5) * 0.14) + (i / 12 - 0.5) * 0.22 }));

/**
 * Sortie « masque qui se déchire » : la scène se fend le long d'une ligne brisée lumineuse ; les deux moitiés
 * s'écartent, tournent et tombent dans le noir. Avant la sortie : la scène, une seule fois.
 */
function Dechirure({ children }: { children: ReactNode }) {
  const { t, sortie, duree, largeur: L, hauteur: H, u } = useSpec();
  if (t < sortie) return <AbsoluteFill>{children}</AbsoluteFill>;
  const k = courbe("sortie")(borne((t - sortie) / (duree - sortie)));
  const fente = progres(t, sortie, 0.12, "douce");
  const pts = POINTS_DECHIRURE.map((p) => `${(p.x * 100).toFixed(2)}% ${(p.y * 100).toFixed(2)}%`);
  const gauche = `polygon(0% 0%, ${pts.join(", ")}, 0% 100%)`;
  const droite = `polygon(100% 0%, ${pts.join(", ")}, 100% 100%)`;
  const ecart = k * L * 0.62;
  const moitie = (cote: -1 | 1, clip: string) => (
    <AbsoluteFill
      style={{
        clipPath: clip,
        transform: `translateX(${(cote * ecart).toFixed(2)}px) translateY(${(k * k * H * 0.12).toFixed(2)}px) rotate(${(cote * k * 9).toFixed(3)}deg)`,
        transformOrigin: cote < 0 ? "0% 100%" : "100% 100%",
        opacity: 1 - k * 0.85,
        filter: k > 0.05 ? `blur(${(k * 14 * u).toFixed(2)}px)` : undefined,
      }}
    >
      {children}
    </AbsoluteFill>
  );
  const ligne = POINTS_DECHIRURE.map((p) => `${(p.x * L).toFixed(1)},${(p.y * H).toFixed(1)}`).join(" ");
  return (
    <AbsoluteFill>
      {moitie(-1, gauche)}
      {moitie(1, droite)}
      {/* La fente : un trait de lumière orange qui s'ouvre puis s'éteint. */}
      <svg width={L} height={H} style={{ position: "absolute", left: 0, top: 0, mixBlendMode: "screen", opacity: fente * (1 - k) }}>
        <polyline points={ligne} fill="none" stroke={COULEURS.orangeVif} strokeWidth={(10 + 60 * k) * u} strokeLinejoin="round" style={{ filter: `blur(${(10 * u).toFixed(1)}px)` }} />
        <polyline points={ligne} fill="none" stroke={COULEURS.creme} strokeWidth={(3 + 8 * k) * u} strokeLinejoin="round" />
      </svg>
    </AbsoluteFill>
  );
}

/** Fond en couches : base chaude, deux lueurs qui dérivent, rayons de lumière qui tournent lentement. */
function FondEnCouches() {
  const { t, largeur: L, hauteur: H } = useSpec();
  const c = camera(t, 1);
  // La couche lointaine suit la caméra à 30 % : parallaxe avec le contenu.
  const px = -c.ry * 0.006 * L;
  const py = c.rx * 0.006 * H;
  const lx = 0.7 + derive(t * 0.4, 1) * 0.12;
  const ly = 0.2 + derive(t * 0.35, 2) * 0.08;
  const l2x = 0.22 + derive(t * 0.3, 5) * 0.1;
  const l2y = 0.82 + derive(t * 0.36, 6) * 0.06;
  return (
    <AbsoluteFill style={{ transform: `translate(${px.toFixed(2)}px, ${py.toFixed(2)}px) scale(1.06)` }}>
      <AbsoluteFill
        style={{
          background: [
            `radial-gradient(ellipse ${(0.9 * L).toFixed(0)}px ${(0.55 * H).toFixed(0)}px at ${(lx * 100).toFixed(2)}% ${(ly * 100).toFixed(2)}%, ${avecOpacite(COULEURS.orange, 0.42)}, ${avecOpacite(COULEURS.orange, 0)} 70%)`,
            `radial-gradient(ellipse ${(0.85 * L).toFixed(0)}px ${(0.45 * H).toFixed(0)}px at ${(l2x * 100).toFixed(2)}% ${(l2y * 100).toFixed(2)}%, ${avecOpacite(COULEURS.orangeProfond, 0.42)}, ${avecOpacite(COULEURS.orangeProfond, 0)} 70%)`,
            `radial-gradient(ellipse at 50% 42%, ${COULEURS.surfaceHaute} 0%, ${COULEURS.fond} 48%, ${COULEURS.fondProfond} 100%)`,
          ].join(", "),
        }}
      />
      <RayonsLumiere />
    </AbsoluteFill>
  );
}

/** Rayons de lumière volumétriques depuis le haut, qui tournent lentement (mouvement secondaire permanent). */
function RayonsLumiere() {
  const { t, largeur: L, hauteur: H } = useSpec();
  const a = -12 + t * 3.2 + derive(t * 0.3, 13) * 3;
  return (
    <AbsoluteFill
      style={{
        background: `conic-gradient(from ${a.toFixed(2)}deg at 72% -8%, ${avecOpacite(COULEURS.creme, 0)} 0deg, ${avecOpacite(COULEURS.orangeVif, 0.1)} 6deg, ${avecOpacite(COULEURS.creme, 0)} 11deg, ${avecOpacite(COULEURS.creme, 0)} 19deg, ${avecOpacite(COULEURS.creme, 0.07)} 23deg, ${avecOpacite(COULEURS.creme, 0)} 28deg, ${avecOpacite(COULEURS.creme, 0)} 40deg, ${avecOpacite(COULEURS.orangeVif, 0.08)} 46deg, ${avecOpacite(COULEURS.creme, 0)} 52deg, ${avecOpacite(COULEURS.creme, 0)} 360deg)`,
        maskImage: `radial-gradient(ellipse ${(L * 1.1).toFixed(0)}px ${(H * 0.9).toFixed(0)}px at 72% 0%, black, transparent 80%)`,
        WebkitMaskImage: `radial-gradient(ellipse ${(L * 1.1).toFixed(0)}px ${(H * 0.9).toFixed(0)}px at 72% 0%, black, transparent 80%)`,
        mixBlendMode: "screen",
      }}
    />
  );
}

/**
 * Poussières lumineuses. `profondeur` négative : couche lointaine dans la scène 3D (fines, nettes) ; `proches` : bokeh
 * devant l'objectif (gros disques flous qui passent lentement).
 */
function Poussieres({ profondeur = 0, proches = false }: { profondeur?: number; proches?: boolean }) {
  const { t, largeur: L, hauteur: H, u } = useSpec();
  const n = proches ? 9 : 54;
  const graine = proches ? 900 : 300;
  return (
    <AbsoluteFill style={{ transform: proches ? undefined : `translateZ(${(profondeur * u).toFixed(0)}px) scale(${(1 - profondeur / 1500).toFixed(3)})`, pointerEvents: "none" }}>
      {Array.from({ length: n }, (_, i) => {
        const h = (k: number) => hasard(graine + i * 7 + k);
        const vitesse = (proches ? 40 : 10 + h(1) * 22) * u;
        const taille = (proches ? 40 + h(2) * 70 : 2 + h(2) * 5) * u;
        const x = h(3) * L + derive(t * 0.5 + i, i) * (proches ? 40 : 18) * u;
        const y = ((((h(4) * H - t * vitesse) % H) + H) % H) - taille / 2;
        const orange = h(5) < 0.4;
        const scintille = 0.55 + 0.45 * Math.sin(t * (1.3 + h(6) * 2) + i);
        const teinte = orange ? COULEURS.orangeVif : COULEURS.creme;
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
              background: proches ? `radial-gradient(circle, ${avecOpacite(teinte, 0.22)} 0%, ${avecOpacite(teinte, 0.1)} 45%, ${avecOpacite(teinte, 0)} 70%)` : `radial-gradient(circle, ${teinte} 0%, ${avecOpacite(teinte, 0)} 70%)`,
              opacity: (proches ? 0.75 : 0.65) * scintille,
              boxShadow: proches ? undefined : `0 0 ${(taille * 2.5).toFixed(1)}px ${avecOpacite(teinte, 0.5)}`,
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
}

function Vignette() {
  return <AbsoluteFill style={{ pointerEvents: "none", background: `radial-gradient(ellipse 80% 72% at 50% 46%, ${avecOpacite(COULEURS.fondProfond, 0)} 52%, ${avecOpacite(COULEURS.fondProfond, 0.82)} 100%)` }} />;
}

/* ------------------------------------------------------------------ */
/* Typographie cinétique géante                                          */
/* ------------------------------------------------------------------ */

export type EffetMot = "ecrase" | "etire" | "rebond";

export interface ProprietesMots {
  texte: string;
  debut: number;
  taille: number;
  graisse?: number;
  effet?: EffetMot;
  couleur?: string;
  alignement?: "left" | "center";
  largeurMax?: number;
  /** Écart entre deux mots (s). */
  decalage?: number;
  /** Instant du balayage de lumière sur les mots clés (`*mot*`) ; absent : juste après leur arrivée. */
  balayage?: number;
  interligne?: number;
  approche?: number;
  opacite?: number;
  style?: CSSProperties;
}

/** Découpe `*mot clé*` : renvoie les mots et l'ensemble des index mis en orange. */
export function decouper(texte: string): { mots: string[]; cles: Set<number> } {
  const cles = new Set<number>();
  let dedans = false;
  const mots = texte
    .split(/\s+/)
    .filter(Boolean)
    .map((m, i) => {
      let mot = m;
      if (mot.startsWith("*")) {
        dedans = true;
        mot = mot.slice(1);
      }
      if (dedans) cles.add(i);
      if (/\*[.,!?;:…]*$/.test(mot)) {
        dedans = false;
        mot = mot.replace(/\*(?=[.,!?;:…]*$)/, "");
      }
      return mot;
    });
  return { mots, cles };
}

/** État d'un mot géant à l'instant t (transformations et flou), selon son effet (`hauteurChute` : px de chute du « rebond »). */
export function etatMot(effet: EffetMot, t: number, d: number, taille: number, u: number, hauteurChute = 330 * u) {
  const vol = 0.3;
  const ti = d + vol;
  const k = courbe("signature")(borne((t - d) / vol));
  const kAvant = courbe("signature")(borne((t - 1 / 50 - d) / vol));
  const r = rebondImpact(t, ti);
  if (effet === "etire") {
    // Arrive de la droite, étiré en largeur, se tasse à l'arrêt puis se détend.
    const x = (1 - k) * 760 * u;
    const xAvant = (1 - kAvant) * 760 * u;
    return { tx: x, ty: 0, sx: 1 + (1 - k) * 1.8 - 0.22 * r, sy: 1 - (1 - k) * 0.35 + 0.14 * r, tz: 0, rot: 0, dx: x - xAvant, dy: 0, opacite: borne((t - d) / 0.08) };
  }
  if (effet === "rebond") {
    // Tombe d'en haut, s'écrase au sol puis rebondit deux fois.
    const chute = t < ti ? -(1 - courbe("sortie")(borne((t - d) / vol))) * hauteurChute : -Math.abs(Math.exp(-(t - ti) * 5.5) * Math.sin((t - ti) * 13)) * 110 * u;
    const chuteAvant = t - 1 / 50 < ti ? -(1 - courbe("sortie")(borne((t - 1 / 50 - d) / vol))) * hauteurChute : -Math.abs(Math.exp(-(t - 1 / 50 - ti) * 5.5) * Math.sin((t - 1 / 50 - ti) * 13)) * 110 * u;
    const ecrase = t >= ti ? Math.max(0, Math.exp(-(t - ti) * 9) * Math.cos((t - ti) * 26)) : 0;
    return { tx: 0, ty: chute, sx: 1 + 0.3 * ecrase - (t < ti ? 0.12 : 0), sy: 1 - 0.3 * ecrase + (t < ti ? 0.22 : 0), tz: 0, rot: 0, dx: 0, dy: chute - chuteAvant, opacite: borne((t - d) / 0.1) };
  }
  // « ecrase » : fonce depuis la caméra (énorme : projection d'une profondeur de 1 100 px sous une perspective de
  // 1 500 px) et s'écrase sur la page, puis se détend en ressort.
  const m = 1500 / (1500 - 1100 * (1 - k));
  const mAvant = 1500 / (1500 - 1100 * (1 - kAvant));
  return { tx: 0, ty: 0, sx: m * (1 + 0.26 * r), sy: m * (1 - 0.26 * r), tz: 0, rot: (1 - k) * -14, dx: 0, dy: (m - mAvant) * taille * 0.45, opacite: borne((t - d) / 0.12) };
}

/** Mots géants : chacun arrive avec son effet ; les mots clés passent en orange, avec halo et balayage de lumière. */
export function MotsGeants(p: ProprietesMots) {
  const { t, u, hauteurVideo } = useSpec();
  const graisse = p.graisse ?? 800;
  const taille = p.largeurMax ? tailleQuiTient(p.texte, p.taille, graisse, p.largeurMax, Math.round(0.031 * hauteurVideo)) : p.taille;
  const { mots, cles } = decouper(p.texte);
  const effet = p.effet ?? "ecrase";
  const decalage = p.decalage ?? 0.09;
  const derniereCle = Math.max(-1, ...cles);
  const tBalayage = p.balayage ?? p.debut + (derniereCle + 1) * decalage + 0.35;
  return (
    <div
      style={{
        fontSize: taille,
        fontWeight: graisse,
        lineHeight: p.interligne ?? 1.02,
        letterSpacing: `${p.approche ?? -0.03}em`,
        display: "flex",
        flexWrap: "wrap",
        justifyContent: p.alignement === "center" ? "center" : "flex-start",
        maxWidth: p.largeurMax,
        columnGap: "0.26em",
        transformStyle: "preserve-3d",
        opacity: p.opacite ?? 1,
        ...p.style,
      }}
    >
      {mots.map((mot, i) => {
        const d = p.debut + i * decalage;
        const e = etatMot(effet, t, d, taille, u);
        const cle = cles.has(i);
        const flotte = Math.sin(t * 1.6 + i * 1.3) * 2.5 * u * borne((t - d - 0.6) / 0.4);
        return (
          <FlouFort
            key={i}
            dx={e.dx}
            dy={e.dy}
            style={{
              display: "inline-block",
              whiteSpace: "nowrap",
              opacity: e.opacite,
              transform: `translate3d(${e.tx.toFixed(2)}px, ${(e.ty + flotte).toFixed(2)}px, ${e.tz.toFixed(2)}px) rotateZ(${e.rot.toFixed(2)}deg) scale(${e.sx.toFixed(4)}, ${e.sy.toFixed(4)})`,
              transformOrigin: effet === "rebond" ? "50% 100%" : "50% 60%",
            }}
          >
            {cle ? <MotCle mot={mot} t={t} arrivee={d + 0.3} balayage={tBalayage} u={u} /> : <span style={{ color: p.couleur ?? COULEURS.creme }}>{mot}</span>}
          </FlouFort>
        );
      })}
    </div>
  );
}

/**
 * Mot clé : orange, halo qui s'allume à l'arrivée puis respire, balayage de lumière (une bande crème traverse les
 * lettres). Le halo est une ombre (drop-shadow) : le texte reste net.
 */
export function MotCle({ mot, t, arrivee, balayage, u }: { mot: string; t: number; arrivee: number; balayage: number; u: number }) {
  const halo = progres(t, arrivee - 0.05, 0.3) * (0.75 + 0.25 * Math.sin((t - arrivee) * 3.2));
  const b = borne((t - balayage) / 0.7);
  const pos = 130 - 160 * courbe("glisse")(b);
  return (
    <span
      style={{
        color: "transparent",
        backgroundImage: `linear-gradient(100deg, ${COULEURS.orangeVif} 0%, ${COULEURS.orangeVif} 38%, ${COULEURS.creme} 48%, ${COULEURS.creme} 52%, ${COULEURS.orangeVif} 62%, ${COULEURS.orangeVif} 100%)`,
        backgroundSize: "300% 100%",
        backgroundPosition: `${pos.toFixed(2)}% 0%`,
        WebkitBackgroundClip: "text",
        backgroundClip: "text",
        filter: `drop-shadow(0 0 ${(18 * u * halo).toFixed(1)}px ${avecOpacite(COULEURS.orangeVif, 0.75 * halo)}) drop-shadow(0 0 ${(46 * u * halo).toFixed(1)}px ${avecOpacite(COULEURS.orange, 0.5 * halo)})`,
        paddingRight: "0.04em",
      }}
    >
      {mot}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Éclats, onde de choc, éclair                                          */
/* ------------------------------------------------------------------ */

/**
 * Explosion en éclats à `debut` autour de (x, y) : des triangles orange et crème partent en étoile en tournant, une
 * onde de choc s'étend, un éclair bref. Dure ≈ 0,95 s ; déterministe (graine).
 */
export function Eclats({ x, y, debut, rayon, nombre = 30, graine = 1, flash = true }: { x: number; y: number; debut: number; rayon: number; nombre?: number; graine?: number; flash?: boolean }) {
  const { t, u } = useSpec();
  const tau = (t - debut) / DUREES_SPEC.eclats;
  if (tau < 0 || tau > 1) return null;
  const sortieExpo = courbe("signature")(tau);
  const eclair = Math.max(0, 1 - tau * 4.5);
  const onde = courbe("signature")(borne(tau * 1.4));
  return (
    <div style={{ position: "absolute", left: 0, top: 0, width: 0, height: 0, pointerEvents: "none" }}>
      {flash && (
        <div style={{ position: "absolute", left: x - rayon, top: y - rayon, width: rayon * 2, height: rayon * 2, borderRadius: "50%", background: `radial-gradient(circle, ${avecOpacite(COULEURS.creme, 0.85 * eclair)}, ${avecOpacite(COULEURS.orangeVif, 0.45 * eclair)} 30%, ${avecOpacite(COULEURS.orange, 0)} 65%)`, transform: `scale(${(0.4 + 0.9 * onde).toFixed(3)})`, mixBlendMode: "screen" }} />
      )}
      <div style={{ position: "absolute", left: x - rayon * 1.25, top: y - rayon * 1.25, width: rayon * 2.5, height: rayon * 2.5, borderRadius: "50%", border: `${Math.max(2, (1 - onde) * 14 * u).toFixed(1)}px solid ${avecOpacite(COULEURS.orangeVif, 0.7 * (1 - onde))}`, transform: `scale(${(0.15 + 0.85 * onde).toFixed(3)})`, boxShadow: `0 0 ${30 * u}px ${avecOpacite(COULEURS.orangeVif, 0.5 * (1 - onde))}` }} />
      {Array.from({ length: nombre }, (_, i) => {
        const h = (k: number) => hasard(graine * 1000 + i * 11 + k);
        const a = (i / nombre) * Math.PI * 2 + (h(1) - 0.5) * 0.5;
        const dist = rayon * (0.55 + h(2) * 0.9) * sortieExpo;
        const gravite = tau * tau * 140 * u;
        const cote = (14 + h(3) * 34) * u;
        const rot = (h(4) - 0.5) * 900 * tau + h(5) * 360;
        const orange = h(6) < 0.62;
        const forme = `polygon(${(h(7) * 40).toFixed(0)}% 0%, 100% ${(30 + h(8) * 60).toFixed(0)}%, ${(h(9) * 30).toFixed(0)}% 100%)`;
        const vitesse = rayon * (0.55 + h(2) * 0.9) * (1 - tau) * 0.12;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: x + Math.cos(a) * dist - cote / 2,
              top: y + Math.sin(a) * dist + gravite - cote / 2,
              width: cote,
              height: cote * (0.6 + h(10) * 0.8),
              clipPath: forme,
              background: orange ? `linear-gradient(135deg, ${COULEURS.orangeVif}, ${COULEURS.orangeProfond})` : `linear-gradient(135deg, ${COULEURS.creme}, ${COULEURS.cremeAttenuee})`,
              transform: `rotate(${rot.toFixed(1)}deg) scale(${(1 - tau * 0.6).toFixed(3)})`,
              opacity: Math.min(1, (1 - tau) * 1.6),
              filter: vitesse > 2 ? `blur(${Math.min(6, vitesse * 0.08).toFixed(2)}px)` : undefined,
            }}
          />
        );
      })}
    </div>
  );
}

/** Balayage de lumière diagonal sur un panneau (une bande crème traverse, en mode écran). */
export function Balayage({ debut, duree = 0.75, opacite = 0.28 }: { debut: number; duree?: number; opacite?: number }) {
  const { t } = useSpec();
  const k = borne((t - debut) / duree);
  if (k <= 0 || k >= 1) return null;
  const x = -60 + 220 * courbe("glisse")(k);
  return (
    <div style={{ position: "absolute", inset: 0, borderRadius: "inherit", overflow: "hidden", pointerEvents: "none", mixBlendMode: "screen" }}>
      <div style={{ position: "absolute", top: "-50%", bottom: "-50%", left: `${x.toFixed(2)}%`, width: "38%", transform: "rotate(18deg)", background: `linear-gradient(90deg, ${avecOpacite(COULEURS.creme, 0)}, ${avecOpacite(COULEURS.creme, opacite)} 50%, ${avecOpacite(COULEURS.creme, 0)})` }} />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Panneaux, icônes, nombres                                             */
/* ------------------------------------------------------------------ */

/** Panneau « verre chaud » en relief : dégradé, filet lumineux, ombre profonde ; `actif` l'allume en orange. */
export function stylePanneauSpec(u: number, actif = 0): CSSProperties {
  return {
    background: `linear-gradient(160deg, ${avecOpacite(COULEURS.surfaceHaute, 0.96)}, ${avecOpacite(COULEURS.surface, 0.94)} 60%, ${avecOpacite(COULEURS.fond, 0.94)})`,
    borderRadius: 34 * u,
    boxShadow: [
      `0 ${(30 * u).toFixed(1)}px ${(70 * u).toFixed(1)}px ${avecOpacite(COULEURS.fondProfond, 0.75)}`,
      `inset 0 ${(2 * u).toFixed(1)}px 0 ${avecOpacite(COULEURS.creme, 0.1 + 0.12 * actif)}`,
      `0 0 0 ${(2 * u).toFixed(1)}px ${avecOpacite(actif > 0.02 ? COULEURS.orangeVif : COULEURS.filet, actif > 0.02 ? 0.4 + 0.5 * actif : 1)}`,
      `0 0 ${(80 * u).toFixed(1)}px ${avecOpacite(COULEURS.orangeVif, 0.42 * actif)}`,
    ].join(", "),
  };
}

/** Icône Lucide tracée trait par trait (même dessin que le style Sobre), avec une lueur. */
export function IconeSpec({ nom, taille, debut, couleur = COULEURS.creme, epaisseur = 2.2, duree = 0.5 }: { nom: NomIcone; taille: number; debut: number; couleur?: string; epaisseur?: number; duree?: number }) {
  const { t, u } = useSpec();
  const noeuds = ICONES[nom] as readonly (readonly [string, Record<string, string | number>])[];
  return (
    <svg width={taille} height={taille} viewBox="0 0 24 24" fill="none" stroke={couleur} strokeWidth={epaisseur} strokeLinecap="round" strokeLinejoin="round" style={{ overflow: "visible", filter: `drop-shadow(0 0 ${(8 * u).toFixed(1)}px ${avecOpacite(COULEURS.orangeVif, 0.6)})` }}>
      {noeuds.map(([balise, a], i) => {
        const k = progres(t, debut + i * 0.07, duree, "glisse");
        const commun = { key: i, pathLength: 1, strokeDasharray: "1 1", strokeDashoffset: (1 - k).toFixed(4), opacity: k > 0.05 ? 1 : 0 };
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

/** Filigrane géant (contour orange) pour la couche lointaine du décor. */
export function FiligraneSpec({ texte, x, y, taille, debut = 0 }: { texte: string; x: number; y: number; taille: number; debut?: number }) {
  const { t, u } = useSpec();
  const e = progres(t, debut, 1, "signature");
  return (
    <div style={{ position: "absolute", left: x, top: y, transform: `translate(-50%, -50%) translateY(${(-t * 14 * u).toFixed(2)}px)`, fontSize: taille, fontWeight: 900, lineHeight: 0.8, color: "transparent", WebkitTextStroke: `${Math.max(3, 4 * u)}px ${avecOpacite(COULEURS.orange, 0.55)}`, opacity: 0.4 * e, letterSpacing: "-0.05em", whiteSpace: "nowrap" }}>
      {texte}
    </div>
  );
}

export { avecOpacite, COULEURS, courbe, derive, DUREES, hasard, progres, ressort };
