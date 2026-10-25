"use client";

/**
 * SUIVI DE FABRICATION DU TABLEAU ANIMÉ (tâche TB-21) : suit le travail en direct et passe le tout à `EtapesTableau`.
 * Pendant la fabrication : « Arrêter ». Après TOUT arrêt (table `issuesApresArret`), au moins un bouton qui marche, et
 * jamais un clic sans effet visible (la fabrication repart, la feuille du prix s'ouvre, ou une phrase dit quoi faire) :
 *  - « Relancer » (échec) : `relancerTableauAction`. Arrêt à la relecture : relecture puis prix de la voix ; arrêt après
 *    la voix : le même travail reprend l'étape en échec et les suivantes, rien n'est repayé, aucun prix demandé ;
 *  - « Corriger la fiche » (échec) / « Reprendre la fiche » (arrêt par Will) : `rouvrirFicheTableauAction`, la vidéo
 *    redevient un brouillon sur l'écran de création (`/tableau/nouvelle?brouillon=<id>`) ; la voix déjà payée y est
 *    reprise si le texte dit ne change pas.
 * Pendant la fabrication, « Passer devant » (travail en file) puis « Arrêter ». Les fichiers déjà faits (une sortie a pu aboutir avant l'arrêt) restent téléchargeables, avec ce qui manque.
 */
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { passerDevantAction } from "@/app/(studio)/videos/actions";
import { relancerTableauAction, rouvrirFicheTableauAction } from "@/app/(studio)/tableau/nouvelle/actions";
import { Bouton } from "@/components/ui/Bouton";
import { confirmerPrix } from "@/components/ui/ConfirmationPrix";
import { phrasePanneAction } from "@/components/ui/phrasesAction";
import { notifier } from "@/components/ui/Toast";
import { BoutonAnnuler } from "@/components/videos/BoutonAnnuler";
import { BoutonArreter } from "@/components/videos/BoutonArreter";
import { ACTIONS_FABRICATION } from "@/domaine/libelles";
import { useTravaux } from "@/hooks/useTravaux";
import type { VueTravail } from "@/services/vues";
import { EtapesTableau, type FichiersArret } from "./EtapesTableau";
import { issuesApresArret } from "./vue";

export function SuiviTableau({ initial, fichiers }: { initial: VueTravail; fichiers?: FichiersArret | null }) {
  const router = useRouter();
  const [relance, demarrer] = useTransition();
  const [devant, passerDevant] = useTransition();
  const { travail, actualiser } = useTravaux({
    travailId: initial.id,
    initial: [initial],
    onTermine: () => {
      notifier.succes("Votre vidéo est prête");
      router.refresh();
    },
  });
  const t = travail ?? initial;
  const [phrase, setPhrase] = useState<string | null>(null);
  const [rouverture, demarrerRouverture] = useTransition();
  const videoId = t.cibleId;
  const injoignable = "Le studio ne répond pas pour l'instant. Rien n'est perdu : réessayez dans un instant.";

  function corrigerFiche() {
    setPhrase(null);
    demarrerRouverture(async () => {
      const r = await rouvrirFicheTableauAction(videoId).catch(() => null);
      if (!r) return setPhrase(injoignable);
      if (!r.ok) return setPhrase(r.message);
      router.push(`/tableau/nouvelle?brouillon=${encodeURIComponent(videoId)}`);
    });
  }

  async function relancer(montant?: number, message?: string, dejaRelance = false) {
    setPhrase(null);
    let accord: number | undefined;
    if (typeof montant === "number") {
      const a = await confirmerPrix({ message: message ?? "La voix de cette vidéo est la seule dépense (l'écriture et le découpage sont gardés).", montant });
      if (typeof a !== "number") return setPhrase("Relance non lancée. Prix indicatif, sans blocage : réessayez quand vous voulez.");
      accord = a;
    }
    demarrer(async () => {
      const r = await relancerTableauAction(t.id, accord).catch(() => null);
      if (!r) return setPhrase(injoignable);
      if (!r.ok) return setPhrase(r.message);
      if (r.donnees.statut === "refusee") return setPhrase(r.donnees.phrase);
      if (r.donnees.statut === "accord-requis") {
        // UNE seule relance automatique, jamais de boucle.
        if (dejaRelance) return setPhrase("Le prix a changé, réessayez.");
        return void relancer(r.donnees.centimes, r.donnees.phrase, true);
      }
      notifier.succes(r.donnees.phrase);
      // Relance d'un autre travail (arrêt à la relecture) : la page suit le nouveau ; sinon le suivi repart d'ici.
      if (r.donnees.travailId !== t.id) router.refresh();
      else {
        await actualiser();
        router.refresh();
      }
    });
  }

  function devancer() {
    setPhrase(null);
    passerDevant(async () => {
      try {
        const r = await passerDevantAction(t.id);
        if (!r.ok) notifier.erreur(r.message);
        else {
          router.refresh();
          void actualiser();
        }
      } catch (err) {
        setPhrase(phrasePanneAction(err));
      }
    });
  }

  const issues = issuesApresArret(t);
  const actionsArret = issues.length ? (
    <>
      {issues.includes("corriger") && (
        <Bouton variante={issues.includes("relancer") ? "secondaire" : "principal"} icone="ecrire" chargement={rouverture} onClick={corrigerFiche}>
          {t.statut === "annule" ? "Reprendre la fiche" : "Corriger la fiche"}
        </Bouton>
      )}
      {issues.includes("relancer") && (
        <Bouton icone="reessayer" chargement={relance} onClick={() => void relancer()}>
          Reprendre la fabrication
        </Bouton>
      )}
    </>
  ) : null;

  return (
    <>
      <EtapesTableau
        travail={t}
        actionsArret={actionsArret}
        fichiers={fichiers}
        passerDevant={
          t.rang && !t.urgent ? (
            <Bouton variante="fantome" icone="eclair" chargement={devant} onClick={devancer}>
              {ACTIONS_FABRICATION.passerDevant}
            </Bouton>
          ) : undefined
        }
        action={<BoutonArreter travailId={t.id} videoId={t.cibleId} depense={t.depense} compact />}
        annuler={<BoutonAnnuler videoId={t.cibleId} travailId={t.statut === "en_file" || t.statut === "en_cours" ? t.id : undefined} depense={t.depense} compact apres="/videos" />}
      />
      {phrase && (
        <p role="alert" className="mt-3 rounded-2xl border border-brique/40 bg-brique-doux px-4 py-3 text-[15px] text-texte">
          {phrase}
        </p>
      )}
    </>
  );
}
