/**
 * Modèle 7 — GRAPHIQUE, style « Spectaculaire » (lot F2). Mêmes données, même charte, plus d'impact :
 *   - barres : de vraies dalles en relief (face, dessus, bout) sur un plan en perspective qui se redresse ; chaque
 *     dalle jaillit au ressort (flou marqué), la plus forte explose en éclats à l'arrivée et sa valeur s'allume ;
 *   - courbe : un trait de néon qui se trace sur un plan incliné, comète et traînée au bout, chaque point frappe
 *     (anneau d'impact), le point fort explose ;
 *   - camembert : un disque épais en 3D qui pivote, les parts se posent l'une après l'autre, la part forte se soulève
 *     et explose en éclats ; la valeur dite s'écrase au centre.
 * Un seul effet fort à la fois ; tout reste lisible une fois posé.
 */
import { useId } from "react";
import { largeurMotMotion } from "../../../../../src/briques/motion/mesure";
import type { MiseEnPageCarte } from "../../../../../src/briques/motion/types";
import type { DonneesGraphique } from "../../../../../src/briques/motion/types-etendus";
import { avancementSegments, geometrieAnneau, geometrieCourbe, noteMontree, pointBezier, segmentLisse, teintePart } from "../MotionGraphique";
import { valeurCompteur, type Zone } from "../noyau";
import { heuresSeries, indexFort, tailleTitreAjustee, texteValeur, uniteGraphique } from "../outils-etendus";
import { avecOpacite, Balayage, borne, COULEURS, courbe, Eclats, FiligraneSpec, FlouFort, MotCle, MotsGeants, progres, rebondImpact, ressort, SceneSpectaculaire, useSpec } from "./noyau";

/** Plan du graphique en perspective : incliné à l'arrivée, il se redresse lentement (jamais figé). */
function Plan({ children, rx, ry, origine }: { children: React.ReactNode; rx: number; ry: number; origine: string }) {
  const { t, u } = useSpec();
  const k = courbe("glisse")(borne(t / 4.2));
  return (
    <div style={{ position: "absolute", inset: 0, perspective: `${(1600 * u).toFixed(0)}px`, perspectiveOrigin: origine }}>
      <div style={{ position: "absolute", inset: 0, transformStyle: "preserve-3d", transformOrigin: origine, transform: `rotateX(${(rx * (1 - 0.55 * k)).toFixed(3)}deg) rotateY(${(ry * (1 - 0.55 * k)).toFixed(3)}deg)` }}>{children}</div>
    </div>
  );
}

function zoneGraphe(zone: Zone, hTitre: number, avecNote: boolean, tLeg: number, u: number): Zone {
  const haut = hTitre > 0 ? hTitre + 50 * u : 0;
  const bas = avecNote ? tLeg * 1.5 + 18 * u : 0;
  return { x: zone.x, y: zone.y + haut, largeur: zone.largeur, hauteur: zone.hauteur - haut - bas };
}

/* ------------------------------------------------------------------ */
/* Barres en relief                                                      */
/* ------------------------------------------------------------------ */

function Barres({ d, z, heures, fort }: { d: DonneesGraphique; z: Zone; heures: number[]; fort: number }) {
  const { t, u, taille } = useSpec();
  const n = d.series.length;
  const unite = uniteGraphique(d);
  const max = Math.max(...d.series.map((s) => s.valeur), 1e-6);
  const tLib = taille("legende");
  const tVal = Math.round(taille("corps") * 1.05);
  const ligne = Math.min(z.hauteur / n, tVal * 3.3);
  const enLigne = ligne < tLib * 2.5;
  const largeurLib = enLigne ? Math.max(...d.series.map((s) => largeurMotMotion(s.libelle, tLib, 700))) + 24 * u : 0;
  const largeurVal = Math.max(...d.series.map((s) => largeurMotMotion(texteValeur(s.valeur, unite, d.decimales), tVal, 900))) + 44 * u;
  const longueur = Math.max(80 * u, z.largeur - largeurLib - largeurVal);
  const epaisseur = Math.min(enLigne ? ligne * 0.56 : ligne * 0.36, 82 * u);
  const profondeur = epaisseur * 0.7;
  const haut = z.y + (z.hauteur - ligne * n) / 2;
  const x0 = z.x + largeurLib;
  return (
    <Plan rx={12} ry={-18} origine={`${x0}px ${haut + (ligne * n) / 2}px`}>
      {/* Sol lumineux : l'axe et un halo derrière les dalles. */}
      <div style={{ position: "absolute", left: x0 - 4 * u, top: haut - 14 * u, width: Math.max(4, 6 * u), height: (ligne * n + 28 * u) * progres(t, 0.35, 0.6, "glisse"), borderRadius: 6 * u, background: COULEURS.orangeVif, boxShadow: `0 0 ${24 * u}px ${COULEURS.orangeVif}` }} />
      {d.series.map((serie, i) => {
        const h = heures[i];
        const estFort = i === fort;
        const lg = (tt: number) => (tt <= h ? 0 : ressort(tt - h, "chute")) * (serie.valeur / max) * longueur;
        const l = Math.max(0, lg(t));
        const y = haut + i * ligne + (enLigne ? (ligne - epaisseur) / 2 : tLib * 1.32 + 8 * u);
        const v = valeurCompteur(t, h, 0, serie.valeur, 0.7);
        const arrivee = h + 0.32;
        const r = rebondImpact(t, arrivee, 18, 7);
        const face = estFort ? `linear-gradient(180deg, ${COULEURS.orangeVif}, ${COULEURS.orange} 60%, ${COULEURS.orangeProfond})` : `linear-gradient(180deg, ${COULEURS.cremeAttenuee}, ${avecOpacite(COULEURS.cremeAttenuee, 0.55)} 55%, ${COULEURS.filet})`;
        return (
          <div key={i} style={{ position: "absolute", left: 0, top: 0, transformStyle: "preserve-3d" }}>
            <div style={{ position: "absolute", left: enLigne ? z.x : x0 + 6 * u, top: enLigne ? y + epaisseur / 2 - tLib * 0.6 : haut + i * ligne, width: enLigne ? largeurLib - 20 * u : longueur, display: "flex", justifyContent: enLigne ? "flex-end" : "flex-start" }}>
              <MotsGeants texte={serie.libelle} debut={h - 0.12} taille={tLib} graisse={700} effet="etire" couleur={estFort ? COULEURS.orangeVif : COULEURS.creme} decalage={0.04} approche={0} />
            </div>
            <FlouFort dx={(lg(t) - lg(t - 1 / 50)) * 1.1} style={{ position: "absolute", left: x0, top: y, width: l, height: epaisseur, transformStyle: "preserve-3d", opacity: borne((t - h) / 0.06) }}>
              {/* Face avant. */}
              <div style={{ position: "absolute", inset: 0, borderRadius: `0 ${6 * u}px ${6 * u}px 0`, background: face, boxShadow: estFort ? `0 0 ${60 * u}px ${avecOpacite(COULEURS.orangeVif, 0.55)}` : `inset 0 0 0 ${2 * u}px ${COULEURS.filet}`, overflow: "hidden" }}>
                {estFort && <Balayage debut={heures[n - 1] + 0.6} opacite={0.45} />}
              </div>
              {/* Dessus (vers le fond) et bout de la dalle. */}
              <div style={{ position: "absolute", left: 0, top: 0, width: l, height: profondeur, transformOrigin: "50% 0%", transform: "rotateX(-90deg)", background: estFort ? `linear-gradient(0deg, ${COULEURS.orangeVif}, ${avecOpacite(COULEURS.creme, 0.85)})` : `linear-gradient(0deg, ${COULEURS.surfaceHaute}, ${avecOpacite(COULEURS.cremeAttenuee, 0.5)})` }} />
              <div style={{ position: "absolute", left: l, top: 0, width: profondeur, height: epaisseur, transformOrigin: "0% 50%", transform: "rotateY(90deg)", background: estFort ? COULEURS.orangeProfond : COULEURS.filet }} />
            </FlouFort>
            <div style={{ position: "absolute", left: x0 + l + 26 * u, top: y + epaisseur / 2 - tVal * 0.62, fontSize: tVal, fontWeight: 900, lineHeight: 1.2, whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums", opacity: borne((t - h - 0.05) / 0.12), transform: `scale(${(1 + 0.25 * r).toFixed(4)}, ${(1 - 0.25 * r).toFixed(4)})`, transformOrigin: "0% 50%" }}>
              {estFort ? <MotCle mot={texteValeur(v, unite, d.decimales)} t={t} arrivee={arrivee} balayage={heures[n - 1] + 0.9} u={u} /> : <span style={{ color: COULEURS.creme }}>{texteValeur(v, unite, d.decimales)}</span>}
            </div>
            {estFort && <Eclats x={x0 + (serie.valeur / max) * longueur} y={y + epaisseur / 2} debut={arrivee} rayon={170 * u} nombre={22} graine={7} />}
          </div>
        );
      })}
    </Plan>
  );
}

/* ------------------------------------------------------------------ */
/* Courbe de néon                                                        */
/* ------------------------------------------------------------------ */

function Courbe({ d, z, heures, fort }: { d: DonneesGraphique; z: Zone; heures: number[]; fort: number }) {
  const { t, u, taille, largeur, hauteur } = useSpec();
  const id = useId().replace(/[^a-zA-Z0-9]/g, "");
  const unite = uniteGraphique(d);
  const tVal = Math.round(taille("corps") * 1.05);
  const tLib = taille("legende");
  const { points, base, sommet, x0, hautEtiquette } = geometrieCourbe(d, z, tVal, tLib, u);
  const n = points.length;
  const segments = points.slice(0, -1).map((_, i) => segmentLisse(points, i));
  const av = avancementSegments(t, heures);
  const iTete = av.findIndex((k) => k < 1);
  const enCours = iTete >= 0 && av[iTete] > 0 && av[iTete] < 1;
  const tete = iTete < 0 ? points[n - 1] : av[iTete] > 0 ? pointBezier(segments[iTete], av[iTete]) : points[iTete];
  const aire = `M ${points[0].x} ${base} L ${points[0].x} ${points[0].y} ${segments.map((g) => `C ${g.c1.x} ${g.c1.y} ${g.c2.x} ${g.c2.y} ${g.p2.x} ${g.p2.y}`).join(" ")} L ${points[n - 1].x} ${base} Z`;
  const ep = Math.max(8, 11 * u);
  return (
    <Plan rx={16} ry={-10} origine={`${z.x + z.largeur / 2}px ${base}px`}>
      <svg width={largeur} height={hauteur} style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }}>
        <defs>
          <linearGradient id={`aireS${id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={COULEURS.orangeVif} stopOpacity={0.55} />
            <stop offset="1" stopColor={COULEURS.orange} stopOpacity={0} />
          </linearGradient>
          <clipPath id={`coupeS${id}`}>
            <rect x={x0 - 40 * u} y={sommet - 200 * u} width={Math.max(0, tete.x - x0 + 40 * u)} height={base - sommet + 400 * u} />
          </clipPath>
        </defs>
        {/* Sol : trame en perspective qui glisse. */}
        {Array.from({ length: 9 }, (_, i) => {
          const x = z.x + (z.largeur * i) / 8;
          return <line key={`v${i}`} x1={x} y1={sommet - 20 * u} x2={x} y2={base} stroke={avecOpacite(COULEURS.creme, 0.06)} strokeWidth={Math.max(1.5, 2 * u)} opacity={progres(t, 0.4 + i * 0.03, 0.5)} />;
        })}
        {[0, 1, 2, 3].map((i) => {
          const y = base - ((base - sommet) * i) / 3;
          return <line key={i} x1={z.x} y1={y} x2={z.x + z.largeur * progres(t, 0.35 + i * 0.06, 0.6, "glisse")} y2={y} stroke={i === 0 ? COULEURS.orangeVif : avecOpacite(COULEURS.creme, 0.08)} strokeWidth={i === 0 ? Math.max(3, 5 * u) : Math.max(1.5, 2 * u)} strokeLinecap="round" style={i === 0 ? { filter: `drop-shadow(0 0 ${10 * u}px ${COULEURS.orangeVif})` } : undefined} />;
        })}
        <path d={aire} fill={`url(#aireS${id})`} clipPath={`url(#coupeS${id})`} />
        {segments.map((g, i) => {
          const dPath = `M ${g.p1.x} ${g.p1.y} C ${g.c1.x} ${g.c1.y} ${g.c2.x} ${g.c2.y} ${g.p2.x} ${g.p2.y}`;
          const off = (1 - av[i]).toFixed(4);
          return (
            <g key={i}>
              <path d={dPath} fill="none" stroke={COULEURS.orangeVif} strokeWidth={ep * 3} strokeLinecap="round" pathLength={1} strokeDasharray="1 1" strokeDashoffset={off} opacity={0.35} style={{ filter: `blur(${(10 * u).toFixed(1)}px)` }} />
              <path d={dPath} fill="none" stroke={COULEURS.orangeVif} strokeWidth={ep} strokeLinecap="round" pathLength={1} strokeDasharray="1 1" strokeDashoffset={off} />
              <path d={dPath} fill="none" stroke={COULEURS.creme} strokeWidth={ep * 0.32} strokeLinecap="round" pathLength={1} strokeDasharray="1 1" strokeDashoffset={off} opacity={0.85} />
            </g>
          );
        })}
        {/* Comète et traînée au bout du trait. */}
        {enCours &&
          Array.from({ length: 7 }, (_, j) => {
            const k = Math.max(0, av[iTete] - j * 0.035);
            const p = pointBezier(segments[iTete], k);
            return <circle key={j} cx={p.x} cy={p.y} r={ep * (1.4 - j * 0.15)} fill={j === 0 ? COULEURS.creme : COULEURS.orangeVif} opacity={j === 0 ? 1 : 0.5 - j * 0.06} style={{ filter: `drop-shadow(0 0 ${16 * u}px ${COULEURS.orangeVif})` }} />;
          })}
      </svg>
      {points.map((p, i) => {
        const h = heures[i];
        const estFort = i === fort;
        const r = rebondImpact(t, h, 20, 7);
        const rayon = (estFort ? 26 : 17) * u * borne((t - h) / 0.12) * (1 + 0.35 * r);
        const v = valeurCompteur(t, h, i === 0 ? 0 : d.series[i - 1].valeur, d.series[i].valeur, 0.5);
        const visible = borne((t - h) / 0.12);
        return (
          <div key={i}>
            {/* Anneau d'impact. */}
            {t > h && t < h + 0.6 && <div style={{ position: "absolute", left: p.x - 60 * u, top: p.y - 60 * u, width: 120 * u, height: 120 * u, borderRadius: "50%", border: `${(4 * u * (1 - (t - h) / 0.6)).toFixed(2)}px solid ${COULEURS.orangeVif}`, transform: `scale(${(0.2 + 1.3 * courbe("signature")((t - h) / 0.6)).toFixed(3)})`, opacity: 1 - (t - h) / 0.6 }} />}
            <div style={{ position: "absolute", left: p.x - rayon, top: p.y - rayon, width: 2 * rayon, height: 2 * rayon, borderRadius: "50%", background: estFort ? `radial-gradient(circle at 35% 30%, ${COULEURS.creme}, ${COULEURS.orangeVif} 55%)` : COULEURS.creme, boxShadow: `0 0 0 ${5 * u}px ${avecOpacite(COULEURS.fondProfond, 0.9)}, 0 0 ${(estFort ? 60 : 24) * u}px ${avecOpacite(COULEURS.orangeVif, 0.85)}` }} />
            <div style={{ position: "absolute", left: p.x - 220 * u, width: 440 * u, top: p.y - 30 * u - tVal * 1.3, textAlign: "center", fontSize: tVal * (estFort ? 1.12 : 1), fontWeight: 900, lineHeight: 1.2, whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums", opacity: visible, transform: `translateY(${((1 - courbe("signature")(borne((t - h) / 0.3))) * -60 * u).toFixed(2)}px) scale(${(1 + 0.22 * r).toFixed(4)}, ${(1 - 0.22 * r).toFixed(4)})`, transformOrigin: "50% 100%" }}>
              {estFort ? <MotCle mot={texteValeur(v, unite, d.decimales)} t={t} arrivee={h + 0.25} balayage={h + 0.8} u={u} /> : <span style={{ color: COULEURS.creme }}>{texteValeur(v, unite, d.decimales)}</span>}
            </div>
            <div style={{ position: "absolute", left: p.x - 220 * u, width: 440 * u, top: hautEtiquette(i), display: "flex", justifyContent: "center" }}>
              <MotsGeants texte={d.series[i].libelle} debut={h - 0.08} taille={tLib} graisse={700} effet="etire" couleur={estFort ? COULEURS.orangeVif : COULEURS.cremeAttenuee} decalage={0.04} approche={0} alignement="center" />
            </div>
            {estFort && <Eclats x={p.x} y={p.y} debut={h + 0.05} rayon={190 * u} nombre={26} graine={11} />}
          </div>
        );
      })}
    </Plan>
  );
}

/* ------------------------------------------------------------------ */
/* Disque épais (camembert)                                              */
/* ------------------------------------------------------------------ */

function Disque({ d, z, heures, fort }: { d: DonneesGraphique; z: Zone; heures: number[]; fort: number }) {
  const { t, u, taille, largeur, hauteur } = useSpec();
  const n = d.series.length;
  const unite = uniteGraphique(d);
  const somme = d.series.reduce((a, s) => a + s.valeur, 0) || 1;
  const tLib = taille("legende");
  const g = geometrieAnneau(z, n, tLib, u, d.series.map((x) => x.libelle));
  const { R, cx, cy } = g;
  const ep = R * 0.38;
  const rs = R - ep / 2;
  // Début de chaque part = somme des parts d'avant (sans variable réassignée pendant le rendu).
  const parts = d.series.map((serie, i) => ({ debut: d.series.slice(0, i).reduce((a, x) => a + x.valeur, 0) / somme, part: serie.valeur / somme }));
  const k = courbe("signature")(borne(t / 1.2));
  const inclinaison = 34 - 14 * courbe("glisse")(borne(t / 4.5));
  const rotation = -40 * (1 - k) + t * 2.5;
  const tFort = heures[fort] + 0.55;
  const leve = 40 * u * courbe("signature")(borne((t - tFort) / 0.4));
  const actif = heures.reduce((a, h, i) => (t >= h ? i : a), -1);
  const anneau = (couche: number, couleur: (i: number) => string) =>
    parts.map((p, i) => {
      const kp = courbe("glisse")(borne((t - heures[i]) / 0.5));
      const ecart = p.part > 0.03 ? 0.008 : 0;
      return <circle key={`${couche}-${i}`} cx={cx} cy={cy} r={rs} fill="none" stroke={couleur(i)} strokeWidth={ep} pathLength={1} strokeDasharray={`${Math.max(0, p.part * kp - ecart).toFixed(5)} 1`} transform={`rotate(${(-90 + p.debut * 360).toFixed(3)} ${cx} ${cy})`} />;
    });
  const grand = Math.round(Math.max(taille("legende"), Math.min(rs * (g.cote ? 0.52 : 0.66), taille("affiche"))));
  return (
    <>
      <div style={{ position: "absolute", inset: 0, perspective: `${(1400 * u).toFixed(0)}px`, perspectiveOrigin: `${cx}px ${cy - R}px` }}>
        <div style={{ position: "absolute", inset: 0, transformStyle: "preserve-3d", transformOrigin: `${cx}px ${cy}px`, transform: `rotateX(${inclinaison.toFixed(3)}deg) rotateZ(${rotation.toFixed(3)}deg) scale(${(0.6 + 0.4 * k).toFixed(4)})` }}>
          {/* Épaisseur : couches sombres empilées sous le disque. */}
          {Array.from({ length: 7 }, (_, c) => (
            <svg key={c} width={largeur} height={hauteur} style={{ position: "absolute", left: 0, top: 0, overflow: "visible", transform: `translateZ(${(-(7 - c) * 4 * u).toFixed(1)}px)` }}>
              {anneau(c, (i) => (i === fort ? COULEURS.orangeProfond : COULEURS.fondProfond))}
            </svg>
          ))}
          <svg width={largeur} height={hauteur} style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }}>
            {anneau(9, (i) => (i === fort ? "transparent" : teintePart(i, fort)))}
          </svg>
          {/* La part forte se soulève (couche à part). */}
          <svg width={largeur} height={hauteur} style={{ position: "absolute", left: 0, top: 0, overflow: "visible", transform: `translateZ(${leve.toFixed(2)}px)`, filter: `drop-shadow(0 0 ${30 * u}px ${avecOpacite(COULEURS.orangeVif, 0.7)})` }}>
            {parts.map((p, i) =>
              i !== fort ? null : (
                <circle key={i} cx={cx} cy={cy} r={rs} fill="none" stroke={COULEURS.orangeVif} strokeWidth={ep * 1.08} pathLength={1} strokeDasharray={`${Math.max(0, p.part * courbe("glisse")(borne((t - heures[i]) / 0.5)) - 0.008).toFixed(5)} 1`} transform={`rotate(${(-90 + p.debut * 360).toFixed(3)} ${cx} ${cy})`} />
              ),
            )}
          </svg>
        </div>
      </div>
      <Eclats x={cx} y={cy - R * 0.45} debut={tFort} rayon={R * 0.9} nombre={28} graine={13} />
      {/* Centre : la valeur dite s'écrase. */}
      {d.series.map((serie, i) => {
        const fin = i < n - 1 ? heures[i + 1] - 0.05 : 99;
        if (t < heures[i] || t > fin + 0.2) return null;
        const v = valeurCompteur(t, heures[i], 0, serie.valeur, 0.5);
        const sortie = borne((t - fin) / 0.2);
        const r = rebondImpact(t, heures[i] + 0.3, 18, 7);
        const m = 1 + 1.4 * (1 - courbe("signature")(borne((t - heures[i]) / 0.3)));
        return (
          <div key={i} style={{ position: "absolute", left: cx - rs * 1.3, width: rs * 2.6, top: cy - grand * 0.62, display: "flex", flexDirection: "column", alignItems: "center", opacity: borne((t - heures[i]) / 0.1) * (1 - sortie), transform: `scale(${(m * (1 + 0.2 * r)).toFixed(4)}, ${(m * (1 - 0.2 * r)).toFixed(4)})` }}>
            <div style={{ fontSize: grand, fontWeight: 900, lineHeight: 1, letterSpacing: "-0.04em", whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums", textShadow: `0 ${8 * u}px ${36 * u}px ${avecOpacite(COULEURS.fondProfond, 0.9)}` }}>
              {i === fort ? <MotCle mot={texteValeur(v, unite, d.decimales)} t={t} arrivee={heures[i] + 0.3} balayage={tFort + 0.3} u={u} /> : <span>{texteValeur(v, unite, d.decimales)}</span>}
            </div>
          </div>
        );
      })}
      {/* Légende : chaque ligne jaillit avec sa part. */}
      <div style={{ position: "absolute", left: g.leg.x, top: g.leg.y + (g.cote ? 0 : 30 * u), width: g.leg.largeur }}>
        {d.series.map((serie, i) => {
          const h = heures[i];
          const e = borne((t - h) / 0.1);
          const x = (1 - courbe("signature")(borne((t - h) / 0.35))) * 300 * u;
          const allume = i === actif ? 1 : 0;
          return (
            <FlouFort key={i} dx={x * 0.08} style={{ height: g.ligneLeg, display: "flex", alignItems: "center", gap: 20 * u, opacity: e, transform: `translateX(${x.toFixed(2)}px) scale(${(1 + 0.04 * allume).toFixed(3)})`, transformOrigin: "0% 50%", fontSize: tLib, fontWeight: 700, whiteSpace: "nowrap" }}>
              <div style={{ flex: "none", width: tLib * 0.62, height: tLib * 0.62, borderRadius: tLib * 0.18, background: teintePart(i, fort), boxShadow: `0 0 ${(i === fort ? 22 : 8) * u}px ${avecOpacite(i === fort ? COULEURS.orangeVif : COULEURS.creme, i === fort ? 0.8 : 0.2)}` }} />
              <span style={{ flex: "1 1 auto", color: i === fort ? COULEURS.orangeVif : COULEURS.creme }}>{serie.libelle}</span>
              {!g.cote && <span style={{ flex: "none", fontWeight: 900, fontVariantNumeric: "tabular-nums", color: i === fort ? COULEURS.orangeVif : COULEURS.cremeAttenuee }}>{texteValeur(serie.valeur, unite, d.decimales)}</span>}
            </FlouFort>
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
  const { u, zone, zoneCentree, taille, mesurer, duree, entree, moitie } = useSpec();
  const centre = d.variante === "camembert";
  const zc = centre ? zoneCentree : zone;
  const tTitre = d.titre ? tailleTitreAjustee([Math.round(taille("titre") * 1.08), taille("titre"), Math.round(taille("titre") * 0.84), taille("corps"), taille("legende")], (ta) => mesurer(d.titre!, ta, 900, zc.largeur, "titre") * 1.04, zc.hauteur * (moitie ? 0.2 : 0.3)) : 0;
  const hTitre = d.titre ? mesurer(d.titre, tTitre, 900, zc.largeur, "titre") * 1.04 : 0;
  const avecNote = noteMontree(d, moitie);
  const z = zoneGraphe(zc, hTitre, avecNote, taille("legende"), u);
  const debut = Math.max(entree + 0.4, d.titre ? 0.8 : 0.5);
  const heures = heuresSeries(d, debut, Math.min(duree - 1.6, debut + (d.series.length - 1) * 0.55)).map((h, i) => Math.max(h, debut + i * 0.3));
  const fort = indexFort(d);
  return (
    <>
      {d.titre && (
        <div style={{ position: "absolute", left: zc.x, width: zc.largeur, top: zc.y, display: "flex", justifyContent: centre ? "center" : "flex-start" }}>
          <MotsGeants texte={d.titre} debut={entree - 0.1} taille={tTitre} graisse={900} largeurMax={zc.largeur} effet="ecrase" alignement={centre ? "center" : "left"} />
        </div>
      )}
      {d.variante === "barres" && <Barres d={d} z={z} heures={heures} fort={fort} />}
      {d.variante === "courbe" && <Courbe d={d} z={z} heures={heures} fort={fort} />}
      {d.variante === "camembert" && <Disque d={d} z={z} heures={heures} fort={fort} />}
      {avecNote && d.note && (
        <div style={{ position: "absolute", left: zc.x, width: zc.largeur, top: zc.y + zc.hauteur - taille("legende") * 1.3, display: "flex", justifyContent: centre ? "center" : "flex-start" }}>
          <MotsGeants texte={d.note} debut={heures[heures.length - 1] + 0.45} taille={taille("legende")} graisse={600} effet="etire" couleur={COULEURS.cremeAttenuee} decalage={0.05} approche={0} />
        </div>
      )}
    </>
  );
}

function Decor({ d }: { d: DonneesGraphique }) {
  const { largeur, hauteur } = useSpec();
  const max = Math.max(...d.series.map((s) => s.valeur));
  return <FiligraneSpec texte={d.variante === "camembert" ? "%" : String(Math.round(max))} x={largeur * 0.56} y={hauteur * 0.55} taille={hauteur * 0.55} debut={0.3} />;
}

export function GraphiqueSpectaculaire(p: MiseEnPageCarte & { donnees: DonneesGraphique }) {
  return (
    <SceneSpectaculaire mp={p} decor={<Decor d={p.donnees} />}>
      <Contenu d={p.donnees} />
    </SceneSpectaculaire>
  );
}
