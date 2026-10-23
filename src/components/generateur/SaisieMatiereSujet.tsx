"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { completerSujetAction, donnerAccordEtReprendreAction } from "@/app/(studio)/ecrire/sujets/actions";
import { ChoixType } from "@/components/matieres/visuels";
import { Bouton, Icone, Interrupteur, notifier } from "@/components/ui";
import { useSaisieGardee } from "@/hooks/useSaisieGardee";
import { accordRequis, LIBELLES_MATIERE, proposerTypeMatiere } from "@/domaine/matieres";
import type { TypeMatiere } from "@/domaine/types";

/** Matière ajoutée à ce sujet mais pas encore citable faute d'accord (cas client, parole de dirigeant). */
export interface MatiereSansAccord {
  id: string;
  texte: string;
  type: TypeMatiere;
}

/**
 * Saisie d'une matière depuis la fiche d'un sujet (E2E-2 parcours n° 13, données n° 4) : le type proposé est DIT et se
 * change d'un toucher ; un cas client ou une parole de dirigeant demande l'accord sur place (sans lui, la matière
 * n'est pas citée : on le dit avant, pas après).
 */
/** `essai` : Claude n'est pas relié, l'écriture est un essai (« rien n'est payé ») ; sinon elle est réelle (B9). */
export function SaisieMatiereSujet({ id, libelleBouton, icone = "ecrire", messageSucces, essai = true }: { id: string; libelleBouton: string; icone?: "ecrire"; messageSucces: string; essai?: boolean }) {
  const router = useRouter();
  const [texte, setTexte] = useState("");
  const [typeTouche, setTypeTouche] = useState<TypeMatiere | undefined>();
  const [accord, setAccord] = useState(false);
  const [enCours, demarrer] = useTransition();
  // Page ouverte avant une mise en ligne : la matière racontée est gardée au rechargement puis remise (rien n'est envoyé).
  useSaisieGardee(`matiere-sujet:${id}`, () => texte, (t) => setTexte(t));
  const type = typeTouche ?? (texte.trim() ? proposerTypeMatiere(texte) : undefined);
  return (
    <div className="mt-4 space-y-3 text-left">
      <textarea
        value={texte}
        onChange={(e) => setTexte(e.target.value)}
        rows={3}
        aria-label="Votre matière"
        placeholder="Touchez le micro du clavier et racontez"
        className="block w-full resize-none rounded-champ border border-trait bg-surface-2 p-3 text-left text-base text-texte outline-none focus:border-orange"
      />
      {type && (
        <div>
          <p className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-texte-faible">
            <Icone nom="etincelles" size={13} />
            Rangée comme
          </p>
          <ChoixType valeur={type} onChange={setTypeTouche} compact className="" />
        </div>
      )}
      {type && accordRequis(type) && <Interrupteur icone="bouclier" libelle="J'ai son accord" detail={accord ? undefined : "Sans accord, elle n'est pas citée"} coche={accord} onChange={setAccord} />}
      <Bouton
        pleineLargeur
        taille="lg"
        icone={icone}
        disabled={!texte.trim()}
        chargement={enCours}
        onClick={() =>
          demarrer(async () => {
            const r = await completerSujetAction(id, texte, { type, accord: type && accordRequis(type) ? accord : undefined });
            if (!r.ok) {
              notifier.erreur(r.message);
              return;
            }
            const rangee = `rangée comme « ${LIBELLES_MATIERE[r.donnees.type].court} »`;
            if (r.donnees.sansAccord) notifier.info(`Matière ${rangee}`, "Sans votre accord, elle n'est pas citée : donnez-le ci-dessus.");
            else if (r.donnees.ecrit) (essai ? notifier.essai : notifier.succes)(`${messageSucces} · ${rangee}`);
            else notifier.info(`Matière ${rangee}`, "Il manque encore quelque chose : voyez ci-dessus.");
            setTexte("");
            setTypeTouche(undefined);
            setAccord(false);
            router.refresh();
          })
        }
      >
        {libelleBouton}
      </Bouton>
    </div>
  );
}

/** Matières de ce sujet en attente d'accord : on le dit, et l'accord se donne d'un toucher (l'écriture reprend). */
export function MatieresSansAccord({ id, matieres }: { id: string; matieres: MatiereSansAccord[] }) {
  const router = useRouter();
  const [enCours, demarrer] = useTransition();
  if (!matieres.length) return null;
  return (
    <div role="status" className="space-y-2 rounded-champ border border-ambre/40 bg-ambre-doux p-3 text-left">
      <p className="flex items-center gap-1.5 text-sm font-semibold text-texte">
        <Icone nom="bouclier" size={15} className="text-ambre" />
        {matieres.length > 1 ? `${matieres.length} matières attendent votre accord` : "Cette matière attend votre accord"}
      </p>
      <p className="text-[13px] text-texte-doux">Sans accord, elle n&apos;est pas citée et ne compte pas pour écrire.</p>
      <ul className="space-y-2">
        {matieres.map((m) => (
          <li key={m.id} className="rounded-champ bg-surface-1 p-3">
            <p className="mb-1 text-xs font-bold uppercase tracking-wider text-texte-faible">{LIBELLES_MATIERE[m.type].court}</p>
            <p className="line-clamp-3 text-[15px] text-texte">{m.texte}</p>
            <Bouton
              className="mt-2"
              variante="secondaire"
              icone="coche"
              chargement={enCours}
              onClick={() =>
                demarrer(async () => {
                  const r = await donnerAccordEtReprendreAction(id, m.id);
                  if (!r.ok) notifier.erreur(r.message);
                  else notifier.succes(r.donnees.ecrit ? "Accord noté : l'écriture reprend" : "Accord noté");
                  router.refresh();
                })
              }
            >
              J&apos;ai son accord
            </Bouton>
          </li>
        ))}
      </ul>
    </div>
  );
}
