"use client";

import { Bouton } from "@/components/ui/Bouton";
import { BarreEtapesCommune } from "@/components/ui/BarreEtapesCommune";
import { Carte } from "@/components/ui/Carte";
import { EnTeteSection } from "@/components/ui/EnTetePage";
import { EtatVide } from "@/components/ui/EtatVide";
import { PastilleFamille, PastilleReseau, PastilleStatut } from "@/components/ui/PastilleStatut";
import { Squelette } from "@/components/ui/Squelette";
import { FAMILLES_CONTENU, ORDRE_STATUTS_USINE, RESEAUX_PASTILLE, type FamilleContenu, type ReseauPastille } from "@/components/ui/statuts-usine";

const ETAPES = [
  { cle: "sujet", libelle: "Sujet" },
  { cle: "reglages", libelle: "Réglages" },
  { cle: "relecture", libelle: "Relecture" },
  { cle: "fabrication", libelle: "Fabrication" },
];

/** Socle commun de la refonte (R3) : boutons, pastilles, carte à liseré, barre d'étapes, états. */
export function VitrineSocle() {
  return (
    <section className="space-y-6 border-t border-trait pt-6" aria-label="Socle commun">
      <EnTeteSection titre="Socle commun" sousTitre="Un seul orange plein par écran : le bouton principal." />
      <div className="flex flex-wrap items-center gap-2">
        <Bouton variante="principal" icone="plus">
          Principal
        </Bouton>
        <Bouton variante="contour">Contour</Bouton>
        <Bouton variante="secondaire">Secondaire</Bouton>
        <Bouton variante="discret">Discret</Bouton>
        <Bouton variante="danger">Danger</Bouton>
        <Bouton variante="secondaire" disabled>
          Éteint
        </Bouton>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {(Object.keys(FAMILLES_CONTENU) as FamilleContenu[]).map((f) => (
          <PastilleFamille key={f} famille={f} />
        ))}
        {(Object.keys(RESEAUX_PASTILLE) as ReseauPastille[]).map((r) => (
          <PastilleReseau key={r} reseau={r} />
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {ORDRE_STATUTS_USINE.map((s) => (
          <PastilleStatut key={s} statut={s} />
        ))}
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        {(Object.keys(FAMILLES_CONTENU) as FamilleContenu[]).map((f) => (
          <Carte key={f} famille={f} className="space-y-2">
            <PastilleFamille famille={f} />
            <p className="font-extrabold text-texte">Carte de contenu</p>
            <PastilleStatut statut="valider" />
          </Carte>
        ))}
      </div>
      <BarreEtapesCommune etapes={ETAPES} courante={1} />
      <div className="grid gap-3 sm:grid-cols-2">
        <EtatVide compact titre="Rien ici pour l'instant" phrase="Une phrase qui dit quoi faire." />
        <div className="space-y-2">
          <Squelette className="h-4 w-3/4" />
          <Squelette className="h-4 w-1/2" />
        </div>
      </div>
    </section>
  );
}
