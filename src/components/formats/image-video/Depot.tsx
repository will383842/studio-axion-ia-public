"use client";

/**
 * ÉCRAN 1 · COMMENCER (lot F). Le générateur ne part plus d'une image : un TITRE ou une IDÉE (le studio écrit le script,
 * que Williams relit et modifie avant toute fabrication) ou un SCRIPT collé (dit tel quel, fabriqué directement).
 * Réseaux en pastilles, puis le bouton. Aucun prix n'est affiché. Le code des images internes (montage) reste ailleurs.
 */
import { useState } from "react";
import { CaseACocher } from "@/components/ui/CaseACocher";
import { SelecteurPastilles } from "@/components/ui/SelecteurPastilles";
import { RESEAUX_IV, type ReseauIV } from "@/domaine/image-video/plafonds";
import { DepotScript } from "./DepotScript";
import { DepotTexte } from "./DepotTexte";
import { ENTREE_PAR_DEFAUT, ENTREES_VISIBLES, type EntreeDepot } from "./entrees";
import { RESEAUX_ECRAN_IV } from "./vue";

/** IV-SV : intitulé du choix « sans voix » (identique à `PHRASES_IV.choixSansVoix`, gardé ici : un composant client n'importe pas le service). */
export const LIBELLE_SANS_VOIX_IV = "Sans voix (sous-titres et texte à l'écran)";

export function Depot({
  montants,
  blocage,
  montantsSansVoix,
  blocageSansVoix,
}: {
  /** Prix par nombre de réseaux cochés (centimes d'euro) : transmis au serveur, jamais affichés. */
  montants: Record<number, number>;
  blocage?: string;
  /** IV-SV : prix du mode sans voix (aucune ligne de voix). Absent : le choix « Sans voix » n'est pas proposé. */
  montantsSansVoix?: Record<number, number>;
  /** IV-SV : phrase qui empêche le mode sans voix (format non relié) ; la voix manquante, elle, ne l'empêche pas. */
  blocageSansVoix?: string;
}) {
  const [refus, setRefus] = useState<string | null>(null);
  const [reseaux, setReseaux] = useState<ReseauIV[]>(RESEAUX_ECRAN_IV.map((r) => r.valeur));
  const [mode, setMode] = useState<EntreeDepot>(ENTREE_PAR_DEFAUT);
  /** Le titre ou l'idée tapé reste gardé quand on change d'entrée. */
  const [texteLibre, setTexteLibre] = useState("");
  /** Le script collé aussi. */
  const [scriptColle, setScriptColle] = useState("");
  const [sansVoix, setSansVoix] = useState(false);
  const tarifs = sansVoix && montantsSansVoix ? montantsSansVoix : montants;
  const montant = tarifs[reseaux.length] ?? tarifs[RESEAUX_IV.length] ?? 0;
  const blocageEffectif = sansVoix ? blocageSansVoix : blocage;

  const alerte = refus && (
    <p role="alert" className="rounded-2xl bg-brique-doux px-4 py-3 text-[15px] font-semibold text-brique">
      {refus}
    </p>
  );
  const choixReseaux = (
    <>
      <SelecteurPastilles multiple minimum={1} libelle="Les réseaux" options={RESEAUX_ECRAN_IV.map((r) => ({ valeur: r.valeur, libelle: r.libelle }))} valeur={reseaux} onChange={setReseaux} />
      {montantsSansVoix && <CaseACocher libelle={LIBELLE_SANS_VOIX_IV} detail="Même vidéo, en silence : les sous-titres et le texte à l'écran portent le sens. Aucune voix, aucune musique." coche={sansVoix} onChange={(v) => (setRefus(null), setSansVoix(v))} />}
    </>
  );

  return (
    <section aria-label="Choisir comment commencer" className="space-y-6">
      <SelecteurPastilles libelle="Point de départ" libelleMasque options={ENTREES_VISIBLES} valeur={mode} onChange={(m) => (setRefus(null), setMode(m))} />
      {mode === "script" ? (
        <DepotScript script={scriptColle} onScript={setScriptColle} reseaux={reseaux} montant={montant} blocage={blocageEffectif} sansVoix={sansVoix} onRefus={setRefus}>
          {alerte}
          {choixReseaux}
        </DepotScript>
      ) : (
        <DepotTexte texte={texteLibre} onTexte={setTexteLibre} reseaux={reseaux} montant={montant} blocage={blocageEffectif} sansVoix={sansVoix} onRefus={setRefus}>
          {alerte}
          {choixReseaux}
        </DepotTexte>
      )}
    </section>
  );
}
