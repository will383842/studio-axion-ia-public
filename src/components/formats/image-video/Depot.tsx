"use client";

/**
 * ÉCRAN 1 · COMMENCER (lot F). Le générateur ne part plus d'une image : un TITRE ou une IDÉE (le studio écrit le script,
 * que Williams relit et modifie avant toute fabrication) ou un SCRIPT collé (dit tel quel, fabriqué directement).
 * Réseaux en pastilles, puis le bouton. Aucun prix n'est affiché. Le code des images internes (montage) reste ailleurs.
 */
import { useState } from "react";
import { SelecteurPastilles } from "@/components/ui/SelecteurPastilles";
import { RESEAUX_IV, type ReseauIV } from "@/domaine/image-video/plafonds";
import { DepotScript } from "./DepotScript";
import { DepotTexte } from "./DepotTexte";
import { ENTREE_PAR_DEFAUT, ENTREES_VISIBLES, type EntreeDepot } from "./entrees";
import { RESEAUX_ECRAN_IV } from "./vue";

export function Depot({ montants, blocage }: { /** Prix par nombre de réseaux cochés (centimes d'euro) : transmis au serveur, jamais affichés. */ montants: Record<number, number>; blocage?: string }) {
  const [refus, setRefus] = useState<string | null>(null);
  const [reseaux, setReseaux] = useState<ReseauIV[]>(RESEAUX_ECRAN_IV.map((r) => r.valeur));
  const [mode, setMode] = useState<EntreeDepot>(ENTREE_PAR_DEFAUT);
  /** Le titre ou l'idée tapé reste gardé quand on change d'entrée. */
  const [texteLibre, setTexteLibre] = useState("");
  /** Le script collé aussi. */
  const [scriptColle, setScriptColle] = useState("");
  const montant = montants[reseaux.length] ?? montants[RESEAUX_IV.length] ?? 0;

  const alerte = refus && (
    <p role="alert" className="rounded-2xl bg-brique-doux px-4 py-3 text-[15px] font-semibold text-brique">
      {refus}
    </p>
  );
  const choixReseaux = <SelecteurPastilles multiple minimum={1} libelle="Les réseaux" options={RESEAUX_ECRAN_IV.map((r) => ({ valeur: r.valeur, libelle: r.libelle }))} valeur={reseaux} onChange={setReseaux} />;

  return (
    <section aria-label="Choisir comment commencer" className="space-y-6">
      <SelecteurPastilles libelle="Point de départ" libelleMasque options={ENTREES_VISIBLES} valeur={mode} onChange={(m) => (setRefus(null), setMode(m))} />
      {mode === "script" ? (
        <DepotScript script={scriptColle} onScript={setScriptColle} reseaux={reseaux} montant={montant} blocage={blocage} onRefus={setRefus}>
          {alerte}
          {choixReseaux}
        </DepotScript>
      ) : (
        <DepotTexte texte={texteLibre} onTexte={setTexteLibre} reseaux={reseaux} montant={montant} blocage={blocage} onRefus={setRefus}>
          {alerte}
          {choixReseaux}
        </DepotTexte>
      )}
    </section>
  );
}
