"use client";

import { etatDe, reseauxDe, type MessageStock } from "@/domaine/stock-messages";
import type { IdReseau } from "@/domaine/types";
import { LIBELLES_CALENDRIER } from "./EnTeteCalendrier";

/** Ce que le calendrier reçoit pour ouvrir le formulaire d'ajout déjà rempli. Rien n'est enregistré ici. */
export interface DemandeAjoutTexte {
  texteId: string;
  texte: string;
  /** AAAA-MM-JJ. */
  jour: string;
  /** Absent : le réseau reste à choisir dans le formulaire. */
  reseau?: IdReseau;
}

export interface CaseDepot {
  jour: string;
  reseau: IdReseau;
}

export const MESSAGE_JOUR_PASSE = "Ce jour est passé : choisissez un jour à venir.";

/** Le texte reste dans « Mes textes » tant qu'il n'est pas planifié ni publié (le passage d'état se fait à la validation de la publication). */
export function textesAPlacer(textes: readonly MessageStock[]): MessageStock[] {
  return textes.filter((m) => !m.archiveLe && etatDe(m) === "en-stock");
}

/** Clic (ou toucher sur téléphone) : ajout daté d'aujourd'hui avec ce texte. */
export function demandeDepuisClic(m: MessageStock, aujourdhui: string): DemandeAjoutTexte {
  return { texteId: m.id, texte: m.texte, jour: aujourdhui, reseau: reseauxDe(m)[0] };
}

/** Dépôt sur une case : ce texte, la date et le réseau de la case. Un jour passé est refusé. */
export function demandeDepuisDepot(m: MessageStock, cible: CaseDepot, aujourdhui: string): { ok: true; demande: DemandeAjoutTexte } | { ok: false; message: string } {
  if (cible.jour < aujourdhui) return { ok: false, message: MESSAGE_JOUR_PASSE };
  return { ok: true, demande: { texteId: m.id, texte: m.texte, jour: cible.jour, reseau: cible.reseau } };
}

/** Un geste = un texte saisi, au plus un dépôt. Un geste annulé ou refusé n'ouvre rien. */
export class GesteTexte {
  private saisi: MessageStock | null = null;
  constructor(private readonly aujourdhui: string, private readonly onAjouter: (d: DemandeAjoutTexte) => void) {}
  saisir(m: MessageStock) { this.saisi = m; }
  annuler() { this.saisi = null; }
  lacher(cible: CaseDepot): { ok: true } | { ok: false; message: string } {
    const m = this.saisi;
    this.saisi = null;
    if (!m) return { ok: false, message: "Aucun texte saisi." };
    const r = demandeDepuisDepot(m, cible, this.aujourdhui);
    if (!r.ok) return r;
    this.onAjouter(r.demande);
    return { ok: true };
  }
}

/** Format de transport du glisser : l'identifiant du texte seulement. Les cases du calendrier le lisent au dépôt. */
export const TYPE_GLISSER_TEXTE = "application/x-axion-texte";

/**
 * Panneau « Mes textes » : chaque texte se glisse sur un jour, ou se touche (le clic remplace le glisser sur téléphone).
 * Le panneau ne modifie jamais la liste ; rien d'affiché quand elle est vide.
 */
export function PanneauMesTextes({ textes, aujourdhui, onAjouter }: { textes: readonly MessageStock[]; aujourdhui: string; onAjouter: (d: DemandeAjoutTexte) => void }) {
  const liste = textesAPlacer(textes);
  if (liste.length === 0) return null;
  return (
    <section aria-label={LIBELLES_CALENDRIER.mesTextes} className="mt-6">
      <h2 className="text-base font-semibold text-texte">{LIBELLES_CALENDRIER.mesTextes}</h2>
      <p className="mt-1 text-sm text-texte-doux">Touchez un texte, ou glissez-le sur un jour.</p>
      <ul className="mt-3 flex flex-col gap-2">
        {liste.map((m) => (
          <li
            key={m.id}
            draggable
            onDragStart={(ev) => {
              ev.dataTransfer.setData(TYPE_GLISSER_TEXTE, m.id);
              ev.dataTransfer.effectAllowed = "copy";
            }}
          >
            <button
              type="button"
              onClick={() => onAjouter(demandeDepuisClic(m, aujourdhui))}
              className="min-h-11 w-full rounded-xl border border-trait bg-surface-1 px-3 py-2 text-left text-sm text-texte hover:border-trait-fort"
            >
              <span className="line-clamp-3">{m.texte}</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
