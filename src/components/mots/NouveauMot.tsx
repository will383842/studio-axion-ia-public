"use client";

// MG-4 — création d'un mot. Présentation pure : la création réelle est une fonction reçue en propriété.
import { useState, type FormEvent } from "react";
import { Bouton } from "@/components/ui/Bouton";
import { Carte } from "@/components/ui/Carte";
import { Champ } from "@/components/ui/Champ";
import type { ElementCatalogue } from "@/domaine/guide-reseau/cibles-contrat";
import { ChoixCibleMot } from "./ChoixCibleMot";
import { LIBELLES_MOTS as L } from "./tableau-mots-libelles";

/** Identifiant fixe : un seul formulaire « nouveau mot » est affiché à la fois. */
const ID_ERREUR = "nouveau-mot-erreur";

export interface ProprietesNouveauMot {
  catalogue: readonly ElementCatalogue[];
  onCreer: (mot: string, codeCible: string) => void;
  /** Phrase simple venant du parent (refus du site, par exemple). */
  erreur?: string | null;
  enCours?: boolean;
}

export function NouveauMot({
  catalogue,
  onCreer,
  erreur = null,
  enCours = false,
}: ProprietesNouveauMot) {
  const [mot, setMot] = useState("");
  const [cible, setCible] = useState<string | null>(null);
  const [locale, setLocale] = useState<string | null>(null);
  const phrase = locale ?? erreur;
  // Seule l'erreur « mot vide » concerne le champ : les autres phrases parlent de la cible ou du site.
  const motEnErreur = locale === L.nouveau.erreurMotVide;

  const envoyer = (e: FormEvent) => {
    e.preventDefault();
    if (mot.trim() === "") return setLocale(L.nouveau.erreurMotVide);
    if (cible === null) return setLocale(L.nouveau.erreurCibleVide);
    setLocale(null);
    onCreer(mot.trim(), cible);
  };

  return (
    <Carte data-carte="nouveau-mot">
      <form onSubmit={envoyer} className="flex flex-col gap-3" noValidate>
        <h3 className="text-base text-texte">{L.nouveau.titre}</h3>
        <Champ
          name="mot"
          libelle={L.nouveau.libelleMot}
          aide={L.nouveau.aideMot}
          value={mot}
          onChange={(e) => setMot(e.target.value)}
          autoComplete="off"
          aria-invalid={motEnErreur || undefined}
          aria-describedby={motEnErreur ? ID_ERREUR : undefined}
        />
        <ChoixCibleMot
          catalogue={catalogue}
          valeur={cible}
          onChoisir={setCible}
        />
        {phrase !== null && (
          <p
            id={ID_ERREUR}
            role="alert"
            className="text-sm font-semibold text-brique"
          >
            {phrase}
          </p>
        )}
        <div>
          <Bouton type="submit" chargement={enCours}>
            {L.nouveau.creer}
          </Bouton>
        </div>
      </form>
    </Carte>
  );
}
