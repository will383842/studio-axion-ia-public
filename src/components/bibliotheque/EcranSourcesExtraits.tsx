"use client";

import { useState } from "react";
import { Bouton, EtatVide } from "@/components/ui";
import type { EtatPlageExtrait, FicheSourceExtraits, PlageExtrait } from "@/domaine/archive-extraits";
import type { PolitiqueSources } from "@/briques/archive-extraits/inscription";
import type { SeuilsNoteInteret } from "@/briques/note-extraits/reglage";
import { ExtraitsGardes } from "./ExtraitsGardes";

const ETATS: { etat: EtatPlageExtrait; libelle: string; classe: string }[] = [
  { etat: "utilisable", libelle: "Utilisable", classe: "bg-surface-2 text-texte border-trait-fort" },
  { etat: "a_verifier", libelle: "À vérifier", classe: "bg-surface-1 text-orange-vif border-orange" },
  { etat: "ecartee", libelle: "Écartée", classe: "bg-surface-1 text-texte-faible border-trait" },
  { etat: "exclue", libelle: "Exclue", classe: "bg-brique-doux text-brique border-brique" },
];
const libelleEtat = (e: EtatPlageExtrait): string => ETATS.find((x) => x.etat === e)?.libelle ?? "À vérifier";

function duree(p: PlageExtrait): string {
  const s = Math.max(0, Math.round(p.finSec - p.debutSec));
  return s < 60 ? `${s} s` : `${Math.floor(s / 60)} min ${String(s % 60).padStart(2, "0")} s`;
}

export interface ProprietesEcranSourcesExtraits {
  fiches: FicheSourceExtraits[];
  /** Titre lisible par vidéo (clé : videoId). */
  titres: Record<string, string>;
  inscriptionActive: boolean;
  politique: PolitiqueSources;
  /** Adresse déjà signée d'un aperçu ; le composant ne signe rien. */
  adresseApercu?: (videoId: string, plageId: string) => string | null;
  /** Vidéos dépliées au départ (facultatif). */
  ouvertesAuDepart?: string[];
  /** Vidéos cochées (politique « cochées » seulement). */
  cochees?: string[];
  surEcarter?: (videoId: string, plageId: string) => void;
  surRetablir?: (videoId: string, plageId: string) => void;
  surValider?: (videoId: string, plageId: string) => void;
  surRanger?: (videoId: string) => void;
  surCocher?: (videoId: string) => void;
  /** « Extraits gardés » (X4-12d). Absent : rendu inchangé. Les onglets ne paraissent que si une fiche est notée. */
  note?: {
    seuils?: SeuilsNoteInteret;
    generateurs?: Record<string, string>;
    reseaux?: Record<string, string>;
    surGarderQuandMeme?: (videoId: string, plageId: string) => void;
    surChangerSujet?: (videoId: string, plageId: string, sujet: string) => void;
    surChiffresReels?: (videoId: string, valeur: boolean) => void;
  };
}

/** Archive des extraits : affichage seul, sans page ni action (C3-UT-3.10b-a). */
export function EcranSourcesExtraits(p: ProprietesEcranSourcesExtraits) {
  const [ouvertes, setOuvertes] = useState<string[]>(p.ouvertesAuDepart ?? []);
  const [apercus, setApercus] = useState<string[]>([]);

  if (!p.inscriptionActive) {
    return (
      <div className="font-sans">
        <p role="status" className="rounded-carte border border-trait bg-surface-1 px-4 py-3 text-sm font-semibold text-texte-doux">
          Archive des extraits éteinte
        </p>
        <ul aria-label="Sources d'extraits" />
      </div>
    );
  }
  if (!p.fiches.length) return <EtatVide titre="Aucune source d'extraits pour l'instant" />;

  const notees = p.note ? p.fiches.filter((f) => f.noteVersion !== undefined) : [];
  const liste = (
    <ul aria-label="Sources d'extraits" className="grid grid-cols-1 gap-4 font-sans">
      {p.fiches.map((f) => {
        const ouverte = ouvertes.includes(f.videoId);
        const bascule = () => setOuvertes(ouverte ? ouvertes.filter((i) => i !== f.videoId) : [...ouvertes, f.videoId]);
        return (
          <li key={`${f.videoId}-${f.versionId}`} className="rounded-carte border border-trait bg-surface-1 p-4 shadow-carte">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate font-semibold text-texte">{p.titres[f.videoId] ?? "Vidéo sans titre"}</p>
                <p className="text-xs text-texte-faible">
                  Format {f.ratio} ·{" "}
                  {ETATS.map((e) => ({ e, n: f.plages.filter((x) => x.etat === e.etat).length }))
                    .filter((x) => x.n > 0)
                    .map((x) => `${x.n} ${x.e.libelle.toLowerCase()}${x.n > 1 && x.e.etat !== "utilisable" ? "s" : x.n > 1 ? "s" : ""}`)
                    .join(" · ") || "aucune plage"}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {p.politique === "cochees" && p.surCocher && (
                  <Bouton variante="secondaire" aria-pressed={p.cochees?.includes(f.videoId) ?? false} onClick={() => p.surCocher?.(f.videoId)}>
                    Cocher
                  </Bouton>
                )}
                {p.surRanger && !f.rangee && (
                  <Bouton variante="secondaire" onClick={() => p.surRanger?.(f.videoId)}>
                    Ranger
                  </Bouton>
                )}
                <Bouton variante="discret" aria-expanded={ouverte} onClick={bascule}>
                  {ouverte ? "Replier" : "Déplier"}
                </Bouton>
              </div>
            </div>
            {ouverte && (
              <ul className="mt-3 grid gap-2">
                {f.plages.map((pl) => {
                  const url = apercus.includes(pl.id) ? (p.adresseApercu?.(f.videoId, pl.id) ?? null) : null;
                  const e = ETATS.find((x) => x.etat === pl.etat) ?? ETATS[1];
                  return (
                    <li key={pl.id} data-plage={pl.id} className="rounded-carte border border-trait bg-surface-2 p-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${e.classe}`}>{libelleEtat(pl.etat)}</span>
                        <span className="text-xs text-texte-faible">{duree(pl)}</span>
                      </div>
                      <p className="mt-1 text-sm text-texte">{pl.texte}</p>
                      {pl.etat !== "utilisable" && pl.raisonExclusion && <p className="text-xs text-texte-faible">{pl.raisonExclusion}</p>}
                      {url && <video src={url} muted playsInline preload="none" controls className="mt-2 w-full rounded-carte" />}
                      <div className="mt-2 flex flex-wrap gap-2">
                        {p.adresseApercu && !url && (
                          <Bouton variante="discret" onClick={() => setApercus([...apercus, pl.id])}>
                            Voir l&apos;aperçu
                          </Bouton>
                        )}
                        {p.surValider && pl.etat === "a_verifier" && (
                          <Bouton variante="secondaire" onClick={() => p.surValider?.(f.videoId, pl.id)}>
                            Valider
                          </Bouton>
                        )}
                        {p.surEcarter && (pl.etat === "utilisable" || pl.etat === "a_verifier") && (
                          <Bouton variante="discret" onClick={() => p.surEcarter?.(f.videoId, pl.id)}>
                            Écarter
                          </Bouton>
                        )}
                        {p.surRetablir && pl.etat === "ecartee" && (
                          <Bouton variante="discret" onClick={() => p.surRetablir?.(f.videoId, pl.id)}>
                            Rétablir
                          </Bouton>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </li>
        );
      })}
    </ul>
  );
  if (!p.note || notees.length === 0) return liste;
  return (
    <div className="grid gap-6">
      <ExtraitsGardes
        noteActive
        fiches={notees}
        titres={p.titres}
        seuils={p.note.seuils}
        generateurs={p.note.generateurs}
        reseaux={p.note.reseaux}
        surNePlusProposer={p.surEcarter}
        surGarderQuandMeme={p.note.surGarderQuandMeme}
        surChangerSujet={p.note.surChangerSujet}
        surChiffresReels={p.note.surChiffresReels}
      />
      {liste}
    </div>
  );
}
