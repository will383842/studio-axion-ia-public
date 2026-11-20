/**
 * T-EXT-50 · Schéma animé du flux : les étapes en blocs reliés, construits à l'écran au fil de la voix (bloc, puis flèche
 * qui se trace, puis bloc suivant). Couleurs de `CHARTE_AXION` et blanc de la charte seulement : fond ivoire, bloc blanc
 * bordé de gris, étape humaine en bloc noir à texte ivoire, étape en cours bordée de terracotta, flèches noires.
 * Aucun texte hors des libellés du flux ; aucune coche, aucune étiquette. Le plan (pur) vient de `schema-flux.ts`.
 */
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { PALETTE } from "../../../../src/briques/charte/axion-2026";
import { CHARTE_AXION, FAMILLE_CSS_AXION } from "../../../../src/briques/jetons-motion";
import { progres } from "../../../../src/briques/motion/courbes";
import { cameraA } from "../../../../src/briques/schema-motion/camera";
import { ECRAN_IV, type BoiteNoeud } from "../../../../src/briques/schema-motion/types";
import type { BlocFlux, PlanSchemaFlux } from "../../../../src/moteurs/montage-tutoriel-outil/proprietes";
import { chargerManrope } from "../PlanDeScenes";

export interface ProprietesSchemaFlux {
  plan: PlanSchemaFlux;
}

type Point = { x: number; y: number };

/** Échelle de l'écran de référence dans la composition (même règle que `echelleSchema` de `schema-flux.ts`, testée égale). */
export function echelleEcran(format: { largeur: number; hauteur: number }): number {
  return format.hauteur >= format.largeur ? format.largeur / ECRAN_IV.largeur : format.hauteur / ECRAN_IV.largeur;
}

/** Départ et arrivée d'une flèche : milieux des bords qui se font face. */
function segment(a: BoiteNoeud, b: BoiteNoeud): [Point, Point] {
  if (b.y >= a.y + a.hauteur) return [{ x: a.x + a.largeur / 2, y: a.y + a.hauteur }, { x: b.x + b.largeur / 2, y: b.y }];
  if (b.x >= a.x + a.largeur) return [{ x: a.x + a.largeur, y: a.y + a.hauteur / 2 }, { x: b.x, y: b.y + b.hauteur / 2 }];
  if (b.x + b.largeur <= a.x) return [{ x: a.x, y: a.y + a.hauteur / 2 }, { x: b.x + b.largeur, y: b.y + b.hauteur / 2 }];
  return [{ x: a.x + a.largeur / 2, y: a.y }, { x: b.x + b.largeur / 2, y: b.y + b.hauteur }];
}

export function SchemaFlux({ plan }: ProprietesSchemaFlux) {
  chargerManrope();
  const image = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const t = image / fps;
  const echelle = echelleEcran({ largeur: width, hauteur: height });
  const pose = cameraA(plan.trajectoire, t);
  const dx = ECRAN_IV.largeur / 2 - pose.cx * pose.zoom;
  const dy = ECRAN_IV.hauteur / 2 - pose.cy * pose.zoom;
  const parId = new Map(plan.toile.boites.map((b) => [b.id, b]));
  const bloc = (id: string) => plan.blocs.find((b) => b.id === id) as BlocFlux | undefined;
  // Étape en cours : la dernière dont le mot est dit.
  const courant = [...plan.blocs].reverse().find((b) => b.motSec <= t)?.id ?? null;

  const fleches = plan.toile.fleches.map((f) => {
    const a = parId.get(f.de);
    const b = parId.get(f.vers);
    const cible = bloc(f.vers);
    if (!a || !b || !cible || cible.traceSec === undefined) return null;
    const p = progres(t, cible.traceSec, plan.traceDureeSec, "signature");
    if (p <= 0) return null;
    const [d, e] = segment(a, b);
    const x = d.x + (e.x - d.x) * p;
    const y = d.y + (e.y - d.y) * p;
    const angle = Math.atan2(e.y - d.y, e.x - d.x);
    const pointe = 22;
    const tete = [
      [e.x, e.y],
      [e.x - pointe * Math.cos(angle - 0.45), e.y - pointe * Math.sin(angle - 0.45)],
      [e.x - pointe * Math.cos(angle + 0.45), e.y - pointe * Math.sin(angle + 0.45)],
    ]
      .map((q) => q.join(","))
      .join(" ");
    return (
      <g key={f.id}>
        <line x1={d.x} y1={d.y} x2={x} y2={y} stroke={CHARTE_AXION.noir} strokeWidth={6} strokeLinecap="round" strokeDasharray={f.style === "pointille" ? "16 14" : undefined} />
        {p >= 0.98 ? <polygon points={tete} fill={CHARTE_AXION.noir} /> : null}
      </g>
    );
  });

  const blocs = plan.toile.boites.map((b) => {
    const info = bloc(b.id);
    if (!info) return null;
    const entree = progres(t, info.allumageSec, plan.entreeSec, "signature");
    if (entree <= 0) return null;
    const actif = courant === b.id;
    const fond = info.humain ? CHARTE_AXION.noir : PALETTE.blanc;
    const texte = info.humain ? CHARTE_AXION.ivoire : CHARTE_AXION.noir;
    const bordure = actif ? CHARTE_AXION.terracotta : info.humain ? CHARTE_AXION.noir : CHARTE_AXION.gris;
    const taille = (b.textes[0]?.taille ?? 0.02) * ECRAN_IV.hauteur * 0.85;
    return (
      <div
        key={b.id}
        data-bloc={b.id}
        style={{
          position: "absolute",
          left: b.x,
          top: b.y,
          width: b.largeur,
          height: b.hauteur,
          boxSizing: "border-box",
          borderRadius: 28,
          border: `${actif ? 8 : 5}px solid ${bordure}`,
          background: fond,
          color: texte,
          fontFamily: FAMILLE_CSS_AXION,
          fontWeight: 700,
          fontSize: taille,
          lineHeight: 1.15,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
          padding: 24,
          overflow: "hidden",
          opacity: entree,
          transform: `scale(${0.94 + 0.06 * entree})`,
          transformOrigin: "50% 50%",
        }}
      >
        {info.libelle}
      </div>
    );
  });

  return (
    <AbsoluteFill style={{ background: CHARTE_AXION.ivoire, overflow: "hidden" }}>
      <div
        style={{
          position: "absolute",
          left: (width - ECRAN_IV.largeur * echelle) / 2,
          top: (height - ECRAN_IV.hauteur * echelle) / 2,
          width: ECRAN_IV.largeur,
          height: ECRAN_IV.hauteur,
          transform: `scale(${echelle})`,
          transformOrigin: "0 0",
        }}
      >
        <div style={{ position: "absolute", left: 0, top: 0, width: plan.toile.largeur, height: plan.toile.hauteur, transform: `translate(${dx}px, ${dy}px) scale(${pose.zoom})`, transformOrigin: "0 0" }}>
          <svg width={plan.toile.largeur} height={plan.toile.hauteur} style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }}>
            {fleches}
          </svg>
          {blocs}
        </div>
      </div>
    </AbsoluteFill>
  );
}
