"use client";

import { useRef, useState } from "react";
import { creerDemoDepuisEnvoi } from "@/app/(studio)/demo-facecam/actions-envoi";
import { lancerDemoFacecam } from "@/app/(studio)/demo-facecam/actions-lancement";
import type { IssueLancementDemo } from "@/domaine/demo-facecam/prix";
import { Bouton } from "@/components/ui/Bouton";
import { Champ } from "@/components/ui/Champ";
import { envoyerFichier, MESSAGE_ENVOI_RATE } from "@/lib/envoi-multipart";
import type { Resultat } from "@/services/_commun";

type Cible = { typeEntite: string; entiteId: string };

export interface DepsEnvoiDemo {
  titre: string;
  entiteId: string;
  facecam: File;
  ecran?: File | null;
  envoyer: (fichier: File, cible: Cible, onProgression?: (pourcentage: number) => void) => Promise<{ fichierId: string }>;
  creer: (e: { titre: string; entiteId: string; facecamFichierId: string; ecranFichierId?: string }) => Promise<Resultat<{ videoId: string }>>;
  onProgression?: (pourcentage: number) => void;
}

/** Envoie les vidéos une par une, puis crée le brouillon. Ne lance JAMAIS : le lancement exige un clic à part. */
export async function enchainerEnvoiDemo(d: DepsEnvoiDemo): Promise<{ ok: true; videoId: string } | { ok: false; message: string }> {
  const cible = { typeEntite: "entree", entiteId: d.entiteId };
  const nombre = d.ecran ? 2 : 1;
  const part = (i: number) => (p: number) => d.onProgression?.(Math.round((i * 100 + p) / nombre));
  let facecamFichierId: string;
  let ecranFichierId: string | undefined;
  try {
    facecamFichierId = (await d.envoyer(d.facecam, cible, part(0))).fichierId;
    if (d.ecran) ecranFichierId = (await d.envoyer(d.ecran, cible, part(1))).fichierId;
  } catch {
    return { ok: false, message: MESSAGE_ENVOI_RATE };
  }
  const r = await d.creer({ titre: d.titre, entiteId: d.entiteId, facecamFichierId, ...(ecranFichierId ? { ecranFichierId } : {}) });
  return r.ok ? { ok: true, videoId: r.donnees.videoId } : { ok: false, message: r.message };
}

export type EtatLancement = { statut: "lancee"; travailId: string } | { statut: "accord-requis"; centimes: number; prix: string } | { statut: "erreur"; message: string };

/** 1er appel : `accord` = null (le serveur répond par le prix). 2e appel : le prix montré, après « Confirmer et lancer ». */
export async function demanderLancementDemo(lancer: (videoId: string, accord: number | null) => Promise<Resultat<IssueLancementDemo>>, videoId: string, accord: number | null): Promise<EtatLancement> {
  let r: Resultat<IssueLancementDemo>;
  try {
    r = await lancer(videoId, accord);
  } catch {
    return { statut: "erreur", message: "Le lancement n'a pas pu se faire. Réessayez dans un instant." };
  }
  if (!r.ok) return { statut: "erreur", message: r.message };
  if (r.donnees.statut === "lancee") return { statut: "lancee", travailId: r.donnees.travailId };
  return { statut: "accord-requis", centimes: r.donnees.centimes, prix: r.donnees.prix };
}

function ChoixVideo({ libelle, onFichier }: { libelle: string; onFichier: (f: File | null) => void }) {
  return (
    <label className="block text-sm font-semibold text-texte-doux">
      {libelle}
      <input type="file" accept="video/*" className="mt-1.5 block w-full text-sm" onChange={(e) => onFichier(e.target.files?.[0] ?? null)} />
    </label>
  );
}

/** Écran « Démo facecam » avec envoi réel (réglage `demoFacecam.envoi` allumé seulement). */
export function EnvoiDemoFacecam() {
  const entiteId = useRef(`demo-${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`);
  const [titre, setTitre] = useState("");
  const [facecam, setFacecam] = useState<File | null>(null);
  const [ecran, setEcran] = useState<File | null>(null);
  const [progression, setProgression] = useState<number | null>(null);
  const [occupe, setOccupe] = useState(false);
  const [videoId, setVideoId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [lancement, setLancement] = useState<EtatLancement | null>(null);

  async function preparer() {
    if (!facecam) {
      setMessage("Choisissez d'abord votre vidéo facecam.");
      return;
    }
    setOccupe(true);
    setMessage("");
    setProgression(0);
    const r = await enchainerEnvoiDemo({
      titre: titre.trim() || "Démo face caméra",
      entiteId: entiteId.current,
      facecam,
      ecran,
      envoyer: (f, cible, onProgression) => envoyerFichier(f, cible, { onProgression }),
      creer: creerDemoDepuisEnvoi,
      onProgression: setProgression,
    });
    setOccupe(false);
    if (r.ok) setVideoId(r.videoId);
    else setMessage(r.message);
  }

  async function lancer(accord: number | null) {
    if (!videoId) return;
    setOccupe(true);
    setLancement(await demanderLancementDemo(lancerDemoFacecam, videoId, accord));
    setOccupe(false);
  }

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (!videoId && !occupe) void preparer();
      }}
    >
      <Champ libelle="Titre" value={titre} onChange={(e) => setTitre(e.target.value)} />
      <ChoixVideo libelle="Votre vidéo facecam" onFichier={setFacecam} />
      <ChoixVideo libelle="Votre enregistrement d'écran (facultatif)" onFichier={setEcran} />
      {progression !== null && !videoId && <progress className="w-full" max={100} value={progression} aria-label="Envoi de vos vidéos" />}
      {!videoId && (
        <Bouton type="submit" icone="ecran-partage" disabled={occupe}>
          {occupe ? "Envoyer en cours…" : "Envoyer et préparer la démo"}
        </Bouton>
      )}
      {message && <p role="alert" className="text-sm text-texte-doux">{message}</p>}
      {videoId && !lancement && (
        <div className="space-y-2">
          <p className="text-sm text-texte-doux">Démo préparée. Rien n&rsquo;est lancé tant que vous n&rsquo;avez pas cliqué.</p>
          <Bouton type="button" disabled={occupe} onClick={() => void lancer(null)}>
            Lancer la démo
          </Bouton>
        </div>
      )}
      {lancement?.statut === "accord-requis" && (
        <div className="space-y-2">
          <p className="text-sm text-texte-doux">Cette démo coûtera {lancement.prix}. Confirmez pour la lancer.</p>
          <Bouton type="button" disabled={occupe} onClick={() => void lancer(lancement.centimes)}>
            Confirmer et lancer
          </Bouton>
        </div>
      )}
      {lancement?.statut === "lancee" && (
        <p className="text-sm text-texte-doux">
          La démo est lancée. <a className="font-semibold underline" href={`/videos/${videoId}`}>Voir la vidéo</a>
        </p>
      )}
      {lancement?.statut === "erreur" && <p role="alert" className="text-sm text-texte-doux">{lancement.message}</p>}
    </form>
  );
}
