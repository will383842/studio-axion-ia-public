"use client";

import Link from "next/link";
import { useState, useSyncExternalStore } from "react";
import { BandeauAnnuler } from "@/components/ui/BandeauAnnuler";
import { Pastille } from "@/components/ui/Pastille";
import { libelleEtat } from "./PastilleStatutPlan";

export interface EntreeAFaire {
  cle: string;
  /** État affiché du calendrier (« a_corriger », « a_valider », « brouillon »…). */
  etat: string;
  titre?: string;
  /** Adresse de la publication. */
  href?: string | null;
}

/** Trie les entrées dans les trois groupes du panneau ; les autres états n'y sont pas. */
export function repartirAFaire<T extends Pick<EntreeAFaire, "etat">>(entrees: readonly T[]): { aCorriger: T[]; aValider: T[]; brouillons: T[] } {
  return {
    aCorriger: entrees.filter((e) => e.etat === "a_corriger"),
    aValider: entrees.filter((e) => e.etat === "a_valider"),
    brouillons: entrees.filter((e) => e.etat === "brouillon"),
  };
}

function Groupe({ titre, etat, entrees }: { titre: string; etat: string; entrees: readonly EntreeAFaire[] }) {
  if (entrees.length === 0) return null;
  const { ton } = libelleEtat(etat);
  return (
    <section data-groupe={etat} className="mb-3">
      <h3 className="mb-1 flex items-center gap-1.5 text-sm font-extrabold text-texte">
        {titre} <Pastille ton={ton}>{entrees.length}</Pastille>
      </h3>
      <ul className="space-y-1">
        {entrees.map((e) => (
          <li key={e.cle}>
            {e.href ? (
              <Link href={e.href} className="flex min-h-11 items-center rounded-[10px] border border-trait bg-surface-1 px-3 text-sm text-texte hover:border-trait-fort">
                {e.titre || "Sans titre"}
              </Link>
            ) : (
              <span className="flex min-h-11 items-center rounded-[10px] border border-trait bg-surface-1 px-3 text-sm text-texte">{e.titre || "Sans titre"}</span>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Panneau « À faire » : À corriger, À valider, Brouillons à compléter. Un clic ouvre la publication. */
export function PanneauAFaire({ entrees }: { entrees: readonly EntreeAFaire[] }) {
  const { aCorriger, aValider, brouillons } = repartirAFaire(entrees);
  const vide = aCorriger.length + aValider.length + brouillons.length === 0;
  return (
    <aside aria-label="À faire" className="mb-4 rounded-carte border border-trait bg-surface-1 p-3">
      <h2 className="mb-2 font-titre text-lg text-texte">À faire</h2>
      {vide ? (
        <p className="text-sm text-texte-doux">Rien à faire pour le moment.</p>
      ) : (
        <>
          <Groupe titre="À corriger" etat="a_corriger" entrees={aCorriger} />
          <Groupe titre="À valider" etat="a_valider" entrees={aValider} />
          <Groupe titre="Brouillons à compléter" etat="brouillon" entrees={brouillons} />
        </>
      )}
    </aside>
  );
}

const CLE_MEMOIRE = "calendrier-depart-ferme";
const ECOUTEURS = new Set<() => void>();

function lireFerme(): boolean {
  try {
    return localStorage.getItem(CLE_MEMOIRE) === "1";
  } catch {
    return false; // mémoire indisponible : le bandeau reste affiché
  }
}
function memoriser(valeur: boolean) {
  try {
    if (valeur) localStorage.setItem(CLE_MEMOIRE, "1");
    else localStorage.removeItem(CLE_MEMOIRE);
  } catch {
    /* sans effet */
  }
  ECOUTEURS.forEach((f) => f());
}
function abonner(f: () => void) {
  ECOUTEURS.add(f);
  return () => void ECOUTEURS.delete(f);
}

/** Bandeau de départ en 3 lignes. Se ferme ; le choix est mémorisé. Fermer ouvre le bandeau « Annuler » (10 secondes). */
export function BandeauDepart() {
  const ferme = useSyncExternalStore(abonner, lireFerme, () => false);
  const [annulable, setAnnulable] = useState(false);
  return (
    <>
      {!ferme && (
        <div role="note" className="mb-3 flex items-start justify-between gap-3 rounded-carte border border-trait bg-surface-1 p-3 text-sm text-texte-doux">
          <ul className="space-y-0.5">
            <li>Le calendrier montre ce qui est prévu, réseau par réseau.</li>
            <li>« À faire » liste ce qui attend votre geste ; « À placer » garde les contenus prêts sans date.</li>
            <li>Réponses aux commentaires : à la main</li>
          </ul>
          <button
            type="button"
            className="min-h-11 shrink-0 rounded-[10px] border border-trait-fort px-3 font-bold text-texte hover:bg-surface-2"
            onClick={() => {
              setAnnulable(true);
              memoriser(true);
            }}
          >
            Compris
          </button>
        </div>
      )}
      {annulable && (
        <BandeauAnnuler
          message="Bandeau fermé."
          onAnnuler={() => {
            setAnnulable(false);
            memoriser(false);
          }}
          onFin={() => setAnnulable(false)}
        />
      )}
    </>
  );
}
