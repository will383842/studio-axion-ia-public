/**
 * Modèle 11 — CAPTURE ANNOTÉE, style « Spectaculaire » (lot F2) : la capture arrive en carte 3D qui pivote depuis la
 * profondeur et se pose (rebond), un balayage de lumière la traverse ; à chaque annotation, la caméra PLONGE vers elle
 * (flou marqué pendant le zoom), le projecteur se resserre, le cercle se trace en néon avec une étincelle au bout du
 * trait, la flèche file et frappe sa cible (anneau d'impact), le surligneur laisse une traînée de lumière ;
 * l'étiquette s'étire puis rebondit.
 */
import { useId } from "react";
import { largeurMotMotion } from "../../../../../src/briques/motion/mesure";
import type { MiseEnPageCarte } from "../../../../../src/briques/motion/types";
import type { AnnotationCapture, DonneesCaptureAnnotee } from "../../../../../src/briques/motion/types-etendus";
import { AVANCE_ZOOM, boiteVue, cadreCapture, cheminCercle, cheminFleche, etatZoom, heuresAnnotations, pointCercle, positionEtiquette, visibiliteEtiquette } from "../MotionCaptureAnnotee";
import { ImageCapture, tailleTitreAjustee } from "../outils-etendus";
import { avecOpacite, Balayage, borne, COULEURS, courbe, FlouFort, MotsGeants, progres, rebondImpact, ressort, SceneSpectaculaire, useSpec } from "./noyau";

/** Point du tour d'un rectangle au paramètre k (0-1), dans le sens du tracé. */
function pointCadre(x: number, y: number, l: number, h: number, k: number) {
  const p = k * 2 * (l + h);
  if (p <= l) return { x: x + p, y };
  if (p <= l + h) return { x: x + l, y: y + p - l };
  if (p <= 2 * l + h) return { x: x + l - (p - l - h), y: y + h };
  return { x, y: y + h - (p - 2 * l - h) };
}

function Annotation({ a, i, h, W, H, s, actif }: { a: AnnotationCapture; i: number; h: number; W: number; H: number; s: number; actif: number }) {
  const { t, u } = useSpec();
  const x = a.x * W;
  const y = a.y * H;
  const l = a.largeur * W;
  const ht = a.hauteur * H;
  const ep = Math.max(6, 9 * u) / s;
  const k = courbe("glisse")(borne((t - h) / (a.type === "fleche" ? 0.32 : 0.5)));
  const neon = { filter: `drop-shadow(0 0 ${(12 * u) / s}px ${COULEURS.orangeVif}) drop-shadow(0 0 ${(30 * u) / s}px ${avecOpacite(COULEURS.orange, 0.6)})` };
  const opacite = 0.5 + 0.5 * actif;
  if (k <= 0) return null;
  switch (a.type) {
    case "cercle":
    case "cadre": {
      const d = a.type === "cercle" ? cheminCercle(x, y, l, ht, i) : `M ${x - 10} ${y - 10} H ${x + l + 10} V ${y + ht + 10} H ${x - 10} Z`;
      return (
        <g opacity={opacite}>
          <path d={d} fill="none" stroke={COULEURS.orangeVif} strokeWidth={ep} strokeLinecap="round" strokeLinejoin="round" pathLength={1} strokeDasharray="1 1" strokeDashoffset={(1 - k).toFixed(4)} style={neon} />
          <path d={d} fill="none" stroke={COULEURS.creme} strokeWidth={ep * 0.3} strokeLinecap="round" pathLength={1} strokeDasharray="1 1" strokeDashoffset={(1 - k).toFixed(4)} />
          {/* Étincelle au bout du trait. */}
          {k < 1 && (() => {
            // Étincelle : même paramètre que le tracé (cercle à main levée, ou tour du cadre).
            const p = a.type === "cercle" ? pointCercle(x, y, l, ht, i, k) : pointCadre(x - 10, y - 10, l + 20, ht + 20, k);
            return <circle cx={p.x} cy={p.y} r={ep * 1.3} fill={COULEURS.creme} style={{ filter: `drop-shadow(0 0 ${(16 * u) / s}px ${COULEURS.orangeVif})` }} />;
          })()}
        </g>
      );
    }
    case "surligne":
      return (
        <g opacity={opacite}>
          <rect x={x} y={y} width={l * k} height={ht} rx={12 / s} fill={COULEURS.orangeVif} opacity={0.34} style={{ mixBlendMode: "multiply" }} />
          <rect x={x} y={y + ht - (7 * u) / s} width={l * k} height={(7 * u) / s} rx={4 / s} fill={COULEURS.orangeVif} style={neon} />
          {k < 1 && <rect x={x + l * k - (60 * u) / s} y={y - (4 * u) / s} width={(60 * u) / s} height={ht + (8 * u) / s} fill={COULEURS.creme} opacity={0.6} style={{ filter: `blur(${(10 * u) / s}px)` }} />}
        </g>
      );
    case "fleche": {
      const f = cheminFleche(x, y, l, ht, W, H);
      const tp = (34 * u) / s;
      const impact = borne((t - h - 0.32) / 0.5);
      return (
        <g opacity={opacite}>
          <path d={f.d} fill="none" stroke={COULEURS.orangeVif} strokeWidth={ep} strokeLinecap="round" pathLength={1} strokeDasharray="1 1" strokeDashoffset={(1 - k).toFixed(4)} style={neon} />
          {k >= 1 && (
            <path d={`M ${-tp} ${-tp * 0.72} L 0 0 L ${-tp} ${tp * 0.72}`} fill="none" stroke={COULEURS.orangeVif} strokeWidth={ep} strokeLinecap="round" strokeLinejoin="round" transform={`translate(${f.fin.x.toFixed(1)} ${f.fin.y.toFixed(1)}) rotate(${((f.angle * 180) / Math.PI).toFixed(2)})`} style={neon} />
          )}
          {impact > 0 && impact < 1 && <circle cx={f.fin.x} cy={f.fin.y} r={((20 + 90 * courbe("signature")(impact)) * u) / s} fill="none" stroke={COULEURS.orangeVif} strokeWidth={((6 * (1 - impact)) * u) / s} opacity={1 - impact} />}
        </g>
      );
    }
  }
}

function Contenu({ d }: { d: DonneesCaptureAnnotee }) {
  const { t, u, zoneCentree: zc, taille, duree, entree, mesurer, moitie } = useSpec();
  const id = useId().replace(/[^a-zA-Z0-9]/g, "");
  const tTitre = d.titre ? tailleTitreAjustee([Math.round(taille("titre") * 1.05), taille("corps"), taille("legende")], (ta) => mesurer(d.titre!, ta, 900, zc.largeur, "titre") * 1.04, zc.hauteur * (moitie ? 0.14 : 0.25)) : 0;
  const hTitre = d.titre ? mesurer(d.titre, tTitre, 900, zc.largeur, "titre") + 50 * u : 0;
  const cadre = cadreCapture(d, { x: zc.x, y: zc.y + hTitre, largeur: zc.largeur, hauteur: zc.hauteur - hTitre });
  const W = cadre.largeur;
  const H = cadre.hauteur;
  const heures = heuresAnnotations(d, Math.max(entree + 0.65, d.titre ? 1.0 : 0.8), duree - 1.6);
  const z = etatZoom(t, d, heures, W, H, 2.1, 0.55);
  const zAvant = etatZoom(t - 1 / 50, d, heures, W, H, 2.1, 0.55);
  const flou = Math.min(12, (Math.abs(z.s - zAvant.s) * 300 + Math.hypot(z.tx - zAvant.tx, z.ty - zAvant.ty) * 0.25) * u);
  const actif = heures.reduce((a, h, i) => (t >= h - AVANCE_ZOOM ? i : a), -1);
  // Arrivée : pivote depuis la profondeur puis se pose au ressort ; légère orbite ensuite.
  const tA = entree - 0.15;
  const kA = t <= tA ? 0 : ressort(t - tA, "chute");
  const ry = -38 * (1 - kA) + 3 * Math.sin(t * 0.8);
  const rx = 18 * (1 - kA) + 2 * Math.sin(t * 0.6 + 1);
  const tz = -700 * u * (1 - kA);
  const tLeg = taille("legende");
  const projecteur = actif >= 0 ? progres(t, heures[actif] - 0.2, 0.3) * 0.55 : 0;
  const boite = actif >= 0 ? boiteVue(d.annotations[actif], W, H, z) : null;
  const rayon = 30 * u;
  return (
    <>
      {d.titre && (
        <div style={{ position: "absolute", left: zc.x, width: zc.largeur, top: zc.y, display: "flex", justifyContent: "center" }}>
          <MotsGeants texte={d.titre} debut={entree - 0.1} taille={tTitre} graisse={900} largeurMax={zc.largeur} effet="ecrase" alignement="center" />
        </div>
      )}
      <div style={{ position: "absolute", left: cadre.x, top: cadre.y, width: W, height: H, perspective: `${(1600 * u).toFixed(0)}px`, opacity: borne((t - tA) / 0.12) }}>
        <div style={{ position: "absolute", inset: 0, transform: `translateZ(${tz.toFixed(2)}px) rotateY(${ry.toFixed(3)}deg) rotateX(${rx.toFixed(3)}deg)`, borderRadius: rayon, overflow: "hidden", boxShadow: `0 ${40 * u}px ${100 * u}px ${avecOpacite(COULEURS.fondProfond, 0.85)}, 0 0 0 ${2 * u}px ${avecOpacite(COULEURS.orangeVif, 0.55)}, 0 0 ${60 * u}px ${avecOpacite(COULEURS.orangeVif, 0.3)}`, background: COULEURS.surface }}>
          <FlouFort dx={flou} dy={flou * 0.6} style={{ position: "absolute", left: 0, top: 0, width: W, height: H }}>
            <div style={{ position: "absolute", left: 0, top: 0, width: W, height: H, transformOrigin: "0 0", transform: `translate(${z.tx.toFixed(2)}px, ${z.ty.toFixed(2)}px) scale(${z.s.toFixed(5)})` }}>
              <ImageCapture src={d.image.src} />
              <svg width={W} height={H} style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }}>
                {d.annotations.map((a, i) => (
                  <Annotation key={i} a={a} i={i} h={heures[i]} W={W} H={H} s={z.s} actif={i === actif ? 1 : 0} />
                ))}
              </svg>
            </div>
          </FlouFort>
          {boite && projecteur > 0 && (
            <svg width={W} height={H} style={{ position: "absolute", left: 0, top: 0 }}>
              <defs>
                <mask id={`trouS${id}`}>
                  <rect x={0} y={0} width={W} height={H} fill="white" />
                  <rect x={boite.x - 22 * u} y={boite.y - 22 * u} width={boite.largeur + 44 * u} height={boite.hauteur + 44 * u} rx={30 * u} fill="black" style={{ filter: `blur(${12 * u}px)` }} />
                </mask>
              </defs>
              <rect x={0} y={0} width={W} height={H} fill={COULEURS.fondProfond} opacity={projecteur} mask={`url(#trouS${id})`} />
            </svg>
          )}
          <Balayage debut={entree + 0.25} opacite={0.35} duree={0.8} />
          {d.annotations.map((a, i) => {
            const vis = visibiliteEtiquette(t, i, heures);
            if (!a.texte || vis <= 0) return null;
            const b = boiteVue(a, W, H, z);
            const largeurEtiquette = Math.min(W - 24, largeurMotMotion(a.texte, tLeg, 800) + 64 * u);
            const hauteurEtiquette = tLeg * 1.65;
            const p = positionEtiquette(b, largeurEtiquette, hauteurEtiquette, W, H);
            const ti = heures[i] + 0.15;
            const r = rebondImpact(t, ti + 0.15, 18, 7);
            const kE = courbe("signature")(borne((t - ti) / 0.2));
            return (
              <div key={i} style={{ position: "absolute", left: p.x, top: p.y, height: hauteurEtiquette, width: largeurEtiquette, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 999, background: `linear-gradient(180deg, ${COULEURS.orangeVif}, ${COULEURS.orange})`, boxShadow: `0 ${12 * u}px ${36 * u}px ${avecOpacite(COULEURS.fondProfond, 0.6)}, 0 0 ${44 * u}px ${avecOpacite(COULEURS.orangeVif, 0.7)}`, opacity: borne((t - ti) / 0.08) * vis, transform: `scale(${(kE * (1 + 0.25 * r)).toFixed(4)}, ${(kE * (1 - 0.25 * r)).toFixed(4)})`, transformOrigin: "50% 100%", overflow: "hidden" }}>
                <MotsGeants texte={a.texte} debut={ti + 0.05} taille={tLeg} graisse={800} effet="etire" couleur={COULEURS.creme} decalage={0.04} approche={0} />
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}

export function CaptureAnnoteeSpectaculaire(p: MiseEnPageCarte & { donnees: DonneesCaptureAnnotee }) {
  return (
    <SceneSpectaculaire mp={p}>
      <Contenu d={p.donnees} />
    </SceneSpectaculaire>
  );
}
