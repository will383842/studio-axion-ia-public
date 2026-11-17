/**
 * STYLE CROQUIS (X1-08) : rectangle, ellipse, flèche, ligne tracés par roughjs en mode SVG (générateur pur, sans DOM).
 * `graine` = graine de la vidéo, OBLIGATOIRE : même graine = même balisage, aucun hasard libre. Couleur par `couleurDuTon`.
 * Pièce NON inscrite. Imports relatifs seulement.
 */
import type { JSX } from "react";
import { RoughGenerator } from "roughjs/bin/generator";
import type { FondAxion } from "../../../../src/briques/jetons-motion";
import type { TonObjet } from "../../../../src/briques/motion/petits-objets/contrat";
import { reglagesCroquis, graineCroquisValide, validerCroquis, type FormeCroquis, type ParametresCroquis } from "../../../../src/briques/motion/petits-objets/croquis";

const L = 1000;
const H = 1000;

export interface ProprietesCroquis {
  forme: FormeCroquis;
  parametres: ParametresCroquis;
  ton: TonObjet;
  fond: FondAxion;
  /** Graine de la vidéo (entier ≥ 0). */
  graine: number;
}

const arrondi = (n: number) => Math.round(n * 100) / 100;

export function Croquis({ forme, parametres, ton, fond, graine }: ProprietesCroquis): JSX.Element | null {
  const p = validerCroquis(parametres);
  if (!p || !graineCroquisValide(graine)) return null;
  const r = reglagesCroquis(p, ton, fond, graine);
  const gen = new RoughGenerator();
  const x = (p.x / 100) * L;
  const y = (p.y / 100) * H;
  const l = (p.largeur / 100) * L;
  const h = (p.hauteur / 100) * H;
  const opts = (decalage: number) => ({ seed: r.seed + decalage, roughness: r.roughness, stroke: r.stroke, strokeWidth: r.strokeWidth, fill: "none" });

  const dessins = [];
  if (forme === "rectangle") dessins.push(gen.rectangle(x, y, l, h, opts(0)));
  else if (forme === "ellipse") dessins.push(gen.ellipse(x + l / 2, y + h / 2, l, h, opts(0)));
  else {
    dessins.push(gen.line(x, y, x + l, y + h, opts(0)));
    if (forme === "fleche") {
      const angle = Math.atan2(h, l);
      const pointe = 46;
      for (const [i, ouverture] of [0.5, -0.5].entries()) {
        const a = angle + Math.PI + ouverture;
        dessins.push(gen.line(x + l, y + h, arrondi(x + l + pointe * Math.cos(a)), arrondi(y + h + pointe * Math.sin(a)), opts(i + 1)));
      }
    }
  }
  const traces = dessins.flatMap((d) => gen.toPaths(d));
  return (
    <svg viewBox={`0 0 ${L} ${H}`} width="100%" height="100%" data-croquis={forme} fill="none" strokeLinecap="round" strokeLinejoin="round">
      {traces.map((t, i) => (
        <path key={i} d={t.d} stroke={r.stroke} strokeWidth={r.strokeWidth} fill="none" />
      ))}
    </svg>
  );
}
