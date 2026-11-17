"use client";

import { useState } from "react";
import type { FicheSourceExtraits, PlageExtrait } from "@/domaine/archive-extraits";
import { LIBELLE_SUJET_EXTRAIT } from "@/briques/note-extraits/sujets";
import { SEUILS_PAR_DEFAUT, type SeuilsNoteInteret } from "@/briques/note-extraits/reglage";
import { pourquoiIgnores } from "@/briques/archive-extraits/raisons-note";
import type { SujetExtrait } from "@/briques/note-extraits/types";

type Onglet = "gardes" | "peut-etre" | "ignores";

/** Une plage notée, avec la fiche d'où elle vient. */
type Carte = { fiche: FicheSourceExtraits; plage: PlageExtrait & { note: number } };

export type ApercuDemande = { videoId: string; plageId: string; debutSec: number; finSec: number };

export interface ProprietesExtraitsGardes {
  fiches: FicheSourceExtraits[];
  /** Titre lisible de chaque vidéo d'origine, par identifiant de vidéo. */
  titres: Record<string, string>;
  seuils?: SeuilsNoteInteret;
  /** Libellé du format (générateur) de chaque vidéo, par identifiant de vidéo. Absent : le filtre porte sur la vidéo. */
  generateurs?: Record<string, string>;
  /** Réseau de chaque vidéo, par identifiant de vidéo. Absent : pas de filtre « Réseau ». */
  reseaux?: Record<string, string>;
  /** Seul `true` exact allume. */
  noteActive: boolean | undefined;
  /** Adresse de l'aperçu (avec `#t=`), chargée au clic seulement. */
  urlApercu?: (c: ApercuDemande) => string | null;
  surApercu?: (c: ApercuDemande) => void;
  surNePlusProposer?: (videoId: string, plageId: string) => void;
  surGarderQuandMeme?: (videoId: string, plageId: string) => void;
  surChangerSujet?: (videoId: string, plageId: string, sujet: string) => void;
  surChiffresReels?: (videoId: string, valeur: boolean) => void;
}

/** Note en mots : 80 et plus « très utile », 60 et plus « utile », sinon « peut-être ». */
/** Raisons de la note (codes de `noter.ts`) en phrases simples. Un code inconnu n'est jamais affiché tel quel. */
export const RAISON_EN_CLAIR: Readonly<Record<string, string>> = {
  interface: "on voit l'écran du logiciel",
  chiffre: "un chiffre est visible",
  demarche: "on voit une démarche pas à pas",
  geste: "on voit un geste",
  texte: "du texte à l'écran",
  visage: "un visage à l'écran",
  inconnu: "contenu pas très clair",
  "source-propre": "image propre, sans visage ni texte incrusté",
  "texte-incruste": "du texte est incrusté dans l'image",
  "sujet-reconnu": "le sujet est reconnu",
  "sujet-absent": "le sujet n'est pas reconnu",
  fait: "un fait précis est annoncé",
  "mot-cle": "le mot-clé de la vidéo est dit",
  "phrase-creuse": "phrase un peu creuse",
  duree: "durée idéale (3 à 6 secondes)",
  "exclu-droit": "exclu : on n'a pas le droit de l'utiliser",
};

export function raisonsEnClair(raisons: readonly { code: string }[] | undefined): string {
  const phrases = (raisons ?? []).map((r) => RAISON_EN_CLAIR[r.code] ?? "autre critère");
  return [...new Set(phrases)].join(", ");
}

export function motsDeNote(note: number): string {
  if (note >= 80) return "très utile";
  if (note >= 60) return "utile";
  return "peut-être";
}

const LIBELLE_USAGE: Record<string, string> = {
  telephone: "Téléphone",
  ecran: "Écran",
  fond: "Fond",
  "preuve-chiffree": "Preuve chiffrée",
};
const libelleSujet = (s: string): string => (LIBELLE_SUJET_EXTRAIT as Record<string, string>)[s] ?? s;
const minutes = (s: number): string => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

const CLASSE_BOUTON = "min-h-11 rounded-carte border border-trait-fort px-3 text-sm font-semibold text-texte";

export function ExtraitsGardes({ fiches, titres, seuils = SEUILS_PAR_DEFAUT, generateurs: formats, reseaux, noteActive, urlApercu, surApercu, surNePlusProposer, surGarderQuandMeme, surChangerSujet, surChiffresReels }: ProprietesExtraitsGardes) {
  const [onglet, setOnglet] = useState<Onglet>("gardes");
  const [sujet, setSujet] = useState("");
  const [usage, setUsage] = useState("");
  const [generateur, setGenerateur] = useState("");
  const [reseau, setReseau] = useState("");
  const [ouverts, setOuverts] = useState<Record<string, boolean>>({});

  if (noteActive !== true) return null;
  const cartes: Carte[] = fiches.flatMap((fiche) =>
    fiche.plages.filter((p): p is PlageExtrait & { note: number } => typeof p.note === "number").map((plage) => ({ fiche, plage })),
  );
  const ignores = fiches.filter((f) => f.ignores && f.ignores.nombre > 0);
  if (cartes.length === 0 && ignores.length === 0) return null;

  const gardes = cartes.filter((c) => c.plage.note >= seuils.garde);
  const peutEtre = cartes.filter((c) => c.plage.note < seuils.garde && c.plage.note >= seuils.peutEtre);
  const nbIgnores = ignores.reduce((n, f) => n + (f.ignores?.nombre ?? 0), 0);

  const sujets = [...new Set(cartes.map((c) => c.plage.sujet).filter((s): s is string => !!s))];
  const usages = [...new Set(cartes.flatMap((c) => c.plage.usages ?? []))];
  const cleGenerateur = (c: Carte): string => (formats ? (formats[c.fiche.videoId] ?? "") : c.fiche.videoId);
  const generateurs = [...new Set(cartes.map(cleGenerateur).filter((g) => g !== ""))];
  const cleReseau = (c: Carte): string => reseaux?.[c.fiche.videoId] ?? "";
  const listeReseaux = [...new Set(cartes.map(cleReseau).filter((r) => r !== ""))];
  const filtre = (liste: Carte[]) =>
    liste.filter((c) => (!sujet || c.plage.sujet === sujet) && (!usage || (c.plage.usages ?? []).includes(usage)) && (!generateur || cleGenerateur(c) === generateur) && (!reseau || cleReseau(c) === reseau));

  const visibles = onglet === "gardes" ? filtre(gardes) : onglet === "peut-etre" ? filtre(peutEtre) : [];
  const onglets: { id: Onglet; libelle: string }[] = [
    { id: "gardes", libelle: `Gardés (${gardes.length})` },
    { id: "peut-etre", libelle: `Peut-être (${peutEtre.length})` },
    { id: "ignores", libelle: `Ignorés (pourquoi) (${nbIgnores})` },
  ];
  const selecteur = (libelle: string, valeur: string, options: [string, string][], change: (v: string) => void) =>
    options.length > 0 && (
      <label className="grid gap-1 text-xs text-texte-faible">
        {libelle}
        <select className="min-h-11 rounded-carte border border-trait-fort bg-surface-2 px-2 text-sm text-texte" value={valeur} onChange={(e) => change(e.target.value)}>
          <option value="">Tous</option>
          {options.map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </select>
      </label>
    );

  return (
    <section className="grid gap-4 font-texte" aria-label="Extraits gardés">
      <p className="rounded-carte border border-trait-fort bg-surface-2 p-3 text-sm text-texte">Le Studio trie tout seul. Vous pouvez corriger si vous le souhaitez.</p>

      <div role="tablist" className="flex flex-wrap gap-2">
        {onglets.map((o) => (
          <button key={o.id} type="button" role="tab" aria-selected={onglet === o.id} onClick={() => setOnglet(o.id)}
            className={`${CLASSE_BOUTON} ${onglet === o.id ? "bg-surface-2" : "text-texte-faible"}`}>
            {o.libelle}
          </button>
        ))}
      </div>

      {onglet !== "ignores" && (
        <div className="flex flex-wrap gap-3">
          {selecteur("Sujet", sujet, sujets.map((s) => [s, libelleSujet(s)]), setSujet)}
          {selecteur("Usage", usage, usages.map((u) => [u, LIBELLE_USAGE[u] ?? u]), setUsage)}
          {selecteur("Générateur", generateur, generateurs.map((g) => [g, formats ? g : (titres[g] ?? g)]), setGenerateur)}
          {reseaux && selecteur("Réseau", reseau, listeReseaux.map((r) => [r, r]), setReseau)}
        </div>
      )}

      {onglet === "ignores" ? (
        <ul className="grid gap-2">
          {ignores.length === 0 && <li className="text-sm text-texte-faible">{"Rien n'a été ignoré."}</li>}
          {ignores.map((f) => (
            <li key={f.videoId} className="rounded-carte border border-trait-fort bg-surface-2 p-3 text-sm text-texte">
              <span className="font-semibold">{titres[f.videoId] ?? f.videoId}</span> : {pourquoiIgnores(f.ignores)}
            </li>
          ))}
        </ul>
      ) : (
        <ul className="grid gap-3">
          {visibles.length === 0 && <li className="text-sm text-texte-faible">{"Aucun extrait ici pour l'instant."}</li>}
          {visibles.map(({ fiche, plage }) => {
            const demande: ApercuDemande = { videoId: fiche.videoId, plageId: plage.id, debutSec: plage.debutSec, finSec: plage.finSec };
            const cle = `${fiche.videoId}/${plage.id}`;
            const url = ouverts[cle] ? urlApercu?.(demande) : null;
            return (
              <li key={cle} className="grid gap-2 rounded-carte border border-trait-fort bg-surface-2 p-4">
                <div className="flex flex-wrap items-baseline gap-2 text-texte">
                  <span className="font-semibold">{motsDeNote(plage.note)}</span>
                  <span className="text-sm text-texte-faible">{plage.note} sur 100</span>
                </div>
                <p className="text-sm text-texte">{plage.texte}</p>
                {(plage.raisonsNote?.length ?? 0) > 0 && (
                  <p className="text-xs text-texte-faible">{raisonsEnClair(plage.raisonsNote)}</p>
                )}
                <p className="text-xs text-texte-faible">
                  {plage.sujet ? `${libelleSujet(plage.sujet as SujetExtrait)} · ` : ""}
                  {(plage.usages ?? []).map((u) => LIBELLE_USAGE[u] ?? u).join(", ")}
                  {` · ${titres[fiche.videoId] ?? fiche.videoId} (${minutes(plage.debutSec)} à ${minutes(plage.finSec)})`}
                </p>
                {url && <video controls preload="metadata" src={url} className="w-full rounded-carte" />}
                <div className="flex flex-wrap gap-2">
                  {surApercu && (
                    <button type="button" className={CLASSE_BOUTON} onClick={() => { setOuverts((o) => ({ ...o, [cle]: true })); surApercu(demande); }}>
                      {"Voir l'aperçu"}
                    </button>
                  )}
                  {surNePlusProposer && <button type="button" className={CLASSE_BOUTON} onClick={() => surNePlusProposer(fiche.videoId, plage.id)}>Ne plus proposer</button>}
                  {surGarderQuandMeme && onglet === "peut-etre" && <button type="button" className={CLASSE_BOUTON} onClick={() => surGarderQuandMeme(fiche.videoId, plage.id)}>Garder quand même</button>}
                  {surChangerSujet && (
                    <select aria-label="Changer le sujet" className="min-h-11 rounded-carte border border-trait-fort bg-surface-2 px-2 text-sm text-texte" value={plage.sujet ?? ""} onChange={(e) => surChangerSujet(fiche.videoId, plage.id, e.target.value)}>
                      {Object.entries(LIBELLE_SUJET_EXTRAIT).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                    </select>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {surChiffresReels && onglet !== "ignores" && (
        <div className="grid gap-2">
          {[...new Set(visibles.map((c) => c.fiche))].map((f) => (
            <label key={f.videoId} className="flex min-h-11 items-start gap-2 text-sm text-texte">
              <input type="checkbox" checked={f.chiffresReels === true} onChange={(e) => surChiffresReels(f.videoId, e.target.checked)} />
              <span>
                <span className="font-semibold">Chiffres réels</span> ({titres[f.videoId] ?? f.videoId}) : Cochez seulement si les chiffres de cette vidéo sont vrais et vérifiables
              </span>
            </label>
          ))}
        </div>
      )}
    </section>
  );
}
