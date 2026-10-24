"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { remettreCasAction } from "@/app/(studio)/cas-concret/actions";
import { Bouton } from "@/components/ui/Bouton";
import { notifier } from "@/components/ui/Toast";

/** « Remettre ce cas » : le cas est de nouveau proposé. Demande une confirmation avant d'agir ; ne fabrique ni ne dépense rien. */
export function BoutonRemettreCas({ casId, titre }: { casId: string; titre: string }) {
  const routeur = useRouter();
  const [attente, demarrer] = useTransition();
  const [confirmer, setConfirmer] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const oui = useRef<HTMLButtonElement>(null);
  const depart = useRef<HTMLButtonElement>(null);
  const dejaOuvert = useRef(false);
  // Le clavier suit le geste : après « Remettre ce cas », le focus passe sur la confirmation ; après « Annuler », il revient au bouton.
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
      <Bouton ref={depart} variante="contour" aria-label={`Remettre ce cas : ${titre}`} onClick={() => setConfirmer(true)}>
        Remettre ce cas
      </Bouton>
    );
  }
  return (
    <div className="flex flex-col gap-2" role="group" aria-label="Confirmer la remise du cas">
      <p className="text-[13px] text-texte-doux">Ce cas sera de nouveau proposé. Rien n&apos;est dépensé.</p>
      <div className="flex flex-wrap gap-2">
        <Bouton
          ref={oui}
          chargement={attente}
          onClick={() =>
            demarrer(async () => {
              const r = await remettreCasAction(casId);
              if (r.ok) {
                notifier.succes("Cas remis", titre);
                routeur.refresh();
              }
              else setMessage(r.message);
            })
          }
        >
          Oui, le remettre
        </Bouton>
        <Bouton variante="fantome" disabled={attente} onClick={() => setConfirmer(false)}>
          Annuler
        </Bouton>
      </div>
      {message && <p role="alert" className="text-sm text-brique">{message}</p>}
    </div>
  );
}
