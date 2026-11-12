"use client";

/**
 * Bouton « Décaler » d'une entrée future du calendrier (L4-06). Il ne publie rien et n'appelle aucun fournisseur.
 * Une entrée confiée à l'usine est réaffichée par AReprogrammer (« à renvoyer ») ; une entrée confiée au diffuseur est refusée par l'action.
 * Anti double clic : le bouton se désactive pendant l'envoi et la clé du formulaire reste la même.
 */
import { useRef, useState } from "react";
import { decalerEntree, type ResultatDecalage } from "@/app/(studio)/calendrier/actions/decaler";
import { AReprogrammer } from "@/components/migration/AReprogrammer";
import type { PostMigration, Reseau } from "@/components/migration/logique";
import type { CreneauPlan } from "@/services/plan-editorial";

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
