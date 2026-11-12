"use client";

import { useState } from "react";
import { preparerAjoutEnLot } from "@/domaine/stock-messages-lot";
import type { MessageStock, PrioriteStock } from "@/domaine/stock-messages";
import { RESEAUX_TAXONOMIE } from "@/domaine/taxonomie-contenu";
import type { IdReseau } from "@/domaine/types";

const NOMS_RESEAUX = {
  linkedin: "LinkedIn", instagram: "Instagram", facebook: "Facebook", tiktok: "TikTok", youtube: "YouTube", "youtube-shorts": "YouTube Shorts",
} as Record<string, string>;
const PRIORITES: { valeur: PrioriteStock; libelle: string }[] = [
  { valeur: "haute", libelle: "Haute" },
  { valeur: "normale", libelle: "Normale" },
  { valeur: "basse", libelle: "Basse" },
];

/**
 * Collez plusieurs messages séparés par une ligne vide (ou une ligne de tirets) : ils sont ajoutés au stock d'un geste.
 * L'enregistrement est confié à `onAjouter` ; les doublons exacts sont signalés et ne sont pas ajoutés.
 */
export function AjoutStockEnLot({ existantes, onAjouter }: { existantes: MessageStock[]; onAjouter: (entrees: MessageStock[]) => Promise<void> }) {
  const [texte, setTexte] = useState("");
  const [reseaux, setReseaux] = useState<IdReseau[]>([]);
  const [priorite, setPriorite] = useState<PrioriteStock>("normale");
  const [message, setMessage] = useState("");
  const [enCours, setEnCours] = useState(false);

  const plan = preparerAjoutEnLot({ texte, reseaux, priorite, existantes, idDe: (i) => `lot-${i}`, creeLe: "" });
  const aperçu = texte.trim() ? plan : null;

  async function ajouter() {
    if (enCours) return;
    const pret = preparerAjoutEnLot({
      texte, reseaux, priorite, existantes,
      idDe: (i) => `stk-lot-${Date.now().toString(36)}-${i}`,
      creeLe: new Date().toISOString(),
    });
    if (pret.erreur) return setMessage(pret.erreur);
    if (pret.aCreer.length === 0) return setMessage("Tous ces messages sont déjà dans votre stock : rien n'a été ajouté.");
    setEnCours(true);
    try {
      await onAjouter(pret.aCreer);
      setTexte("");
      setMessage(`${pret.aCreer.length} message(s) ajouté(s) au stock${pret.doublons.length ? `, ${pret.doublons.length} déjà présent(s) et laissé(s) de côté` : ""}.`);
    } catch {
      setMessage("L'ajout n'a pas abouti. Votre texte est conservé : vous pouvez réessayer.");
    } finally {
      setEnCours(false);
    }
  }

  return (
    <section aria-label="Ajouter plusieurs messages au stock">
      <label>
        Collez vos messages, séparés par une ligne vide (ou une ligne de tirets)
        <textarea value={texte} onChange={(ev) => setTexte(ev.target.value)} rows={10} className="block w-full" />
      </label>
      <fieldset className="mt-3">
        <legend>Réseaux par défaut (modifiables ensuite)</legend>
        {RESEAUX_TAXONOMIE.map((r) => (
          <label key={r} className="mr-3">
            <input type="checkbox" checked={reseaux.includes(r)} onChange={(ev) => setReseaux(ev.target.checked ? [...reseaux, r] : reseaux.filter((x) => x !== r))} /> {NOMS_RESEAUX[r] ?? r}
          </label>
        ))}
      </fieldset>
      <label className="mt-3 block">
        Priorité par défaut (modifiable ensuite){" "}
        <select value={priorite} onChange={(ev) => setPriorite(ev.target.value as PrioriteStock)}>
          {PRIORITES.map((p) => (
            <option key={p.valeur} value={p.valeur}>{p.libelle}</option>
          ))}
        </select>
      </label>
      {aperçu && (
        <div className="mt-3" aria-live="polite">
          {aperçu.erreur ? <p>{aperçu.erreur}</p> : <p>{aperçu.aCreer.length} message(s) à ajouter.</p>}
          {aperçu.doublons.length > 0 && (
            <div>
              <p>{aperçu.doublons.length} message(s) déjà dans votre stock ou répété(s) dans ce texte : ils ne seront pas ajoutés.</p>
              <ul>
                {aperçu.doublons.map((d) => (
                  <li key={d.position}>Message {d.position} : « {d.texte.length > 80 ? `${d.texte.slice(0, 80)}…` : d.texte} »</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
      <button type="button" onClick={ajouter} disabled={enCours} className="mt-3">Ajouter au stock</button>
      {message && <p role="status">{message}</p>}
    </section>
  );
}
