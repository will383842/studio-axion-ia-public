"use client";

/**
 * Bouton « Ajouter » d'un jour du calendrier (L7-11). Il crée un créneau « propose » : il ne publie jamais directement.
 * Anti double clic : le bouton se désactive pendant l'envoi et la clé du formulaire reste la même.
 */
import { useRef, useState } from "react";
import { ajouterEntree, type ResultatAjout } from "@/app/(studio)/calendrier/actions/ajouter";
import type { IdReseau } from "@/domaine/types";
import { DepotMedia } from "./DepotMedia";

export function AjouterEntree({ jour, compteCible, reseau = "linkedin" }: { jour: string; compteCible: string; reseau?: IdReseau }) {
  const cle = useRef(crypto.randomUUID());
  const [heure, setHeure] = useState("09:00");
  const [mediaId, setMediaId] = useState("");
  const [enCours, setEnCours] = useState(false);
  const [retour, setRetour] = useState<ResultatAjout | null>(null);

  // Confirmations déjà données pour cette saisie (le passé, puis la proximité ou le quota).
  const confirme = useRef({ passe: false, proximite: false });

  async function envoyer(confirmation?: "passe" | "proximite" | "quota") {
    if (enCours) return;
    if (confirmation === "passe") confirme.current.passe = true;
    if (confirmation === "proximite" || confirmation === "quota") confirme.current.proximite = true;
    setEnCours(true);
    try {
      const r = await ajouterEntree({ jour, heure, compteCible, reseau, videoId: mediaId || undefined, cle: cle.current, confirmerPasse: confirme.current.passe, confirmerProximite: confirme.current.proximite });
      setRetour(r);
      // Succès : nouvelle clé, pour qu'un 2e ajout depuis ce formulaire crée bien un 2e créneau.
      if (r.ok) {
        cle.current = crypto.randomUUID();
        confirme.current = { passe: false, proximite: false };
      }
    } finally {
      setEnCours(false);
    }
  }

  return (
    <form onSubmit={(e) => { e.preventDefault(); confirme.current = { passe: false, proximite: false }; void envoyer(); }} aria-label={`Ajouter une entrée le ${jour}`}>
      <p>Ajouter le {jour}</p>
      <label>Heure (Paris) <input type="time" value={heure} onChange={(e) => setHeure(e.target.value)} /></label>
      <label>Vidéo <input type="text" value={mediaId} onChange={(e) => setMediaId(e.target.value)} /></label>
      <DepotMedia reseau={reseau} onMedia={() => undefined} />
      <button type="submit" disabled={enCours}>Ajouter</button>
      {retour?.ok === false && retour.aConfirmer && (
        <p role="alert">{retour.avertissement} <button type="button" disabled={enCours} onClick={() => void envoyer(retour.aConfirmer)}>Ajouter quand même</button></p>
      )}
      {retour?.ok === false && !retour.aConfirmer && <p role="alert">{retour.message}</p>}
      {retour?.ok === true && <p role="status">Ajouté en « Proposée » : à valider avant tout envoi.{retour.avertissement ? ` ${retour.avertissement}` : ""}</p>}
    </form>
  );
}
