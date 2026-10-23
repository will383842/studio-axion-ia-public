"use client";

/**
 * « ENVOYER MA VIDÉO DE : <titre> » (plan facecam v4, § C.3, B.13 et B.27 ; lot D). Pensé pour l'iPhone, 390 px.
 * 2 touchers : « Choisir ma vidéo » (photothèque ou Fichiers), puis l'envoi part tout seul. Automatique :
 * - contrôle du fichier AVANT l'envoi (vidéo réduite par iOS → « renvoyez-la depuis l'app Fichiers », trop courte) ;
 * - coup d'œil aux 3 premières secondes (image très sombre), sans bloquer ;
 * - écran maintenu allumé pendant l'envoi (Wake Lock), repris quand on revient sur l'onglet ;
 * - reprise : une coupure met l'envoi en pause (« Envoi en pause à 63 % — Reprendre ») ; il repart où il s'est arrêté,
 *   même après fermeture (envoi multipart existant), et l'accueil le rappelle ;
 * - case facultative « Une demande pour le monteur ? », au clavier ou au micro ;
 * - lot E2 (raccord du lot E) : « Depuis mon Google Drive », même chemin de dépôt (copie par morceaux vers R2), puis
 *   la même réception que l'iPhone.
 * Puis le montage part tout seul et l'écran mène à l'attente.
 */
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { recevoirVideoFacecamAction } from "@/app/(studio)/envoyer/actions";
import { SelecteurDrive } from "@/components/google-drive/SelecteurDrive";
import { ajouterDicte, BoutonMicro, useDictee } from "@/components/matieres/Dictee";
import { Bouton } from "@/components/ui/Bouton";
import { Icone } from "@/components/ui/Icone";
import { notifier } from "@/components/ui/Toast";
import { ZoneTexte } from "@/components/ui/ZoneTexte";
import { EtatFacecam, LIBELLES_ETAT_FACECAM } from "@/domaine/facecam";
import { analyserDebut, controlerFichier, type ControleFichier, type MetaVideo } from "@/domaine/facecam-parcours";
import { envoyerFichier } from "@/lib/envoi-multipart";
import { cn } from "@/lib/cn";
import type { VueEnvoi } from "@/services/envoi-facecam";

/** Envoi en pause, rappelé sur l'accueil (« Envoi en pause à 63 % — Reprendre »). */
export const CLE_ENVOI_EN_PAUSE = "studio.facecam.envoi-en-pause";
export interface EnvoiEnPause {
  varianteId: string;
  titre: string;
  pourcentage: number;
  le: string;
}

function noterPause(p: EnvoiEnPause | null) {
  try {
    if (p) localStorage.setItem(CLE_ENVOI_EN_PAUSE, JSON.stringify(p));
    else localStorage.removeItem(CLE_ENVOI_EN_PAUSE);
  } catch {
    // Navigation privée : pas de rappel sur l'accueil, l'envoi reprend quand même.
  }
}

type Etape = { nom: "choix" } | { nom: "refus"; controle: ControleFichier } | { nom: "envoi" } | { nom: "pause"; message: string } | { nom: "montage" };

/** Écran maintenu allumé tant que `actif` (repris au retour sur l'onglet : iOS le relâche en arrière-plan). */
function useEcranAllume(actif: boolean) {
  useEffect(() => {
    if (!actif || typeof navigator === "undefined" || !("wakeLock" in navigator)) return;
    let verrou: WakeLockSentinel | null = null;
    let fini = false;
    const prendre = async () => {
      try {
        if (document.visibilityState === "visible" && !fini) verrou = await navigator.wakeLock.request("screen");
      } catch {
        // Refusé (batterie faible) : l'envoi continue, le message « Gardez l'écran allumé » reste affiché.
      }
    };
    void prendre();
    document.addEventListener("visibilitychange", prendre);
    return () => {
      fini = true;
      document.removeEventListener("visibilitychange", prendre);
      void verrou?.release().catch(() => undefined);
    };
  }, [actif]);
}

/** Dimensions, durée et luminance des premières secondes, lues dans le navigateur (rien n'est envoyé pour cela). */
async function lireVideo(fichier: File): Promise<{ meta: MetaVideo; luminanceDebut?: number }> {
  const url = URL.createObjectURL(fichier);
  try {
    const video = document.createElement("video");
    video.preload = "metadata";
    video.muted = true;
    video.playsInline = true;
    video.src = url;
    await new Promise<void>((ok, ko) => {
      video.onloadedmetadata = () => ok();
      video.onerror = () => ko(new Error("illisible"));
      setTimeout(() => ko(new Error("delai")), 8000);
    });
    const meta: MetaVideo = { largeur: video.videoWidth, hauteur: video.videoHeight, dureeSec: Number.isFinite(video.duration) ? video.duration : 0, taille: fichier.size, mime: fichier.type };
    let luminanceDebut: number | undefined;
    try {
      video.currentTime = Math.min(2, meta.dureeSec / 2);
      await new Promise<void>((ok, ko) => {
        video.onseeked = () => ok();
        setTimeout(() => ko(new Error("delai")), 4000);
      });
      const toile = document.createElement("canvas");
      toile.width = 64;
      toile.height = 36;
      const ctx = toile.getContext("2d", { willReadFrequently: true });
      if (ctx) {
        ctx.drawImage(video, 0, 0, 64, 36);
        const px = ctx.getImageData(0, 0, 64, 36).data;
        let somme = 0;
        for (let i = 0; i < px.length; i += 4) somme += 0.2126 * px[i] + 0.7152 * px[i + 1] + 0.0722 * px[i + 2];
        luminanceDebut = somme / (px.length / 4);
      }
    } catch {
      // Image du début illisible ici (codec) : le studio l'analysera à la réception.
    }
    return { meta, luminanceDebut };
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function EnvoiIphone({ vue }: { vue: VueEnvoi }) {
  const router = useRouter();
  const [etape, setEtape] = useState<Etape>({ nom: "choix" });
  const [pourcentage, setPourcentage] = useState(0);
  const [demande, setDemande] = useState("");
  const [conseils, setConseils] = useState<string[]>([]);
  const [drive, setDrive] = useState(false);
  const fichier = useRef<File | null>(null);
  const duree = useRef(0);
  const entree = useRef<HTMLInputElement>(null);
  const champ = useRef<HTMLTextAreaElement>(null);
  const demandeCourante = useRef("");
  const pourcentageCourant = useRef(0);
  useEffect(() => {
    demandeCourante.current = demande;
    pourcentageCourant.current = pourcentage;
  }, [demande, pourcentage]);
  const { ecoute, basculer } = useDictee((m) => setDemande((t) => ajouterDicte(t, m)), champ);
  useEcranAllume(etape.nom === "envoi");

  const envoyer = useCallback(async () => {
    const f = fichier.current;
    if (!f) return;
    setEtape({ nom: "envoi" });
    try {
      const { fichierId } = await envoyerFichier(f, { typeEntite: "rush", entiteId: vue.varianteId }, { onProgression: setPourcentage });
      noterPause(null);
      setEtape({ nom: "montage" });
      const r = await recevoirVideoFacecamAction(vue.varianteId, fichierId, duree.current, demandeCourante.current);
      if (!r.ok) {
        setEtape({ nom: "pause", message: r.message });
        return;
      }
      if (r.donnees.enAttente) notifier.info("Vidéo bien reçue", r.donnees.enAttente);
      router.push(`/videos/${r.donnees.videoId}`);
    } catch (e) {
      const message = e instanceof Error && e.name !== "AbortError" ? e.message : "La connexion a coupé.";
      noterPause({ varianteId: vue.varianteId, titre: vue.titre, pourcentage: pourcentageCourant.current, le: new Date().toISOString() });
      setEtape({ nom: "pause", message });
    }
  }, [router, vue.titre, vue.varianteId]);

  /** Copie depuis le Drive terminée (fichier déjà sur R2) : même réception que l'envoi depuis l'iPhone. */
  const depuisDrive = useCallback(
    async ({ fichierId, dureeSec }: { fichierId: string; dureeSec: number }) => {
      setPourcentage(100);
      setEtape({ nom: "montage" });
      const r = await recevoirVideoFacecamAction(vue.varianteId, fichierId, dureeSec, demandeCourante.current);
      if (!r.ok) {
        setEtape({ nom: "pause", message: r.message });
        return;
      }
      if (r.donnees.enAttente) notifier.info("Vidéo bien reçue", r.donnees.enAttente);
      router.push(`/videos/${r.donnees.videoId}`);
    },
    [router, vue.varianteId],
  );

  // La connexion revient pendant une pause : l'envoi repart seul (le fichier est encore en mémoire).
  useEffect(() => {
    if (etape.nom !== "pause") return;
    const reprendre = () => fichier.current && void envoyer();
    window.addEventListener("online", reprendre);
    return () => window.removeEventListener("online", reprendre);
  }, [etape.nom, envoyer]);

  async function choisi(f: File | undefined) {
    if (!f) return;
    fichier.current = f;
    let controle: ControleFichier = { ok: true, bloquant: false, conseils: [] };
    let notes: string[] = [];
    try {
      const { meta, luminanceDebut } = await lireVideo(f);
      duree.current = meta.dureeSec;
      controle = controlerFichier(meta);
      notes = [...controle.conseils, ...(luminanceDebut !== undefined ? analyserDebut({ visageTrouvePct: 100, luminanceVisage: luminanceDebut }).map((a) => a.message) : [])];
    } catch {
      // Métadonnées illisibles dans le navigateur (rare) : le studio contrôlera le fichier à la réception.
      duree.current = 0;
    }
    setConseils(notes);
    if (controle.bloquant) {
      fichier.current = null;
      setEtape({ nom: "refus", controle });
      return;
    }
    void envoyer();
  }

  return (
    <div className="mx-auto flex min-h-[calc(100dvh-8rem)] max-w-md flex-col">
      <header className="mb-6">
        <p className="text-sm font-semibold text-texte-faible">Envoyer ma vidéo de :</p>
        <h1 className="font-titre text-2xl leading-tight text-texte">{vue.titre}</h1>
        {vue.dejaRecue && <p className="mt-1 text-sm text-texte-faible">Une vidéo est déjà reçue : celle-ci s&apos;ajoutera comme nouvelle prise.</p>}
      </header>

      <input ref={entree} type="file" accept="video/*" className="sr-only" tabIndex={-1} aria-hidden onChange={(e) => void choisi(e.target.files?.[0])} />

      {etape.nom === "choix" && (
        <div className="flex flex-1 flex-col justify-center">
          <button
            type="button"
            onClick={() => entree.current?.click()}
            className="group relative isolate grid aspect-square w-full place-items-center overflow-hidden rounded-carte border border-trait bg-surface-1 transition-transform active:scale-[0.99]"
          >
            <div aria-hidden className="absolute inset-0 -z-10 lueur-forte opacity-70" />
            <span className="flex flex-col items-center gap-4">
              <span className="grid size-20 place-items-center rounded-full bg-orange text-sur-orange shadow-orange">
                <Icone nom="video" size={34} />
              </span>
              <span className="text-xl font-semibold text-texte">Choisir ma vidéo</span>
              <span className="px-6 text-center text-[15px] text-texte-doux">Dans la photothèque, la dernière vidéo filmée. L&apos;envoi part tout seul.</span>
            </span>
          </button>
          <Bouton taille="lg" variante="secondaire" pleineLargeur icone="telecharger" className="mt-4" onClick={() => setDrive(true)}>
            Depuis mon Google Drive
          </Bouton>
        </div>
      )}

      <SelecteurDrive
        ouverte={drive}
        onOuverteChange={setDrive}
        cible={{ typeEntite: "rush", entiteId: vue.varianteId }}
        onPret={depuisDrive}
        onIphone={() => {
          setDrive(false);
          entree.current?.click();
        }}
      />

      {etape.nom === "refus" && (
        <div className="flex flex-1 flex-col justify-center gap-4">
          <div className="rounded-carte border border-ambre/40 bg-ambre-doux p-4">
            <p className="flex items-start gap-2 text-[17px] font-semibold text-texte">
              <Icone nom="attention" size={20} className="mt-0.5 shrink-0 text-ambre" />
              {etape.controle.message}
            </p>
            {etape.controle.etat === EtatFacecam.FichierReduitIos && (
              <ol className="mt-3 list-decimal space-y-1 pl-6 text-[15px] text-texte-doux">
                <li>Dans Photos, touchez la vidéo, puis Partager.</li>
                <li>Choisissez « Enregistrer dans Fichiers ».</li>
                <li>Revenez ici et choisissez-la dans « Parcourir ».</li>
              </ol>
            )}
          </div>
          <Bouton taille="xl" pleineLargeur icone="video" onClick={() => entree.current?.click()}>
            {etape.controle.etat === EtatFacecam.FichierReduitIos ? LIBELLES_ETAT_FACECAM[EtatFacecam.FichierReduitIos].geste : "Choisir une autre vidéo"}
          </Bouton>
        </div>
      )}

      {(etape.nom === "envoi" || etape.nom === "pause" || etape.nom === "montage") && (
        <div className="flex flex-1 flex-col gap-5">
          <div className="rounded-carte border border-trait bg-surface-1 p-5" aria-live="polite">
            <div className="flex items-baseline justify-between gap-3">
              <p className="text-[17px] font-semibold text-texte">
                {etape.nom === "envoi" ? "Envoi en cours" : etape.nom === "pause" ? `Envoi en pause à ${pourcentage} %` : "Vidéo reçue"}
              </p>
              <p className="font-titre text-2xl tabular-nums text-texte">{pourcentage} %</p>
            </div>
            <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-surface-2" role="progressbar" aria-valuenow={pourcentage} aria-valuemin={0} aria-valuemax={100} aria-label="Envoi">
              <div className={cn("h-full rounded-full transition-[width] duration-500 ease-studio", etape.nom === "pause" ? "bg-ambre" : "bg-orange")} style={{ width: `${pourcentage}%` }} />
            </div>
            <p className="mt-3 text-[15px] text-texte-doux">
              {etape.nom === "envoi" && LIBELLES_ETAT_FACECAM[EtatFacecam.EnvoiEnCours].libelle}
              {etape.nom === "pause" && `${etape.message} L'envoi reprendra où il s'est arrêté.`}
              {etape.nom === "montage" && "Le montage démarre…"}
            </p>
            {etape.nom === "pause" && (
              <Bouton taille="lg" pleineLargeur icone="reessayer" className="mt-4" onClick={() => (fichier.current ? void envoyer() : entree.current?.click())}>
                Reprendre
              </Bouton>
            )}
          </div>

          {conseils.length > 0 && (
            <ul className="space-y-2">
              {conseils.map((c) => (
                <li key={c} className="flex items-start gap-2 rounded-2xl border border-trait bg-surface-1 px-4 py-3 text-[15px] text-texte-doux">
                  <Icone nom="info" size={16} className="mt-0.5 shrink-0 text-orange-vif" />
                  {c}
                </li>
              ))}
            </ul>
          )}

          {etape.nom !== "montage" && (
            <div>
              <div className="flex items-end gap-3">
                <ZoneTexte
                  ref={champ}
                  libelle="Une demande pour le monteur ? (facultatif)"
                  rows={2}
                  value={demande}
                  onChange={(e) => setDemande(e.target.value)}
                  placeholder="Ex. : un générique à la fin"
                  longueurMax={1000}
                  className="flex-1"
                />
                <BoutonMicro ecoute={ecoute} onClick={basculer} taille="md" libelle="" />
              </div>
              <p className="mt-1 text-sm text-texte-faible">Elle partira avec la vidéo.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
