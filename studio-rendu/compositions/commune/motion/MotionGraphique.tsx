/**
 * Modèle 7 — GRAPHIQUE (lot F2), trois variantes, chaque valeur arrive au mot près et compte :
 *   - barres : chaque barre jaillit au ressort depuis l'axe (flou de mouvement), sa valeur compte au bout, la plus
 *     forte s'allume en orange et respire ; la grille se dessine ;
 *   - courbe : la ligne se trace de point en point avec la parole (comète au bout), l'aire se remplit derrière,
 *     chaque point rebondit et sa valeur compte depuis la précédente ;
 *   - camembert : l'anneau se construit part après part, la part forte se détache, le centre suit la part dite.
 * Fond vivant, caméra, filigrane : le noyau commun (style Sobre validé).
 */
import { useId } from "react";
import { largeurMotMotion } from "../../../../src/briques/motion/mesure";
import type { DonneesGraphique } from "../../../../src/briques/motion/types-etendus";
import type { MiseEnPageCarte } from "../../../../src/briques/motion/types";
import { heuresSeries, indexFort, tailleTitreAjustee, texteValeur, uniteGraphique } from "./outils-etendus";
import { avecOpacite, CarteMotion, COULEURS, deplacementObturateur, DUREES, echelleRessort, Filigrane, FlouMouvement, progres, ressort, TexteCinetique, useMotion, valeurCompteur, type Zone } from "./noyau";
import { GraphiqueSpectaculaire } from "./spectaculaire/GraphiqueSpectaculaire";

/** Teintes des parts (camembert), toutes dans la charte : la part forte est toujours l'orange vif. */
export const TEINTES_PARTS = [COULEURS.creme, COULEURS.orangeProfond, COULEURS.cremeAttenuee, COULEURS.orange, avecOpacite(COULEURS.creme, 0.42), COULEURS.filet];

/** Teinte d'une part : orange vif pour la part forte, sinon la suite de la charte (sans jamais reprendre l'orange vif). */
export function teintePart(i: number, fort: number): string {
  if (i === fort) return COULEURS.orangeVif;
  const rang = i < fort ? i : i - 1;
  return TEINTES_PARTS[rang % TEINTES_PARTS.length];
}

/** Zone du graphique sous le titre et au-dessus de la note. */
/** Zone du graphique sous le titre (de hauteur `hTitre`) et au-dessus de la note (si elle est montrée). */
function zoneGraphe(zone: Zone, hTitre: number, avecNote: boolean, tLeg: number, u: number): Zone {
  const haut = hTitre > 0 ? hTitre + 44 * u : 0;
  const bas = avecNote ? tLeg * 1.5 + 18 * u : 0;
  return { x: zone.x, y: zone.y + haut, largeur: zone.largeur, hauteur: zone.hauteur - haut - bas };
}

/** Le graphique a-t-il la place de montrer sa note ? (En moitié haute, la note s'efface d'abord.) */
export const noteMontree = (d: DonneesGraphique, moitie: boolean) => !!d.note && !moitie;

/* ------------------------------------------------------------------ */
/* Barres                                                                */
/* ------------------------------------------------------------------ */

function Barres({ d, z, heures, fort }: { d: DonneesGraphique; z: Zone; heures: number[]; fort: number }) {
  const { t, u, taille, chute } = useMotion();
  const n = d.series.length;
  const unite = uniteGraphique(d);
  const max = Math.max(...d.series.map((s) => s.valeur), 1e-6);
  const tLib = taille("legende");
  const tVal = taille("corps");
  const ligne = Math.min(z.hauteur / n, tVal * 3.3);
  // Peu de hauteur (moitié haute) : étiquette à gauche de la barre plutôt qu'au-dessus.
  const enLigne = ligne < tLib * 2.5;
  const largeurLib = enLigne ? Math.max(...d.series.map((s) => largeurMotMotion(s.libelle, tLib, 600))) + 24 * u : 0;
  const largeurVal = Math.max(...d.series.map((s) => largeurMotMotion(texteValeur(s.valeur, unite, d.decimales), tVal, 800))) + 28 * u;
  const longueur = Math.max(80 * u, z.largeur - largeurLib - largeurVal);
  const epaisseur = Math.min(enLigne ? ligne * 0.56 : ligne * 0.34, 78 * u);
  const haut = z.y + (z.hauteur - ligne * n) / 2;
  const x0 = z.x + largeurLib;
  const tFort = heures[n - 1] + 0.55;
  const respire = progres(t, tFort, 0.6) * (0.5 + 0.5 * Math.sin((t - tFort) * 3));
  const s = progres(t, chute, DUREES.sortie, "sortie");
  return (
    <>
      {/* Grille : 4 traits verticaux qui se dessinent de haut en bas. */}
      {[0.25, 0.5, 0.75, 1].map((f, i) => (
        <div key={i} style={{ position: "absolute", left: x0 + longueur * f, top: haut - 10 * u, width: Math.max(1.5, 2 * u), height: (ligne * n + 20 * u) * progres(t, 0.1 + i * 0.07, 0.8, "glisse"), background: avecOpacite(COULEURS.creme, 0.07), opacity: 1 - s }} />
      ))}
      <div style={{ position: "absolute", left: x0, top: haut - 10 * u, width: Math.max(3, 4 * u), height: (ligne * n + 20 * u) * progres(t, 0.05, 0.7, "glisse"), borderRadius: 4 * u, background: COULEURS.filet, opacity: 1 - s }} />
      {d.series.map((serie, i) => {
        const h = heures[i];
        const estFort = i === fort;
        const sortie = progres(t, chute + (n - 1 - i) * 0.04, DUREES.sortie, "sortie");
        const lg = (tt: number) => (tt <= h ? 0 : ressort(tt - h, "souple")) * (serie.valeur / max) * longueur * (1 - progres(tt, chute + (n - 1 - i) * 0.04, DUREES.sortie, "sortie"));
        const l = lg(t);
        const y = haut + i * ligne + (enLigne ? (ligne - epaisseur) / 2 : tLib * 1.32 + 6 * u);
        const v = valeurCompteur(t, h, 0, serie.valeur, 0.9);
        const allume = estFort ? progres(t, h + 0.2, 0.4) : 0;
        return (
          <div key={i}>
            <div style={{ position: "absolute", left: enLigne ? z.x : x0 + 4 * u, top: enLigne ? y + epaisseur / 2 - tLib * 0.62 : haut + i * ligne, width: enLigne ? largeurLib - 20 * u : longueur, display: "flex", justifyContent: enLigne ? "flex-end" : "flex-start" }}>
              <TexteCinetique texte={serie.libelle} niveau="legende" debut={h - 0.08} graisse={600} couleur={estFort ? COULEURS.orangeVif : COULEURS.creme} chute={chute + (n - 1 - i) * 0.04} />
            </div>
            <FlouMouvement dx={deplacementObturateur(lg, t)} style={{ position: "absolute", left: x0, top: y, width: Math.max(0, l), height: epaisseur }}>
              <div
                style={{
                  width: "100%",
                  height: "100%",
                  borderRadius: `0 ${epaisseur * 0.32}px ${epaisseur * 0.32}px 0`,
                  background: estFort
                    ? `linear-gradient(90deg, ${COULEURS.orangeProfond}, ${COULEURS.orange} 55%, ${COULEURS.orangeVif})`
                    : `repeating-linear-gradient(135deg, ${avecOpacite(COULEURS.creme, 0.06)} 0 ${10 * u}px, transparent ${10 * u}px ${22 * u}px), linear-gradient(90deg, ${COULEURS.surface}, ${COULEURS.surfaceHaute})`,
                  boxShadow: estFort
                    ? `0 0 ${(40 + 30 * respire) * u}px ${avecOpacite(COULEURS.orangeVif, 0.35 + 0.25 * respire)}, inset 0 ${2 * u}px 0 ${avecOpacite(COULEURS.creme, 0.35)}`
                    : `inset 0 0 0 ${2 * u}px ${COULEURS.filet}, inset 0 ${2 * u}px 0 ${avecOpacite(COULEURS.creme, 0.1)}`,
                }}
              />
            </FlouMouvement>
            <div style={{ position: "absolute", left: x0 + l + 18 * u, top: y + epaisseur / 2 - tVal * 0.6, fontSize: tVal, fontWeight: 800, lineHeight: 1.2, letterSpacing: "-0.01em", whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums", color: estFort ? COULEURS.orangeVif : COULEURS.creme, opacity: progres(t, h + 0.05, 0.25) * (1 - sortie), transform: `scale(${(1 + 0.06 * allume * respire).toFixed(4)})`, transformOrigin: "0% 50%" }}>
              {texteValeur(v, unite, d.decimales)}
            </div>
          </div>
        );
      })}
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Courbe                                                                */
/* ------------------------------------------------------------------ */

/** Points de contrôle (Catmull-Rom → Bézier) du segment i → i + 1. */
export function segmentLisse(p: { x: number; y: number }[], i: number) {
  const p0 = p[Math.max(0, i - 1)];
  const p1 = p[i];
  const p2 = p[i + 1];
  const p3 = p[Math.min(p.length - 1, i + 2)];
  const k = 1 / 6;
  return { p1, c1: { x: p1.x + (p2.x - p0.x) * k, y: p1.y + (p2.y - p0.y) * k }, c2: { x: p2.x - (p3.x - p1.x) * k, y: p2.y - (p3.y - p1.y) * k }, p2 };
}

/** Point d'une Bézier cubique au paramètre k. */
export function pointBezier(s: ReturnType<typeof segmentLisse>, k: number) {
  const a = 1 - k;
  return {
    x: a * a * a * s.p1.x + 3 * a * a * k * s.c1.x + 3 * a * k * k * s.c2.x + k * k * k * s.p2.x,
    y: a * a * a * s.p1.y + 3 * a * a * k * s.c1.y + 3 * a * k * k * s.c2.y + k * k * k * s.p2.y,
  };
}

/** Géométrie de la courbe dans sa zone : points, base, marges (étiquettes jamais coupées). */
export function geometrieCourbe(d: DonneesGraphique, z: Zone, tVal: number, tLib: number, u: number) {
  const unite = uniteGraphique(d);
  const n = d.series.length;
  const max = Math.max(...d.series.map((s) => s.valeur), 1e-6);
  const largeurLib = Math.max(...d.series.map((s) => largeurMotMotion(s.libelle, tLib, 600)));
  const demi = Math.max(...d.series.map((s) => Math.max(largeurMotMotion(texteValeur(s.valeur, unite, d.decimales), tVal, 800), largeurMotMotion(s.libelle, tLib, 600)))) / 2 + 8 * u;
  const x0 = z.x + demi;
  const x1 = z.x + z.largeur - demi;
  // Étiquettes trop larges pour l'écart entre deux points : en quinconce sur deux rangs (jamais l'une sur l'autre).
  const quinconce = n > 1 && (x1 - x0) / (n - 1) < largeurLib + 24 * u;
  const base = z.y + z.hauteur - tLib * (quinconce ? 2.95 : 1.7);
  const sommet = z.y + tVal * 1.9;
  const points = d.series.map((s, i) => ({ x: x0 + ((x1 - x0) * i) / Math.max(1, n - 1), y: base - (s.valeur / max) * (base - sommet) }));
  /** Haut de l'étiquette du point i. */
  const hautEtiquette = (i: number) => base + 16 * u + (quinconce && i % 2 === 1 ? tLib * 1.25 : 0);
  return { points, base, sommet, x0, x1, hautEtiquette };
}

/** Avancement de chaque segment (0-1) : il se trace dans les 0,45 s qui précèdent le mot de sa valeur. */
export function avancementSegments(t: number, heures: number[]): number[] {
  return heures.slice(1).map((h, i) => progres(t, Math.max(heures[i] + 0.05, h - 0.45), Math.min(0.5, h + 0.05 - Math.max(heures[i] + 0.05, h - 0.45)), "glisse"));
}

function Courbe({ d, z, heures, fort }: { d: DonneesGraphique; z: Zone; heures: number[]; fort: number }) {
  const { t, u, taille, chute, largeur, hauteur } = useMotion();
  const id = useId().replace(/[^a-zA-Z0-9]/g, "");
  const unite = uniteGraphique(d);
  const tVal = taille("corps");
  const tLib = taille("legende");
  const { points, base, sommet, x0, hautEtiquette } = geometrieCourbe(d, z, tVal, tLib, u);
  const n = points.length;
  const segments = points.slice(0, -1).map((_, i) => segmentLisse(points, i));
  const av = avancementSegments(t, heures);
  const iTete = av.findIndex((k) => k < 1);
  const tete = iTete < 0 ? points[n - 1] : av[iTete] > 0 ? pointBezier(segments[iTete], av[iTete]) : points[iTete];
  const traceEnCours = iTete >= 0 && av[iTete] > 0 && av[iTete] < 1;
  const s = progres(t, chute, DUREES.sortie, "sortie");
  const epaisseur = Math.max(6, 9 * u);
  const aire = `M ${points[0].x} ${base} L ${points[0].x} ${points[0].y} ${segments.map((g) => `C ${g.c1.x} ${g.c1.y} ${g.c2.x} ${g.c2.y} ${g.p2.x} ${g.p2.y}`).join(" ")} L ${points[n - 1].x} ${base} Z`;
  return (
    <>
      <svg width={largeur} height={hauteur} style={{ position: "absolute", left: 0, top: 0, overflow: "visible", opacity: 1 - s }}>
        <defs>
          <linearGradient id={`aire${id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={COULEURS.orange} stopOpacity={0.42} />
            <stop offset="1" stopColor={COULEURS.orange} stopOpacity={0} />
          </linearGradient>
          <clipPath id={`coupe${id}`}>
            <rect x={x0 - 40 * u} y={sommet - 200 * u} width={Math.max(0, tete.x - x0 + 40 * u)} height={base - sommet + 400 * u} />
          </clipPath>
        </defs>
        {/* Grille horizontale et axe. */}
        {[0, 1, 2, 3].map((i) => {
          const y = base - ((base - sommet) * i) / 3;
          const k = progres(t, 0.08 + i * 0.07, 0.8, "glisse");
          return <line key={i} x1={z.x} y1={y} x2={z.x + (z.largeur) * k} y2={y} stroke={i === 0 ? COULEURS.filet : avecOpacite(COULEURS.creme, 0.07)} strokeWidth={i === 0 ? Math.max(3, 4 * u) : Math.max(1.5, 2 * u)} strokeLinecap="round" />;
        })}
        <path d={aire} fill={`url(#aire${id})`} clipPath={`url(#coupe${id})`} />
        {segments.map((g, i) => (
          <path key={i} d={`M ${g.p1.x} ${g.p1.y} C ${g.c1.x} ${g.c1.y} ${g.c2.x} ${g.c2.y} ${g.p2.x} ${g.p2.y}`} fill="none" stroke={COULEURS.orangeVif} strokeWidth={epaisseur} strokeLinecap="round" pathLength={1} strokeDasharray="1 1" strokeDashoffset={(1 - av[i]).toFixed(4)} style={{ filter: `drop-shadow(0 0 ${10 * u}px ${avecOpacite(COULEURS.orangeVif, 0.6)})` }} />
        ))}
        {traceEnCours && <circle cx={tete.x} cy={tete.y} r={epaisseur * 1.1} fill={COULEURS.creme} style={{ filter: `drop-shadow(0 0 ${14 * u}px ${COULEURS.orangeVif})` }} />}
        {/* Repères verticaux pointillés sous chaque point posé. */}
        {points.map((p, i) => (
          <line key={i} x1={p.x} y1={base} x2={p.x} y2={base - (base - p.y) * progres(t, heures[i], 0.4, "glisse")} stroke={avecOpacite(COULEURS.creme, 0.16)} strokeWidth={Math.max(1.5, 2 * u)} strokeDasharray={`${6 * u} ${8 * u}`} />
        ))}
      </svg>
      {points.map((p, i) => {
        const h = heures[i];
        const estFort = i === fort;
        const e = echelleRessort(t, h, chute + 9);
        const r = (estFort ? 22 : 15) * u;
        const v = valeurCompteur(t, h, i === 0 ? 0 : d.series[i - 1].valeur, d.series[i].valeur, 0.6);
        const visible = progres(t, h, 0.2) * (1 - s);
        return (
          <div key={i}>
            <div style={{ position: "absolute", left: p.x - r, top: p.y - r, width: 2 * r, height: 2 * r, borderRadius: "50%", background: estFort ? `radial-gradient(circle at 35% 30%, ${COULEURS.creme}, ${COULEURS.orangeVif} 55%)` : COULEURS.creme, boxShadow: `0 0 0 ${5 * u}px ${avecOpacite(COULEURS.fond, 0.9)}, 0 0 ${(estFort ? 40 : 16) * u}px ${avecOpacite(COULEURS.orangeVif, estFort ? 0.8 : 0.4)}`, transform: `scale(${e.toFixed(4)})`, opacity: visible }} />
            <div style={{ position: "absolute", left: p.x - 200 * u, width: 400 * u, top: p.y - r - tVal * 1.45, textAlign: "center", fontSize: tVal * (estFort ? 1.08 : 1), fontWeight: 800, lineHeight: 1.2, whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums", color: estFort ? COULEURS.orangeVif : COULEURS.creme, opacity: visible, transform: `translateY(${((1 - progres(t, h, DUREES.entree)) * 24 * u).toFixed(2)}px)` }}>
              {texteValeur(v, unite, d.decimales)}
            </div>
            <div style={{ position: "absolute", left: p.x - 200 * u, width: 400 * u, top: hautEtiquette(i), display: "flex", justifyContent: "center" }}>
              <TexteCinetique texte={d.series[i].libelle} niveau="legende" debut={h - 0.05} graisse={600} couleur={estFort ? COULEURS.orangeVif : COULEURS.cremeAttenuee} alignement="center" />
            </div>
          </div>
        );
      })}
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Camembert (anneau)                                                    */
/* ------------------------------------------------------------------ */

/** Géométrie de l'anneau et de la légende : légende dessous en plein écran, à droite en moitié haute. */
export function geometrieAnneau(z: Zone, n: number, tLib: number, u: number, libelles: string[] = []) {
  const ligneLeg = tLib * 1.55;
  const cote = z.hauteur < z.largeur * 1.05;
  if (cote) {
    // L'anneau laisse à la légende la largeur de son plus long libellé (pastille comprise), jamais tronqué.
    const largeurLeg = Math.max(0, ...libelles.map((l) => largeurMotMotion(l, tLib, 700))) + tLib * 0.62 + 34 * u;
    const R = Math.max(z.hauteur * 0.26, Math.min(z.hauteur * 0.46, (z.largeur - 70 * u - largeurLeg) / 2));
    return { cote, R, cx: z.x + R + 10 * u, cy: z.y + z.hauteur / 2, leg: { x: z.x + 2 * R + 60 * u, y: z.y + (z.hauteur - ligneLeg * n) / 2, largeur: z.largeur - 2 * R - 60 * u }, ligneLeg };
  }
  const hauteurLeg = ligneLeg * n;
  const R = Math.min(z.largeur * 0.36, (z.hauteur - hauteurLeg - 70 * u) / 2);
  const bloc = 2 * R + 70 * u + hauteurLeg;
  const haut = z.y + (z.hauteur - bloc) / 2;
  return { cote, R, cx: z.x + z.largeur / 2, cy: haut + R, leg: { x: z.x + z.largeur * 0.08, y: haut + 2 * R + 70 * u, largeur: z.largeur * 0.84 }, ligneLeg };
}

function Anneau({ d, z, heures, fort }: { d: DonneesGraphique; z: Zone; heures: number[]; fort: number }) {
  const { t, u, taille, chute, largeur, hauteur } = useMotion();
  const n = d.series.length;
  const unite = uniteGraphique(d);
  const somme = d.series.reduce((a, s) => a + s.valeur, 0) || 1;
  const tLib = taille("legende");
  const g = geometrieAnneau(z, n, tLib, u, d.series.map((x) => x.libelle));
  const { R, cx, cy } = g;
  const epaisseur = R * 0.36;
  const rs = R - epaisseur / 2;
  const s = progres(t, chute, DUREES.sortie, "sortie");
  // Début de chaque part = somme des parts d'avant (sans variable réassignée pendant le rendu).
  const parts = d.series.map((serie, i) => ({ debut: d.series.slice(0, i).reduce((a, x) => a + x.valeur, 0) / somme, part: serie.valeur / somme }));
  const grand = Math.round(Math.max(taille("legende"), Math.min(rs * (g.cote ? 0.5 : 0.62), taille("affiche") * 0.95)));
  return (
    <>
      <svg width={largeur} height={hauteur} style={{ position: "absolute", left: 0, top: 0, overflow: "visible", opacity: 1 - s, transform: `scale(${(0.9 + 0.1 * echelleRessort(t, 0.05, chute + 9)).toFixed(4)}) rotate(${(-8 * (1 - progres(t, 0, 1.4, "signature"))).toFixed(3)}deg)`, transformOrigin: `${cx}px ${cy}px` }}>
        <circle cx={cx} cy={cy} r={rs} fill="none" stroke={COULEURS.surface} strokeWidth={epaisseur} />
        {/* Graduations qui tournent lentement (mouvement secondaire). */}
        <g transform={`rotate(${(t * 5).toFixed(3)} ${cx} ${cy})`} opacity={0.5 * progres(t, 0.05, 0.8)}>
          {Array.from({ length: 60 }, (_, i) => {
            const a = (i / 60) * Math.PI * 2;
            const r1 = R + 16 * u;
            const r2 = r1 + (i % 5 === 0 ? 18 : 8) * u;
            return <line key={i} x1={cx + r1 * Math.cos(a)} y1={cy + r1 * Math.sin(a)} x2={cx + r2 * Math.cos(a)} y2={cy + r2 * Math.sin(a)} stroke={i % 5 === 0 ? COULEURS.cremeAttenuee : COULEURS.filet} strokeWidth={Math.max(1.5, 2.5 * u)} strokeLinecap="round" />;
          })}
        </g>
        {parts.map((p, i) => {
          const k = progres(t, heures[i], 0.6, "glisse");
          const estFort = i === fort;
          const milieu = (p.debut + p.part / 2) * Math.PI * 2 - Math.PI / 2;
          const sortie = estFort ? 16 * u * progres(t, heures[i] + 0.45, 0.5, "signature") : 0;
          const ecart = p.part > 0.03 ? 0.006 : 0;
          return (
            <circle
              key={i}
              cx={cx + Math.cos(milieu) * sortie}
              cy={cy + Math.sin(milieu) * sortie}
              r={rs}
              fill="none"
              stroke={teintePart(i, fort)}
              strokeWidth={epaisseur * (estFort ? 1 + 0.12 * progres(t, heures[i] + 0.45, 0.5) : 1)}
              pathLength={1}
              strokeDasharray={`${Math.max(0, p.part * k - ecart).toFixed(5)} 1`}
              transform={`rotate(${(-90 + p.debut * 360).toFixed(3)} ${cx} ${cy})`}
              style={estFort ? { filter: `drop-shadow(0 0 ${18 * u}px ${avecOpacite(COULEURS.orangeVif, 0.55)})` } : undefined}
            />
          );
        })}
      </svg>
      {/* Centre : la part dite, sa valeur qui compte et son libellé. */}
      {d.series.map((serie, i) => {
        const visible = progres(t, heures[i] + 0.05, 0.25) * (1 - (i < n - 1 ? progres(t, heures[i + 1] - 0.05, 0.2) : 0)) * (1 - s);
        if (visible <= 0.001) return null;
        const v = valeurCompteur(t, heures[i], 0, serie.valeur, 0.6);
        return (
          <div key={i} style={{ position: "absolute", left: cx - rs, width: rs * 2, top: cy - grand * (g.cote ? 0.5 : 0.72), display: "flex", flexDirection: "column", alignItems: "center", opacity: visible, transform: `scale(${(0.92 + 0.08 * progres(t, heures[i], 0.4)).toFixed(4)})` }}>
            <div style={{ fontSize: grand, fontWeight: 900, lineHeight: 1, letterSpacing: "-0.04em", fontVariantNumeric: "tabular-nums", color: i === fort ? COULEURS.orangeVif : COULEURS.creme, whiteSpace: "nowrap" }}>{texteValeur(v, unite, d.decimales)}</div>
            {!g.cote && <div style={{ fontSize: tLib, fontWeight: 600, color: COULEURS.cremeAttenuee, marginTop: 10 * u, whiteSpace: "nowrap" }}>{serie.libelle}</div>}
          </div>
        );
      })}
      {/* Légende : une ligne par part, qui arrive avec elle. */}
      <div style={{ position: "absolute", left: g.leg.x, top: g.leg.y, width: g.leg.largeur }}>
        {d.series.map((serie, i) => {
          const h = heures[i];
          const x = (1 - progres(t, h, DUREES.entree)) * 40 * u;
          const sortie = progres(t, chute + (n - 1 - i) * 0.03, DUREES.sortie, "sortie");
          return (
            <div key={i} style={{ height: g.ligneLeg, display: "flex", alignItems: "center", gap: 20 * u, opacity: progres(t, h, 0.25) * (1 - sortie), transform: `translateX(${x.toFixed(2)}px)`, fontSize: tLib, fontWeight: i === fort ? 700 : 600, whiteSpace: "nowrap" }}>
              <div style={{ flex: "none", width: tLib * 0.62, height: tLib * 0.62, borderRadius: tLib * 0.18, background: teintePart(i, fort), boxShadow: i === fort ? `0 0 ${16 * u}px ${avecOpacite(COULEURS.orangeVif, 0.7)}` : `inset 0 0 0 ${2 * u}px ${avecOpacite(COULEURS.creme, 0.15)}` }} />
              <span style={{ flex: "1 1 auto", color: i === fort ? COULEURS.orangeVif : COULEURS.creme, overflow: "hidden", textOverflow: "ellipsis" }}>{serie.libelle}</span>
              {/* Côte à côte (moitié haute) : la valeur se lit au centre de l'anneau quand la part est dite. */}
              {!g.cote && <span style={{ flex: "none", fontWeight: 800, fontVariantNumeric: "tabular-nums", color: i === fort ? COULEURS.orangeVif : COULEURS.cremeAttenuee }}>{texteValeur(serie.valeur, unite, d.decimales)}</span>}
            </div>
          );
        })}
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Carte                                                                 */
/* ------------------------------------------------------------------ */

function Contenu({ d }: { d: DonneesGraphique }) {
  const { u, zone, zoneCentree, taille, mesurer, duree, chute, moitie } = useMotion();
  const centre = d.variante === "camembert";
  const zc = centre ? zoneCentree : zone;
  // Le titre se resserre pour laisser au graphique au moins 70 % (80 % en moitié haute) de la zone.
  const tTitre = d.titre ? tailleTitreAjustee([taille("titre"), Math.round(taille("titre") * 0.84), taille("corps"), taille("legende")], (ta) => mesurer(d.titre!, "titre", zc.largeur, 800, ta), zc.hauteur * (moitie ? 0.2 : 0.3)) : 0;
  const hTitre = d.titre ? mesurer(d.titre, "titre", zc.largeur, 800, tTitre) : 0;
  const avecNote = noteMontree(d, moitie);
  const z = zoneGraphe(zc, hTitre, avecNote, taille("legende"), u);
  const heures = heuresSeries(d, d.titre ? 0.75 : 0.35, Math.min(duree - 1.8, (d.titre ? 0.75 : 0.35) + (d.series.length - 1) * 0.6));
  const fort = indexFort(d);
  const max = Math.max(...d.series.map((s) => s.valeur));
  return (
    <>
      <Filigrane texte={d.variante === "camembert" ? "%" : String(Math.round(max))} x={zc.x + zc.largeur * (centre ? 0.5 : 0.55)} y={zc.y + zc.hauteur * 0.62} taille={zc.hauteur * 0.42} debut={0.2} />
      {d.titre && (
        <div style={{ position: "absolute", left: zc.x, width: zc.largeur, top: zc.y }}>
          <TexteCinetique texte={d.titre} niveau="titre" taillePx={tTitre} debut={0.1} alignement={centre ? "center" : "left"} largeurMax={zc.largeur} />
        </div>
      )}
      {d.variante === "barres" && <Barres d={d} z={z} heures={heures} fort={fort} />}
      {d.variante === "courbe" && <Courbe d={d} z={z} heures={heures} fort={fort} />}
      {d.variante === "camembert" && <Anneau d={d} z={z} heures={heures} fort={fort} />}
      {avecNote && d.note && (
        <div style={{ position: "absolute", left: zc.x, width: zc.largeur, top: zc.y + zc.hauteur - taille("legende") * 1.3 }}>
          <TexteCinetique texte={d.note} niveau="legende" debut={heures[heures.length - 1] + 0.3} graisse={500} couleur={COULEURS.cremeAttenuee} alignement={centre ? "center" : "left"} chute={chute} />
        </div>
      )}
    </>
  );
}

export function MotionGraphique(p: MiseEnPageCarte & { donnees: DonneesGraphique }) {
  if (p.style === "spectaculaire") return <GraphiqueSpectaculaire {...p} />;
  return (
    <CarteMotion mp={p}>
      <Contenu d={p.donnees} />
    </CarteMotion>
  );
}
