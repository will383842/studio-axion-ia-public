"use client";

/** Bouton « Importer une vidéo déjà faite » + petit formulaire. Le fichier n'est envoyé qu'une fois la case cochée ; les contrôles décisifs sont côté serveur. */
import { useRouter } from "next/navigation";
import { useState } from "react";
import { importerVideoAction } from "@/app/(studio)/a-publier/actions-import";
import { Bouton } from "@/components/ui/Bouton";
import { envoyerFichier } from "@/lib/envoi-multipart";

const RESEAUX: { id: string; nom: string }[] = [
  { id: "instagram", nom: "Instagram" },
  { id: "tiktok", nom: "TikTok" },
  { id: "facebook", nom: "Facebook" },
  { id: "linkedin", nom: "LinkedIn" },
  { id: "youtube-shorts", nom: "YouTube Shorts" },
  { id: "youtube", nom: "YouTube" },
  { id: "pinterest", nom: "Pinterest" },
];

/** Durée et taille lues dans le navigateur (le serveur borne ensuite la durée annoncée). */
function lireMetadonnees(fichier: File): Promise<{ dureeSec: number; largeur: number; hauteur: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(fichier);
    const v = document.createElement("video");
    v.preload = "metadata";
    v.onloadedmetadata = () => {
      resolve({ dureeSec: v.duration, largeur: v.videoWidth, hauteur: v.videoHeight });
      URL.revokeObjectURL(url);
    };
    v.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("illisible"));
    };
    v.src = url;
  });
}

export function ImporterVideo() {
  const routeur = useRouter();
  const [ouvert, setOuvert] = useState(false);
  const [fichier, setFichier] = useState<File | null>(null);
  const [titre, setTitre] = useState("");
  const [reseaux, setReseaux] = useState<string[]>([]);
  const [valide, setValide] = useState(false);
  const [message, setMessage] = useState("");
  const [enCours, setEnCours] = useState(false);

  async function envoyer() {
    if (!valide) return setMessage("Cochez « Je valide cette vidéo » pour l'ajouter. Rien n'a été ajouté.");
    if (!fichier) return setMessage("Choisissez une vidéo (mp4, mov ou webm).");
    setEnCours(true);
    setMessage("");
    try {
      const meta = await lireMetadonnees(fichier).catch(() => ({ dureeSec: 0, largeur: 0, hauteur: 0 }));
      const entiteId = `imp-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
      const { fichierId } = await envoyerFichier(fichier, { typeEntite: "video", entiteId });
      const r = await importerVideoAction({ fichierId, entiteId, titre, reseaux, valide, ...meta });
      if (!r.ok) return setMessage(r.message);
      setOuvert(false);
      setFichier(null);
      setTitre("");
      setReseaux([]);
      setValide(false);
      routeur.refresh();
    } catch {
      setMessage("Le fichier n'a pas pu être envoyé. Vérifiez la connexion et recommencez.");
    } finally {
      setEnCours(false);
    }
  }

  if (!ouvert) return <Bouton variante="secondaire" onClick={() => setOuvert(true)}>Importer une vidéo déjà faite</Bouton>;
  return (
    <form className="flex flex-col gap-2" onSubmit={(e) => { e.preventDefault(); void envoyer(); }}>
      <label>Vidéo (mp4, mov, webm) <input type="file" accept=".mp4,.mov,.webm,video/mp4,video/quicktime,video/webm" onChange={(e) => setFichier(e.target.files?.[0] ?? null)} /></label>
      <label>Titre <input type="text" value={titre} maxLength={120} onChange={(e) => setTitre(e.target.value)} /></label>
      <fieldset>
        <legend>Réseaux visés</legend>
        {RESEAUX.map((r) => (
          <label key={r.id}>
            <input type="checkbox" checked={reseaux.includes(r.id)} onChange={(e) => setReseaux(e.target.checked ? [...reseaux, r.id] : reseaux.filter((x) => x !== r.id))} /> {r.nom}{" "}
          </label>
        ))}
      </fieldset>
      <label><input type="checkbox" checked={valide} onChange={(e) => setValide(e.target.checked)} /> Je valide cette vidéo</label>
      {message && <p role="alert">{message}</p>}
      <div className="flex gap-2">
        <Bouton type="submit" variante="principal" disabled={enCours}>{enCours ? "Envoi en cours…" : "Ajouter à « À publier »"}</Bouton>
        <Bouton type="button" variante="discret" onClick={() => setOuvert(false)}>Annuler</Bouton>
      </div>
    </form>
  );
}
