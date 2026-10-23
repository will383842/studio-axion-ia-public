"use client";

/**
 * « ENREGISTRER ICI » (lot G4c, B.6 n° 15) : caméra avant du téléphone, texte du téléprompteur en bandeau JUSTE SOUS
 * L'OBJECTIF (haut de l'écran), défilement au débit du mode « je lis », compte à rebours de 3 s, pause au toucher,
 * vitesse réglable, écran gardé allumé. À l'arrêt : relecture, puis « Garder » (la prise part et se range seule sous son
 * code) ou « Prise ratée, on recommence ». Les versions de la séance s'enchaînent sans refermer la caméra.
 * La logique (états, défilement) est pure et testée : `domaine/tournage.ts`.
 */
import { useRouter } from "next/navigation";
import { Dialog } from "radix-ui";
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { enregistrerPriseAction } from "@/app/(studio)/ecrire/tournage/actions";
import { bornerVitesse, enregistreur, nomFichierPrise, phrasesPrompteur, positionLecture, type EtatEnregistreur, type VersionDeSeance } from "@/domaine/tournage";
import { envoyerFichier } from "@/lib/envoi-multipart";
import { cn } from "@/lib/cn";
import { Bouton } from "@/components/ui/Bouton";
import { Icone } from "@/components/ui/Icone";
import { ErreurLisible } from "@/lib/erreur-lisible";

type Version = Pick<VersionDeSeance, "id" | "code" | "titre" | "mode" | "prompteur" | "trame" | "debit" | "prises">;

function choisirFormat(): string {
  if (typeof MediaRecorder === "undefined") return "";
  const candidats = ["video/mp4;codecs=avc1,mp4a", "video/mp4", "video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm"];
  return candidats.find((m) => MediaRecorder.isTypeSupported?.(m)) ?? "";
}

const formatTemps = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

export function Enregistreur({ seanceId, versions, onFermer }: { seanceId: string; versions: Version[]; onFermer: () => void }) {
  const router = useRouter();
  const [index, setIndex] = useState(0);
  const [etat, envoyer] = useReducer(enregistreur, { phase: "camera" } as EtatEnregistreur);
  const [vitesse, setVitesse] = useState(1);
  const [temps, setTemps] = useState(0);
  const [relecture, setRelecture] = useState<string | null>(null);
  const [progression, setProgression] = useState(0);
  const [rangee, setRangee] = useState<{ nom: string; suivante: boolean } | null>(null);
  const [prisesFaites, setPrisesFaites] = useState<Record<string, number>>({});

  const video = useRef<HTMLVideoElement>(null);
  const flux = useRef<MediaStream | null>(null);
  const enreg = useRef<MediaRecorder | null>(null);
  const morceaux = useRef<Blob[]>([]);
  const prise = useRef<Blob | null>(null);
  const chrono = useRef({ cumul: 0, depuis: 0, marche: false });
  const bande = useRef<HTMLDivElement>(null);
  const lignes = useRef<(HTMLLIElement | null)[]>([]);

  const v = versions[index];
  const { phrases } = useMemo(() => phrasesPrompteur(v?.prompteur ?? "", v?.debit ?? 2.9), [v]);

  // Caméra avant + micro ; écran gardé allumé ; tout est refermé en quittant.
  useEffect(() => {
    let fini = false;
    let verrou: { release: () => Promise<void> } | null = null;
    (async () => {
      try {
        const f = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: { ideal: 1080 }, height: { ideal: 1920 } }, audio: true });
        if (fini) return f.getTracks().forEach((t) => t.stop());
        flux.current = f;
        if (video.current) video.current.srcObject = f;
        envoyer({ type: "camera-ok" });
      } catch {
        envoyer({ type: "camera-refusee" });
      }
      try {
        verrou = (await (navigator as Navigator & { wakeLock?: { request: (t: "screen") => Promise<{ release: () => Promise<void> }> } }).wakeLock?.request("screen")) ?? null;
      } catch {
        /* écran : le navigateur refuse, sans conséquence */
      }
    })();
    return () => {
      fini = true;
      flux.current?.getTracks().forEach((t) => t.stop());
      void verrou?.release().catch(() => undefined);
    };
  }, []);

  // Compte à rebours.
  useEffect(() => {
    if (etat.phase !== "decompte") return;
    const t = setTimeout(() => envoyer({ type: "tic" }), 1000);
    return () => clearTimeout(t);
  }, [etat]);

  // Début, pause et reprise de l'enregistrement, chrono hors pauses.
  const phase = etat.phase;
  useEffect(() => {
    const c = chrono.current;
    if (phase === "enregistre") {
      if (!enreg.current && flux.current) {
        morceaux.current = [];
        const mime = choisirFormat();
        const r = new MediaRecorder(flux.current, mime ? { mimeType: mime } : undefined);
        r.ondataavailable = (e) => e.data.size && morceaux.current.push(e.data);
        r.onstop = () => {
          const blob = new Blob(morceaux.current, { type: r.mimeType || mime || "video/webm" });
          prise.current = blob;
          setRelecture(URL.createObjectURL(blob));
        };
        r.start(1000);
        enreg.current = r;
        c.cumul = 0;
      } else if (enreg.current?.state === "paused") enreg.current.resume();
      c.depuis = performance.now();
      c.marche = true;
      let image = 0;
      const boucle = () => {
        setTemps(c.cumul + (performance.now() - c.depuis) / 1000);
        image = requestAnimationFrame(boucle);
      };
      image = requestAnimationFrame(boucle);
      return () => cancelAnimationFrame(image);
    }
    if (c.marche) {
      c.cumul += (performance.now() - c.depuis) / 1000;
      c.marche = false;
      setTemps(c.cumul);
    }
    if (phase === "pause" && enreg.current?.state === "recording") enreg.current.pause();
    if (phase === "relecture" && enreg.current && enreg.current.state !== "inactive") {
      enreg.current.stop();
      enreg.current = null;
    }
  }, [phase]);

  useEffect(() => {
    if (phase === "enregistre") envoyer({ type: "temps", sec: temps });
  }, [temps, phase]);

  // Défilement au débit « je lis » : la phrase en cours reste en haut du bandeau, au plus près de l'objectif.
  const lecture = positionLecture(phrases, phase === "decompte" || phase === "pret" ? 0 : temps, vitesse);
  useEffect(() => {
    const el = lignes.current[lecture.index];
    if (!el || !bande.current) return;
    bande.current.style.transform = `translateY(${-(el.offsetTop + lecture.avancement * el.offsetHeight * 0.8)}px)`;
  }, [lecture.index, lecture.avancement]);

  const oublierPrise = useCallback(() => {
    if (relecture) URL.revokeObjectURL(relecture);
    setRelecture(null);
    prise.current = null;
    setTemps(0);
    chrono.current = { cumul: 0, depuis: 0, marche: false };
  }, [relecture]);

  const recommencer = () => {
    if (enreg.current && enreg.current.state !== "inactive") {
      enreg.current.onstop = null;
      enreg.current.stop();
      enreg.current = null;
    }
    oublierPrise();
    envoyer({ type: "ratee" });
  };

  const garder = async () => {
    const blob = prise.current;
    if (!blob || !v) return;
    envoyer({ type: "garder" });
    setProgression(0);
    try {
      const numero = v.prises + (prisesFaites[v.id] ?? 0) + 1;
      const fichier = new File([blob], nomFichierPrise(v.code, numero, blob.type), { type: blob.type || "video/webm", lastModified: Date.now() });
      const { fichierId } = await envoyerFichier(fichier, { typeEntite: "rush", entiteId: seanceId }, { onProgression: setProgression });
      const r = await enregistrerPriseAction(seanceId, v.id, fichierId, temps);
      if (!r.ok) throw new ErreurLisible(r.message);
      setPrisesFaites((p) => ({ ...p, [v.id]: (p[v.id] ?? 0) + 1 }));
      const suivante = r.donnees.suivanteId ? versions.findIndex((x) => x.id === r.donnees.suivanteId) : -1;
      setRangee({ nom: r.donnees.nom, suivante: suivante >= 0 });
      envoyer({ type: "envoyee" });
      oublierPrise();
      router.refresh();
      if (suivante >= 0)
        setTimeout(() => {
          setIndex(suivante);
          setRangee(null);
          envoyer({ type: "suivante" });
        }, 1600);
    } catch (e) {
      envoyer({ type: "echec", message: e instanceof ErreurLisible ? e.message : "La prise n'est pas partie." });
    }
  };

  const filme = phase === "enregistre" || phase === "pause";

  return (
    // Fenêtre plein écran (Radix) : focus gardé à l'intérieur, Échap referme — sauf pendant le décompte, la prise ou le
    // rangement, pour ne jamais perdre une vidéo en cours.
    <Dialog.Root open onOpenChange={(o) => !o && onFermer()}>
      <Dialog.Portal>
        <Dialog.Content
          aria-describedby={undefined}
          onEscapeKeyDown={(e) => {
            if (filme || phase === "decompte" || phase === "envoi") e.preventDefault();
          }}
          className="fixed inset-0 z-[65] flex flex-col bg-[#000] text-[#fff] outline-none"
        >
      <Dialog.Title className="sr-only">{`Filmer ${v?.code ?? ""}`}</Dialog.Title>
      {/* Bandeau du texte, collé en haut : sous l'objectif de la caméra avant. */}
      <div className={cn("relative z-10 shrink-0 overflow-hidden bg-[#000]/85 px-5 pb-3 pt-[max(14px,env(safe-area-inset-top))]", v?.mode === "trame" ? "max-h-[38vh]" : "h-[30vh]")}>
        {v?.mode === "trame" && v.trame ? (
          <div className="space-y-2 text-[20px] font-semibold leading-snug">
            <p>« {v.trame.verbatim.accroche} »</p>
            <ul className="flex flex-wrap gap-1.5 text-[15px]">
              {v.trame.reperes.map((r) => (
                <li key={r} className="rounded-full bg-[#fff]/15 px-3 py-1">
                  {r}
                </li>
              ))}
            </ul>
            <p className="text-[#fff]/70">« {v.trame.verbatim.appel} »</p>
          </div>
        ) : (
          <div ref={bande} className="will-change-transform">
            <ol>
              {phrases.map((p, i) => (
                <li
                  key={p.numero}
                  ref={(el) => {
                    lignes.current[i] = el;
                  }}
                  className={cn("pb-4 text-[26px] font-semibold leading-tight transition-opacity", i === lecture.index ? "opacity-100" : i < lecture.index ? "opacity-25" : "opacity-60")}
                >
                  {p.lignes.map((l, k) => (
                    <span key={k} className="block">
                      {l}
                    </span>
                  ))}
                </li>
              ))}
            </ol>
          </div>
        )}
        {/* Pause / reprise : tout le bandeau est un vrai bouton (toucher, Entrée ou Espace). */}
        {filme && (
          <button
            type="button"
            aria-label={phase === "pause" ? "Reprendre" : "Pause"}
            onClick={() => envoyer({ type: "toucher" })}
            className="absolute inset-0 grid place-items-center text-lg font-semibold outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-orange"
          >
            {phase === "pause" && (
              <span className="absolute inset-0 grid place-items-center bg-[#000]/70">
                <span className="flex items-center gap-2">
                  <Icone nom="lecture" size={20} />
                  Touchez pour reprendre
                </span>
              </span>
            )}
          </button>
        )}
      </div>

      {/* Image de la caméra (miroir) ou relecture de la prise. */}
      <div className="relative min-h-0 flex-1">
        <video ref={video} autoPlay muted playsInline className={cn("absolute inset-0 size-full -scale-x-100 object-cover", relecture && "invisible")} />
        {relecture && <video src={relecture} controls playsInline className="absolute inset-0 size-full bg-[#000] object-contain" />}

        <div className="absolute inset-x-0 top-0 flex items-center justify-between p-3">
          <span className="rounded-full bg-[#000]/60 px-3 py-1 font-mono text-xs">{v?.code}</span>
          {filme ? (
            <span className="flex items-center gap-2 rounded-full bg-[#000]/60 px-3 py-1 text-sm font-semibold tabular-nums">
              <span className={cn("size-2.5 rounded-full bg-brique", phase === "enregistre" && "animate-pulse")} />
              {formatTemps(temps)}
            </span>
          ) : (
            <button type="button" onClick={onFermer} aria-label="Fermer" className="grid size-11 place-items-center rounded-full bg-[#000]/60">
              <Icone nom="fermer" size={20} />
            </button>
          )}
        </div>

        {phase === "decompte" && (
          <div className="absolute inset-0 grid place-items-center">
            <span className="font-titre text-[120px] leading-none drop-shadow-lg">{etat.reste}</span>
          </div>
        )}

        {phase === "refusee" && (
          <div className="absolute inset-0 grid place-items-center p-8 text-center">
            <div className="space-y-4">
              <Icone nom="camera" size={40} className="mx-auto text-[#fff]/70" />
              <p className="text-lg font-semibold">Autorisez la caméra pour filmer ici.</p>
              <Bouton variante="secondaire" icone="reessayer" onClick={() => location.reload()}>
                Réessayer
              </Bouton>
            </div>
          </div>
        )}

        {(phase === "envoi" || phase === "rangee") && (
          <div className="absolute inset-0 grid place-items-center bg-[#000]/75 p-8 text-center">
            {phase === "envoi" ? (
              <div className="w-full max-w-[240px] space-y-3">
                <p className="text-lg font-semibold">Rangement…</p>
                <span className="block h-1.5 overflow-hidden rounded-full bg-[#fff]/20">
                  <span className="block h-full rounded-full bg-orange transition-[width]" style={{ width: `${Math.max(8, progression)}%` }} />
                </span>
              </div>
            ) : (
              <div className="space-y-3">
                <span className="mx-auto grid size-16 place-items-center rounded-full bg-sauge text-fond">
                  <Icone nom="coche" size={32} />
                </span>
                <p className="text-lg font-semibold">Rangée</p>
                <p className="font-mono text-sm text-[#fff]/70">{rangee?.nom}</p>
                {!rangee?.suivante && (
                  <Bouton
                    className="mt-2"
                    icone="valide"
                    onClick={() => {
                      router.refresh();
                      onFermer();
                    }}
                  >
                    Séance terminée
                  </Bouton>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Commandes. */}
      <div className="shrink-0 bg-[#000] px-5 pb-[max(16px,env(safe-area-inset-bottom))] pt-3">
        {phase === "relecture" || phase === "erreur" ? (
          <div className="space-y-2">
            {phase === "erreur" && <p className="text-center text-sm text-ambre">{etat.message}</p>}
            <div className="flex gap-2">
              <Bouton variante="secondaire" taille="lg" icone="reessayer" className="flex-1" onClick={recommencer}>
                Prise ratée, on recommence
              </Bouton>
              <Bouton taille="lg" icone="coche" className="flex-1" onClick={garder}>
                Garder
              </Bouton>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-3">
            <div role="group" aria-label="Vitesse du texte" className="flex w-auto shrink-0 items-center gap-1">
              <button type="button" aria-label="Moins vite" onClick={() => setVitesse((x) => bornerVitesse(x - 0.1))} className="grid size-11 place-items-center rounded-full bg-[#fff]/10 text-lg font-bold">
                −
              </button>
              <span className="w-10 text-center text-sm tabular-nums">{vitesse.toFixed(1).replace(".", ",")}×</span>
              <button type="button" aria-label="Plus vite" onClick={() => setVitesse((x) => bornerVitesse(x + 0.1))} className="grid size-11 place-items-center rounded-full bg-[#fff]/10 text-lg font-bold">
                +
              </button>
            </div>
            {filme ? (
              <button type="button" aria-label="Arrêter" onClick={() => envoyer({ type: "arreter" })} className="grid size-[76px] place-items-center rounded-full border-4 border-[#fff]">
                <span className="size-8 rounded-md bg-brique" />
              </button>
            ) : (
              <button
                type="button"
                aria-label="Filmer"
                disabled={phase !== "pret"}
                onClick={() => envoyer({ type: "demarrer" })}
                className="grid size-[76px] place-items-center rounded-full border-4 border-[#fff] disabled:opacity-40"
              >
                <span className="size-[58px] rounded-full bg-brique" />
              </button>
            )}
            <div className="min-w-10 shrink-0 text-right text-xs text-[#fff]/60">
              {index + 1}/{versions.length}
            </div>
          </div>
        )}
      </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
