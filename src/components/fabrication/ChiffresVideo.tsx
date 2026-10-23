import { Apparition } from "@/components/ui/Apparition";
import { Icone, type NomIcone } from "@/components/ui/Icone";
import { PastilleEssai } from "@/components/ui/PastilleEssai";

export interface ChiffreVideo {
  libelle: string;
  valeur: string;
  icone: NomIcone;
  essai?: boolean;
}

/** Les chiffres d'une fiche vidéo (durée, vues, coûts), extraits tels quels de la fiche : trois colonnes, deux au-delà. */
export function ChiffresVideo({ chiffres }: { chiffres: ChiffreVideo[] }) {
  return (
    <ul className={chiffres.length > 3 ? "grid grid-cols-2 gap-2" : "grid grid-cols-3 gap-2"}>
      {chiffres.map((c, i) => (
        <li key={c.libelle} className="min-w-0">
          <Apparition index={i}>
            <div className="rounded-carte border border-trait bg-surface-1 p-3">
              <p className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs font-semibold text-texte-faible">
                <Icone nom={c.icone} size={13} />
                {c.libelle}
                {c.essai && <PastilleEssai className="ml-auto" />}
              </p>
              <p className="mt-1 truncate font-titre text-xl tabular-nums text-texte">{c.valeur}</p>
            </div>
          </Apparition>
        </li>
      ))}
    </ul>
  );
}
