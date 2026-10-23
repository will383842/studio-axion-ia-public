"use client";

import { FeuillePartager } from "@/components/partage/FeuillePartager";
import { BarreActionCollee } from "@/components/ui/BarreActionCollee";
import { Bouton, BoutonIcone } from "@/components/ui/Bouton";
import { notifier } from "@/components/ui/Toast";
import { useVideo } from "./ContexteVideo";
import { FeuilleEnvoyerBuffer } from "./FeuilleEnvoyerBuffer";
import { FeuilleTelecharger } from "./FeuilleTelecharger";

/**
 * « Publier » touché avant la fin des vérifications : ouvre l'onglet Publier (Radix l'active au focus), descend jusqu'à
 * « Avant de publier » et dit ce qu'il reste à faire.
 */
export function allerAuxVerifications(nbCochees: number, total: number) {
  const onglet = document.querySelector<HTMLElement>('[role="tab"][id$="-trigger-publier"]');
  onglet?.focus();
  window.setTimeout(() => document.getElementById("avant-publier")?.scrollIntoView({ behavior: "smooth", block: "center" }), 60);
  notifier.info(`Cochez d'abord ce que vous avez vérifié (${nbCochees}/${total}).`);
}

/**
 * Actions de la fiche d'une vidéo prête, collées en bas sur mobile :
 * Télécharger · Lien privé · PUBLIER (actif quand « Avant de publier » est complet).
 * Porte aussi les trois feuilles (Télécharger, Partager, Buffer).
 */
/** `libellePublier` (plan facecam v4, lot D, facultatif) : « Valider et publier » sur « Votre vidéo » ; absent : « Publier ». */
/** `avecOngletPublier` : la fiche porte l'onglet Publier ; sinon le bouton « Publier » n'aurait nulle part où mener et n'est pas montré. */
export function BarreActionsVideo({ libellePublier = "Publier", avecOngletPublier = true }: { libellePublier?: string; avecOngletPublier?: boolean } = {}) {
  const { ouvrir, publiable, nbCochees, kit, casesRequises } = useVideo();
  return (
    <>
      <BarreActionCollee
        secondaire={
          <>
            <BoutonIcone icone="telecharger" libelle="Télécharger" variante="secondaire" taille="lg" onClick={() => ouvrir("telecharger")} />
            <BoutonIcone icone="lien" libelle="Lien privé" variante="secondaire" taille="lg" onClick={() => ouvrir("partager")} />
          </>
        }
      >
        {/* Navigation (03/10) : tant que les vérifications manquent, le bouton n'est plus muet : il mène aux cases à cocher. */}
        {avecOngletPublier && (
          <Bouton taille="lg" icone="envoyer" essai={kit?.envoiSimule} variante={publiable ? "principal" : "secondaire"} onClick={() => (publiable ? ouvrir("buffer") : allerAuxVerifications(nbCochees, casesRequises.length))}>
            {publiable ? libellePublier : `${libellePublier} · ${nbCochees}/${casesRequises.length}`}
          </Bouton>
        )}
      </BarreActionCollee>
      <FeuilleTelecharger />
      <FeuillePartager />
      <FeuilleEnvoyerBuffer />
    </>
  );
}
