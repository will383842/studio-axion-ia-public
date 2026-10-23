"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState, useTransition } from "react";
import { creerSujetAction, sujetsDejaTraitesAction } from "@/app/(studio)/ecrire/sujets/actions";
import { BarreActionCollee } from "@/components/ui/BarreActionCollee";
import { ChoixSerie } from "@/components/ecrire/ChoixSerie";
import { Bouton } from "@/components/ui/Bouton";
import { Carte } from "@/components/ui/Carte";
import { Champ } from "@/components/ui/Champ";
import { Icone } from "@/components/ui/Icone";
import { PastilleEssai } from "@/components/ui/PastilleEssai";
import { notifier } from "@/components/ui/Toast";
import { avertissementTexteColle } from "@/domaine/avertissement-texte-colle";
import { detecterSujetSensible } from "@/domaine/classement-generateur";
import { lienSujet } from "@/domaine/retour-video";
import { useSaisieGardee } from "@/hooks/useSaisieGardee";
import { ideesParLigne } from "@/domaine/serie-idees";
import { cn } from "@/lib/cn";
import { FeuilleSerie } from "./FeuilleSerie";
import { PanneauSujetCentralDejaTraite } from "./PanneauSujetCentralDejaTraite";
import { boutonPrincipalActif, confirmationRefaire, ideeDeLaSuggestion, peutLancer, refusDeLaReponse, refusEncoreValable, type RefusAffiche } from "./sujet-deja-traite";
import { ReglagesSujet, useReglagesSujet, type FormatEcrivable } from "./ReglagesSujet";
import { useRetenirDepart } from "./useRetenirDepart";
import { formateurDate } from "@/lib/intl";

export type { FormatEcrivable } from "./ReglagesSujet";

const LIBELLE_SENSIBLE: Record<string, string> = {
  juridique: "Sujet juridique : vous en personne conseillé",
  donnees: "Sujet sensible : vous en personne conseillé",
  financier: "Sujet sensible : vous en personne conseillé",
  rh: "Sujet sensible : vous en personne conseillé",
};

/**
 * Écran Sujet (B.6.5, maquette GM validée) : l'idée seule est obligatoire, le reste est déjà réglé. « Écrire » crée le
 * sujet et lance l'écriture ; sans matière, la carte « Il manque une matière » s'ouvre (0 €).
 */
export function EcranSujet({
  ideeInitiale,
  ideeId,
  formats,
  ecritureSimulee,
  prix,
  retour,
  series = [],
  imposee,
}: {
  ideeInitiale: string;
  ideeId?: string;
  formats: FormatEcrivable[];
  ecritureSimulee: boolean;
  /** Prix au plus d'une écriture, calculé par le service (B11). */
  prix: string;
  /** Retour à la vidéo (B1) : gardé jusqu'à la fiche du sujet. */
  retour?: string;
  /** Équipe 7 : séries TikTok proposées (épisode attribué à la création). */
  series?: { id: string; nom: string }[];
  /** « Refaire cette structure sur un autre sujet » (Ce qui marche) : structure et famille d'accroche demandées. */
  imposee?: { structure: string; libelle: string; famille?: string };
}) {
  const router = useRouter();
  const idIdee = useId();
  const [idee, setIdee] = useState(ideeInitiale);
  const [phraseOuverte, setPhraseOuverte] = useState(false);
  const [phrase, setPhrase] = useState("");
  const [envoye, setEnvoye] = useState(false);
  useRetenirDepart(!envoye && (idee.trim() !== ideeInitiale.trim() || !!phrase.trim()));
  const [cible, setCible] = useState("");
  const [motCle, setMotCle] = useState("");
  // Équipe 7 : série du sujet (épisode attribué à la création).
  const [serieId, setSerieId] = useState<string | undefined>();
  const [envoi, demarrer] = useTransition();
  /** Lot L5 : le refus du serveur (sujet déjà traité) et le verrou anti double clic (posé avant que l'écran ne se redessine). */
  const [refusBrut, setRefusBrut] = useState<RefusAffiche | undefined>();
  const verrou = useRef(false);
  /** Avertissement NON bloquant (D1) : sujets déjà traités qui ressemblent à l'idée, lus sans rien créer ni payer. */
  const [avis, setAvis] = useState<{ pour: string; sujets: { id: string; numero: number; le: string }[] }>({ pour: "", sujets: [] });

  /** Écriture en série (B7) : plusieurs idées, une par ligne, mêmes réglages. */
  const [plusieurs, setPlusieurs] = useState(false);
  // Page ouverte avant une mise en ligne : l'idée et la phrase saisies sont gardées au rechargement, puis remises
  // (src/lib/mise-a-jour-studio.ts). Rien n'est envoyé tout seul.
  useSaisieGardee(
    "generateur:idee",
    () => (envoye || idee.trim() === ideeInitiale.trim() ? "" : idee),
    (t) => {
      setIdee(t);
      if (ideesParLigne(t).length > 1) setPlusieurs(true);
    },
  );
  useSaisieGardee(
    "generateur:phrase",
    () => (envoye ? "" : phrase),
    (t) => {
      setPhrase(t);
      setPhraseOuverte(true);
    },
  );
  const [serieOuverte, setSerieOuverte] = useState(false);
  const lignes = plusieurs ? ideesParLigne(idee) : [];

  const sensible = plusieurs ? undefined : detecterSujetSensible(idee);
  const reglages = useReglagesSujet(formats, sensible);
  const { formatId, reseaux, adresse, qui, but, modes } = reglages;
  const pret = (plusieurs ? lignes.length > 0 : idee.trim().length > 0) && reglages.pret;
  const refus = refusEncoreValable(refusBrut, idee, formatId);

  // Avertissement discret pendant la saisie (un seul sujet) : il ne bloque jamais, le serveur reste le seul juge.
  useEffect(() => {
    const texte = idee.trim();
    if (plusieurs || texte.length < 12) return;
    let vivant = true;
    const minuteur = setTimeout(() => {
      void sujetsDejaTraitesAction(texte, formatId).then((d) => {
        if (vivant && d.ok) setAvis({ pour: texte, sujets: d.donnees });
      });
    }, 700);
    return () => {
      vivant = false;
      clearTimeout(minuteur);
    };
  }, [idee, plusieurs, formatId]);

  function ecrire(confirmation?: ReturnType<typeof confirmationRefaire>) {
    if (!peutLancer(pret, envoi, verrou.current)) return;
    verrou.current = true;
    demarrer(async () => {
      // Le verrou reste posé jusqu'au départ vers la fiche du sujet ; il se libère sur toute autre issue (erreur, refus).
      const r = await creerSujetAction({
        idee,
        phraseWill: phrase || undefined,
        objectif: but,
        reseaux,
        formatId,
        adresse,
        mode: qui,
        motCle: motCle || undefined,
        cible: cible || undefined,
        ideeId,
        sujetSensible: sensible,
        serieId,
        ...(confirmation ? { confirmationSujet: confirmation } : {}),
        ...(imposee ? { structureImposee: imposee.structure, ...(imposee.famille ? { familleAccroche: imposee.famille } : {}) } : {}),
      }).catch(() => undefined);
      if (!r) {
        verrou.current = false;
        notifier.erreur("Un souci est survenu. Réessayez dans un instant.");
        return;
      }
      if (!r.ok) {
        verrou.current = false;
        notifier.erreur(r.message);
        return;
      }
      const attendu = refusDeLaReponse(r.donnees, idee, formatId);
      if (attendu) {
        // Rien n'a été créé ni payé : Will choisit (autre sujet ou refaire).
        verrou.current = false;
        setRefusBrut(attendu);
        return;
      }
      if (!("id" in r.donnees)) {
        verrou.current = false;
        return;
      }
      if (r.donnees.ecrit && ecritureSimulee) notifier.essai("texte d'essai, rien n'est payé");
      setEnvoye(true);
      router.push(lienSujet(r.donnees.id, retour));
    });
  }

  return (
    <div className="space-y-4">
      {imposee && (
        <p className="rounded-champ bg-surface-2 px-3 py-2 text-sm text-texte-doux" role="status">
          Même structure qu&apos;une vidéo qui a marché : <span className="font-semibold text-texte">{imposee.libelle}</span>
        </p>
      )}
      {/* Le champ n'a pas de contour propre : c'est la carte entière qui s'entoure quand on y écrit au clavier. */}
      <Carte lueur className="p-0 sm:p-0 has-[textarea:focus-visible]:outline-2 has-[textarea:focus-visible]:outline-offset-2 has-[textarea:focus-visible]:outline-orange-vif">
        <div className="flex items-center gap-2 px-4 pt-4">
          <label htmlFor={idIdee} className="flex flex-1 items-center gap-2 text-sm font-semibold text-orange-vif">
            <Icone nom="idee" size={16} />
            {plusieurs ? "Vos idées" : "Votre idée"}
          </label>
          <button
            type="button"
            onClick={() => setPlusieurs((x) => !x)}
            aria-pressed={plusieurs}
            className={cn(
              "inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3 text-xs font-bold transition-colors",
              plusieurs ? "border-orange bg-orange-doux text-orange-vif" : "border-trait text-texte-doux hover:text-texte",
            )}
          >
            <Icone nom="calques" size={14} />
            Plusieurs
          </button>
        </div>
        <textarea
          id={idIdee}
          value={idee}
          onChange={(e) => setIdee(e.target.value)}
          rows={plusieurs ? 6 : 3}
          placeholder={plusieurs ? "Une idée par ligne" : "Dites ou tapez votre idée"}
          className={cn("block w-full resize-none bg-transparent px-4 pb-4 pt-2 font-semibold leading-snug text-texte outline-none placeholder:text-texte-faible", plusieurs ? "text-base" : "text-xl")}
        />
        {!plusieurs && avertissementTexteColle(idee, reglages.format?.nom) && (
          <p className="px-4 pb-3 text-sm font-semibold text-texte-doux" aria-live="polite">
            {avertissementTexteColle(idee, reglages.format?.nom)}
          </p>
        )}
        {plusieurs && lignes.length > 0 && (
          <p className="px-4 pb-3 text-xs font-semibold text-texte-faible" aria-live="polite">
            {lignes.length} idée{lignes.length > 1 ? "s" : ""}
          </p>
        )}
      </Carte>

      {plusieurs ? null : phraseOuverte ? (
        <Carte className="p-0 sm:p-0 has-[textarea:focus-visible]:outline-2 has-[textarea:focus-visible]:outline-offset-2 has-[textarea:focus-visible]:outline-orange-vif">
          <label htmlFor={`${idIdee}-p`} className="block px-4 pt-3 text-sm font-semibold text-texte-doux">
            Une phrase à vous
          </label>
          <textarea
            id={`${idIdee}-p`}
            value={phrase}
            onChange={(e) => setPhrase(e.target.value)}
            rows={2}
            autoFocus
            placeholder="Facultatif : reprise mot pour mot"
            className="block w-full resize-none bg-transparent px-4 pb-3 pt-1 text-base text-texte outline-none placeholder:text-texte-faible"
          />
        </Carte>
      ) : (
        <button
          type="button"
          onClick={() => setPhraseOuverte(true)}
          className="flex min-h-12 w-full items-center gap-2 rounded-carte border border-dashed border-trait-fort px-4 text-left text-sm font-semibold text-texte-doux hover:text-texte"
        >
          <Icone nom="plus" size={16} />
          Une phrase à vous
          <span className="ml-auto text-xs font-medium text-texte-faible">facultatif</span>
        </button>
      )}

      {sensible && modes.includes("avatar") && (
        <div className="flex items-center gap-3 rounded-carte border border-ambre/40 bg-ambre-doux p-3">
          <Icone nom="balance" size={20} className="shrink-0 text-ambre" />
          <p className="flex-1 text-sm font-semibold leading-snug text-texte">{LIBELLE_SENSIBLE[sensible]}</p>
          {qui !== "avatar" && (
            <button type="button" onClick={() => reglages.setQuiChoisi("avatar")} className="min-h-11 shrink-0 rounded-full border border-trait-fort px-3 text-xs font-bold text-texte">
              Garder mon double
            </button>
          )}
        </div>
      )}

      <ReglagesSujet r={reglages} />

      <ChoixSerie series={series} valeur={serieId} onChange={setSerieId} />

      {!plusieurs && (
        <details className="group rounded-carte border border-trait bg-surface-1 px-4">
          <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between text-sm font-semibold text-texte-doux">
            Je choisis
            <Icone nom="chevron-bas" size={16} className="transition-transform group-open:rotate-180" />
          </summary>
          <div className="space-y-4 pb-4">
            <Champ libelle="À qui ?" placeholder="Dirigeants de PME" value={cible} onChange={(e) => setCible(e.target.value)} />
            <Champ libelle="Mot cherché" placeholder="factures ChatGPT" value={motCle} onChange={(e) => setMotCle(e.target.value)} aide="Une hypothèse, jamais une certitude." />
          </div>
        </details>
      )}

      {!plusieurs && !refus && avis.pour === idee.trim() && avis.sujets.length > 0 && (
        <p className="flex items-center gap-1.5 px-1 text-sm font-semibold text-ambre" role="status">
          <Icone nom="attention" size={14} />
          Un sujet proche existe déjà : n° {avis.sujets[0]!.numero} le {formateurDate("fr-FR", { day: "2-digit", month: "2-digit" }).format(new Date(avis.sujets[0]!.le))}
        </p>
      )}

      {!plusieurs && refus && (
        <PanneauSujetCentralDejaTraite
          refus={refus.refus}
          chargement={envoi}
          onAutreSujet={(titre) => {
            setIdee(ideeDeLaSuggestion(titre));
            setRefusBrut(undefined);
          }}
          onRefaire={() => ecrire(confirmationRefaire(refus))}
        />
      )}

      <BarreActionCollee>
        {plusieurs ? (
          <Bouton icone="ecrire" taille="lg" disabled={!pret} onClick={() => setSerieOuverte(true)}>
            {lignes.length > 1 ? `Écrire ces ${lignes.length} idées` : "Écrire"}
          </Bouton>
        ) : (
          <Bouton icone="ecrire" taille="lg" disabled={!boutonPrincipalActif(pret, refus)} chargement={envoi} onClick={() => ecrire()}>
            Écrire · au plus {prix}
          </Bouton>
        )}
      </BarreActionCollee>
      {ecritureSimulee && (
        <p className="flex items-center justify-center gap-2 text-xs text-texte-faible">
          <PastilleEssai />
          Rien n&apos;est payé tant que Claude n&apos;est pas branché.
        </p>
      )}
      <FeuilleSerie ouverte={serieOuverte} onOuverteChange={setSerieOuverte} idees={lignes.map((texte) => ({ texte }))} reglages={reglages} serieId={serieId} onLancee={() => setEnvoye(true)} />
    </div>
  );
}
