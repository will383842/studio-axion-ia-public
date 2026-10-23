import Link from "next/link";
import { EnTeteSection } from "@/components/ui/EnTetePage";
import { Icone, type NomIcone } from "@/components/ui/Icone";
import { cn } from "@/lib/cn";

export interface CompteursEcrire {
  aRelire: number;
  manqueMatiere: number;
  pretAFabriquer: number;
  aProgrammer: number;
  aRanger: number;
  /** Lot G7a : vidéos publiées dont la mesure J+3 ou J+7 est attendue. */
  mesuresASaisir?: number;
}

/**
 * Tuiles d'Accueil du générateur (plan v5 B.6.13, lot G1b) : chaque tuile ouvre la liste Scripts déjà filtrée (vue
 * rapide dans l'adresse) ; « À ranger » ouvre les anciennes vidéos sans réseau. Les tuiles disent « Scripts » :
 * « Aujourd'hui » compte des VIDÉOS sous les mêmes mots (E2E-1 n° 8).
 */
export function TuilesEcrire({ c }: { c: CompteursEcrire }) {
  const tuiles: { libelle: string; nombre: number; icone: NomIcone; href: string; ton?: "ambre" }[] = [
    { libelle: "Scripts à relire", nombre: c.aRelire, icone: "oeil", href: "/ecrire?etat=a-relire" },
    { libelle: "Il manque une matière", nombre: c.manqueMatiere, icone: "micro", href: "/ecrire?etat=il-manque-une-matiere", ton: "ambre" },
    { libelle: "Prêt à fabriquer", nombre: c.pretAFabriquer, icone: "film", href: "/ecrire?etat=pret-a-fabriquer" },
    { libelle: "Scripts à programmer", nombre: c.aProgrammer, icone: "calendrier", href: "/ecrire?etat=a-programmer" },
    { libelle: "À ranger", nombre: c.aRanger, icone: "archive", href: "/videos/a-ranger" },
    { libelle: "Mesures à saisir", nombre: c.mesuresASaisir ?? 0, icone: "resultats", href: "/mesures", ton: "ambre" },
  ];
  return (
    <section>
      <EnTeteSection titre="Écrire" lien={{ href: "/ecrire" }} />
      <div className="sans-barre -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:grid sm:grid-cols-6 sm:overflow-visible sm:px-0">
        {tuiles.map((t) => (
          <Link
            key={t.libelle}
            href={t.href}
            className={cn(
              "group flex min-h-24 w-[30%] shrink-0 flex-col gap-2 rounded-carte border bg-surface-1 p-3 transition-colors hover:border-trait-fort sm:w-auto",
              t.nombre && t.ton === "ambre" ? "border-ambre/40" : t.nombre ? "border-trait" : "border-trait/60",
            )}
          >
            <Icone nom={t.icone} size={18} className={cn(t.nombre ? (t.ton === "ambre" ? "text-ambre" : "text-orange-vif") : "text-texte-faible")} />
            <span className={cn("font-titre text-4xl tabular-nums leading-none", t.nombre ? "text-texte" : "text-texte-faible")}>{t.nombre}</span>
            <span className="text-xs font-semibold leading-tight text-texte-doux">{t.libelle}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}
