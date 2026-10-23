"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import type { VueTravail } from "@/services/vues";

/**
 * Progression en direct (B.8 transverses) : interroge /api/travaux toutes les 2 s
 * tant qu'un travail est actif (puis toutes les 15 s), et s'arrête quand l'onglet est caché.
 * `travailId` : ne suivre qu'un travail. `onTermine` : appelé une fois par travail terminé.
 */
export function useTravaux(options: { travailId?: string; videoId?: string; initial?: VueTravail[]; onTermine?: (t: VueTravail) => void; intervalleMs?: number } = {}) {
  const { travailId, videoId, initial = [], onTermine, intervalleMs = 2000 } = options;
  const router = useRouter();
  const [travaux, setTravaux] = useState<VueTravail[]>(initial);
  const [erreur, setErreur] = useState<string | null>(null);
  // TEST-UI-REEL U7 : une première réponse est arrivée (sinon l'écran ne sait pas encore s'il y a un travail).
  const [charge, setCharge] = useState(false);
  const dejaTermines = useRef(new Set(initial.filter((t) => t.statut === "termine").map((t) => t.id)));
  const rappel = useRef(onTermine);
  useEffect(() => {
    rappel.current = onTermine;
  }, [onTermine]);

  const charger = useCallback(async () => {
    try {
      const url = adresseTravaux(travailId, videoId);
      const r = await fetch(url, { cache: "no-store" });
      if (r.status === 401) {
        router.replace("/connexion");
        return [];
      }
      const donnees = (await r.json()) as { travaux: VueTravail[] };
      setTravaux(donnees.travaux);
      setErreur(null);
      setCharge(true);
      for (const t of donnees.travaux) {
        if (t.statut === "termine" && !dejaTermines.current.has(t.id)) {
          dejaTermines.current.add(t.id);
          rappel.current?.(t);
        }
      }
      return donnees.travaux;
    } catch {
      setErreur("Connexion perdue");
      return null;
    }
  }, [travailId, videoId, router]);

  useEffect(() => {
    let arret = false;
    let minuterie: ReturnType<typeof setTimeout>;
    async function boucle() {
      if (arret) return;
      const liste = document.visibilityState === "visible" ? await charger() : null;
      const actifs = (liste ?? []).some((t) => t.statut === "en_cours" || t.statut === "en_file");
      minuterie = setTimeout(boucle, actifs || liste === null ? intervalleMs : 15000);
    }
    void boucle();
    const reprise = () => document.visibilityState === "visible" && void charger();
    document.addEventListener("visibilitychange", reprise);
    return () => {
      arret = true;
      clearTimeout(minuterie);
      document.removeEventListener("visibilitychange", reprise);
    };
  }, [charger, intervalleMs]);

  const travail = travailId ? (travaux.find((t) => t.id === travailId) ?? null) : null;
  return { travaux, travail, erreur, charge, actualiser: charger };
}

/** Adresse interrogée : un travail (`id`), la dernière fabrication d'une vidéo (`video`), ou tous les travaux en cours. */
export function adresseTravaux(travailId?: string, videoId?: string): string {
  const p = new URLSearchParams();
  if (travailId) p.set("id", travailId);
  if (videoId) p.set("video", videoId);
  const q = p.toString();
  return q ? `/api/travaux?${q}` : "/api/travaux";
}

/**
 * TEST-UI-REEL U7 : le travail que l'écran de fabrication montre : le plus récent entre celui qu'il connaît
 * (`travailId`) et la dernière fabrication de la vidéo ; sinon un travail de fabrication de cette vidéo.
 */
export function travailAffiche(travaux: VueTravail[], travailId: string | undefined, videoId: string | undefined): VueTravail | undefined {
  const candidats = travaux.filter((t) => t.id === travailId || (!!videoId && t.cibleId === videoId && t.type === "fabrication"));
  return candidats.sort((a, b) => b.creeLe.localeCompare(a.creeLe))[0];
}
