"use client";

import { useState, useTransition } from "react";
import { EcranSourcesExtraits } from "@/components/bibliotheque/EcranSourcesExtraits";
import type { PolitiqueSources } from "@/briques/archive-extraits/inscription";
import type { FicheSourceExtraits } from "@/domaine/archive-extraits";
import {
  cocherVideoAction,
  ecarterPlageAction,
  rangerSourceAction,
  retablirPlageAction,
  validerPlageAction,
} from "@/app/(studio)/bibliotheque/source-extraits/actions";
import {
  changerSujetAction,
  garderQuandMemeAction,
  marquerChiffresReelsAction,
} from "@/app/(studio)/bibliotheque/source-extraits/actions-note";
import type { SeuilsNoteInteret } from "@/briques/note-extraits/reglage";

interface Proprietes {
  fiches: FicheSourceExtraits[];
  titres: Record<string, string>;
  inscriptionActive: boolean;
  politique: PolitiqueSources;
  cochees: string[];
  note?: { seuils?: SeuilsNoteInteret; generateurs?: Record<string, string>; reseaux?: Record<string, string> };
}

type Resultat = { ok: boolean; message?: string };

/** Lien entre l'écran (affichage seul) et les actions serveur : un geste, un refus éventuel affiché tel quel (C3-UT-3.10b-d). */
export function EcranSourcesExtraitsBranche(p: Proprietes) {
  const [, demarrer] = useTransition();
  const [refus, setRefus] = useState<string | null>(null);
  const lancer = (geste: () => Promise<Resultat>) =>
    demarrer(async () => {
      const r = await geste();
      setRefus(r.ok ? null : (r.message ?? "Le geste n'a pas pu être fait."));
    });
  return (
    <>
      <EcranSourcesExtraits
        fiches={p.fiches}
        titres={p.titres}
        inscriptionActive={p.inscriptionActive}
        politique={p.politique}
        cochees={p.cochees}
        surEcarter={(v, id) => lancer(() => ecarterPlageAction(v, id))}
        surRetablir={(v, id) => lancer(() => retablirPlageAction(v, id))}
        surValider={(v, id) => lancer(() => validerPlageAction(v, id))}
        surRanger={(v) => lancer(() => rangerSourceAction(v, true))}
        surCocher={(v) => lancer(() => cocherVideoAction(v, !p.cochees.includes(v)))}
        note={
          p.note && {
            ...p.note,
            surGarderQuandMeme: (v, id) => lancer(() => garderQuandMemeAction(v, id)),
            surChangerSujet: (v, id, sujet) => lancer(() => changerSujetAction(v, id, sujet)),
            surChiffresReels: (v, oui) => lancer(() => marquerChiffresReelsAction(v, oui)),
          }
        }
      />
      {refus && (
        <p role="status" className="mt-3 rounded-carte border border-brique bg-brique-doux px-4 py-3 text-sm font-semibold text-brique">
          {refus}
        </p>
      )}
    </>
  );
}
