/**
 * Modèle 9 — PROBLÈME → SOLUTION (lot F2) : la carte du problème arrive (icône tracée, titre qui se construit), se
 * barre ligne à ligne quand la voix s'apprête à dire la solution, puis BASCULE en 3D (anticipation, flou de
 * mouvement) : au dos, la solution s'allume en orange, son icône se trace, la lumière se réchauffe derrière.
 */
import { couperLignes } from "../../../../src/briques/motion/mesure";
import type { MiseEnPageCarte } from "../../../../src/briques/motion/types";
import type { DonneesProblemeSolution, FaceProblemeSolution } from "../../../../src/briques/motion/types-etendus";
import { APPROCHE_EM, INTERLIGNE } from "../../../../src/briques/motion/jetons";
import { courbe } from "../../../../src/briques/motion/courbes";
import { avecOpacite, CarteMotion, COULEURS, DUREES, echelleRessort, FlouMouvement, IconeTracee, progres, stylePanneau, TexteCinetique, useMotion } from "./noyau";
import { ProblemeSolutionSpectaculaire } from "./spectaculaire/ProblemeSolutionSpectaculaire";

/** Instant de la bascule : celui de l'aligneur, sinon 40 % de la carte (jamais avant 1,2 s). */
export const instantSolution = (d: DonneesProblemeSolution, duree: number) => Math.min(duree - 1.6, Math.max(1.2, d.aSecSolution ?? duree * 0.4));

/** Taille commune des deux faces (la plus haute des deux), d'après la mesure réelle des textes. */
export function mesureFaces(d: DonneesProblemeSolution, largeur: number, padding: number, tailles: { titre: number; corps: number; legende: number }, hauteurTexte: (texte: string, niveau: "titre" | "corps", taille: number, largeur: number) => number) {
  const interieur = largeur - 2 * padding;
  const face = (f: FaceProblemeSolution) => tailles.legende * 1.5 + 26 + hauteurTexte(f.titre, "titre", tailles.titre, interieur) + (f.detail ? 20 + hauteurTexte(f.detail, "corps", tailles.corps, interieur) : 0);
  return { interieur, hauteur: Math.max(face(d.probleme), face(d.solution)) + 2 * padding };
}

/** Tailles des faces : agrandies (×1,3) en plein écran, ramenées pas à pas tant que la carte ne tient pas. */
export function taillesFaces(taille: (n: "titre" | "corps" | "legende") => number, tient: (t: { titre: number; corps: number; legende: number }) => boolean) {
  for (const f of [1.3, 1.18, 1.08, 1]) {
    const t = { titre: Math.round(taille("titre") * f), corps: Math.round(taille("corps") * Math.min(1.12, f)), legende: Math.round(taille("legende") * Math.min(1.08, f)) };
    if (f === 1 || tient(t)) return t;
  }
  return { titre: taille("titre"), corps: taille("corps"), legende: taille("legende") };
}

function Face({ f, etiquette, solution, debut, largeur, hauteur, padding, barre, tailles }: { f: FaceProblemeSolution; etiquette: string; solution: boolean; debut: number; largeur: number; hauteur: number; padding: number; barre?: number; tailles: { titre: number; corps: number; legende: number } }) {
  const { t, u } = useMotion();
  const tTitre = tailles.titre;
  const lignes = couperLignes(f.titre, tTitre, 800, largeur - 2 * padding, APPROCHE_EM.titre);
  const hLigne = tTitre * INTERLIGNE.titre + tTitre * 0.04;
  const couleur = solution ? COULEURS.orangeVif : COULEURS.cremeAttenuee;
  return (
    <div style={{ position: "absolute", inset: 0, ...stylePanneau(u, solution ? 0.9 : 0), padding, backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden", transform: solution ? "rotateY(180deg)" : undefined, display: "flex", flexDirection: "column", gap: 20 * u, height: hauteur }}>
      <div style={{ display: "flex", alignItems: "center", gap: 18 * u, height: tailles.legende * 1.5 }}>
        <IconeTracee nom={f.icone ?? (solution ? "coche-cercle" : "alerte")} taille={tailles.legende * 1.25} debut={debut} couleur={couleur} epaisseur={2.4} chute={99} />
        <TexteCinetique texte={etiquette.toUpperCase()} niveau="legende" taillePx={tailles.legende} debut={debut + 0.05} graisse={700} couleur={couleur} style={{ letterSpacing: "0.14em" }} chute={99} />
      </div>
      <div style={{ position: "relative" }}>
        <TexteCinetique texte={f.titre} niveau="titre" taillePx={tTitre} debut={debut + 0.15} graisse={800} couleur={COULEURS.creme} chute={99} />
        {/* Le problème se barre ligne à ligne. */}
        {barre !== undefined &&
          lignes.map((_, i) => {
            const k = progres(t, barre + i * 0.12, 0.35, "glisse");
            return <div key={i} style={{ position: "absolute", left: -8 * u, top: i * hLigne + tTitre * 0.56, width: `calc(${(k * 100).toFixed(2)}% + ${16 * u}px)`, height: Math.max(4, 6 * u), borderRadius: 6 * u, background: COULEURS.orange, boxShadow: `0 0 ${12 * u}px ${avecOpacite(COULEURS.orange, 0.6)}`, opacity: k > 0.01 ? 0.92 : 0 }} />;
          })}
      </div>
      {f.detail && <TexteCinetique texte={f.detail} niveau="corps" taillePx={tailles.corps} debut={debut + 0.35} graisse={500} couleur={solution ? COULEURS.creme : COULEURS.cremeAttenuee} chute={99} />}
    </div>
  );
}

function Contenu({ d }: { d: DonneesProblemeSolution }) {
  const { t, u, zoneCentree: z, taille, chute, duree, mesurer, largeur } = useMotion();
  const tSol = instantSolution(d, duree);
  const padding = Math.round(56 * u);
  const mesure = (tl: { titre: number; corps: number; legende: number }) => mesureFaces(d, z.largeur, padding, tl, (tx, n, ta, l) => mesurer(tx, n, l, n === "titre" ? 800 : 500, ta));
  const tailles = taillesFaces(taille, (tl) => mesure(tl).hauteur <= z.hauteur * 0.92);
  const { hauteur } = mesure(tailles);
  const haut = z.y + (z.hauteur - hauteur) / 2;
  // Bascule : anticipation (léger recul) puis 180° ; flou de mouvement horizontal pendant la rotation.
  const angle = (tt: number) => 180 * courbe("anticipation")(Math.min(1, Math.max(0, (tt - tSol) / 0.62)));
  const a = angle(t);
  const vitesse = angle(t) - angle(t - DUREES.obturateur);
  const entree = echelleRessort(t, 0.1, chute);
  const y = (1 - progres(t, 0.1, DUREES.entreeLongue)) * 80 * u;
  const chaleur = progres(t, tSol + 0.2, 0.8);
  const s = progres(t, chute, DUREES.sortie, "sortie");
  return (
    <>
      {/* La lumière se réchauffe derrière la solution. */}
      <div style={{ position: "absolute", left: largeur / 2 - z.largeur, top: haut + hauteur / 2 - z.largeur, width: 2 * z.largeur, height: 2 * z.largeur, borderRadius: "50%", background: `radial-gradient(circle, ${avecOpacite(COULEURS.orangeVif, 0.34 * chaleur * (0.85 + 0.15 * Math.sin(t * 2.4)))}, ${avecOpacite(COULEURS.orange, 0)} 60%)`, opacity: 1 - s }} />
      {/* Le flou se pose AUTOUR de la perspective : un filtre sur l'élément en 3D l'aplatirait (les deux faces visibles). */}
      <FlouMouvement dx={vitesse * 4 * u} style={{ position: "absolute", left: z.x, width: z.largeur, top: haut, height: hauteur, opacity: Math.min(1, entree * 1.4) * (1 - s), transform: `translateY(${(y - s * 60 * u).toFixed(2)}px) scale(${(0.94 + 0.06 * Math.min(1, entree)).toFixed(4)})` }}>
        <div style={{ position: "absolute", inset: 0, perspective: `${(1800 * u).toFixed(0)}px` }}>
          <div style={{ position: "absolute", inset: 0, transformStyle: "preserve-3d", transform: `rotateY(${a.toFixed(3)}deg) translateZ(${(Math.sin((a * Math.PI) / 180) * 60 * u).toFixed(2)}px)` }}>
            <Face f={d.probleme} etiquette={d.etiquetteProbleme ?? "Le problème"} solution={false} debut={0.25} largeur={z.largeur} hauteur={hauteur} padding={padding} barre={tSol - 0.6} tailles={tailles} />
            <Face f={d.solution} etiquette={d.etiquetteSolution ?? "La solution"} solution debut={tSol + 0.3} largeur={z.largeur} hauteur={hauteur} padding={padding} tailles={tailles} />
          </div>
        </div>
      </FlouMouvement>
    </>
  );
}

export function MotionProblemeSolution(p: MiseEnPageCarte & { donnees: DonneesProblemeSolution }) {
  if (p.style === "spectaculaire") return <ProblemeSolutionSpectaculaire {...p} />;
  return (
    <CarteMotion mp={p}>
      <Contenu d={p.donnees} />
    </CarteMotion>
  );
}
