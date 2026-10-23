"use client";

import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { cocherAvantDePublierAction } from "@/app/(studio)/videos/actions";
import { notifier } from "@/components/ui/Toast";
import type { IdReseau, KitPublication, Partage, Ratio } from "@/domaine/types";
import { casesRequises } from "@/formats";
import type { VueKit } from "@/services/vues";
import type { VueEnvoiBuffer } from "@/services/buffer";

export type CleAvantDePublier = keyof KitPublication["avantDePublier"];
export type FeuilleVideo = "telecharger" | "partager" | "buffer" | null;

export interface SortieTelechargeable {
  id: string;
  ratio: Ratio;
  resolution: string;
  url: string;
  vignette: string;
  taille: number;
}

export type PartageVue = Partage & { chemin: string; actif: boolean };

/** Données de la fiche partagées par le kit, la barre d'actions et les feuilles (sérialisables). */
export interface DonneesVideo {
  videoId: string;
  titre: string;
  dureeSec: number;
  ratios: Ratio[];
  ratiosFormat: Ratio[];
  /** Coût estimé (centimes) de chaque format d'image qui peut encore être ajouté. */
  coutsFormats: Partial<Record<Ratio, number>>;
  sorties: SortieTelechargeable[];
  sousTitres: { srt: string; vtt: string } | null;
  kit: VueKit | null;
  partages: PartageVue[];
  reseauxParDefaut: IdReseau[];
  /** Le moteur de fabrication est une simulation (pastille « Essai » sur les retouches et nouveaux formats). */
  fabricationSimulee: boolean;
  /** Le rédacteur des textes de publication est une simulation (« Réécrire » en Essai). */
  textesSimules: boolean;
  /** Lot R1 : envoi réel par Buffer (mode, compte de chaque réseau) ; absent ou null en simulation. Lu en base seulement. */
  envoiBuffer?: VueEnvoiBuffer | null;
  /** Cases déjà vérifiées par le rapport de qualité (simulé). */
  verifiesAuto: Partial<Record<CleAvantDePublier, boolean>>;
}

interface Contexte extends DonneesVideo {
  feuille: FeuilleVideo;
  ouvrir: (f: FeuilleVideo) => void;
  cases: KitPublication["avantDePublier"] | null;
  cocher: (cle: CleAvantDePublier, valeur: boolean) => void;
  /** Cases à cocher : 5, ou 4 quand la mention IA est coupée (jamais bloquant pour la mention). */
  casesRequises: CleAvantDePublier[];
  nbCochees: number;
  publiable: boolean;
}

const Ctx = createContext<Contexte | null>(null);

/** Fournit l'état partagé de la fiche vidéo (feuilles ouvertes, cases « Avant de publier »). */
export function FournisseurVideo({ donnees, children }: { donnees: DonneesVideo; children: ReactNode }) {
  const router = useRouter();
  const [feuille, setFeuille] = useState<FeuilleVideo>(null);
  const [cases, setCases] = useState(donnees.kit?.avantDePublier ?? null);

  const cocher = useCallback(
    (cle: CleAvantDePublier, valeur: boolean) => {
      setCases((c) => (c ? { ...c, [cle]: valeur } : c));
      void cocherAvantDePublierAction(donnees.videoId, cle, valeur).then((r) => {
        if (!r.ok) {
          setCases((c) => (c ? { ...c, [cle]: !valeur } : c));
          notifier.erreur(r.message);
        } else router.refresh();
      });
    },
    [donnees.videoId, router],
  );

  const valeur = useMemo<Contexte>(() => {
    const requises = casesRequises(donnees.kit?.mentionIAActive ?? true);
    const nbCochees = cases ? requises.filter((c) => cases[c]).length : 0;
    return {
      ...donnees,
      feuille,
      ouvrir: setFeuille,
      cases,
      cocher,
      casesRequises: requises,
      nbCochees,
      publiable: !!cases && nbCochees === requises.length && !(donnees.kit?.licencesABloquer.length ?? 0),
    };
  }, [donnees, feuille, cases, cocher]);

  return <Ctx.Provider value={valeur}>{children}</Ctx.Provider>;
}

export function useVideo(): Contexte {
  const c = useContext(Ctx);
  if (!c) throw new Error("useVideo doit être utilisé dans <FournisseurVideo>");
  return c;
}
