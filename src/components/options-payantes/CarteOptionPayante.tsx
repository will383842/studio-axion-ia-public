"use client";

/**
 * CARTE « OPTION PAYANTE » (lot J, décision de Will du 09/10). Petite carte, 390 px de large au plus, deux boutons.
 * Le SEUL endroit du face caméra où un montant apparaît : « Option payante — environ X € pris sur vos crédits
 * <outil>. [Confirmer] [Annuler] ». Utilisée dans le fil du monteur, sur « Votre vidéo » et dans Réglages.
 */
import { useState, useTransition } from "react";
import { annulerOptionPayanteAction, confirmerOptionPayanteAction } from "@/app/(studio)/videos/actions-options-payantes";
import { TEXTES_CARTE, texteEtat, type ApercuCarte, type VueCarteConfirmation } from "@/briques/options-payantes/carte";
import type { EtatDemande } from "@/briques/options-payantes/types";
import { Bouton } from "@/components/ui/Bouton";
import { Icone } from "@/components/ui/Icone";
import { notifier } from "@/components/ui/Toast";
import { cn } from "@/lib/cn";

/** Présentation seule : la phrase, l'état, les deux boutons. */
export function CarteOptionPayante({
  libelle,
  phrase,
  etat = "en-attente",
  enCours,
  onConfirmer,
  onAnnuler,
  apercu,
  onChangerMoment,
  className,
}: {
  libelle?: string;
  phrase: string;
  etat?: EtatDemande;
  enCours?: boolean;
  onConfirmer(): void;
  onAnnuler(): void;
  /** Lot K : aperçu du moment choisi (effet réaliste) — image fixe, instant, phrase dite. */
  apercu?: ApercuCarte;
  /** Lot K : « Changer de moment » (le fil reçoit « Plutôt à … »). */
  onChangerMoment?(): void;
  className?: string;
}) {
  const apres = texteEtat(etat);
  return (
    <div role="group" aria-label={TEXTES_CARTE.titre} className={cn("w-full max-w-[358px] rounded-2xl border border-ambre/40 bg-ambre-doux p-3", className)}>
      {apercu && <ApercuMoment apercu={apercu} onChangerMoment={etat === "en-attente" ? onChangerMoment : undefined} />}
      <p className="flex items-start gap-2 text-[15px] text-texte">
        <Icone nom="info" size={16} className="mt-0.5 shrink-0 text-ambre" />
        <span>
          {libelle && !apercu && <span className="block font-semibold">{libelle}</span>}
          {phrase}
        </span>
      </p>
      {apres ? (
        <p className="mt-2 flex items-center gap-1.5 text-sm text-texte-doux">
          <Icone nom={etat === "confirmee" || etat === "utilisee" ? "coche" : "info"} size={14} className={etat === "confirmee" || etat === "utilisee" ? "text-sauge" : "text-texte-faible"} />
          {apres}
        </p>
      ) : (
        <div className="mt-3 grid grid-cols-2 gap-2">
          <Bouton variante="contour" pleineLargeur disabled={enCours} onClick={onAnnuler}>
            {TEXTES_CARTE.annuler}
          </Bouton>
          <Bouton variante="principal" pleineLargeur chargement={enCours} onClick={onConfirmer}>
            {TEXTES_CARTE.confirmer}
          </Bouton>
        </div>
      )}
    </div>
  );
}

/** Lot K : l'image fixe du moment choisi, l'instant, la phrase dite à cet instant, et « Changer de moment ». */
function ApercuMoment({ apercu, onChangerMoment }: { apercu: ApercuCarte; onChangerMoment?(): void }) {
  return (
    <div className="mb-3 overflow-hidden rounded-xl border border-trait bg-surface-1">
      {apercu.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- adresse signée courte (R2), pas d'optimisation Next
        <img src={apercu.imageUrl} alt={`Image de la vidéo à ${apercu.instant}`} className="aspect-[9/16] max-h-64 w-full object-cover" />
      ) : null}
      <div className="space-y-1 p-2.5">
        <p className="text-sm font-semibold text-texte">À {apercu.instant}</p>
        {apercu.description && <p className="text-sm text-texte">{apercu.description}</p>}
        {apercu.phrase && <p className="text-sm italic text-texte-doux">« {apercu.phrase} »</p>}
        {onChangerMoment && (
          <button type="button" onClick={onChangerMoment} className="min-h-11 text-sm font-semibold text-orange-vif hover:underline">
            Changer de moment
          </button>
        )}
      </div>
    </div>
  );
}

/** Carte branchée sur le serveur (fil du monteur, « Votre vidéo ») : la réponse part avec le jeton de la demande. */
export function CarteConfirmation({ carte, videoId, onRepondu, onChangerMoment }: { carte: VueCarteConfirmation; videoId?: string; onRepondu?(etat: EtatDemande): void; onChangerMoment?(): void }) {
  const [etat, setEtat] = useState<EtatDemande>(carte.etat);
  const [enCours, demarrer] = useTransition();

  function repondre(confirme: boolean) {
    demarrer(async () => {
      const r = confirme ? await confirmerOptionPayanteAction(carte.jeton, videoId) : await annulerOptionPayanteAction(carte.jeton, videoId);
      if (!r.ok) {
        notifier.erreur(r.message);
        return;
      }
      const suivant: EtatDemande = confirme ? "confirmee" : "annulee";
      setEtat(suivant);
      onRepondu?.(suivant);
      if (confirme) notifier.succes("C'est confirmé", "Une nouvelle version part avec l'option.");
    });
  }

  return <CarteOptionPayante libelle={carte.libelle} phrase={carte.phrase} etat={etat} enCours={enCours} onConfirmer={() => repondre(true)} onAnnuler={() => repondre(false)} {...(carte.apercu ? { apercu: carte.apercu } : {})} {...(onChangerMoment ? { onChangerMoment } : {})} />;
}

/** « Votre vidéo » : les options payantes qui attendent la réponse de Will (option allumée dans Réglages). */
export function OptionsPayantesVideo({ videoId, cartes }: { videoId: string; cartes: VueCarteConfirmation[] }) {
  if (!cartes.length) return null;
  return (
    <section aria-label="Options payantes à confirmer" className="mt-4 space-y-2">
      <p className="text-sm text-texte-doux">Sans votre accord, la vidéo reste dans sa version gratuite.</p>
      {cartes.map((c) => (
        <CarteConfirmation key={c.jeton} carte={c} videoId={videoId} />
      ))}
    </section>
  );
}
