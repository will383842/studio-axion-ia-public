"use client";

import { useMemo, useState } from "react";
import { Bouton } from "@/components/ui/Bouton";
import { Icone } from "@/components/ui/Icone";
import { LogoReseau } from "@/components/ui/LogoReseau";
import { Pastille } from "@/components/ui/Pastille";
import { SelecteurPastilles } from "@/components/ui/SelecteurPastilles";
import { cn } from "@/lib/cn";
import { boutonEcrireOffert, perimetreCouvre, NB_IDEES_USINE, TAILLES_USINE, TYPES_CONTENU_USINE, type IdeeDuComite, type IdeesDuComite, type IdeeUsine, type MetierUsine } from "@/domaine/usine";
import type { ReseauDeclinaison } from "@/domaine/types";
import { RESEAUX_DECLINAISON } from "@/reseaux/codes";

export interface EtatFiltresUsine {
  metiers: string[];
  tailles: string[];
  reseaux: ReseauDeclinaison[];
}

interface Props {
  filtres: EtatFiltresUsine;
  onFiltres: (f: EtatFiltresUsine) => void;
  metiers: MetierUsine[];
  idees: IdeeUsine[];
  enCours: boolean;
  /** Signature de la carte en cours d'écriture. */
  ecritureEn: string | null;
  erreur: string | null;
  onProposer: () => void;
  onEcrire: (i: IdeeUsine) => void;
  /** Idées déjà jugées par le comité éditorial (réglage `idees.comite`) ; absent ou vide : affichage inchangé. */
  comite?: IdeesDuComite;
}

/** Présentation seule du bloc « Idées de l'usine » (l'état et les appels serveur sont dans BlocIdeesUsine). */
export function VueIdeesUsine({ filtres, onFiltres, metiers, idees, enCours, ecritureEn, erreur, onProposer, onEcrire, comite }: Props) {
  const [recherche, setRecherche] = useState("");
  const retenues = comite?.retenues ?? [];
  const ecartees = comite?.ecartees ?? [];
  // Une idée déjà retenue par le comité n'est pas montrée deux fois.
  const brutes = retenues.length ? idees.filter((i) => !retenues.some((r) => r.signature === i.signature)) : idees;
  // Ce que la dernière réponse de la porte offre encore (inconnu tant qu'elle n'a pas répondu). Elle est filtrée : hors de
  // son périmètre (métiers, tailles choisis), l'absence d'une signature ne prouve rien.
  const offertes = idees.length ? new Set(idees.map((i) => i.signature)) : undefined;
  const carte = (i: IdeeUsine | IdeeDuComite, ecrire = true, jugee = false) => (
    <CarteIdee key={i.signature} idee={i} ecritureEn={ecritureEn} onEcrire={ecrire ? onEcrire : undefined} indisponible={ecrire && jugee && !boutonEcrireOffert(i, offertes, perimetreCouvre(i.parts, filtres))} />
  );
  const visibles = useMemo(() => {
    const q = recherche.trim().toLowerCase();
    return metiers.filter((m) => !q || m.libelle.toLowerCase().includes(q) || m.secteur?.toLowerCase().includes(q));
  }, [metiers, recherche]);

  return (
    <section aria-label="Idées de l'usine" className="space-y-4 rounded-carte border border-trait bg-surface-1 p-4">
      <h2 className="flex items-center gap-2 text-[15px] font-semibold text-texte">
        <Icone nom="eclair" size={18} className="text-ambre" />
        Idées de l&apos;usine
      </h2>

      {retenues.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-texte-doux">Retenues par le comité</h3>
          <ul className="grid grid-cols-1 gap-2 lg:grid-cols-2">{retenues.map((i) => carte(i, true, true))}</ul>
          {ecartees.length > 0 && (
            <details>
              <summary className="cursor-pointer text-sm text-texte-faible">voir les idées écartées</summary>
              <ul className="mt-2 grid grid-cols-1 gap-2 lg:grid-cols-2">{ecartees.map((i) => carte(i, false))}</ul>
            </details>
          )}
        </div>
      )}

      <div className="flex flex-wrap gap-2" role="group" aria-label="Type de contenu">
        {TYPES_CONTENU_USINE.map((t) => (
          <span
            key={t.id}
            aria-disabled={!t.actif}
            className={cn("inline-flex min-h-11 items-center gap-2 rounded-full border px-4 text-sm font-semibold", t.actif ? "border-orange bg-orange text-sur-orange" : "border-trait text-texte-faible opacity-50")}
          >
            {t.libelle}
            {!t.actif && <span className="text-[11px] font-medium">bientôt</span>}
          </span>
        ))}
      </div>

      <SelecteurPastilles
        multiple
        libelle="Taille"
        taille="md"
        valeur={filtres.tailles}
        onChange={(tailles) => onFiltres({ ...filtres, tailles })}
        options={TAILLES_USINE.map((t) => ({ valeur: t.id, libelle: t.libelle }))}
      />

      <div>
        <label htmlFor="usine-metier" className="mb-2 block text-sm font-semibold text-texte-doux">
          Métier
        </label>
        <div className="flex min-h-11 items-center gap-2 rounded-full border border-trait bg-surface-2 px-4 focus-within:border-orange">
          <Icone nom="loupe" size={16} className="shrink-0 text-texte-faible" />
          <input id="usine-metier" value={recherche} onChange={(e) => setRecherche(e.target.value)} placeholder="Chercher" className="min-w-0 flex-1 bg-transparent text-[16px] text-texte outline-none placeholder:text-texte-faible" />
        </div>
        {metiers.length > 0 && (
          <div className="sans-barre mt-2 flex max-h-28 flex-wrap gap-1.5 overflow-y-auto">
            {visibles.map((m) => {
              const actif = filtres.metiers.includes(m.code);
              return (
                <button
                  key={m.code}
                  type="button"
                  aria-pressed={actif}
                  onClick={() => onFiltres({ ...filtres, metiers: actif ? filtres.metiers.filter((x) => x !== m.code) : [...filtres.metiers, m.code] })}
                  className={cn("min-h-9 rounded-full border px-3 text-[13px] font-semibold transition-colors", actif ? "border-orange bg-orange text-sur-orange" : "border-trait bg-surface-1 text-texte hover:border-trait-fort")}
                >
                  {m.libelle}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <SelecteurPastilles
        multiple
        minimum={1}
        libelle="Réseaux"
        valeur={filtres.reseaux}
        onChange={(reseaux) => onFiltres({ ...filtres, reseaux })}
        options={RESEAUX_DECLINAISON.map((r) => ({ valeur: r, libelle: <LogoReseau reseau={r} taille="sm" />, }))}
      />

      <Bouton onClick={onProposer} chargement={enCours} icone="etincelles" pleineLargeur>
        Me proposer {NB_IDEES_USINE} idées
      </Bouton>

      {erreur && (
        <p role="alert" className="rounded-carte bg-brique-doux px-4 py-3 text-sm text-brique">
          {erreur}
        </p>
      )}

      {brutes.length > 0 && <ul className="grid grid-cols-1 gap-2 lg:grid-cols-2">{brutes.map((i) => carte(i))}</ul>}
    </section>
  );
}

/** Une carte d'idée (brute de la porte, ou jugée par le comité : sa raison en plus). Sans `onEcrire` : lecture seule. */
function CarteIdee({ idee: i, ecritureEn, onEcrire, indisponible }: { idee: IdeeUsine | IdeeDuComite; ecritureEn: string | null; onEcrire?: (i: IdeeUsine) => void; indisponible?: boolean }) {
  return (
    <li className="flex flex-col gap-3 rounded-carte border border-trait bg-surface-2 p-4">
      <p className="flex flex-wrap items-center gap-1.5">
        {i.metier && <Pastille ton="orange">{i.metier}</Pastille>}
        {i.taille && <Pastille>{i.taille}</Pastille>}
      </p>
      <p className="text-[15px] font-semibold leading-snug text-texte">{i.douleur}</p>
      {i.casUsage && <p className="text-sm leading-snug text-texte-doux">{i.casUsage}</p>}
      {"raison" in i && i.raison && (
        <p title={i.raison} className="truncate text-xs italic text-texte-faible">
          {i.raison}
        </p>
      )}
      <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-texte-faible">
        {i.format && (
          <span className="inline-flex items-center gap-1">
            <Icone nom="clap" size={14} />
            {i.format}
          </span>
        )}
        {i.fin && (
          <span className="inline-flex items-center gap-1">
            <Icone nom="fleche-droite" size={14} />
            {i.fin}
          </span>
        )}
      </p>
      {onEcrire && indisponible && <p className="mt-auto text-xs font-semibold text-texte-faible">Plus disponible</p>}
      {onEcrire && !indisponible && (
        <Bouton variante="contour" icone="ecrire" chargement={ecritureEn === i.signature} disabled={ecritureEn !== null} onClick={() => onEcrire(i)} className="mt-auto">
          Écrire ce sujet
        </Bouton>
      )}
    </li>
  );
}
