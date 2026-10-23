import { Icone } from "@/components/ui/Icone";
import type { NoteQualite } from "@/domaine/types";
import { cn } from "@/lib/cn";

function ton(note: number) {
  return note >= 85 ? "sauge" : note >= 70 ? "ambre" : "brique";
}

const TEXTES = { sauge: "text-sauge", ambre: "text-ambre", brique: "text-brique" } as const;

/**
 * Note de qualité /100 : anneau et alertes. Audit 4.3 : la note est une ESTIMATION tirée des alertes, libellée comme
 * telle ; les anciennes sous-notes (lèvres, son, sous-titres, réalisme), jamais mesurées, ne s'affichent plus.
 */
export function CarteQualite({ note }: { note: NoteQualite }) {
  const r = 30;
  const c = 2 * Math.PI * r;
  const t = ton(note.globale);
  return (
    <section aria-label="Qualité" className="rounded-carte border border-trait bg-surface-1 p-4">
      <div className="flex items-center gap-4">
        <div className="relative size-[72px] shrink-0">
          <svg viewBox="0 0 72 72" className="size-full -rotate-90" aria-hidden>
            <circle cx="36" cy="36" r={r} className="fill-none stroke-surface-3" strokeWidth="7" />
            <circle cx="36" cy="36" r={r} className={cn("fill-none stroke-current", TEXTES[t])} strokeWidth="7" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c - (note.globale / 100) * c} />
          </svg>
          <span className="absolute inset-0 grid place-items-center">
            <span className="font-titre text-xl tabular-nums leading-none text-texte">{note.globale}</span>
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-texte">Qualité</p>
          <p className="text-xs text-texte-faible">Estimation</p>
        </div>
      </div>
      {note.alertes.length > 0 && (
        <ul className="mt-4 space-y-1.5 border-t border-trait pt-3">
          {note.alertes.map((a, i) => (
            <li key={i} className="flex items-start gap-2 text-sm">
              <Icone nom={a.gravite === "info" ? "info" : "attention"} size={16} className={cn("mt-0.5 shrink-0", a.gravite === "bloquant" ? "text-brique" : a.gravite === "attention" ? "text-ambre" : "text-texte-faible")} />
              <span className="text-texte-doux">{a.message}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
