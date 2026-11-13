"use client";

/**
 * Bouton « Décaler » d'une entrée future du calendrier (L4-06). Il ne publie rien et n'appelle aucun fournisseur.
 * Une entrée confiée à l'usine est réaffichée par AReprogrammer (« à renvoyer ») ; une entrée confiée au diffuseur est refusée par l'action.
 * Anti double clic : le bouton se désactive pendant l'envoi et la clé du formulaire reste la même.
 */
import { useRef, useState } from "react";
import { BandeauAnnuler } from "@/components/ui/BandeauAnnuler";
import type { IdReseau } from "@/domaine/types";
import { decalerEntree, type ResultatDecalage } from "@/app/(studio)/calendrier/actions/decaler";
import { AReprogrammer } from "@/components/migration/AReprogrammer";
import type { PostMigration, Reseau } from "@/components/migration/logique";
import type { CreneauPlan } from "@/services/plan-editorial";
import { libelleJour } from "./BarreVue";
import { estVerrouillee, jourLisible, nomReseau, type EntreeCarte, type TypeContenu } from "./CarteEntreeCalendrier";
import { decisionDepot, peutGlisser } from "./GrilleSemaine";

const RESEAUX: readonly Reseau[] = ["instagram", "facebook", "linkedin", "tiktok"];

/** Entrée du plan → ligne affichable par AReprogrammer (le composant migration n'est ni modifié ni dupliqué). */
export function enPost(c: CreneauPlan): PostMigration[] {
  return RESEAUX.flatMap((reseau) => {
    const h = c.heuresParReseau[reseau];
    return h ? [{ id: `${c.id}:${reseau}`, reseau, titre: c.videoId ?? c.visuelId ?? c.id, datePrevue: h, etat: "restant" as const }] : [];
  });
}

export function DecalerEntree({ id, jourActuel }: { id: string; jourActuel: string }) {
  const cle = useRef(crypto.randomUUID());
  const [jour, setJour] = useState(jourActuel);
  const [raison, setRaison] = useState("Report demandé");
  const [enCours, setEnCours] = useState(false);
  const [retour, setRetour] = useState<ResultatDecalage | null>(null);

  async function envoyer() {
    if (enCours) return;
    setEnCours(true);
    try {
      const r = await decalerEntree({ id, nouveauJour: jour, raison, cle: cle.current });
      setRetour(r);
      if (r.ok) cle.current = crypto.randomUUID();
    } finally {
      setEnCours(false);
    }
  }

  const aRenvoyer = retour?.ok === true && retour.donnees.aRenvoyer === true;
  return (
    <form onSubmit={(e) => { e.preventDefault(); void envoyer(); }} aria-label={`Décaler l'entrée ${id}`}>
      <label>Nouveau jour <input type="date" value={jour} onChange={(e) => setJour(e.target.value)} /></label>
      <label>Raison <input type="text" value={raison} onChange={(e) => setRaison(e.target.value)} /></label>
      <button type="submit" disabled={enCours}>Décaler</button>
      {retour?.ok === false && <p role="alert">{retour.message}</p>}
      {retour?.ok === true && <p role="status">Décalée au {retour.donnees.jourVise}.</p>}
      {aRenvoyer && retour.ok && <AReprogrammer posts={enPost(retour.donnees)} />}
    </form>
  );
}

/* ---------- CAL-11c : « Déplacer » au clavier et sur téléphone, panneau « À programmer », contenus liés ---------- */

export const HEURE_PLACEMENT = "09:00";
export const MESSAGE_RIEN_A_PLACER = "Rien à placer. Ajoutez une publication ou importez un fichier.";
const BOUTON = "inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg border border-trait-fort bg-surface-1 px-3 text-sm font-bold text-texte hover:border-orange";

/** Versions des autres réseaux du même média : celles que le fondateur peut choisir de déplacer aussi (jamais imposé). */
export function contenusLies(entree: EntreeCarte, toutes: readonly EntreeCarte[], aujourdhui?: string): EntreeCarte[] {
  if (!entree.mediaId) return [];
  return toutes.filter((e) => e.cle !== entree.cle && e.mediaId === entree.mediaId && e.reseau !== entree.reseau && (aujourdhui === undefined ? e.etat !== "publie" : !estVerrouillee(e, aujourdhui)));
}

/** Contenu de la réserve « À programmer » : prévu pour UN réseau, pas encore de jour. */
export interface ContenuAPlacer {
  id: string;
  reseau: IdReseau;
  type: TypeContenu;
  titre: string;
}

export type DecisionPlacement = { ok: true; jour: string; heure: string; statut: "a_valider" } | { ok: false; message: string };

/** Placer un contenu sur un jour de SON réseau le met à 9 h, « À valider » : il ne part qu'après la validation du fondateur. */
export function deciderPlacement(contenu: ContenuAPlacer, cible: { reseau: IdReseau; jour: string }, aujourdhui: string): DecisionPlacement {
  if (cible.reseau !== contenu.reseau) return { ok: false, message: `Ce contenu est prévu pour ${nomReseau(contenu.reseau)}.` };
  if (!jourLisible(cible.jour) || (jourLisible(aujourdhui) && cible.jour < aujourdhui)) return { ok: false, message: "Ce jour est passé : choisissez un jour à venir." };
  return { ok: true, jour: cible.jour, heure: HEURE_PLACEMENT, statut: "a_valider" };
}

export interface DeplacementPropose {
  entree: EntreeCarte;
  jour: string;
}

/**
 * Bouton « Déplacer » : fait au clavier et sur téléphone tout ce que fait le glisser (même règle : `decisionDepot`).
 * Il PROPOSE les déplacements à l'appelant (`onDeplacer`, qui enregistre par l'action de report) puis montre « Annuler » 10 secondes.
 */
export function BoutonDeplacer({ entree, entrees, aujourdhui, onDeplacer, onAnnuler }: { entree: EntreeCarte; entrees: readonly EntreeCarte[]; aujourdhui: string; onDeplacer: (propositions: DeplacementPropose[]) => void; onAnnuler: (retours: { entree: EntreeCarte; jourAvant: string }[]) => void }) {
  const [ouvert, setOuvert] = useState(false);
  const [jour, setJour] = useState(entree.jour);
  const [aussi, setAussi] = useState<ReadonlySet<string>>(new Set());
  const [message, setMessage] = useState("");
  const [dernier, setDernier] = useState<DeplacementPropose[] | null>(null);
  const liees = contenusLies(entree, entrees, aujourdhui);
  if (!peutGlisser(entree, aujourdhui) && !dernier) return null;

  const confirmer = () => {
    const d = decisionDepot(entree, { reseau: entree.reseau, jour }, aujourdhui);
    if (!d.ok) {
      setMessage(d.message ?? "Choisissez un autre jour.");
      return;
    }
    const propositions: DeplacementPropose[] = [{ entree, jour: d.jour }, ...liees.filter((e) => aussi.has(e.cle) && decisionDepot(e, { reseau: e.reseau, jour: d.jour }, aujourdhui).ok).map((e) => ({ entree: e, jour: d.jour }))];
    onDeplacer(propositions);
    setDernier(propositions);
    setMessage("");
    setOuvert(false);
  };

  return (
    <div data-deplacer={entree.cle}>
      {peutGlisser(entree, aujourdhui) && (
        <button type="button" aria-expanded={ouvert} onClick={() => setOuvert((o) => !o)} className={BOUTON}>
          Déplacer
        </button>
      )}
      {ouvert && (
        <div role="group" aria-label={`Déplacer la publication ${nomReseau(entree.reseau)} du ${libelleJour(entree.jour)}`} onKeyDown={(e) => e.key === "Escape" && setOuvert(false)} className="mt-2 flex flex-col gap-2 rounded-xl border border-dashed border-trait-fort bg-surface-1 p-3">
          <label className="flex flex-col gap-1 text-sm text-texte">
            Nouveau jour
            <input type="date" value={jour} min={aujourdhui} onChange={(e) => setJour(e.target.value)} className="min-h-[44px] rounded-lg border border-trait-fort bg-fond px-2" />
          </label>
          {liees.length > 0 && (
            <fieldset className="flex flex-col gap-1 text-sm text-texte">
              <legend className="font-bold">Déplacer aussi ses versions sur les autres réseaux (facultatif)</legend>
              {liees.map((e) => (
                <label key={e.cle} className="flex min-h-[44px] items-center gap-2">
                  <input
                    type="checkbox"
                    checked={aussi.has(e.cle)}
                    onChange={(ev) => setAussi((prev) => { const n = new Set(prev); if (ev.target.checked) n.add(e.cle); else n.delete(e.cle); return n; })}
                    className="size-5"
                  />
                  {nomReseau(e.reseau)}, {libelleJour(e.jour)}
                </label>
              ))}
            </fieldset>
          )}
          {message && <p role="alert" className="text-sm text-texte">{message}</p>}
          <div className="flex gap-2">
            <button type="button" onClick={confirmer} className={BOUTON}>
              Déplacer ici
            </button>
            <button type="button" onClick={() => setOuvert(false)} className={BOUTON}>
              Fermer
            </button>
          </div>
        </div>
      )}
      {dernier && (
        <BandeauAnnuler
          message={`Déplacée au ${libelleJour(dernier[0].jour)}${dernier.length > 1 ? `, avec ${dernier.length - 1} autre${dernier.length > 2 ? "s" : ""} version${dernier.length > 2 ? "s" : ""}` : ""}.`}
          onAnnuler={() => {
            onAnnuler(dernier.map((p) => ({ entree: p.entree, jourAvant: p.entree.jour })));
            setDernier(null);
          }}
          onFin={() => setDernier(null)}
        />
      )}
    </div>
  );
}

/**
 * Panneau « À programmer » : les contenus prévus pour un réseau, sans jour. « Placer » (clavier et téléphone) les met à 9 h, « À valider »,
 * avec « Annuler » 10 secondes ; aucun départ sans la validation du fondateur.
 */
export function PanneauAProgrammer({ contenus, aujourdhui, onPlacer, onAnnulerPlacement }: { contenus: readonly ContenuAPlacer[]; aujourdhui: string; onPlacer: (contenu: ContenuAPlacer, jour: string) => void; onAnnulerPlacement?: (contenu: ContenuAPlacer) => void }) {
  const [jours, setJours] = useState<Readonly<Record<string, string>>>({});
  const [message, setMessage] = useState("");
  const [dernier, setDernier] = useState<ContenuAPlacer | null>(null);
  return (
    <section aria-label="À programmer" data-a-programmer className="rounded-xl border border-trait bg-surface-1 p-3">
      <h3 className="mb-2 text-sm font-extrabold text-texte">À programmer</h3>
      {contenus.length === 0 ? (
        <p className="text-sm text-texte-doux">{MESSAGE_RIEN_A_PLACER}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {contenus.map((c) => {
            const jour = jours[c.id] ?? aujourdhui;
            return (
              <li key={c.id} className="flex flex-wrap items-center gap-2 text-sm text-texte">
                <span className="min-w-0 flex-1">
                  {nomReseau(c.reseau)} · {c.titre}
                </span>
                <input type="date" aria-label={`Jour pour ${c.titre}`} value={jour} min={aujourdhui} onChange={(e) => setJours((j) => ({ ...j, [c.id]: e.target.value }))} className="min-h-[44px] rounded-lg border border-trait-fort bg-fond px-2" />
                <button
                  type="button"
                  className={BOUTON}
                  onClick={() => {
                    const d = deciderPlacement(c, { reseau: c.reseau, jour }, aujourdhui);
                    if (!d.ok) return setMessage(d.message);
                    setMessage("");
                    onPlacer(c, d.jour);
                    setDernier(c);
                  }}
                >
                  Placer
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <p className="mt-2 text-xs text-texte-doux">Elle ne partira qu&apos;après votre validation.</p>
      {message && <p role="alert" className="mt-1 text-sm text-texte">{message}</p>}
      {dernier && (
        <BandeauAnnuler
          message={`Placée à ${HEURE_PLACEMENT}, à valider. Elle ne partira qu'après votre validation.`}
          onAnnuler={() => {
            onAnnulerPlacement?.(dernier);
            setDernier(null);
          }}
          onFin={() => setDernier(null)}
        />
      )}
    </section>
  );
}
