"use client";

import { useState, useTransition } from "react";
import { creerSerieAction } from "@/app/(studio)/ecrire/actions-series";
import { Icone } from "@/components/ui/Icone";
import { SelecteurPastilles } from "@/components/ui/SelecteurPastilles";
import { notifier } from "@/components/ui/Toast";

const AUCUNE = "";

/**
 * Choix de la série (équipe 7) : « Aucune », une série existante, ou « Nouvelle » (créée et choisie d'un geste).
 * Le numéro d'épisode est attribué par le studio. Servi par l'atelier (nouveau sujet) et par le kit de la vidéo.
 */
export function ChoixSerie({ series, valeur, onChange, detail, desactive }: { series: { id: string; nom: string }[]; valeur?: string; onChange: (serieId: string | undefined) => void; detail?: string; desactive?: boolean }) {
  const [liste, setListe] = useState(series);
  const [nouvelle, setNouvelle] = useState(false);
  const [nom, setNom] = useState("");
  const [enCours, demarrer] = useTransition();

  function creer() {
    demarrer(async () => {
      const r = await creerSerieAction(nom);
      if (!r.ok) {
        notifier.erreur(r.message);
        return;
      }
      setListe((l) => [r.donnees, ...l]);
      setNom("");
      setNouvelle(false);
      onChange(r.donnees.id);
    });
  }

  return (
    <div className="space-y-2">
      <SelecteurPastilles<string>
        libelle="Série"
        defilement
        valeur={valeur ?? AUCUNE}
        onChange={(v) => (desactive ? undefined : onChange(v || undefined))}
        options={[{ valeur: AUCUNE, libelle: "Aucune" }, ...liste.map((s) => ({ valeur: s.id, libelle: s.nom, icone: "calques" as const, detail: s.id === valeur ? detail : undefined }))]}
      />
      {nouvelle ? (
        <form
          className="flex min-h-12 items-center gap-1 rounded-champ border border-orange bg-surface-1 pl-3 pr-1"
          onSubmit={(e) => {
            e.preventDefault();
            creer();
          }}
        >
          <input autoFocus value={nom} onChange={(e) => setNom(e.target.value)} maxLength={40} placeholder="L'IA qui fait gagner 1 h" aria-label="Nom de la série" className="min-w-0 flex-1 bg-transparent text-[15px] text-texte outline-none placeholder:text-texte-faible" />
          <button type="submit" disabled={enCours || nom.trim().length < 2} aria-label="Créer la série" className="grid size-10 place-items-center rounded-full bg-orange text-sur-orange disabled:opacity-40">
            <Icone nom="coche" size={16} />
          </button>
          <button type="button" aria-label="Annuler" onClick={() => setNouvelle(false)} className="grid size-10 place-items-center rounded-full text-texte-faible hover:text-texte">
            <Icone nom="fermer" size={15} />
          </button>
        </form>
      ) : (
        <button type="button" disabled={desactive} onClick={() => setNouvelle(true)} className="inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-orange-vif hover:underline disabled:opacity-40">
          <Icone nom="plus" size={15} />
          Nouvelle série
        </button>
      )}
    </div>
  );
}
