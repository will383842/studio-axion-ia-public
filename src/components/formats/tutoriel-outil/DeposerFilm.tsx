"use client";

/** AUD-4 · Bloc « Déposer le film » : montré seulement quand la vidéo attend son film de navigation (pause TO_FILM_A_CAPTURER). */
import { useRouter } from "next/navigation";
import { useState } from "react";
import { deposerFilmAction } from "@/app/(studio)/tutoriel-outil/[videoId]/actions-film";
import { ZoneDepot } from "@/components/ui/ZoneDepot";

type Retour = { ok: true; donnees: { statut: "ok" | "refusee"; phrase: string } } | { ok: false; message: string };

/** Geste testable en appel direct : renvoie la phrase à montrer. */
export async function surDepotFilm(videoId: string, fichierId: string, navigation: string, action: (v: string, d: { fichierId: string; navigation?: string }) => Promise<Retour> = deposerFilmAction): Promise<{ reussi: boolean; phrase: string }> {
  const r = await action(videoId, { fichierId, navigation });
  return r.ok ? { reussi: r.donnees.statut === "ok", phrase: r.donnees.phrase } : { reussi: false, phrase: r.message };
}

export function DeposerFilm({ videoId }: { videoId: string }) {
  const routeur = useRouter();
  const [film, setFilm] = useState<string | null>(null);
  const [navigation, setNavigation] = useState<string | null>(null);
  const [message, setMessage] = useState<{ reussi: boolean; phrase: string } | null>(null);
  const [envoi, setEnvoi] = useState(false);

  async function lireNavigation(fichiers: File[]) {
    const f = fichiers[0];
    if (!f) return;
    if (f.size > 256 * 1024) return setMessage({ reussi: false, phrase: "Le fichier navigation.json est trop gros : ce n'est pas le bon fichier." });
    setNavigation(await f.text());
    setMessage(null);
  }

  async function deposer() {
    if (!film || !navigation) return;
    setEnvoi(true);
    const r = await surDepotFilm(videoId, film, navigation);
    setMessage(r);
    setEnvoi(false);
    if (r.reussi) routeur.refresh();
  }

  return (
    <section aria-labelledby="film-titre" className="mb-6 rounded-lg border p-4">
      <h2 id="film-titre" className="text-lg font-semibold">Déposer le film</h2>
      <p className="mb-3 text-sm">Le film de navigation (mp4 ou webm) et son fichier navigation.json. Rien n&apos;a échoué : la vidéo reprend dès le dépôt.</p>
      <ZoneDepot libelle="Le film de navigation" detail="mp4 ou webm" accepte="video/mp4,video/webm" multiple={false} essai={false} onFichiers={() => undefined} envoi={{ typeEntite: "entree", entiteId: videoId, onEnvoyes: (f) => setFilm(f[0]?.fichierId ?? null), onErreur: (m) => setMessage({ reussi: false, phrase: m }) }} />
      <ZoneDepot libelle="Le fichier navigation.json" accepte=".json,application/json" multiple={false} essai={false} compacte onFichiers={lireNavigation} />
      <button type="button" className="mt-3 rounded border px-3 py-2" disabled={!film || !navigation || envoi} onClick={deposer}>
        Déposer le film
      </button>
      {message ? <p role="status" className="mt-2 text-sm">{message.phrase}</p> : null}
    </section>
  );
}
