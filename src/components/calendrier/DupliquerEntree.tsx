"use client";

/**
 * CAL-24 : bouton « Dupliquer » d'une publication (autre réseau ou autre jour) et lien « Voir sur le réseau ».
 * Rien ne part d'ici : la copie naît en attente, son texte est marqué « À adapter », et elle attend votre validation.
 * Anti double clic : le bouton se désactive pendant l'envoi et la clé du formulaire reste la même jusqu'au succès.
 */
import { useState } from "react";
import { dupliquerEntree, type ResultatDuplication } from "@/app/(studio)/calendrier/actions/dupliquer";
import { LIBELLE_VOIR_SUR_RESEAU, lienVoirSurReseau } from "@/domaine/calendrier/lien-reseau";
import type { IdReseau } from "@/domaine/types";
import { RESEAUX } from "@/reseaux";

const BOUTON = "inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-[10px] border border-trait-fort bg-surface-2 px-3 py-1.5 text-sm font-bold text-texte hover:bg-surface-3 disabled:opacity-60";
const CHAMP = "mt-1 block min-h-[44px] w-full rounded-[10px] border border-trait-fort bg-surface-1 px-3 text-sm text-texte";

export const PHRASE_DUPLIQUER = "La copie est une nouvelle publication, en attente. Son texte est marqué « À adapter » : relisez-le, puis validez-la. Elle ne part pas toute seule, et l'original ne change pas.";

/** « Voir sur le réseau » : seulement pour une publication publiée dont l'adresse est connue ; sinon rien n'est affiché. */
export function VoirSurLeReseau({ statut, urlPubliee }: { statut?: string; urlPubliee?: string | null }) {
  const lien = lienVoirSurReseau({ statut, urlPubliee });
  if (!lien) return null;
  return (
    <a href={lien} target="_blank" rel="noopener noreferrer" className={BOUTON}>
      {LIBELLE_VOIR_SUR_RESEAU}
    </a>
  );
}

export function DupliquerEntree({ cle, reseau, jour }: { cle: string; reseau: IdReseau; jour: string }) {
  const [cleFormulaire, setCleFormulaire] = useState(() => crypto.randomUUID());
  const [ouvert, setOuvert] = useState(false);
  const [reseauVise, setReseauVise] = useState<IdReseau>(reseau);
  const [jourVise, setJourVise] = useState(jour);
  const [enCours, setEnCours] = useState(false);
  const [retour, setRetour] = useState<ResultatDuplication | null>(null);
  /** Ce que la personne a déjà confirmé d'un clic (date passée, proximité) : jamais plus, pour qu'un autre avertissement s'affiche. */
  const [accord, setAccord] = useState<{ passe?: true; proximite?: true }>({});

  async function envoyer(accordDonne: { passe?: true; proximite?: true }) {
    if (enCours) return;
    setEnCours(true);
    try {
      const r = await dupliquerEntree({ cle, reseau: reseauVise, jour: jourVise, cleFormulaire, ...(accordDonne.passe ? { confirmerPasse: true } : {}), ...(accordDonne.proximite ? { confirmerProximite: true } : {}) });
      setRetour(r);
      if (r.ok) setCleFormulaire(crypto.randomUUID());
    } catch {
      setRetour({ ok: false, message: "La copie n'a pas pu être créée. Réessayez." });
    } finally {
      setEnCours(false);
    }
  }

  if (!ouvert) {
    return (
      <div className="mt-3">
        <button type="button" className={BOUTON} onClick={() => setOuvert(true)}>
          Dupliquer
        </button>
      </div>
    );
  }
  const fait = retour?.ok === true;
  const aConfirmer = retour?.ok === false && retour.aConfirmer !== undefined;
  return (
    <form className="mt-3 max-w-full" aria-label="Dupliquer cette publication" onSubmit={(e) => { e.preventDefault(); void envoyer({}); }}>
      <p className="text-sm text-texte">{PHRASE_DUPLIQUER}</p>
      <label className="mt-2 block text-sm font-bold text-texte">
        Réseau
        <select className={CHAMP} value={reseauVise} onChange={(e) => { setReseauVise(e.target.value as IdReseau); setRetour(null); setAccord({}); }} disabled={enCours || fait}>
          {RESEAUX.map((r) => (
            <option key={r.id} value={r.id}>{r.nom}</option>
          ))}
        </select>
      </label>
      <label className="mt-2 block text-sm font-bold text-texte">
        Jour
        <input className={CHAMP} type="date" value={jourVise} onChange={(e) => { setJourVise(e.target.value); setRetour(null); setAccord({}); }} disabled={enCours || fait} />
      </label>
      <div className="mt-3 flex flex-wrap gap-2">
        {!fait && !aConfirmer && (
          <button type="submit" className={BOUTON} disabled={enCours}>
            Créer la copie
          </button>
        )}
        {aConfirmer && (
          <button type="button" className={BOUTON} disabled={enCours} onClick={() => { const nouveau = { ...accord, ...(retour?.ok === false && retour.aConfirmer === "passe" ? { passe: true as const } : { proximite: true as const }) }; setAccord(nouveau); void envoyer(nouveau); }}>
            Créer quand même
          </button>
        )}
        <button type="button" className={BOUTON} disabled={enCours} onClick={() => { setOuvert(false); setRetour(null); setAccord({}); setCleFormulaire(crypto.randomUUID()); }}>
          {fait ? "Fermer" : "Annuler"}
        </button>
      </div>
      {retour?.ok === false && <p role="alert" className="mt-2 rounded-[10px] bg-surface-1 p-2 text-sm font-bold text-texte">{retour.avertissement ?? retour.message}</p>}
      {retour?.ok === true && <p role="status" className="mt-2 text-sm font-bold text-texte">{retour.donnees.message}{retour.donnees.avertissement ? ` ${retour.donnees.avertissement}` : ""}</p>}
    </form>
  );
}
