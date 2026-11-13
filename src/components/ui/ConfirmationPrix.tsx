"use client";

import { useSyncExternalStore } from "react";
import type { AccordPrix } from "@/domaine/accord";
import { Bouton } from "./Bouton";
import { FeuilleBas } from "./FeuilleBas";

/**
 * Feuille « Confirmer » (remplace `window.confirm`) : réservée aux simples questions SANS montant (elle rend `true`).
 * Un montant renvoyé par le serveur avec `CONFIRMATION_REQUISE` est accepté tout de suite par `confirmerPrix`, qui le rend
 * à l'appelant pour qu'il le renvoie au serveur ; aucun montant n'est affiché.
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

// Symboles écrits en code (u20ac = euro, x24 = dollar) : le fichier lui-même ne porte aucun symbole d'argent.
const SYM = "[\\u20ac\\x24]";
const UNITE = "(?:\\u20ac|\\x24|euros?|dollars?|EUR|USD|cents?)";
const MONTANT_DANS_TEXTE = new RegExp(`(?:(?:environ|au plus|jusqu['\u2019]\u00e0|pr\u00e8s de|autour de)\\s+)?(?:${SYM}\\s*\\d[\\d.,]*|\\d[\\d\\s\\u00a0\\u202f.,]*\\s*${UNITE}(?![\\p{L}]))`, "giu");

/** Règle du fondateur : aucun montant à l'écran. Un prix glissé dans un message du serveur est remplacé par « ce coût ». */
export function messageSansMontant(message: string): string {
  return message.replace(MONTANT_DANS_TEXTE, "ce coût").replace(new RegExp(`${SYM}|\\b(?:euros?|dollars?)\\b`, "gi"), "").replace(/\(\s*(?:≈|~)?\s*ce coût\s*\)/g, "").replace(/\s{2,}/g, " ").trim();
}

export function HoteConfirmationPrix() {
  const d = useSyncExternalStore(
    abonner,
    () => courante,
    () => null,
  );
  const fermer = (accord: number | true | null) => {
    if (!d) return;
    publier(null);
    d.resoudre(accord);
  };
  return (
    <FeuilleBas
      ouverte={!!d}
      onOuverteChange={(v) => !v && fermer(null)}
      titre="Confirmer"
      pied={
        <div className="flex flex-col gap-2">
          <Bouton pleineLargeur taille="lg" icone="coche" onClick={() => fermer(d?.montant ?? true)}>
            Confirmer
          </Bouton>
          <Bouton pleineLargeur variante="fantome" onClick={() => fermer(null)}>
            Annuler
          </Bouton>
        </div>
      }
    >
      <div className="flex flex-col items-center gap-3 py-2 text-center">
        {d?.message && <p className="max-w-sm text-sm text-texte-doux">{messageSansMontant(d.message)}</p>}
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
