import { Pastille } from "@/components/ui/Pastille";
import type { Tonalite } from "@/domaine/libelles";

/** Les six états qu'une personne lit dans le calendrier (ceux de la maquette validée). */
export type EtatCalendrier = "brouillon" | "a_valider" | "programme" | "publie" | "a_corriger" | "idee";

/** Ordre de la légende. */
export const ETATS_CALENDRIER: readonly EtatCalendrier[] = ["brouillon", "a_valider", "programme", "publie", "a_corriger", "idee"];

/** Libellé et ton de chaque état. Le ton dit l'état, jamais le réseau. */
export const LIBELLES_ETAT: Readonly<Record<EtatCalendrier, { libelle: string; ton: Tonalite }>> = {
  brouillon: { libelle: "Brouillon", ton: "neutre" },
  a_valider: { libelle: "À valider", ton: "ambre" },
  programme: { libelle: "Programmé", ton: "sauge" },
  publie: { libelle: "Publié", ton: "contour" },
  a_corriger: { libelle: "À corriger", ton: "brique" },
  idee: { libelle: "Idée de l'IA", ton: "pointille" },
};

/** Statuts internes (plan éditorial et publications) → état affiché. « archive » n'est pas montré dans le calendrier. */
const DEPUIS_STATUT: Readonly<Record<string, EtatCalendrier | null>> = {
  propose: "idee",
  a_valider: "a_valider",
  // Validée mais pas encore programmée : rien n'est parti, il reste quelque chose à faire.
  valide: "brouillon",
  programme: "programme",
  programmee: "programme",
  publie: "publie",
  publiee: "publie",
  echec: "a_corriger",
  a_corriger: "a_corriger",
  brouillon: "brouillon",
  idee: "idee",
  archive: null,
};

/**
 * État affiché d'un statut interne. `null` : l'entrée n'a pas sa place dans le calendrier (archivée).
 * Statut vide ou inconnu : « brouillon » (rien n'est parti), jamais le mot interne.
 */
export function etatDepuisStatut(statut: string | null | undefined): EtatCalendrier | null {
  const cle = (statut ?? "").trim();
  return Object.hasOwn(DEPUIS_STATUT, cle) ? DEPUIS_STATUT[cle] : "brouillon";
}

export interface ProprietesPastilleStatutPlan {
  etat: EtatCalendrier;
  className?: string;
}

/** Pastille d'état d'une entrée du calendrier : un libellé court, un ton par état. */
export function PastilleStatutPlan({ etat, className }: ProprietesPastilleStatutPlan) {
  const { libelle, ton } = LIBELLES_ETAT[etat] ?? LIBELLES_ETAT.brouillon;
  return (
    <Pastille ton={ton} className={className}>
      {libelle}
    </Pastille>
  );
}
