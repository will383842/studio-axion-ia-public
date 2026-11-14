"use client";

/**
 * Pont entre `Filtres` (cases, mot cherché) et l'adresse du calendrier : chaque changement navigue vers la même page avec
 * `?types=…&etats=…&q=…` (vue, date et réseaux sont déjà dans `base`). Aucune donnée n'est lue ici : la page relit l'adresse.
 * Les cases agissent aussitôt ; le mot cherché attend une courte pause de frappe pour ne pas recharger à chaque lettre.
 */
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import type { CriteresFiltre } from "@/domaine/calendrier/regroupement";
import { Filtres, suiteFiltres } from "./Filtres";
import { LIBELLES_ENVOI } from "./apercu-reseau";

export interface ProprietesFiltresCalendrier {
  /** Filtres lus dans l'adresse par la page. */
  criteres: CriteresFiltre;
  /** Adresse de la vue en cours, SANS types, états ni mot cherché (avec vue, date et réseaux). */
  base: string;
  /** Liens gardés dans le panneau « Filtrer » (« Mes textes », « Afficher tous les réseaux »). */
  children?: ReactNode;
}

const PAUSE_FRAPPE_MS = 400;

/** L'adresse de la vue avec les filtres. */
export function adresseAvecFiltres(base: string, criteres: CriteresFiltre): string {
  const suite = suiteFiltres(criteres);
  return !suite ? base : base.includes("?") ? `${base}${suite}` : `${base}?${suite.slice(1)}`;
}

/** Le routeur de l'application ; hors application (rendu de test, aperçu isolé), `null` : on navigue alors par l'adresse. */
function useRouteurOuNul() {
  try {
    return useRouter();
  } catch {
    return null;
  }
}

export function FiltresCalendrier({ criteres, base, children }: ProprietesFiltresCalendrier) {
  const routeur = useRouteurOuNul();
  const [mot, setMot] = useState(criteres.motCle ?? "");
  const minuteur = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (minuteur.current) clearTimeout(minuteur.current); }, []);

  const aller = (c: CriteresFiltre) => {
    const adresse = adresseAvecFiltres(base, c);
    if (routeur) routeur.replace(adresse, { scroll: false });
    else window.location.assign(adresse);
  };
  const onChanger = (nouveaux: CriteresFiltre) => {
    if (minuteur.current) clearTimeout(minuteur.current);
    const motChange = (nouveaux.motCle ?? "") !== mot;
    setMot(nouveaux.motCle ?? "");
    if (motChange) minuteur.current = setTimeout(() => aller(nouveaux), PAUSE_FRAPPE_MS);
    else aller(nouveaux);
  };
  return <Filtres criteres={{ ...criteres, motCle: mot }} onChanger={onChanger} libellesEtat={LIBELLES_ENVOI} enPlus={children} effacerDansLePanneau />;
}
