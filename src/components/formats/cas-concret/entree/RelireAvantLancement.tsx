"use client";

/**
 * RELIRE LE SCRIPT VALIDÉ AVANT LE LANCEMENT (brique 3 : cas concret, demande de Will). Le script validé du cas sur
 * l'écran COMMUN `RelireScript` : chaque phrase se touche pour être modifiée (le chiffre tiré d'un fait du cas reste
 * verrouillé), les contrôles tournent en direct (gratuits), puis « Lancer la vidéo » confirme le prix et lance. Une
 * modification devient une NOUVELLE version validée du script, côté serveur, avant le lancement.
 */
import { useMemo } from "react";
import { RelireScript, type ProprietesRelireScript } from "@/components/script/RelireScript";
import { Bouton } from "@/components/ui/Bouton";
import type { AdaptateurFormat } from "@/domaine/relecture-script";
import { lignesDesEcrans } from "@/moteurs/montage-cas-concret/relecture";
import type { VueCas } from "./vue";

export function RelireAvantLancement({
  cas,
  montant,
  controler,
  lancer,
  enregistrerSansLancer,
  onRetour,
}: {
  cas: VueCas;
  /** Prix au plus (centimes), celui de la feuille pour ce choix. */
  montant: number;
  controler: AdaptateurFormat<unknown>["controler"];
  lancer: AdaptateurFormat<unknown>["lancer"];
  /** « Enregistrer sans lancer » : nouvelle version validée du script, sans lancer ni payer. */
  enregistrerSansLancer?: ProprietesRelireScript["enregistrerSansLancer"];
  onRetour: () => void;
}) {
  const lignes = useMemo(() => lignesDesEcrans(cas.script ?? []), [cas.script]);
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Bouton variante="fantome" icone="fleche-gauche" onClick={onRetour}>
          Retour
        </Bouton>
        <h2 className="min-w-0 flex-1 truncate text-lg font-semibold text-texte">Relire le script</h2>
      </div>
      <p className="text-sm text-texte-doux">{cas.titre}. Touchez une phrase pour la modifier.</p>
      <RelireScript lignes={lignes} controler={controler} lancer={lancer} prixCentimes={montant} {...(enregistrerSansLancer ? { enregistrerSansLancer } : {})} />
    </div>
  );
}
