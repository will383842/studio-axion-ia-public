"use client";

import { useState } from "react";
import { Curseur, Icone, SelecteurPastilles } from "@/components/ui";
import type { DonneesApercuImage } from "@/services/B-personnages-bibliotheque";
import { CadreApercu } from "./CadreApercu";

const AUCUN = "aucun";

/** APERÇU EN DIRECT d'une image de vidéo avec les choix de la Bibliothèque appliqués (B.8 #15). */
export function ApercuImageVideo({ donnees }: { donnees: DonneesApercuImage }) {
  const [lutId, setLutId] = useState(donnees.defauts.lutId ?? AUCUN);
  const lut = donnees.luts.find((l) => l.id === lutId) ?? null;
  const [intensite, setIntensite] = useState(lut?.intensite ?? 70);
  const [stId, setStId] = useState(donnees.defauts.sousTitresId ?? AUCUN);
  const [habId, setHabId] = useState(donnees.defauts.habillageId ?? AUCUN);
  const st = donnees.sousTitres.find((s) => s.id === stId)?.valeur ?? null;
  const hab = donnees.habillages.find((h) => h.id === habId)?.valeur ?? null;
  const avant = lut?.avant ?? donnees.luts[0]?.avant ?? null;

  return (
    <section aria-label="Aperçu en direct" className="overflow-hidden rounded-carte border border-trait bg-surface-1">
      <div className="p-3 pb-0 sm:p-4 sm:pb-0">
        <CadreApercu avant={avant} apres={lut ? lut.apres : undefined} intensite={intensite} sousTitres={st} habillage={hab} logo={donnees.logo} />
      </div>
      {/* Colonne bornée (minmax(0,1fr)) : les rangées de pastilles défilent sans élargir la carte. */}
      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 p-4">
        <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-orange-vif">
          <span className="relative flex size-2">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-orange-vif opacity-60" />
            <span className="relative inline-flex size-2 rounded-full bg-orange-vif" />
          </span>
          Aperçu en direct
        </p>
        <SelecteurPastilles
          libelle="Couleurs (LUT)"
          defilement
          options={[{ valeur: AUCUN, libelle: "Aucune" }, ...donnees.luts.map((l) => ({ valeur: l.id, libelle: l.nom }))]}
          valeur={lutId}
          onChange={(v) => {
            setLutId(v);
            const l = donnees.luts.find((x) => x.id === v);
            if (l) setIntensite(l.intensite);
          }}
        />
        {lut && <Curseur libelle="Intensité" valeur={intensite} onChange={setIntensite} unite=" %" />}
        <SelecteurPastilles libelle="Sous-titres" defilement options={[{ valeur: AUCUN, libelle: "Aucun" }, ...donnees.sousTitres.map((s) => ({ valeur: s.id, libelle: s.nom }))]} valeur={stId} onChange={setStId} />
        <SelecteurPastilles libelle="Habillage" defilement options={[{ valeur: AUCUN, libelle: "Aucun" }, ...donnees.habillages.map((h) => ({ valeur: h.id, libelle: h.nom }))]} valeur={habId} onChange={setHabId} />
        <p className="flex items-center gap-1.5 text-xs text-texte-faible">
          <Icone nom="info" size={13} />
          Juste pour voir : rien n&apos;est modifié.
        </p>
      </div>
    </section>
  );
}
