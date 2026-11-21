"use client";

import Link from "next/link";
import { Carte } from "@/components/ui/Carte";
import { Pastille } from "@/components/ui/Pastille";
import type { Tonalite } from "@/domaine/libelles";
import type { EtatRole } from "@/moteurs/montage-tutoriel-outil/journal-roles";
import { lienDeSuivi, messageDePause, vueRoles, type LigneRole } from "@/moteurs/montage-tutoriel-outil/vue-roles";
import { useTravaux } from "@/hooks/useTravaux";
import type { VueTravail } from "@/services/vues";

const MOT: Record<EtatRole, { mot: string; ton: Tonalite }> = {
  "a-venir": { mot: "À venir", ton: "neutre" },
  "en-cours": { mot: "Au travail", ton: "orange" },
  "attend-williams": { mot: "À vous de jouer", ton: "ambre" },
  fait: { mot: "Terminé", ton: "sauge" },
  "a-revoir": { mot: "À revoir", ton: "brique" },
  saute: { mot: "Pas nécessaire", ton: "contour" },
};

/** La liste des 10 rôles (présentation pure : testable sans navigateur). */
export function ListeRoles({ lignes, lienValidation }: { lignes: LigneRole[]; lienValidation?: string }) {
  return (
    <ul className="space-y-2" aria-label="Votre équipe, rôle par rôle">
      {lignes.map((l) => (
        <li key={l.role}>
          <Carte className="flex flex-wrap items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-texte">{l.libelle}</p>
              <p className="text-[15px] text-texte-doux">{l.phrase}</p>
              {l.detail && <p className="mt-1 text-sm text-texte-doux">{l.detail}</p>}
            </div>
            <Pastille ton={MOT[l.etat].ton} point={l.etat === "en-cours"}>
              {MOT[l.etat].mot}
            </Pastille>
            {l.attendWilliams && lienValidation && (
              <Link href={lienValidation} className="inline-flex min-h-11 items-center rounded-full border border-trait-fort px-4 text-sm font-semibold text-texte hover:bg-surface-2">
                Voir et valider
              </Link>
            )}
          </Carte>
        </li>
      ))}
    </ul>
  );
}

/** Le message de la pause en cours, tel que le moteur l'a écrit, avec « Voir et valider » quand c'est à Williams de jouer. */
export function MessagePause({ message, lienValidation }: { message: string; lienValidation?: string }) {
  return (
    <Carte className="flex flex-wrap items-center gap-3" role="status">
      <p className="min-w-0 flex-1 text-[15px] text-texte">{message}</p>
      {lienValidation && (
        <Link href={lienValidation} className="inline-flex min-h-11 items-center rounded-full border border-trait-fort px-4 text-sm font-semibold text-texte hover:bg-surface-2">
          Voir et valider
        </Link>
      )}
    </Carte>
  );
}

/** Le suivi rôle par rôle, rafraîchi tant que le travail avance. Le lien « Voir et valider » se calcule ici, sur le travail courant : il change avec la pause. */
export function SuiviRoles({ initial, videoId }: { initial: VueTravail; videoId: string }) {
  const { travail } = useTravaux({ travailId: initial.id, initial: [initial] });
  const t = travail ?? initial;
  const lignes = vueRoles(t);
  const lien = lienDeSuivi(t, videoId);
  const brut = messageDePause(t);
  // Le message déjà lu sur une ligne (code inconnu, TO_CAS_V2) n'est pas répété dans le bandeau.
  const message = brut && !lignes.some((l) => l.phrase === brut) ? brut : null;
  // Un seul « Voir et valider » : le bandeau n'en porte pas quand une ligne qui attend Williams l'affiche déjà.
  const lienBandeau = lignes.some((l) => l.attendWilliams) ? undefined : lien;
  return (
    <div className="space-y-3">
      {message && <MessagePause message={message} lienValidation={lienBandeau} />}
      <ListeRoles lignes={lignes} lienValidation={lien} />
    </div>
  );
}
