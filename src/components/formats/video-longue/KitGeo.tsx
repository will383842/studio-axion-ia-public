"use client";

import { useState } from "react";
import { Bouton } from "@/components/ui/Bouton";
import { BoutonCopier } from "@/components/ui/BoutonCopier";
import { Carte } from "@/components/ui/Carte";
import { CaseACocher } from "@/components/ui/CaseACocher";
import { Interrupteur } from "@/components/ui/Interrupteur";
import { descriptionValidee, type BlocDescription } from "@/briques/geo";
import type { ChapitreWeb } from "@/domaine/site-videos/types";
import { chapitresYoutube } from "@/domaine/site-videos/youtube";

export interface CourtPossible {
  id: string;
  titre: string;
}

/**
 * Écran 6 : la vidéo finie et son kit de publication. Chaque carte n'apparaît que si son contenu existe, et ce contenu
 * vient toujours du script validé ou d'un choix de l'utilisateur : « À retenir » et « Questions et réponses » n'existent
 * que si l'utilisateur les a remplis ou choisis phrase par phrase. L'étiquette IA est éteinte.
 */
export function KitGeo({
  urlVideo,
  titre,
  description,
  chapitres,
  srt,
  texteComplet,
  aRetenir,
  questions,
  courts,
  onMettreSurLeSite,
  onFabriquerCourts,
}: {
  urlVideo?: string;
  titre: string;
  description: readonly BlocDescription[];
  chapitres: readonly ChapitreWeb[];
  /** Contenu du fichier .srt déjà fabriqué ; vide = pas de carte. */
  srt?: string;
  texteComplet: string;
  aRetenir?: readonly string[];
  questions?: readonly { question: string; reponse: string }[];
  courts?: readonly CourtPossible[];
  onMettreSurLeSite?: () => void;
  onFabriquerCourts?: (ids: string[]) => void;
}) {
  const [iaAllumee, setIaAllumee] = useState(false);
  const [choisis, setChoisis] = useState<string[]>([]);
  const texteDescription = descriptionValidee(description);
  const lienSrt = srt ? `data:text/plain;charset=utf-8,${encodeURIComponent(srt)}` : undefined;
  return (
    <section className="space-y-4" aria-label="Votre vidéo et son kit de publication">
      {urlVideo && (
        <div className="aspect-video w-full overflow-hidden rounded-carte border border-trait bg-surface-2 md:w-2/3">
          <video src={urlVideo} controls className="h-full w-full" />
        </div>
      )}
      {urlVideo && (
        <Carte className="flex items-center justify-between gap-3">
          <h3 className="text-base font-semibold text-texte">Vidéo</h3>
          <a href={urlVideo} download className="inline-flex min-h-11 items-center rounded-full bg-accent px-4 text-sm font-semibold text-sur-accent">
            Télécharger la vidéo
          </a>
        </Carte>
      )}
      {titre.trim() !== "" && (
        <Carte className="space-y-2">
          <h3 className="text-base font-semibold text-texte">Titre</h3>
          <p className="text-sm text-texte">{titre}</p>
          <p className="text-sm text-texte-doux">Posez la question comme vos clients la cherchent.</p>
          <BoutonCopier texte={titre} libelle="Copier le titre" />
        </Carte>
      )}
      {texteDescription !== "" && (
        <Carte className="space-y-2">
          <h3 className="text-base font-semibold text-texte">Description</h3>
          <p className="whitespace-pre-line text-sm text-texte">{texteDescription}</p>
          <BoutonCopier texte={texteDescription} libelle="Copier la description" />
        </Carte>
      )}
      {chapitres.length > 0 && (
        <Carte className="space-y-2">
          <h3 className="text-base font-semibold text-texte">Chapitres pour YouTube</h3>
          <p className="whitespace-pre-line text-sm text-texte">{chapitresYoutube([...chapitres])}</p>
          <BoutonCopier texte={chapitresYoutube([...chapitres])} libelle="Copier les chapitres" />
        </Carte>
      )}
      {lienSrt && (
        <Carte className="flex items-center justify-between gap-3">
          <h3 className="text-base font-semibold text-texte">Sous-titres</h3>
          <a href={lienSrt} download="sous-titres.srt" className="inline-flex min-h-11 items-center rounded-full border border-trait-fort px-4 text-sm font-semibold text-texte">
            Télécharger les sous-titres (.srt)
          </a>
        </Carte>
      )}
      {texteComplet.trim() !== "" && (
        <Carte className="space-y-2">
          <h3 className="text-base font-semibold text-texte">Texte complet</h3>
          <BoutonCopier texte={texteComplet} libelle="Copier le texte" />
        </Carte>
      )}
      {aRetenir && aRetenir.length > 0 && (
        <Carte className="space-y-2">
          <h3 className="text-base font-semibold text-texte">À retenir</h3>
          <ul className="list-disc space-y-1 pl-5 text-sm text-texte">
            {aRetenir.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        </Carte>
      )}
      {questions && questions.length > 0 && (
        <Carte className="space-y-2">
          <h3 className="text-base font-semibold text-texte">Questions et réponses</h3>
          <dl className="space-y-2 text-sm text-texte">
            {questions.map((q) => (
              <div key={q.question}>
                <dt className="font-semibold">{q.question}</dt>
                <dd>{q.reponse}</dd>
              </div>
            ))}
          </dl>
        </Carte>
      )}
      {onMettreSurLeSite && (
        <Carte className="flex items-center justify-between gap-3">
          <h3 className="text-base font-semibold text-texte">Pour votre site</h3>
          <Bouton type="button" variante="secondaire" onClick={onMettreSurLeSite}>
            Mettre sur le site
          </Bouton>
        </Carte>
      )}
      <Carte>
        <Interrupteur libelle="Étiquette IA (facultative)" detail={iaAllumee ? "Allumée" : "Éteinte"} coche={iaAllumee} onChange={setIaAllumee} />
      </Carte>
      {courts && courts.length > 0 && (
        <Carte className="space-y-3">
          <h3 className="text-base font-semibold text-texte">Vidéos courtes tirées de cette vidéo</h3>
          <ul className="space-y-1">
            {courts.map((c) => (
              <li key={c.id}>
                <CaseACocher
                  libelle={`Fabriquer ce court : ${c.titre}`}
                  coche={choisis.includes(c.id)}
                  onChange={(v) => setChoisis((cur) => (v ? [...cur, c.id] : cur.filter((x) => x !== c.id)))}
                />
              </li>
            ))}
          </ul>
          <Bouton type="button" disabled={choisis.length === 0 || !onFabriquerCourts} onClick={() => onFabriquerCourts?.(choisis)}>
            Fabriquer les courts choisis
          </Bouton>
        </Carte>
      )}
    </section>
  );
}
