import { cn } from "@/lib/cn";
import { Icone } from "./Icone";

export interface EtapeCommune {
  cle: string;
  libelle: string;
}

export type EtatEtape = "faite" | "ici" | "a-venir";

/** État d'une étape selon l'étape courante (index à partir de 0). Pur, testable. */
export function etatEtape(index: number, courante: number): EtatEtape {
  return index < courante ? "faite" : index === courante ? "ici" : "a-venir";
}

/**
 * Barre d'étapes commune (maquette M0) : ronds numérotés reliés par un trait. Étape faite en vert avec une coche,
 * étape en cours en accent, étapes à venir en gris. Sur téléphone, seuls les ronds restent et la phrase de l'étape
 * courante s'affiche dessous. Aucune information par la couleur seule : numéro, coche et mot.
 */
export function BarreEtapesCommune({ etapes, courante, libelle = "Étapes", className }: { etapes: EtapeCommune[]; courante: number; libelle?: string; className?: string }) {
  return (
    <nav aria-label={libelle} className={cn("@container w-full", className)}>
      <ol className="flex items-center">
        {etapes.map((e, i) => {
          const etat = etatEtape(i, courante);
          const dernier = i === etapes.length - 1;
          return (
            <li
              key={e.cle}
              data-etat={etat}
              aria-current={etat === "ici" ? "step" : undefined}
              className={cn("flex items-center gap-2 whitespace-nowrap font-bold", !dernier && "flex-1", etat === "a-venir" ? "text-texte-doux" : "text-texte", etat === "ici" && "font-extrabold")}
            >
              <span
                className={cn(
                  "grid size-[30px] flex-none place-items-center rounded-full text-[13px] font-extrabold",
                  etat === "faite" && "bg-sauge-doux text-sauge",
                  etat === "ici" && "bg-accent text-sur-accent ring-4 ring-accent-doux",
                  etat === "a-venir" && "bg-surface-3 text-texte-doux",
                )}
              >
                {etat === "faite" ? <Icone nom="coche" size={15} /> : i + 1}
              </span>
              <span className="hidden @[560px]:inline">{e.libelle}</span>
              <span className="sr-only">{etat === "faite" ? "(faite)" : etat === "ici" ? "(en cours)" : ""}</span>
              {!dernier && <span aria-hidden className={cn("mx-1.5 h-0.5 min-w-3.5 flex-1 rounded-sm @[560px]:mx-3", etat === "faite" ? "bg-sauge" : "bg-trait-fort")} />}
            </li>
          );
        })}
      </ol>
      <p className="mt-2.5 font-extrabold text-texte @[560px]:hidden">{etapes[courante]?.libelle}</p>
    </nav>
  );
}
