import Link from "next/link";
import { EtatVide } from "@/components/ui/EtatVide";
import type { NomIcone } from "@/components/ui/Icone";
import { Icone } from "@/components/ui/Icone";

export interface RecentGenerateur {
  id: string;
  href: string;
  titre: string;
  /** Phrase lisible (« écriture en cours », « prête »). */
  etat: string;
  /** ISO ; affichée « 18 oct., 14:05 » (fr-FR). */
  date?: string;
  /** Ligne en plus : « payé 1,20 € », « 3 vidéos ». */
  detail?: string;
  icone?: NomIcone;
}

/** « 18 oct., 14:05 ». */
export function dateRecent(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

function Liste({ elements, courant, deuxColonnes }: { elements: RecentGenerateur[]; courant?: string; deuxColonnes?: boolean }) {
  return (
    <ul className={deuxColonnes ? "grid gap-2 sm:grid-cols-2" : "space-y-2"}>
      {elements.map((r) => (
        <li key={r.id}>
          <Link
            href={r.href}
            aria-current={r.id === courant ? "page" : undefined}
            className={`flex items-center justify-between gap-3 rounded-2xl border px-4 py-3 ${r.id === courant ? "border-orange-vif bg-surface-1" : "border-trait"}`}
          >
            <span className="flex min-w-0 items-center gap-2">
              {r.icone && <Icone nom={r.icone} size={16} className="shrink-0 text-texte-doux" />}
              <span className="min-w-0">
                <span className="block truncate text-[15px] text-texte">{r.titre}</span>
                {r.detail && <span className="block truncate text-xs text-texte-faible">{r.detail}</span>}
              </span>
            </span>
            <span className="shrink-0 text-right text-sm text-texte-doux">{r.date ? `${r.etat} · ${dateRecent(r.date)}` : r.etat}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

/**
 * Récents d'un générateur : liste verticale, état et date à droite, `aria-current` sur le courant.
 * Vide : `EtatVide` compact (`vide`), ou rien si `vide` vaut `null`.
 */
export function RecentsGenerateur({
  titre = "Vos vidéos récentes",
  groupes,
  elements,
  courant,
  vide,
  deuxColonnes,
}: {
  titre?: string;
  groupes?: { titre: string; elements: RecentGenerateur[] }[];
  elements?: RecentGenerateur[];
  courant?: string;
  vide?: { titre: string; phrase?: string } | null;
  deuxColonnes?: boolean;
}) {
  const parts = groupes?.filter((g) => g.elements.length) ?? [];
  const liste = elements ?? [];
  if (!parts.length && !liste.length) {
    if (vide === null) return null;
    return (
      <section aria-label={titre}>
        <EtatVide compact titre={vide?.titre ?? "Rien pour le moment"} phrase={vide?.phrase} />
      </section>
    );
  }
  return (
    <section aria-label={titre} className="space-y-2">
      {parts.length ? (
        parts.map((g) => (
          <div key={g.titre} className="space-y-2">
            <h2 className="text-sm font-semibold text-texte-doux">{g.titre}</h2>
            <Liste elements={g.elements} courant={courant} deuxColonnes={deuxColonnes} />
          </div>
        ))
      ) : (
        <>
          <h2 className="text-sm font-semibold text-texte-doux">{titre}</h2>
          <Liste elements={liste} courant={courant} deuxColonnes={deuxColonnes} />
        </>
      )}
    </section>
  );
}
