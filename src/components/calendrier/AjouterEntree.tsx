"use client";

/**
 * Bouton « Ajouter » d'un jour du calendrier (L7-11). Il crée un créneau « propose » : il ne publie jamais directement.
 * Anti double clic : le bouton se désactive pendant l'envoi et la clé du formulaire reste la même.
 */
import { useRef, useState } from "react";
import { ajouterEntree, type ResultatAjout } from "@/app/(studio)/calendrier/actions/ajouter";
import type { IdReseau } from "@/domaine/types";
import { ProposerTexte, type PropsProposerTexte } from "./ProposerTexte";
import { DepotMedia, envoyerFichierChoisi, type FichierChoisi, type ResultatEnvoiChoisi } from "./DepotMedia";

export function AjouterEntree({ jour, compteCible, reseau = "linkedin", proposer }: { jour: string; compteCible: string; reseau?: IdReseau; proposer?: PropsProposerTexte["proposer"] }) {
  const cle = useRef(crypto.randomUUID());
  const [heure, setHeure] = useState("09:00");
  const [mediaId, setMediaId] = useState("");
  const [choisi, setChoisi] = useState<FichierChoisi | null>(null);
  const [enCours, setEnCours] = useState(false);
  const [nonEnvoye, setNonEnvoye] = useState<string | null>(null);
  const [retour, setRetour] = useState<ResultatAjout | null>(null);

  // Confirmations déjà données pour cette saisie (le passé, puis la proximité ou le quota).
  const dejaEnvoye = useRef<{ fichier: File; envoi: ResultatEnvoiChoisi } | null>(null);
  const confirme = useRef({ passe: false, proximite: false });

  async function envoyer(confirmation?: "passe" | "proximite" | "quota") {
    if (enCours) return;
    if (confirmation === "passe") confirme.current.passe = true;
    if (confirmation === "proximite" || confirmation === "quota") confirme.current.proximite = true;
    setEnCours(true);
    try {
      // Le fichier choisi part vraiment (dépôt existant) avant la création de l'entrée, qui le rattache.
      // Déjà envoyé pour cette saisie (clic sur « Ajouter quand même ») : on ne renvoie pas le fichier.
      // Sans fichier choisi, rien à envoyer ni à réutiliser. Un format refusé ou un envoi en échec n'empêche JAMAIS l'ajout.
      const fichier = choisi?.fichier;
      const envoi = fichier && dejaEnvoye.current?.fichier === fichier ? dejaEnvoye.current.envoi : await envoyerFichierChoisi(fichier, reseau, `manuel-${cle.current}`);
      if (envoi.ok && fichier && !envoi.nonEnvoye) dejaEnvoye.current = { fichier, envoi };
      setNonEnvoye(envoi.nonEnvoye ?? null);
      const r = await ajouterEntree({ jour, heure, compteCible, reseau, videoId: envoi.videoId ?? (mediaId || undefined), ...(envoi.visuelId ? { visuelId: envoi.visuelId } : {}), cle: cle.current, confirmerPasse: confirme.current.passe, confirmerProximite: confirme.current.proximite });
      setRetour(r);
      // Succès : nouvelle clé, pour qu'un 2e ajout depuis ce formulaire crée bien un 2e créneau.
      if (r.ok) {
        cle.current = crypto.randomUUID();
        dejaEnvoye.current = null;
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
      <DepotMedia reseau={reseau} onMedia={setChoisi} />
      {proposer && <ProposerTexte type="video" reseaux={[reseau]} proposer={proposer} />}
      <button type="submit" disabled={enCours}>Ajouter</button>
      {retour?.ok === false && retour.aConfirmer && (
        <p role="alert">{retour.avertissement} <button type="button" disabled={enCours} onClick={() => void envoyer(retour.aConfirmer)}>Ajouter quand même</button></p>
      )}
      {retour?.ok === false && !retour.aConfirmer && <p role="alert">{retour.message}</p>}
      {retour?.ok === true && <p role="status">Ajouté en « Proposée » : à valider avant tout envoi.{retour.avertissement ? ` ${retour.avertissement}` : ""}{nonEnvoye ? ` ${nonEnvoye}` : ""}</p>}
    </form>
  );
}
