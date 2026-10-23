import Link from "next/link";
import { NATURES_PERSONNAGE } from "@/domaine/libelles";
import type { NaturePersonnage } from "@/domaine/types";
import { cn } from "@/lib/cn";
import { Icone } from "./Icone";
import { Pastille } from "./Pastille";
import { Portrait } from "./Portrait";

export interface DonneesCartePersonnage {
  id: string;
  nom: string;
  role?: string;
  nature: NaturePersonnage;
  photo: string | null;
  visagesPrets: number;
  /** Tous les visages, prêts ou non : le même chiffre que l'onglet « Visages » de la fiche (E2E-1 n° 19). */
  visagesTotal?: number;
  voixPrete: boolean;
  accordValide: boolean;
}

/** « 2 visages » quand tout est prêt ; sinon « 0 prêt · 1 en attente » (même total que la fiche). */
export function libelleVisages(prets: number, total: number): string {
  if (total <= prets) return `${prets} ${prets > 1 ? "visages" : "visage"}`;
  return `${prets} prêt${prets > 1 ? "s" : ""} · ${total - prets} en attente`;
}

/** Carte d'un personnage : photo, nature, visages prêts, voix prête, alerte d'accord. */
export function CartePersonnage({ personnage: p, href, className }: { personnage: DonneesCartePersonnage; href: string; className?: string }) {
  return (
    <Link
      href={href}
      className={cn(
        "group relative isolate flex flex-col items-center overflow-hidden rounded-carte border border-trait bg-surface-1 p-5 text-center shadow-carte transition-[border-color,transform] duration-200 ease-studio hover:-translate-y-0.5 hover:border-trait-fort",
        !p.accordValide && "border-ambre/40",
        className,
      )}
    >
      <div aria-hidden className="absolute inset-x-0 top-0 -z-10 h-24 lueur" />
      <Portrait nom={p.nom} photo={p.photo} taille="xl" anneau={p.nature === "moi"} />
      <h2 className="mt-3 text-lg text-texte">{p.nom}</h2>
      <p className="flex items-center gap-1 text-sm text-texte-doux">
        <Icone nom={NATURES_PERSONNAGE[p.nature].icone} size={14} />
        {p.role ?? NATURES_PERSONNAGE[p.nature].libelle}
      </p>
      <div className="mt-4 flex flex-wrap justify-center gap-1.5">
        <Pastille ton={p.visagesPrets ? "sauge" : "neutre"} icone="visage">
          {libelleVisages(p.visagesPrets, p.visagesTotal ?? p.visagesPrets)}
        </Pastille>
        <Pastille ton={p.voixPrete ? "sauge" : "neutre"} icone="micro">
          {p.voixPrete ? "Voix prête" : "Sans voix"}
        </Pastille>
      </div>
      {!p.accordValide && (
        <Pastille ton="ambre" icone="cadenas" taille="md" className="mt-3">
          Accord manquant
        </Pastille>
      )}
    </Link>
  );
}
