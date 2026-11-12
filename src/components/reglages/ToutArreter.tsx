"use client";

import { useState, useTransition } from "react";
import type { ServicesZernio } from "@/app/(studio)/reglages/actions-zernio";
import { Bouton } from "@/components/ui/Bouton";
import { Dialogue } from "@/components/ui/Dialogue";
import { notifier } from "@/components/ui/Toast";

export interface GestesArret {
  /** Le bouton « Tout arrêter » : ouvre la fenêtre, n'arrête RIEN. */
  demander(): void;
  /** Le bouton de la fenêtre : coupe l'interrupteur local du Studio (jamais Zernio). */
  confirmer(): Promise<boolean>;
  /** Reprise en un geste, sans fenêtre. */
  reprendre(): Promise<boolean>;
  annuler(): void;
}

/**
 * Les gestes de l'arrêt d'urgence, séparés de l'affichage pour être vérifiés sans navigateur :
 * demander ≠ confirmer. Seul `confirmer` coupe ; seul `reprendre` rétablit.
 */
export function creerGestesArret(
  services: Pick<ServicesZernio, "arreter" | "reprendre">,
  appui: { ouvrir(): void; fermer(): void; apres(): void; erreur(message: string): void; succes(message: string): void },
): GestesArret {
  return {
    demander: () => appui.ouvrir(),
    annuler: () => appui.fermer(),
    async confirmer() {
      const r = await services.arreter();
      appui.fermer();
      if (!r.ok) {
        appui.erreur(r.message);
        return false;
      }
      appui.succes("Tout est à l’arrêt.");
      appui.apres();
      return true;
    },
    async reprendre() {
      const r = await services.reprendre();
      if (!r.ok) {
        appui.erreur(r.message);
        return false;
      }
      appui.succes("Les envois reprennent.");
      appui.apres();
      return true;
    },
  };
}

/**
 * Carte « Arrêt d’urgence » : toujours rendue, quel que soit l'état de l'écran (normal, vide, chargement, erreur).
 * Elle ne dépend d'aucune réponse de Zernio : l'arrêt agit sur un interrupteur local et ne supprime rien.
 */
export function ToutArreter({ services, arretActif, erreur = false, onChange }: { services: Pick<ServicesZernio, "arreter" | "reprendre">; arretActif: boolean; erreur?: boolean; onChange?: () => void }) {
  const [ouvert, setOuvert] = useState(false);
  const [enCours, demarrer] = useTransition();
  const gestes = creerGestesArret(services, {
    ouvrir: () => setOuvert(true),
    fermer: () => setOuvert(false),
    apres: () => onChange?.(),
    erreur: (m) => notifier.erreur(m),
    succes: (m) => notifier.succes(m),
  });

  return (
    <section aria-labelledby="arret-titre" data-carte="arret" className="rounded-carte border border-brique/30 bg-brique-doux/40 p-4 sm:p-5">
      <h2 id="arret-titre" className="text-lg text-texte">
        Arrêt d’urgence
      </h2>
      <p className="mt-1 text-sm text-texte-doux">Bloque seulement les envois vers le nouvel outil : créer un brouillon, programmer, promouvoir. Ce qui est déjà programmé dans le nouvel outil y reste. L’ancien outil n’est pas touché et rien n’est supprimé. Tout se reprend en un geste.</p>
      {erreur && <p className="mt-1 text-sm text-texte-doux">Toujours disponible, même quand le nouvel outil ne répond pas.</p>}
      <div className="mt-3">
        {arretActif ? (
          <>
            <p className="mb-2 text-sm font-semibold text-brique">Tout est à l’arrêt.</p>
            <Bouton taille="lg" pleineLargeur icone="lecture" chargement={enCours} onClick={() => demarrer(async () => void (await gestes.reprendre()))}>
              Tout reprendre
            </Bouton>
          </>
        ) : (
          <Bouton variante="danger" taille="lg" pleineLargeur icone="alerte" onClick={gestes.demander}>
            Tout arrêter
          </Bouton>
        )}
      </div>
      <Dialogue
        ouvert={ouvert}
        onOuvertChange={setOuvert}
        titre="Tout arrêter ?"
        description="Rien n’est supprimé. Vous reprenez quand vous voulez, en un geste."
        pied={
          <div className="flex flex-col gap-2">
            <Bouton variante="danger" taille="lg" pleineLargeur chargement={enCours} onClick={() => demarrer(async () => void (await gestes.confirmer()))}>
              Oui, tout arrêter
            </Bouton>
            <Bouton variante="secondaire" pleineLargeur onClick={gestes.annuler}>
              Non, continuer
            </Bouton>
          </div>
        }
      />
    </section>
  );
}
