"use client";

/**
 * Rappels d'envoi face caméra sur l'accueil (plan facecam v4, B.13 ; lot D) :
 * - « Envoi en pause à 63 % — Reprendre » (envoi coupé sur ce téléphone, retenu dans le navigateur) ;
 * - « Envoyer ma vidéo de : <titre> » pour chaque vidéo face caméra validée et pas encore reçue.
 * Rien quand il n'y a rien à faire.
 */
import Link from "next/link";
import { useEffect, useState } from "react";
import { Icone } from "@/components/ui/Icone";
import { CLE_ENVOI_EN_PAUSE, type EnvoiEnPause } from "./EnvoiIphone";

export function RappelsEnvoi({ aEnvoyer }: { aEnvoyer: { varianteId: string; titre: string }[] }) {
  const [pause, setPause] = useState<EnvoiEnPause | null>(null);
  useEffect(() => {
    try {
      const brut = localStorage.getItem(CLE_ENVOI_EN_PAUSE);
      const p = brut ? (JSON.parse(brut) as EnvoiEnPause) : null;
      // Une pause de plus de 7 jours n'est plus reprise par le stockage : on l'oublie.
      if (p && Date.now() - Date.parse(p.le) < 7 * 86_400_000) queueMicrotask(() => setPause(p));
      else if (p) localStorage.removeItem(CLE_ENVOI_EN_PAUSE);
    } catch {
      // Stockage du navigateur indisponible : pas de rappel.
    }
  }, []);
  const autres = aEnvoyer.filter((a) => a.varianteId !== pause?.varianteId);
  if (!pause && !autres.length) return null;
  return (
    <ul className="space-y-2">
      {pause && (
        <li>
          <Link href={`/envoyer/${pause.varianteId}`} className="flex min-h-14 items-center gap-3 rounded-2xl border border-ambre/40 bg-ambre-doux px-4 py-3 text-[15px] text-texte">
            <Icone nom="attention" size={18} className="shrink-0 text-ambre" />
            <span className="min-w-0 flex-1">
              <span className="block font-semibold">Envoi en pause à {pause.pourcentage} %</span>
              <span className="block truncate text-sm text-texte-doux">{pause.titre}</span>
            </span>
            <span className="shrink-0 font-semibold text-orange-vif">Reprendre</span>
          </Link>
        </li>
      )}
      {autres.map((a) => (
        <li key={a.varianteId}>
          <Link href={`/envoyer/${a.varianteId}`} className="flex min-h-14 items-center gap-3 rounded-2xl border border-trait bg-surface-1 px-4 py-3 text-[15px] text-texte hover:bg-surface-2">
            <span className="grid size-9 shrink-0 place-items-center rounded-full bg-orange-doux text-orange-vif">
              <Icone nom="video" size={17} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm text-texte-faible">Envoyer ma vidéo de :</span>
              <span className="block truncate font-semibold">{a.titre}</span>
            </span>
            <Icone nom="chevron-droite" size={16} className="shrink-0 text-texte-faible" />
          </Link>
        </li>
      ))}
    </ul>
  );
}
