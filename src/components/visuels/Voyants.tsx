import type { NiveauControle, RapportPorte } from "@/domaine/visuels/contrats";
import { Pastille } from "@/components/ui/Pastille";
import { cn } from "@/lib/cn";

const TONS = { vert: "sauge", orange: "ambre", rouge: "brique" } as const;
const NOMS: Record<NiveauControle, string> = { vert: "Vert", orange: "Orange", rouge: "Rouge" };
const POINTS: Record<NiveauControle, string> = { vert: "bg-sauge", orange: "bg-ambre", rouge: "bg-brique" };

/** Petit voyant : pastille de couleur + mot (la couleur ne porte jamais seule l'information). */
export function Voyant({ niveau, className }: { niveau: NiveauControle; className?: string }) {
  return (
    <Pastille ton={TONS[niveau]} className={className}>
      <span aria-hidden className={cn("size-2 rounded-full", POINTS[niveau])} />
      {NOMS[niveau]}
    </Pastille>
  );
}

/** Résultat de la porte : une ligne par contrôle, avec la phrase et la page concernée. */
export function Voyants({ rapport, className }: { rapport: RapportPorte; className?: string }) {
  return (
    <section aria-label="Contrôles avant validation" className={cn("flex flex-col gap-2", className)}>
      <Voyant niveau={rapport.verdict} className="self-start" />
      {rapport.controles.length === 0 ? (
        <p className="text-sm text-texte-doux">Tout est en ordre.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {rapport.controles.map((c, i) => (
            <li key={`${c.code}-${i}`} className="flex min-h-11 items-start gap-3 rounded-champ border border-trait bg-surface-1 px-3.5 py-2.5">
              <Voyant niveau={c.niveau} />
              <p className="text-sm text-texte">
                {c.phrase}
                {/* ControlePorte.page est déjà en base 1 (« Page 3 ») : affiché tel quel. */}
                {c.page !== undefined && !new RegExp(`^Page ${c.page}(?!\\d)`, "i").test(c.phrase) && <span className="ml-1.5 text-texte-faible">(page {c.page})</span>}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
