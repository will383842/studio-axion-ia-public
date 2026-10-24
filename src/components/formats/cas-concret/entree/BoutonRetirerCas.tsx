"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { retirerCasAction } from "@/app/(studio)/cas-concret/actions";
import { Bouton } from "@/components/ui/Bouton";
import { notifier } from "@/components/ui/Toast";

/**
 * « Retirer ce cas » : le cas n'est plus proposé (réversible : Cas concret MD › Cas retirés › Remettre ce cas). Demande une
 * confirmation avant d'agir ; ne supprime rien, ne fabrique rien, ne dépense rien. `onRetire` : après le succès (ferme la feuille).
 */
export function BoutonRetirerCas({ casId, titre, onRetire, desactive = false }: { casId: string; titre: string; onRetire?: () => void; desactive?: boolean }) {
  const routeur = useRouter();
  const [attente, demarrer] = useTransition();
  const [confirmer, setConfirmer] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const oui = useRef<HTMLButtonElement>(null);
  const depart = useRef<HTMLButtonElement>(null);
  const dejaOuvert = useRef(false);
  // Le clavier suit le geste : après « Retirer ce cas », le focus passe sur la confirmation ; après « Annuler », il revient au bouton.
  useEffect(() => {
    if (confirmer) {
      oui.current?.focus();
      dejaOuvert.current = true;
    } else if (dejaOuvert.current) {
      depart.current?.focus();
      dejaOuvert.current = false;
    }
  }, [confirmer]);
  if (!confirmer) {
    return (
      <Bouton ref={depart} variante="fantome" disabled={desactive} aria-label={`Retirer ce cas : ${titre}`} onClick={() => setConfirmer(true)}>
        Retirer ce cas
      </Bouton>
    );
  }
  return (
    <div className="flex flex-col gap-2" role="group" aria-label="Confirmer le retrait du cas">
      <p className="text-[13px] text-texte-doux">Ce cas ne sera plus proposé. Vous pourrez le remettre depuis Cas retirés. Rien n&apos;est supprimé. Une vidéo de ce cas en pause ne pourra pas être relancée tant qu&apos;il n&apos;est pas remis ; une vidéo en cours va au bout.</p>
      <div className="flex flex-wrap gap-2">
        <Bouton
          ref={oui}
          chargement={attente}
          disabled={desactive}
          onClick={() =>
            demarrer(async () => {
              const r = await retirerCasAction(casId);
              if (r.ok) {
                notifier.succes("Cas retiré", titre);
                routeur.refresh();
                onRetire?.();
              } else setMessage(r.message);
            })
          }
        >
          Oui, retirer
        </Bouton>
        <Bouton variante="fantome" disabled={attente} onClick={() => setConfirmer(false)}>
          Annuler
        </Bouton>
      </div>
      {message && <p role="alert" className="text-sm text-brique">{message}</p>}
    </div>
  );
}
