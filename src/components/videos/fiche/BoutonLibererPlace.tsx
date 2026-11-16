"use client";

import { useState, useTransition } from "react";
import { Bouton } from "@/components/ui/Bouton";
import { apercuLibererAction, libererPlaceAction, type ApercuLiberer } from "./actions-liberer";

const mo = (o: number) => (o / 1_000_000).toFixed(1).replace(".", ",");

/** Bouton, puis « Effacer N fichiers (X Mo) ? » Confirmer / Annuler. Rien n'est effacé avant « Confirmer ». */
export function BoutonLibererPlace({ videoId }: { videoId: string }) {
  const [apercu, setApercu] = useState<ApercuLiberer | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [enCours, demarrer] = useTransition();

  const calculer = () =>
    demarrer(async () => {
      setMessage(null);
      const r = await apercuLibererAction(videoId);
      if (!r.ok) return setMessage(r.message);
      if (r.donnees.fichiers === 0) return setMessage("Rien à libérer : toutes les scènes en cache sont encore utilisées.");
      setApercu(r.donnees);
    });

  const confirmer = () =>
    demarrer(async () => {
      const r = await libererPlaceAction(videoId, true);
      setApercu(null);
      if (!r.ok) return setMessage(r.message);
      setMessage(`${r.donnees.efface} fichier(s) effacé(s) (${mo(r.donnees.octets)} Mo)${r.donnees.echecs ? `, ${r.donnees.echecs} en échec` : ""}.`);
    });

  return (
    <div className="space-y-2">
      {apercu ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm">
            Effacer {apercu.fichiers} fichier{apercu.fichiers > 1 ? "s" : ""} ({mo(apercu.octets)} Mo) ?
          </span>
          <Bouton variante="danger" onClick={confirmer} chargement={enCours}>
            Confirmer
          </Bouton>
          <Bouton variante="secondaire" onClick={() => setApercu(null)} disabled={enCours}>
            Annuler
          </Bouton>
        </div>
      ) : (
        <Bouton variante="secondaire" onClick={calculer} chargement={enCours}>
          Libérer la place
        </Bouton>
      )}
      {message && (
        <p role="status" className="text-sm text-texte-faible">
          {message}
        </p>
      )}
    </div>
  );
}
