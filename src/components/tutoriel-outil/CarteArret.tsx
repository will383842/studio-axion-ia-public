import Link from "next/link";
import { Carte } from "@/components/ui/Carte";
import type { ArretLisible } from "@/moteurs/montage-tutoriel-outil/vue-roles";

const CLASSE_BOUTON = "inline-flex min-h-11 items-center rounded-full border px-4 text-sm font-semibold";

/**
 * L'arrêt du tutoriel en clair : la cause en une phrase, le détail repliable de ce que l'équipe a relevé, et les seuls
 * boutons qui servent (jamais de « Réessayer » ici : voir `arretLisible`). Présentation pure, sans montant ni JSON.
 */
export function CarteArret({ arret }: { arret: ArretLisible }) {
  return (
    <Carte className="space-y-3" role="status" data-arret={arret.code}>
      <p className="text-[15px] text-texte">{arret.cause}</p>
      {arret.releves.length > 0 && (
        <details className="text-sm text-texte-doux">
          <summary className="min-h-11 cursor-pointer py-2 font-semibold text-texte">Ce qui a été relevé</summary>
          <ul className="list-disc space-y-1 pl-5">
            {arret.releves.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        </details>
      )}
      {arret.boutons.length > 0 && (
        <div className="flex flex-wrap gap-3">
          {arret.boutons.map((b, i) => (
            <Link key={b.genre} href={b.href} className={`${CLASSE_BOUTON} ${i === 0 ? "border-orange bg-orange text-sur-orange" : "border-trait-fort text-texte hover:bg-surface-2"}`}>
              {b.libelle}
            </Link>
          ))}
        </div>
      )}
    </Carte>
  );
}
