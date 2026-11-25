"use client";

import Link from "next/link";
import { useState } from "react";
import type { ElementReserve, EtatElementReserve } from "@/domaine/tutoriel-reserve";
import { Bouton } from "@/components/ui/Bouton";

/** Résultat d'une action de la page (forme de `Resultat`, recopiée : pas d'import serveur ici). */
type Retour<T> = { ok: true; donnees: T } | { ok: false; message: string };

export const LIBELLE_ETAT: Record<EtatElementReserve, string> = {
  en_reserve: "En réserve",
  pris: "En fabrication",
  fait: "Prêt : à valider",
  a_revoir: "À revoir",
  retire: "Retiré",
};

const LIBELLE_TYPE = { dossier: "Dossier", idee: "Idée", "maquette-demo": "Démo" } as const;

/**
 * La réserve, dans l'ordre : rang, titre, type, état en mots simples, motif, lien vers le suivi, gestes permis.
 * Aucun montant. `essayer` : « Préparer le suivant maintenant » (le clic de Williams).
 */
export function ListeReserve({
  elements,
  retirer,
  remettre,
  essayer,
}: {
  elements: ElementReserve[];
  retirer: (id: string) => Promise<Retour<unknown>>;
  remettre: (id: string) => Promise<Retour<unknown>>;
  essayer: () => Promise<Retour<{ phrase: string; pris: boolean }>>;
}) {
  const [occupe, setOccupe] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function geste(cle: string, f: () => Promise<Retour<unknown>>) {
    if (occupe) return;
    setOccupe(cle);
    setMessage(null);
    try {
      const r = await f();
      if (!r.ok) setMessage(r.message);
      else if (typeof r.donnees === "object" && r.donnees && "statut" in r.donnees && (r.donnees as { statut: string }).statut === "refuse") setMessage((r.donnees as { phrase?: string }).phrase ?? "Ce geste n'a pas pu être fait.");
    } catch {
      setMessage("Un souci est survenu. Réessayez dans un instant.");
    } finally {
      setOccupe(null);
    }
  }

  async function lancerEssai() {
    if (occupe) return;
    setOccupe("essai");
    setMessage(null);
    try {
      const r = await essayer();
      setMessage(r.ok ? r.donnees.phrase : r.message);
    } catch {
      setMessage("Un souci est survenu. Réessayez dans un instant.");
    } finally {
      setOccupe(null);
    }
  }

  return (
    <section aria-labelledby="bloc-liste-reserve" className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="bloc-liste-reserve" className="text-lg font-semibold">
          Dans la réserve
        </h2>
        <Bouton type="button" icone="baguette" variante="secondaire" disabled={occupe !== null} chargement={occupe === "essai"} onClick={() => void lancerEssai()}>
          Préparer le suivant maintenant
        </Bouton>
      </div>
      {message && (
        <p role="status" className="rounded-carte border border-trait bg-surface-2 p-3.5 text-sm text-texte">
          {message}
        </p>
      )}
      {elements.length === 0 ? (
        <p className="text-sm text-texte-doux">La réserve est vide. Ajoutez un dossier ou une idée ci-dessus.</p>
      ) : (
        <ol className="space-y-2">
          {elements.map((e, i) => (
            <li key={e.id} data-etat={e.etat} className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-carte border border-trait bg-surface-1 p-3.5">
              <span className="w-6 shrink-0 text-sm font-semibold text-texte-doux" aria-label={`Rang ${i + 1}`}>
                {i + 1}
              </span>
              <div className="min-w-0 flex-1 basis-48">
                <p className="break-words font-semibold">{e.titre}</p>
                <p className="text-sm text-texte-doux">
                  {LIBELLE_TYPE[e.source.type]} · {LIBELLE_ETAT[e.etat]}
                </p>
                {e.motif && <p className="text-sm text-texte-doux">{e.motif}</p>}
                {e.prise?.videoId && (
                  <Link href={`/tutoriel-outil/suivi/${e.prise.videoId}`} className="inline-flex min-h-11 items-center text-sm font-semibold underline underline-offset-4">
                    Voir la vidéo
                  </Link>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {(e.etat === "en_reserve" || e.etat === "a_revoir") && (
                  <Bouton type="button" variante="contour" disabled={occupe !== null} onClick={() => void geste(e.id, () => retirer(e.id))}>
                    Retirer
                  </Bouton>
                )}
                {(e.etat === "a_revoir" || e.etat === "retire") && (
                  <Bouton type="button" variante="contour" disabled={occupe !== null} onClick={() => void geste(e.id, () => remettre(e.id))}>
                    Remettre en réserve
                  </Bouton>
                )}
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
