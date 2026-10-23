"use client";

/**
 * SUIVI DE FABRICATION DU CAS CONCRET (tâche X12). Constat en ligne : « Réessayer cette étape » ne faisait RIEN de
 * visible (vidéo arrêtée à « L'écriture »). Ici, un clic a TOUJOURS un effet visible :
 *   - la relance passe par une adresse fixe du format (`/cas-concret/relance`, appelée par `fetch`), jamais par la file
 *     des actions du routeur ni par un identifiant d'action qui change à chaque mise en ligne ;
 *   - pendant la relance, le bouton passe en attente ; acceptée, une phrase le dit et la progression est relue tout de
 *     suite, puis quelques fois de suite (la fiche se met à jour seule) ;
 *   - un prix à confirmer ouvre la feuille « Confirmer ce prix » (écriture : le prix d'un nouvel essai est annoncé) ;
 *   - un refus, une panne, un délai dépassé : une phrase claire à côté du bouton ;
 *   - un arrêt sans « Reprendre cette étape » (relecture refusée, calage, vérification bloquante) garde une issue : « Recommencer ce cas ».
 *   - lot F8 : titre et phrase par `EnTeteSuivi`, boutons rangés par `ActionsSuivi`, argent dit « Déjà payé : x » ; une vidéo arrêtée se recommence (pas de « Reprendre »).
 *   - brique 3 : l'arrêt pour que Will relise le script n'est pas un échec : l'étape s'affiche « À relire », sans
 *     « Réessayer » (la validation, juste en dessous, relance la fabrication).
 */
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { EtatSuivi } from "@/components/creation/SuiviFabrication";
import { ActionsSuivi } from "@/components/fabrication/ActionsSuivi";
import { EnTeteSuivi } from "@/components/fabrication/EnTeteSuivi";
import { Bouton } from "@/components/ui/Bouton";
import { confirmerPrix } from "@/components/ui/ConfirmationPrix";
import { ProgressionEtapes } from "@/components/ui/ProgressionEtapes";
import { notifier } from "@/components/ui/Toast";
import { BoutonAnnuler } from "@/components/videos/BoutonAnnuler";
import { BoutonArreter } from "@/components/videos/BoutonArreter";
import { ACTIONS_FABRICATION, LIBELLES_ARGENT } from "@/domaine/libelles";
import { useTravaux } from "@/hooks/useTravaux";
import { formaterMontant } from "@/lib/montants";
import type { VueTravail } from "@/services/vues";
import { etapeARelire } from "./a-relire";
import { ADRESSE_RELANCE, PHRASES_ECRAN_RELANCE, lireIssue, phraseRelancee } from "./relance";

/** Au-delà, la relance est tenue pour sans réponse (phrase, jamais un bouton qui tourne sans fin). */
const DELAI_RELANCE_MS = 30_000;
/** Relectures de la progression après une relance acceptée (ms après l'acceptation). */
const RELECTURES_MS = [0, 1500, 4000, 8000, 15000];

export function SuiviCasConcret({ initial, compacte, annulable = true, videoPrete }: { initial: VueTravail; compacte?: boolean; annulable?: boolean; videoPrete?: boolean }) {
  const router = useRouter();
  const { travail, actualiser } = useTravaux({
    travailId: initial.id,
    initial: [initial],
    onTermine: () => {
      notifier.succes("Votre vidéo est prête");
      router.refresh();
    },
  });
  const t = travail ?? initial;
  const [enAttente, setEnAttente] = useState(false);
  const [phrase, setPhrase] = useState<{ texte: string; ton: "info" | "refus" } | null>(null);
  /** Relance acceptée : le nombre d'essais du travail à ce moment et l'étape relancée (la phrase suit l'état relu). */
  const [relance, setRelance] = useState<{ tentatives: number; etape?: string } | null>(null);
  const minuteries = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => () => minuteries.current.forEach(clearTimeout), []);

  const echec = t.etapes.find((e) => e.statut === "echec");
  const aRelire = etapeARelire(t);
  const reessayable = t.statut === "echec" && (echec?.erreur ?? t.erreur)?.reessayable !== false;
  const actif = t.statut === "en_cours" || t.statut === "en_file";
  // Après une relance acceptée : « envoyée » tant que l'état relu n'a pas changé ou que l'étape tourne ; de nouveau
  // arrêtée (essai suivant compté) : dit ; terminée : plus rien.
  const phraseRelance = !relance || t.statut === "termine" ? null : t.statut === "echec" && t.tentatives > relance.tentatives ? PHRASES_ECRAN_RELANCE.denouveau : phraseRelancee(relance.etape);
  const affichee = phrase ?? (phraseRelance ? { texte: phraseRelance, ton: "info" as const } : null);

  async function envoyer(accord?: number | true): Promise<void> {
    const controle = new AbortController();
    const minuterie = setTimeout(() => controle.abort(), DELAI_RELANCE_MS);
    let issue;
    try {
      const r = await fetch(ADRESSE_RELANCE, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ travailId: t.id, ...(accord !== undefined ? { accord } : {}) }),
        signal: controle.signal,
        cache: "no-store",
      });
      issue = r.status === 401 ? { statut: "refusee" as const, phrase: PHRASES_ECRAN_RELANCE.session } : lireIssue(await r.json().catch(() => null));
    } catch (err) {
      issue = { statut: "refusee" as const, phrase: err instanceof DOMException && err.name === "AbortError" ? PHRASES_ECRAN_RELANCE.delai : PHRASES_ECRAN_RELANCE.injoignable };
    } finally {
      clearTimeout(minuterie);
    }
    if (issue.statut === "accord-requis") {
      const confirme = await confirmerPrix({ message: issue.phrase, montant: issue.centimes });
      if (confirme === null) return setPhrase({ texte: PHRASES_ECRAN_RELANCE.annulee, ton: "info" });
      return envoyer(confirme);
    }
    if (issue.statut === "refusee") return setPhrase({ texte: issue.phrase, ton: "refus" });
    setRelance({ tentatives: t.tentatives, etape: echec?.nom });
    minuteries.current.forEach(clearTimeout);
    minuteries.current = RELECTURES_MS.map((ms) => setTimeout(() => void actualiser(), ms));
    router.refresh();
  }

  async function reessayer() {
    if (enAttente) return;
    setPhrase(null);
    setRelance(null);
    setEnAttente(true);
    try {
      await envoyer();
    } catch {
      setPhrase({ texte: PHRASES_ECRAN_RELANCE.injoignable, ton: "refus" });
    } finally {
      setEnAttente(false);
    }
  }

  const FIN_SANS_REESSAI = "Une étape n'a pas abouti. Vous pouvez recommencer ce cas.";
  const etat: EtatSuivi = aRelire ? "a-relire" : actif ? "en-cours" : t.statut === "termine" ? "prete" : t.statut === "annule" ? "arretee" : "coincee";
  // Le message de l'étape en échec est déjà dans l'encart de ProgressionEtapes : l'en-tête ne le répète pas.
  const message =
    etat === "arretee"
      ? "Vous pouvez recommencer cette vidéo."
      : etat === "coincee"
        ? echec?.erreur
          ? reessayable
            ? undefined
            : FIN_SANS_REESSAI
          : t.erreur?.messagePourWill ?? (reessayable ? undefined : FIN_SANS_REESSAI)
        : undefined;
  // Une vidéo arrêtée ou sans réessai possible se recommence (l'écran du format ne rouvre pas de brouillon) : jamais de « Reprendre » qui mène à un écran vide.
  const recommencer = etat === "arretee" ? { href: "/cas-concret" } : etat === "coincee" && !reessayable ? { href: "/cas-concret", libelle: "Recommencer ce cas" } : undefined;
  const peutAnnuler = annulable && (etat === "arretee" || etat === "coincee");

  // Retouche arrêtée sur une vidéo prête : la vidéo reste valable, rien à recommencer ni à annuler.
  if (videoPrete && t.statut === "annule") return null;

  return (
    <div className="space-y-4">
      {etat !== "prete" && <EnTeteSuivi etat={etat} sansTemps message={message} />}
      <ProgressionEtapes
        etapes={t.etapes}
        progression={t.progression}
        suivi={{ resteMin: t.resteMin, heureFin: t.heureFin, rang: t.rang, debutVers: t.debutVers, enAttenteFournisseur: t.enAttenteFournisseur, attenteCredit: t.attenteCredit, abonnementsClaude: t.abonnementsClaude, aucunCompteClaude: t.aucunCompteClaude }}
        compacte={compacte}
        {...(aRelire ? { aRelire } : {})}
      />
      {t.depense.centimes > 0 && (
        <p className="flex justify-end text-xs tabular-nums text-texte-faible">
          {LIBELLES_ARGENT.dejaPaye} : {formaterMontant(t.depense)}
        </p>
      )}
      <ActionsSuivi
        etat={etat}
        arreter={actif ? <BoutonArreter travailId={t.id} videoId={t.cibleId} depense={t.depense} compact={compacte} /> : undefined}
        reprendre={
          etat === "coincee" && reessayable ? (
            <Bouton variante="secondaire" icone="reessayer" onClick={() => void reessayer()} chargement={enAttente} className="shrink-0">
              {ACTIONS_FABRICATION.reprendreEtape}
            </Bouton>
          ) : undefined
        }
        annuler={actif ? <BoutonAnnuler videoId={t.cibleId} travailId={t.id} depense={t.depense} compact apres="/videos" /> : peutAnnuler ? <BoutonAnnuler videoId={t.cibleId} apres="/videos" /> : undefined}
        recommencer={recommencer}
      />
      {affichee && (
        <p role={affichee.ton === "refus" ? "alert" : "status"} className={affichee.ton === "refus" ? "text-sm text-brique" : "text-sm text-texte-doux"}>
          {affichee.texte}
        </p>
      )}
    </div>
  );
}
