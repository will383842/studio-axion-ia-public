/**
 * PETITE COURBE D'INTENSITÉ (lot du 02/10, D1) : charge de chaque fenêtre de 3 s sur la durée de la vidéo, sous la
 * bande de plans (Aperçu) et dans la fiche vidéo. Le trait pointillé est le plafond du niveau choisi ; un dépassement
 * (deux choix verrouillés empilés) se voit en rouge. Composant sans état, utilisable côté serveur comme côté client.
 */
import type { NiveauIntensite, RapportIntensite } from "@/domaine/types";
import { cn } from "@/lib/cn";

export const NOMS_NIVEAUX: Record<NiveauIntensite, string> = { sobre: "Sobre", equilibre: "Équilibré", "tres-dynamique": "Très dynamique" };

export function CourbeIntensite({ rapport, className, marques }: { rapport: RapportIntensite; className?: string; marques?: { tSec: number; libelle: string }[] }) {
  const duree = Math.max(1, rapport.courbe.at(-1)?.tSec ?? 1);
  const haut = Math.max(rapport.plafond + 1, ...rapport.courbe.map((p) => p.charge));
  const L = 300;
  const H = 44;
  const x = (t: number) => (t / duree) * L;
  const y = (c: number) => H - (c / haut) * (H - 4);
  const points = rapport.courbe.map((p) => `${x(p.tSec).toFixed(1)},${y(p.charge).toFixed(1)}`).join(" ");
  const aire = `0,${H} ${points} ${L},${H}`;
  const depasse = rapport.depassements.length > 0;
  return (
    <figure className={cn("rounded-2xl border border-trait bg-surface-1 px-3 pb-2 pt-2.5", className)}>
      <figcaption className="mb-1 flex items-center justify-between gap-2 text-xs">
        <span className="font-semibold text-texte-doux">Intensité · {NOMS_NIVEAUX[rapport.niveau]}</span>
        <span className={cn("tabular-nums", depasse ? "font-semibold text-brique" : "text-texte-faible")}>{depasse ? "Trop d'effets à un moment" : `${rapport.effetsGardes + rapport.effetsDecales} effets`}</span>
      </figcaption>
      <svg viewBox={`0 0 ${L} ${H}`} preserveAspectRatio="none" role="img" aria-label={`Courbe d'intensité, plafond ${rapport.plafond}`} className="block h-11 w-full">
        <polygon points={aire} className="fill-orange/20" />
        <polyline points={points} fill="none" strokeWidth={1.6} vectorEffect="non-scaling-stroke" className="stroke-orange-vif" />
        <line x1={0} x2={L} y1={y(rapport.plafond)} y2={y(rapport.plafond)} strokeDasharray="4 4" strokeWidth={1} vectorEffect="non-scaling-stroke" className="stroke-texte-faible" />
        {rapport.depassements.map((d, i) => (
          <rect key={i} x={x(d.debutSec)} y={0} width={Math.max(2, x(d.finSec) - x(d.debutSec))} height={H} className="fill-brique/25" />
        ))}
        {marques?.map((m, i) => (
          <circle key={i} cx={x(m.tSec)} cy={H - 3} r={2.2} className="fill-texte-doux">
            <title>{m.libelle}</title>
          </circle>
        ))}
      </svg>
    </figure>
  );
}
