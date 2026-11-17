/**
 * STYLE CROQUIS (X1-08) : rectangle, ellipse, flèche, ligne tracés par roughjs en mode SVG (générateur pur, sans DOM).
 * `graine` = graine de la vidéo, OBLIGATOIRE : même graine = même balisage, aucun hasard libre. Couleur par `couleurDuTon`.
 * Le calcul des traits est pur et vit dans `croquis.ts` ; ici on ne fait que les confier à la bibliothèque.
 * Pièce NON inscrite. Imports relatifs seulement.
 */
import type { JSX } from "react";
import { RoughGenerator } from "roughjs/bin/generator";
import type { FondAxion } from "../../../../src/briques/jetons-motion";
import type { TonObjet } from "../../../../src/briques/motion/petits-objets/contrat";
import { planCroquis, TOILE_CROQUIS, type FormeCroquis, type ParametresCroquis } from "../../../../src/briques/motion/petits-objets/croquis";

export interface ProprietesCroquis {
  forme: FormeCroquis;
  parametres: ParametresCroquis;
  ton: TonObjet;
  fond: FondAxion;
  /** Graine de la vidéo (entier ≥ 0). */
  graine: number;
}

export function Croquis({ forme, parametres, ton, fond, graine }: ProprietesCroquis): JSX.Element | null {
  const plan = planCroquis(forme, parametres, ton, fond, graine);
  if (!plan) return null;
  const { reglages: r, traits } = plan;
  const gen = new RoughGenerator();
  const dessins = traits.map((t) => {
    const o = { seed: t.seed, roughness: r.roughness, stroke: r.stroke, strokeWidth: r.strokeWidth, fill: "none" };
    const [a, b, c, d] = t.nombres;
    if (t.genre === "rectangle") return gen.rectangle(a, b, c, d, o);
    if (t.genre === "ellipse") return gen.ellipse(a, b, c, d, o);
    return gen.line(a, b, c, d, o);
  });
  const chemins = dessins.flatMap((d) => gen.toPaths(d));
  return (
    <svg viewBox={`0 0 ${TOILE_CROQUIS} ${TOILE_CROQUIS}`} width="100%" height="100%" data-croquis={forme} fill="none" strokeLinecap="round" strokeLinejoin="round">
      {chemins.map((t, i) => (
        <path key={i} d={t.d} stroke={r.stroke} strokeWidth={r.strokeWidth} fill="none" />
      ))}
    </svg>
  );
}
