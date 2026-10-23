"use client";

/**
 * MAQUETTE COMPOSÉE DANS LE NAVIGATEUR (moteur avocat, lot M1 ; plan B.1 « Maquette », B.9).
 * Aucune vidéo n'est fabriquée : la piste `audio-maitre` (la vraie voix, nettoyée) est lue par le navigateur et les
 * plans définitifs défilent dessus, avec leur vignette, leur cadrage (large / poitrine, zoom lent) et les sous-titres.
 * Toucher un plan y amène la lecture. Composant AUTONOME : l'écran « Votre vidéo » (lot M3) l'intègre tel quel et y
 * ajoutera le plateau composé (double détouré sur le décor).
 */
import { Pause, Play } from "lucide-react";
import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { Icone } from "@/components/ui/Icone";
import type { CadragePlan, Ratio, SegmentSousTitres, SourceImage } from "@/domaine/types";
import { cn } from "@/lib/cn";

export interface PlanMaquette {
  ordre: number;
  debutSec: number;
  finSec: number;
  texte: string;
  sourceImage: SourceImage;
  angle?: string;
  cadrage?: CadragePlan;
  /** Adresse de la vignette du plan (image du double, ou de l'illustration). */
  vignette?: string | null;
}

const ASPECT: Record<Ratio, string> = { "9:16": "aspect-[9/16]", "1:1": "aspect-square", "4:5": "aspect-[4/5]", "16:9": "aspect-video" };

/** Plan affiché à l'instant `t` (PUR, testé). */
export function planA<T extends { debutSec: number; finSec: number }>(plans: T[], t: number): number {
  const i = plans.findIndex((p) => t >= p.debutSec && t < p.finSec);
  return i >= 0 ? i : t >= (plans.at(-1)?.finSec ?? 0) ? plans.length - 1 : 0;
}

/** Zoom du plan à l'instant `t` : fixe, ou zoom lent du début à la fin du plan (PUR, testé). */
export function zoomA(plan: { debutSec: number; finSec: number; cadrage?: Pick<CadragePlan, "zoom" | "zoomFin"> }, t: number): number {
  const z0 = plan.cadrage?.zoom ?? 1;
  const z1 = plan.cadrage?.zoomFin;
  if (z1 === undefined) return z0;
  const p = Math.min(1, Math.max(0, (t - plan.debutSec) / Math.max(0.01, plan.finSec - plan.debutSec)));
  return z0 + (z1 - z0) * p;
}

const temps = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

export function MaquetteNavigateur({ plans, audioUrl, dureeSec, sousTitres = [], ratio = "9:16", className }: { plans: PlanMaquette[]; audioUrl: string; dureeSec: number; sousTitres?: SegmentSousTitres[]; ratio?: Ratio; className?: string }) {
  const audio = useRef<HTMLAudioElement>(null);
  const bande = useRef<HTMLOListElement>(null);
  const [t, setT] = useState(0);
  const [lecture, setLecture] = useState(false);
  const courant = planA(plans, t);
  const plan = plans[courant];
  const groupe = sousTitres.find((s) => t >= s.debutSec && t <= s.finSec + 0.05);

  // Pendant la lecture : l'instant suit le son, image par image.
  useEffect(() => {
    if (!lecture) return;
    let id = 0;
    const suivre = () => {
      setT(audio.current?.currentTime ?? 0);
      id = requestAnimationFrame(suivre);
    };
    id = requestAnimationFrame(suivre);
    return () => cancelAnimationFrame(id);
  }, [lecture]);

  // Le plan en cours reste visible dans la bande.
  useEffect(() => {
    const el = bande.current?.children[courant] as HTMLElement | undefined;
    el?.scrollIntoView?.({ block: "nearest", inline: "center", behavior: "smooth" });
  }, [courant]);

  const basculer = useCallback(() => {
    const a = audio.current;
    if (!a) return;
    if (a.paused) void a.play().catch(() => setLecture(false));
    else a.pause();
  }, []);

  const aller = (sec: number) => {
    if (audio.current) audio.current.currentTime = sec;
    setT(sec);
  };

  if (!plans.length) return null;
  const zoom = plan ? zoomA(plan, t) : 1;
  const pointInteret = plan?.cadrage?.pointInteret ?? { x: 0.5, y: 0.38 };

  return (
    <section className={cn("flex flex-col gap-4", className)} aria-label="Aperçu des plans sur votre voix">
      <div className={cn("relative mx-auto w-[64%] max-w-[300px] overflow-hidden rounded-[20px] border border-trait bg-surface-2 shadow-carte", ASPECT[ratio])}>
        {plan?.vignette ? (
          <Image
            src={plan.vignette}
            alt=""
            fill
            unoptimized
            sizes="300px"
            className="object-cover"
            style={{ transform: `scale(${zoom})`, transformOrigin: `${pointInteret.x * 100}% ${pointInteret.y * 100}%` }}
          />
        ) : (
          <div className="absolute inset-0 grid place-items-center text-texte-faible">
            <Icone nom={plan?.sourceImage === "illustration" ? "image" : "visage"} size={40} />
          </div>
        )}
        {/* Sous-titre en cours, centre à 48 % ; mots en valeur en orange (jeton de la marque). */}
        {groupe ? (
          <p className="absolute inset-x-3 top-[48%] -translate-y-1/2 text-center text-[15px] font-bold leading-tight text-texte [paint-order:stroke_fill] [-webkit-text-stroke:3px_var(--fond)]">
            {groupe.mots.map((m, i) => (
              <span key={i} className={m.enValeur ? "text-orange-vif" : undefined}>
                {i ? " " : ""}
                {m.mot}
              </span>
            ))}
          </p>
        ) : null}
        <span className="absolute left-2 top-2 rounded-full bg-voile px-2.5 py-1 text-xs font-semibold text-texte">
          {plan?.sourceImage === "illustration" ? "Image" : plan?.cadrage?.valeur === "poitrine" ? "Vous, de près" : "Vous"}
        </span>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={basculer}
          aria-label={lecture ? "Pause" : "Écouter avec les plans"}
          className="grid size-12 shrink-0 place-items-center rounded-full bg-orange text-sur-orange shadow-orange transition active:scale-95"
        >
          {lecture ? <Pause aria-hidden="true" size={20} strokeWidth={1.9} /> : <Play aria-hidden="true" size={20} strokeWidth={1.9} />}
        </button>
        <input
          type="range"
          min={0}
          max={dureeSec}
          step={0.04}
          value={Math.min(t, dureeSec)}
          onChange={(e) => aller(Number(e.target.value))}
          aria-label="Position dans la vidéo"
          className="h-11 flex-1 accent-[var(--orange-vif)]"
        />
        <span className="w-20 shrink-0 text-right text-sm tabular-nums text-texte-doux">
          {temps(t)} / {temps(dureeSec)}
        </span>
      </div>

      <ol ref={bande} className="flex snap-x gap-2 overflow-x-auto pb-1" aria-label="Plans">
        {plans.map((p, i) => (
          <li key={p.ordre} className="snap-center">
            <button
              type="button"
              onClick={() => aller(p.debutSec + 0.01)}
              aria-current={i === courant ? "true" : undefined}
              aria-label={`Plan ${p.ordre}, à ${temps(p.debutSec)}`}
              className={cn(
                "relative flex h-24 w-14 flex-col justify-end overflow-hidden rounded-xl border bg-surface-2 p-1 text-left transition",
                i === courant ? "border-orange-vif ring-2 ring-orange-vif/40" : "border-trait",
              )}
            >
              {p.vignette ? <Image src={p.vignette} alt="" fill unoptimized sizes="56px" className="object-cover opacity-80" /> : null}
              <span className="relative text-[11px] font-semibold tabular-nums text-texte">{(p.finSec - p.debutSec).toFixed(1)} s</span>
              <Icone nom={p.sourceImage === "illustration" ? "image" : "visage"} size={14} className="relative text-texte-doux" />
            </button>
          </li>
        ))}
      </ol>

      <audio
        ref={audio}
        src={audioUrl}
        preload="auto"
        onPlay={() => setLecture(true)}
        onPause={() => setLecture(false)}
        onEnded={() => setLecture(false)}
        onTimeUpdate={(e) => !lecture && setT(e.currentTarget.currentTime)}
      />
    </section>
  );
}
