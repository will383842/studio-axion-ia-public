"use client";

import { useSyncExternalStore } from "react";
import type { AccordPrix } from "@/domaine/accord";
import { formaterMontant } from "@/lib/montants";
import { Bouton } from "./Bouton";
import { FeuilleBas } from "./FeuilleBas";
import { Icone } from "./Icone";

/**
 * Feuille « Confirmer » (remplace `window.confirm`) : réservée aux simples questions SANS montant (elle rend `true`).
 * Un montant renvoyé par le serveur avec `CONFIRMATION_REQUISE` est accepté tout de suite par `confirmerPrix`, qui le rend
 * à l'appelant pour qu'il le renvoie au serveur ; le prix reste affiché ailleurs à titre d'information.
 * À placer une fois (layout racine) : `<HoteConfirmationPrix />`.
 */
interface Demande {
  message: string;
  montant?: number;
  resoudre: (accord: Exclude<AccordPrix, false | undefined> | null) => void;
}

let courante: Demande | null = null;
const abonnes = new Set<() => void>();

function publier(d: Demande | null) {
  courante = d;
  for (const f of abonnes) f();
}

function abonner(f: () => void) {
  abonnes.add(f);
  return () => void abonnes.delete(f);
}

/**
 * Règle du 25/10/2026 : le prix ne bloque jamais et personne ne le valide à la main. Un montant connu est rendu tout de
 * suite (accepté), sans ouvrir la feuille. Sans montant, la feuille s'ouvre ; elle rend `true`, ou `null` si Will renonce.
 */
export function confirmerPrix(r: { message: string; montant?: number }): Promise<number | true | null> {
  if (typeof r.montant === "number" && Number.isFinite(r.montant)) return Promise.resolve(r.montant);
  return new Promise((resoudre) => {
    courante?.resoudre(null);
    publier({ message: r.message, montant: typeof r.montant === "number" && Number.isFinite(r.montant) ? r.montant : undefined, resoudre });
  });
}

export function HoteConfirmationPrix() {
  const d = useSyncExternalStore(
    abonner,
    () => courante,
    () => null,
  );
  const prix = d?.montant !== undefined ? formaterMontant({ centimes: d.montant, devise: "EUR" }) : null;
  const fermer = (accord: number | true | null) => {
    if (!d) return;
    publier(null);
    d.resoudre(accord);
  };
  return (
    <FeuilleBas
      ouverte={!!d}
      onOuverteChange={(v) => !v && fermer(null)}
      titre={prix ? "Confirmer ce prix" : "Confirmer"}
      pied={
        <div className="flex flex-col gap-2">
          <Bouton pleineLargeur taille="lg" icone="coche" onClick={() => fermer(d?.montant ?? true)}>
            {prix ? `Confirmer ${prix}` : "Confirmer"}
          </Bouton>
          <Bouton pleineLargeur variante="fantome" onClick={() => fermer(null)}>
            Annuler
          </Bouton>
        </div>
      }
    >
      <div className="flex flex-col items-center gap-3 py-2 text-center">
        {prix && (
          <>
            <span className="grid size-12 place-items-center rounded-2xl bg-orange-doux text-orange-vif">
              <Icone nom="euro" size={22} />
            </span>
            <span className="text-xs font-bold uppercase tracking-wider text-texte-faible">Au plus</span>
            <span className="font-titre text-4xl tabular-nums leading-none text-texte">{prix}</span>
          </>
        )}
        {d?.message && <p className="max-w-sm text-sm text-texte-doux">{d.message}</p>}
      </div>
    </FeuilleBas>
  );
}

type ResultatAction = { ok: true } | { ok: false; code?: string; message: string; montant?: number };

/**
 * Relance une action tant que le serveur demande l'accord d'un prix : la feuille montre chaque fois le prix du jour, et
 * le montant confirmé repart avec la relance (3 fois au plus). Will renonce : le premier refus est rendu tel quel.
 */
export async function avecConfirmationPrix<R extends ResultatAction>(r: R, relancer: (accord: number | true) => Promise<R>): Promise<R> {
  for (let i = 0; i < 3 && !r.ok && r.code === "CONFIRMATION_REQUISE"; i++) {
    const accord = await confirmerPrix(r);
    if (accord === null) return r;
    r = await relancer(accord);
  }
  return r;
}
