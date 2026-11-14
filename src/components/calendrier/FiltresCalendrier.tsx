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
  // Cases : état local, pour que des clics en rafale partent chacun des cases déjà cochées (l'adresse met un instant à revenir).
  const [cases, setCases] = useState({ types: criteres.types, etats: criteres.etats });
  const minuteur = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (minuteur.current) clearTimeout(minuteur.current); }, []);
  // Le mot ou les cases ont changé SANS passer par le champ (« Tout afficher », bouton Retour…) : on se remet d'accord avec l'adresse.
  // Pendant une frappe (minuteur en attente), la saisie reste maîtresse.
  useEffect(() => { if (!minuteur.current) setMot(criteres.motCle ?? ""); }, [criteres.motCle]);
  // Même resynchronisation pour les cases, faite pendant le rendu (aucun effet) quand les types ou états de l'adresse changent.
  const cleAdresse = `${criteres.types.join(",")}|${criteres.etats.join(",")}`;
  const [cleVue, setCleVue] = useState(cleAdresse);
  if (cleVue !== cleAdresse) {
    setCleVue(cleAdresse);
    setCases({ types: criteres.types, etats: criteres.etats });
  }

  const aller = (c: CriteresFiltre) => {
    const adresse = adresseAvecFiltres(base, c);
    if (routeur) routeur.replace(adresse, { scroll: false });
    else window.location.assign(adresse);
  };
  const onChanger = (nouveaux: CriteresFiltre) => {
    if (minuteur.current) clearTimeout(minuteur.current);
    minuteur.current = null;
    const motChange = (nouveaux.motCle ?? "") !== mot;
    setMot(nouveaux.motCle ?? "");
    setCases({ types: nouveaux.types, etats: nouveaux.etats });
    // Un mot qui se vide (« Effacer les filtres », champ vidé) navigue tout de suite ; une frappe attend sa pause.
    if (motChange && (nouveaux.motCle ?? "") !== "") {
      minuteur.current = setTimeout(() => {
        minuteur.current = null;
        aller(nouveaux);
      }, PAUSE_FRAPPE_MS);
    } else aller(nouveaux);
  };
  return <Filtres criteres={{ ...criteres, ...cases, motCle: mot }} onChanger={onChanger} libellesEtat={LIBELLES_ENVOI} enPlus={children} effacerDansLePanneau />;
}
