"use client";

import { useId, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { envoyerFichier, ErreurEnvoi, phraseAttente } from "@/lib/envoi-multipart";
import { Icone, type NomIcone } from "./Icone";
import { PastilleEssai } from "./PastilleEssai";
import { BarreProgression } from "./ProgressionEtapes";
import { ErreurLisible } from "@/lib/erreur-lisible";

/** Envoi direct au stockage, par morceaux, avec reprise (lot M1b) : rushs de 1 à 2 Go. */
export interface EnvoiZoneDepot {
  typeEntite: string;
  entiteId: string;
  /** Fichiers enregistrés par le studio, une fois envoyés. */
  onEnvoyes: (fichiers: { fichierId: string; nom: string }[]) => void;
  onErreur?: (message: string) => void;
}

/**
 * Zone de dépôt (glisser-déposer ou toucher pour choisir). Remet les fichiers à `onFichiers`.
 * Avec `envoi`, elle les ENVOIE aussi elle-même, directement au stockage, par morceaux et avec reprise
 * (barre de progression, « gardez l'écran allumé ») ; sans R2, l'envoi est simulé. Coupure ou redémarrage du studio : l'envoi attend et
 * reprend tout seul (phrase sous la barre) ; arrêté pour de bon, la zone propose « Reprendre l'envoi » (repart du dernier morceau reçu).
 */
export function ZoneDepot({
  libelle,
  detail,
  accepte,
  multiple = true,
  icone = "telecharger",
  onFichiers,
  essai = true,
  compacte,
  envoi,
  className,
}: {
  libelle: string;
  detail?: string;
  /** Types acceptés (« image/*,video/* », « .cube »). */
  accepte?: string;
  multiple?: boolean;
  icone?: NomIcone;
  onFichiers: (fichiers: File[]) => void;
  /** Dépôt simulé (pastille « Essai »). */
  essai?: boolean;
  compacte?: boolean;
  envoi?: EnvoiZoneDepot;
  className?: string;
}) {
  const id = useId();
  const ref = useRef<HTMLInputElement>(null);
  const [survol, setSurvol] = useState(false);
  const [progression, setProgression] = useState<{ nom: string; pourcentage: number } | null>(null);
  const [attente, setAttente] = useState<string | null>(null);
  /** Envoi arrêté pour de bon : les fichiers pas encore envoyés, pour « Reprendre l'envoi ». */
  const [aReprendre, setAReprendre] = useState<File[] | null>(null);

  async function envoyer(f: File[]) {
    if (!envoi) return;
    setAReprendre(null);
    const envoyes: { fichierId: string; nom: string }[] = [];
    let i = 0;
    try {
      for (; i < f.length; i++) {
        const fichier = f[i];
        setProgression({ nom: fichier.name, pourcentage: 0 });
        const r = await envoyerFichier(fichier, { typeEntite: envoi.typeEntite, entiteId: envoi.entiteId }, { onProgression: (p) => setProgression({ nom: fichier.name, pourcentage: p }), onAttente: (a) => setAttente(a ? phraseAttente(a) : null) });
        envoyes.push({ fichierId: r.fichierId, nom: fichier.name });
      }
      envoi.onEnvoyes(envoyes);
    } catch (e) {
      envoi.onErreur?.(e instanceof ErreurLisible && e.message ? e.message : "L'envoi s'est interrompu. Choisissez à nouveau le fichier : il reprendra où il s'est arrêté.");
      if (!(e instanceof ErreurEnvoi) || e.reprenable) setAReprendre(f.slice(i));
      if (envoyes.length) envoi.onEnvoyes(envoyes);
    } finally {
      setProgression(null);
      setAttente(null);
    }
  }

  async function recevoir(f: File[]) {
    onFichiers(f);
    if (!envoi || progression) return;
    await envoyer(f);
  }
  return (
    <div
      onDragEnter={(e) => {
        e.preventDefault();
        setSurvol(true);
      }}
      onDragOver={(e) => {
        e.preventDefault();
        setSurvol(true);
      }}
      onDragLeave={() => setSurvol(false)}
      onDrop={(e) => {
        e.preventDefault();
        setSurvol(false);
        const f = Array.from(e.dataTransfer?.files ?? []);
        if (f.length) void recevoir(multiple ? f : f.slice(0, 1));
      }}
      className={cn(
        "relative isolate flex flex-col items-center justify-center gap-2 overflow-hidden rounded-carte border-2 border-dashed text-center transition-colors duration-200",
        compacte ? "min-h-28 p-4" : "min-h-44 p-6",
        survol ? "border-orange bg-orange-doux" : "border-trait-fort bg-surface-1 hover:border-orange/60",
        className,
      )}
    >
      <input
        ref={ref}
        id={id}
        type="file"
        accept={accepte}
        multiple={multiple}
        className="sr-only"
        onChange={(e) => {
          const f = Array.from(e.target.files ?? []);
          if (f.length) void recevoir(f);
          e.target.value = "";
        }}
      />
      <span className={cn("grid place-items-center rounded-2xl bg-orange-doux text-orange-vif", compacte ? "size-10" : "size-14")}>
        <Icone nom={icone} size={compacte ? 20 : 26} />
      </span>
      <label htmlFor={id} className="cursor-pointer text-[15px] font-semibold text-texte after:absolute after:inset-0 after:content-['']">
        {libelle}
      </label>
      {detail && !progression && <span className="text-sm text-texte-faible">{detail}</span>}
      {progression && (
        <div className="relative z-10 w-full max-w-xs space-y-1.5" aria-live="polite">
          <BarreProgression valeur={progression.pourcentage} libelle={`Envoi de ${progression.nom}`} />
          <p className="text-xs tabular-nums text-texte-faible">
            {progression.pourcentage} % · Gardez l&apos;écran allumé
          </p>
          {attente && <p className="text-xs font-semibold text-ambre">{attente}</p>}
        </div>
      )}
      {aReprendre && !progression && (
        <button type="button" onClick={() => void envoyer(aReprendre)} className="relative z-10 rounded-full bg-orange px-4 py-2 text-sm font-semibold text-sur-orange">
          Reprendre l&apos;envoi
        </button>
      )}
      {essai && <PastilleEssai className="absolute right-3 top-3" />}
    </div>
  );
}
