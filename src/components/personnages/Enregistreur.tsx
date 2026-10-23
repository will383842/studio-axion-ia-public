"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Bouton, Icone, PastilleEssai } from "@/components/ui";
import { cn } from "@/lib/cn";
import { minutesLisibles } from "./outils";

type Etat = "pret" | "demande" | "enregistre" | "fini" | "refuse" | "indisponible";

export interface EnregistrementTermine {
  blob: Blob;
  dureeSec: number;
  mime: string;
}

function choisirMime(): string {
  if (typeof MediaRecorder === "undefined") return "";
  for (const m of ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg"]) if (MediaRecorder.isTypeSupported?.(m)) return m;
  return "";
}

function chrono(sec: number): string {
  const s = Math.floor(sec);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/**
 * ENREGISTREMENT DE LA VOIX DANS LE NAVIGATEUR (MediaRecorder).
 * Texte à lire affiché en grand, jauge de minutes (déjà enregistrées + en cours), niveau du micro animé.
 * Rien ne part tant que Will ne touche pas « Garder » (géré par le parent via `onTermine`).
 */
export function Enregistreur({
  texteALire,
  minutesDeja,
  minutesConseillees,
  onTermine,
  onAnnule,
}: {
  texteALire: string;
  minutesDeja: number;
  minutesConseillees: number;
  onTermine: (e: EnregistrementTermine | null) => void;
  onAnnule?: () => void;
}) {
  const reduit = useReducedMotion();
  const [etat, setEtat] = useState<Etat>(() => (typeof window !== "undefined" && (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") ? "indisponible" : "pret"));
  const [secondes, setSecondes] = useState(0);
  const [niveaux, setNiveaux] = useState<number[]>(() => Array(24).fill(0.08));
  const [ecoute, setEcoute] = useState<string | null>(null);
  const recRef = useRef<MediaRecorder | null>(null);
  const fluxRef = useRef<MediaStream | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const morceaux = useRef<Blob[]>([]);
  const debut = useRef(0);
  const minuteur = useRef<number | null>(null);
  const anim = useRef<number | null>(null);

  const couper = useCallback(() => {
    if (minuteur.current) window.clearInterval(minuteur.current);
    if (anim.current) cancelAnimationFrame(anim.current);
    minuteur.current = null;
    anim.current = null;
    fluxRef.current?.getTracks().forEach((t) => t.stop());
    fluxRef.current = null;
    void ctxRef.current?.close().catch(() => undefined);
    ctxRef.current = null;
  }, []);

  useEffect(
    () => () => {
      if (recRef.current?.state === "recording") recRef.current.stop();
      couper();
    },
    [couper],
  );

  useEffect(
    () => () => {
      if (ecoute) URL.revokeObjectURL(ecoute);
    },
    [ecoute],
  );

  async function demarrer() {
    setEtat("demande");
    try {
      const flux = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      fluxRef.current = flux;
      const mime = choisirMime();
      const rec = new MediaRecorder(flux, mime ? { mimeType: mime } : undefined);
      morceaux.current = [];
      rec.ondataavailable = (e) => e.data.size && morceaux.current.push(e.data);
      rec.onstop = () => {
        const type = rec.mimeType || mime || "audio/webm";
        const blob = new Blob(morceaux.current, { type });
        const duree = (performance.now() - debut.current) / 1000;
        couper();
        setEcoute(URL.createObjectURL(blob));
        setEtat("fini");
        onTermine({ blob, dureeSec: duree, mime: type });
      };
      recRef.current = rec;

      // Niveau du micro (petites barres animées).
      const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (Ctx && !reduit) {
        const ctx = new Ctx();
        ctxRef.current = ctx;
        const analyseur = ctx.createAnalyser();
        analyseur.fftSize = 64;
        ctx.createMediaStreamSource(flux).connect(analyseur);
        const donnees = new Uint8Array(analyseur.frequencyBinCount);
        let dernier = 0;
        const boucle = (t: number) => {
          if (t - dernier > 70) {
            dernier = t;
            analyseur.getByteFrequencyData(donnees);
            setNiveaux(Array.from({ length: 24 }, (_, i) => Math.max(0.08, (donnees[(i + 2) % donnees.length] ?? 0) / 255)));
          }
          anim.current = requestAnimationFrame(boucle);
        };
        anim.current = requestAnimationFrame(boucle);
      }

      debut.current = performance.now();
      setSecondes(0);
      minuteur.current = window.setInterval(() => setSecondes((performance.now() - debut.current) / 1000), 250);
      rec.start(1000);
      setEtat("enregistre");
    } catch {
      couper();
      setEtat("refuse");
    }
  }

  function arreter() {
    if (recRef.current?.state === "recording") recRef.current.stop();
  }

  function recommencer() {
    if (ecoute) URL.revokeObjectURL(ecoute);
    setEcoute(null);
    setSecondes(0);
    setNiveaux(Array(24).fill(0.08));
    onTermine(null);
    setEtat("pret");
  }

  const minutesTotal = minutesDeja + secondes / 60;
  const pctDeja = Math.min(100, (minutesDeja / minutesConseillees) * 100);
  const pctTotal = Math.min(100, (minutesTotal / minutesConseillees) * 100);

  if (etat === "indisponible" || etat === "refuse") {
    return (
      <div className="flex flex-col items-center gap-3 rounded-carte border border-brique/30 bg-brique-doux p-5 text-center">
        <span className="grid size-12 place-items-center rounded-2xl bg-brique text-sur-orange">
          <Icone nom="micro" size={22} />
        </span>
        <p className="font-semibold text-texte">{etat === "refuse" ? "Le micro est bloqué" : "Enregistrement impossible ici"}</p>
        <p className="text-sm text-texte-doux">{etat === "refuse" ? "Autorisez le micro dans votre navigateur, puis réessayez." : "Déposez plutôt un fichier audio."}</p>
        {etat === "refuse" && (
          <Bouton variante="secondaire" icone="reessayer" onClick={() => setEtat("pret")}>
            Réessayer
          </Bouton>
        )}
        {onAnnule && (
          <Bouton variante="fantome" onClick={onAnnule}>
            Déposer un fichier
          </Bouton>
        )}
      </div>
    );
  }

  return (
    <div className="grid gap-5">
      {/* Jauge de minutes */}
      <div>
        <div className="mb-2 flex items-baseline justify-between">
          <span className="text-sm font-semibold text-texte-doux">Minutes enregistrées</span>
          <span className="font-titre text-xl tabular-nums text-texte">
            {minutesLisibles(minutesTotal)}
            <span className="text-sm text-texte-faible"> / {minutesConseillees} min</span>
          </span>
        </div>
        <div className="relative h-3 overflow-hidden rounded-full bg-surface-3" role="progressbar" aria-valuenow={Math.round(pctTotal)} aria-valuemin={0} aria-valuemax={100} aria-label="Minutes enregistrées">
          <div className="absolute inset-y-0 left-0 rounded-full bg-sauge" style={{ width: `${pctDeja}%` }} />
          <motion.div className="absolute inset-y-0 rounded-full bg-orange" style={{ left: `${pctDeja}%` }} animate={{ width: `${Math.max(0, pctTotal - pctDeja)}%` }} transition={{ duration: 0.25 }} />
          <span className="absolute inset-y-0 w-0.5 bg-texte/60" style={{ left: `${Math.min(100, (1 / minutesConseillees) * 100)}%` }} title="Minimum : 1 minute" />
        </div>
      </div>

      {/* Texte à lire */}
      <div className={cn("relative max-h-[34dvh] overflow-y-auto rounded-carte border p-5 transition-colors", etat === "enregistre" ? "border-orange/60 bg-surface-2" : "border-trait bg-surface-2")}>
        <p className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-orange-vif">
          <Icone nom="citation" size={14} />
          Lisez à voix haute
        </p>
        <p className="text-xl leading-relaxed text-texte sm:text-2xl">{texteALire}</p>
      </div>

      {/* Commandes */}
      <div className="flex flex-col items-center gap-4">
        <div className="flex h-12 items-center gap-1" aria-hidden>
          {niveaux.map((n, i) => (
            <span key={i} className={cn("w-1.5 rounded-full transition-[height] duration-75", etat === "enregistre" ? "bg-orange-vif" : "bg-surface-3")} style={{ height: `${Math.round(8 + n * 40)}px` }} />
          ))}
        </div>

        <AnimatePresence mode="wait">
          {etat === "fini" && ecoute ? (
            <motion.div key="fini" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex w-full flex-col items-center gap-3">
              <audio src={ecoute} controls className="w-full" />
              <Bouton variante="fantome" icone="reessayer" onClick={recommencer}>
                Refaire
              </Bouton>
            </motion.div>
          ) : (
            <motion.div key="rec" className="flex flex-col items-center gap-2">
              <button
                type="button"
                onClick={etat === "enregistre" ? arreter : demarrer}
                disabled={etat === "demande"}
                aria-label={etat === "enregistre" ? "Arrêter l'enregistrement" : "Commencer l'enregistrement"}
                className="relative grid size-20 place-items-center rounded-full bg-orange text-sur-orange shadow-orange transition-transform duration-200 active:scale-95 disabled:opacity-60"
              >
                {etat === "enregistre" && !reduit && <motion.span className="absolute inset-0 rounded-full border-2 border-orange-vif" animate={{ scale: [1, 1.35], opacity: [0.8, 0] }} transition={{ duration: 1.2, repeat: Infinity }} />}
                {etat === "enregistre" ? <span className="size-7 rounded-md bg-sur-orange" /> : <Icone nom={etat === "demande" ? "chargement" : "micro"} size={32} className={etat === "demande" ? "animate-spin" : ""} />}
              </button>
              <span className="font-titre text-2xl tabular-nums text-texte">{chrono(secondes)}</span>
              <span className="flex items-center gap-2 text-sm text-texte-faible">
                {etat === "enregistre" ? "Touchez pour arrêter" : "Touchez pour commencer"}
                <PastilleEssai />
              </span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
