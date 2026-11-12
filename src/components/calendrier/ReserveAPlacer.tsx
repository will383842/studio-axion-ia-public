import Image from "next/image";
import Link from "next/link";
import { EnTeteSection } from "@/components/ui/EnTetePage";

export interface ContenuAPlacer {
  id: string;
  titre: string;
  vignette?: string | null;
}

/** Réserve « À placer » : les contenus prêts, sans date. Un clic ouvre la fiche. Rien d'affiché quand elle est vide. */
export function ReserveAPlacer({ contenus }: { contenus: readonly ContenuAPlacer[] }) {
  if (contenus.length === 0) return null;
  return (
    <section aria-label="À placer" className="mt-10">
      <EnTeteSection titre="À placer" compteur={contenus.length} />
      <ul className="sans-barre -mx-4 flex gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:grid sm:grid-cols-4 sm:px-0 lg:grid-cols-6">
        {contenus.map((c) => (
          <li key={c.id} className="w-36 shrink-0 sm:w-auto">
            <Link href={`/videos/${c.id}`} className="block rounded-2xl border border-trait bg-surface-1 p-2 hover:border-trait-fort">
              <span className="relative block aspect-[9/16] overflow-hidden rounded-lg bg-surface-2">
                {c.vignette && <Image src={c.vignette} alt="" fill sizes="144px" className="object-cover" />}
              </span>
              <span className="mt-1.5 block truncate text-sm font-semibold text-texte">{c.titre}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
