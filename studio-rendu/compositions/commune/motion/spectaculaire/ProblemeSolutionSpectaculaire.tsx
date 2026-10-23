/**
 * Modèle 9 — PROBLÈME → SOLUTION, style « Spectaculaire » (lot F2) : la carte du problème pivote depuis la
 * profondeur ; quand la solution approche, une fêlure lumineuse la traverse, puis elle SE BRISE en deux moitiés qui
 * s'écartent et tombent (éclats, flou marqué). La solution jaillit alors de la profondeur, s'écrase sur la page en
 * orange, un balayage de lumière la traverse. Un seul effet fort à la fois : la brisure, puis l'arrivée.
 */
import type { CSSProperties } from "react";
import type { MiseEnPageCarte } from "../../../../../src/briques/motion/types";
import type { DonneesProblemeSolution, FaceProblemeSolution } from "../../../../../src/briques/motion/types-etendus";
import { instantSolution, mesureFaces, taillesFaces } from "../MotionProblemeSolution";
import { avecOpacite, Balayage, borne, COULEURS, courbe, Eclats, FlouFort, hasard, IconeSpec, MotsGeants, rebondImpact, ressort, SceneSpectaculaire, stylePanneauSpec, useSpec } from "./noyau";

/** Fêlure : ligne brisée verticale (fractions de la carte), fixe. */
const FELURE = Array.from({ length: 9 }, (_, i) => ({ y: i / 8, x: 0.5 + (i === 0 || i === 8 ? 0.04 : (hasard(i + 321) - 0.5) * 0.22) }));

function Face({ f, etiquette, solution, debut, padding, largeur, brisure, style, tailles }: { f: FaceProblemeSolution; etiquette: string; solution: boolean; debut: number; padding: number; largeur: number; brisure?: number; style?: CSSProperties; tailles: { titre: number; corps: number; legende: number } }) {
  const { u } = useSpec();
  const taille = (n: "titre" | "corps" | "legende") => tailles[n];
  const couleur = solution ? COULEURS.orangeVif : COULEURS.cremeAttenuee;
  return (
    <div style={{ position: "absolute", inset: 0, ...stylePanneauSpec(u, solution ? 1 : 0), padding, display: "flex", flexDirection: "column", gap: 20 * u, overflow: "hidden", ...style }}>
      <div style={{ display: "flex", alignItems: "center", gap: 18 * u, height: taille("legende") * 1.5 }}>
        <IconeSpec nom={f.icone ?? (solution ? "coche-cercle" : "alerte")} taille={taille("legende") * 1.25} debut={debut} couleur={couleur} epaisseur={2.4} />
        <MotsGeants texte={etiquette.toUpperCase()} debut={debut + 0.05} taille={taille("legende")} graisse={800} effet="etire" couleur={couleur} decalage={0.05} approche={0.14} />
      </div>
      <MotsGeants texte={solution ? `*${f.titre}*` : f.titre} debut={debut + 0.12} taille={taille("titre")} graisse={900} effet={solution ? "ecrase" : "etire"} largeurMax={largeur - 2 * padding} decalage={0.05} interligne={1.06} approche={-0.02} couleur={COULEURS.creme} balayage={debut + 0.8} />
      {f.detail && <MotsGeants texte={f.detail} debut={debut + 0.4} taille={taille("corps")} graisse={600} effet="etire" couleur={solution ? COULEURS.creme : COULEURS.cremeAttenuee} decalage={0.04} interligne={1.18} approche={-0.005} />}
      {solution && <Balayage debut={debut + 0.9} opacite={0.32} />}
      {/* Fêlure qui se dessine sur le problème. */}
      {brisure !== undefined && <Felure tBrisure={brisure} />}
    </div>
  );
}

function Felure({ tBrisure }: { tBrisure: number }) {
  const { t, u } = useSpec();
  const k = borne((t - (tBrisure - 0.38)) / 0.32);
  if (k <= 0) return null;
  const points = FELURE.filter((p) => p.y <= k + 1e-6).map((p) => `${(p.x * 100).toFixed(2)},${(p.y * 100).toFixed(2)}`).join(" ");
  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", overflow: "visible" }}>
      <polyline points={points} fill="none" stroke={COULEURS.orangeVif} strokeWidth={1.6} vectorEffect="non-scaling-stroke" style={{ filter: `drop-shadow(0 0 ${8 * u}px ${COULEURS.orangeVif})` }} strokeLinejoin="round" />
      <polyline points={points} fill="none" stroke={COULEURS.creme} strokeWidth={0.6} vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
    </svg>
  );
}

function Contenu({ d }: { d: DonneesProblemeSolution }) {
  const { t, u, zoneCentree: z, taille, duree, entree, mesurer, largeur } = useSpec();
  const tSol = Math.max(entree + 1.1, instantSolution(d, duree));
  const padding = Math.round(58 * u);
  const mesure = (tl: { titre: number; corps: number; legende: number }) => mesureFaces(d, z.largeur, padding, tl, (tx, n, ta, l) => mesurer(tx, ta, n === "titre" ? 900 : 600, l, n) * 1.04);
  const tailles = taillesFaces(taille, (tl) => mesure(tl).hauteur <= z.hauteur * 0.92);
  const { hauteur } = mesure(tailles);
  const haut = z.y + (z.hauteur - hauteur) / 2;
  // Problème : pivote depuis la profondeur (charnière à gauche).
  const kP = courbe("signature")(borne((t - entree + 0.1) / 0.55));
  const angleP = -80 * (1 - kP) + 6 * rebondImpact(t, entree + 0.35, 16, 6);
  // Brisure : les deux moitiés s'écartent, tournent et tombent.
  const b = borne((t - tSol) / 0.7);
  const kb = courbe("sortie")(b);
  const moitie = (cote: -1 | 1) => {
    const pts = FELURE.map((p) => `${(p.x * 100).toFixed(2)}% ${(p.y * 100).toFixed(2)}%`);
    const clip = cote < 0 ? `polygon(0% 0%, ${pts.join(", ")}, 0% 100%)` : `polygon(100% 0%, ${pts.join(", ")}, 100% 100%)`;
    return {
      clipPath: clip,
      transform: `translate(${(cote * kb * largeur * 0.55).toFixed(2)}px, ${(kb * kb * 500 * u).toFixed(2)}px) rotate(${(cote * kb * 22).toFixed(2)}deg)`,
      opacity: 1 - kb,
    };
  };
  // Solution : jaillit de la profondeur (ressort) après la brisure.
  const tS = tSol + 0.25;
  const kS = t <= tS ? 0 : ressort(t - tS, "chute");
  const kSAvant = t - 1 / 50 <= tS ? 0 : ressort(t - 1 / 50 - tS, "chute");
  const zS = -900 * u * (1 - kS);
  const flouS = Math.abs(kS - kSAvant) * 60 * u;
  return (
    <>
      <div style={{ position: "absolute", left: largeur / 2 - z.largeur, top: haut + hauteur / 2 - z.largeur, width: 2 * z.largeur, height: 2 * z.largeur, borderRadius: "50%", background: `radial-gradient(circle, ${avecOpacite(COULEURS.orangeVif, 0.42 * borne((t - tS) / 0.4))}, ${avecOpacite(COULEURS.orange, 0)} 60%)` }} />
      {b < 1 && (
        <div style={{ position: "absolute", left: z.x, width: z.largeur, top: haut, height: hauteur, perspective: `${(1300 * u).toFixed(0)}px`, perspectiveOrigin: "0% 50%", opacity: borne((t - entree + 0.1) / 0.1) }}>
          <div style={{ position: "absolute", inset: 0, transformStyle: "preserve-3d", transform: `rotateY(${angleP.toFixed(3)}deg)`, transformOrigin: "0% 50%" }}>
            {b <= 0 ? (
              <Face f={d.probleme} etiquette={d.etiquetteProbleme ?? "Le problème"} solution={false} debut={entree} padding={padding} largeur={z.largeur} brisure={tSol} tailles={tailles} />
            ) : (
              <FlouFort dy={kb * 30 * u} style={{ position: "absolute", inset: 0 }}>
                <Face f={d.probleme} etiquette={d.etiquetteProbleme ?? "Le problème"} solution={false} debut={entree} padding={padding} largeur={z.largeur} brisure={tSol} style={moitie(-1)} tailles={tailles} />
                <Face f={d.probleme} etiquette={d.etiquetteProbleme ?? "Le problème"} solution={false} debut={entree} padding={padding} largeur={z.largeur} brisure={tSol} style={moitie(1)} tailles={tailles} />
              </FlouFort>
            )}
          </div>
        </div>
      )}
      <Eclats x={largeur / 2} y={haut + hauteur / 2} debut={tSol} rayon={z.largeur * 0.55} nombre={34} graine={23} />
      {t > tS && (
        <div style={{ position: "absolute", left: z.x, width: z.largeur, top: haut, height: hauteur, perspective: `${(1500 * u).toFixed(0)}px` }}>
          <FlouFort dy={flouS} style={{ position: "absolute", inset: 0, transform: `translateZ(${zS.toFixed(2)}px)`, opacity: borne((t - tS) / 0.1) }}>
            <Face f={d.solution} etiquette={d.etiquetteSolution ?? "La solution"} solution debut={tS + 0.1} padding={padding} largeur={z.largeur} tailles={tailles} />
          </FlouFort>
        </div>
      )}
    </>
  );
}

export function ProblemeSolutionSpectaculaire(p: MiseEnPageCarte & { donnees: DonneesProblemeSolution }) {
  return (
    <SceneSpectaculaire mp={p}>
      <Contenu d={p.donnees} />
    </SceneSpectaculaire>
  );
}
