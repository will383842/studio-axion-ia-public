"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { envoyerEssaiNotificationAction } from "@/app/(studio)/reglages/actions";
import { useNotificationsTelephone, type EtatNotificationsTelephone } from "@/components/coquille/EnregistrementPwa";
import { Bouton } from "@/components/ui/Bouton";
import { TELEPHONE_PAS_PRET } from "@/domaine/notifications-textes";
import { Icone } from "@/components/ui/Icone";
import { notifier } from "@/components/ui/Toast";

/**
 * NOTIFICATIONS SUR CE TÉLÉPHONE (lot R3) : activer, guider sur iPhone, envoyer un essai.
 * Apple n'autorise les notifications d'un site que depuis l'application ajoutée à l'écran d'accueil (iOS 16.4 ou plus
 * récent) : l'écran le dit simplement et montre les trois gestes.
 */

/** Rendu PUR selon l'état (testé sans navigateur). */
export function VueCeTelephone({ etat, onActiver, enCours = false }: { etat: EtatNotificationsTelephone | "verification"; onActiver: () => void; enCours?: boolean }) {
  if (etat === "verification") return <div aria-busy="true" className="h-11 w-56 animate-pulse rounded-full bg-surface-2" />;

  if (etat === "actives") {
    return (
      <p className="flex items-center gap-2 text-sm font-semibold text-texte">
        <span className="grid size-7 place-items-center rounded-full bg-sauge text-fond">
          <Icone nom="coche" size={15} strokeWidth={2.6} />
        </span>
        Activées sur ce téléphone
      </p>
    );
  }

  if (etat === "a-activer") {
    return (
      <div className="space-y-2">
        <Bouton variante="secondaire" icone="cloche" chargement={enCours} onClick={onActiver}>
          Activer sur ce téléphone
        </Bouton>
        <p className="text-xs text-texte-faible">Votre téléphone va vous demander l&apos;autorisation : touchez « Autoriser ».</p>
      </div>
    );
  }

  if (etat === "ecran-accueil") {
    return (
      <div className="rounded-2xl border border-trait bg-surface-1 p-4">
        <p className="mb-3 flex items-center gap-2 text-sm font-semibold text-texte">
          <Icone nom="telephone" size={16} />
          Sur iPhone, ajoutez d&apos;abord le studio à l&apos;écran d&apos;accueil
        </p>
        <ol className="space-y-2 text-sm text-texte-doux">
          {[
            "Dans Safari, touchez Partager (le carré avec une flèche vers le haut).",
            "Choisissez « Sur l'écran d'accueil », puis « Ajouter ».",
            "Ouvrez le studio depuis sa nouvelle icône, puis revenez ici.",
          ].map((t, i) => (
            <li key={t} className="flex gap-3">
              <span className="grid size-6 shrink-0 place-items-center rounded-full bg-orange text-xs font-bold text-sur-orange">{i + 1}</span>
              <span className="pt-0.5">{t}</span>
            </li>
          ))}
        </ol>
        <p className="mt-3 text-xs text-texte-faible">Il faut iOS 16.4 ou plus récent. Apple ne permet pas les notifications depuis Safari seul.</p>
      </div>
    );
  }

  if (etat === "refusees") {
    return (
      <div className="rounded-2xl border border-trait bg-surface-1 p-4 text-sm text-texte-doux">
        <p className="mb-2 flex items-center gap-2 font-semibold text-texte">
          <Icone nom="attention" size={16} />
          Les notifications ont été refusées sur ce téléphone
        </p>
        <p>iPhone : Réglages, puis Notifications, puis Studio, puis « Autoriser ».</p>
        <p>Android : touchez le cadenas à côté de l&apos;adresse, puis Notifications, puis « Autoriser ».</p>
        <p className="mt-2 text-xs text-texte-faible">Revenez ensuite sur cette page.</p>
      </div>
    );
  }

  const textes: Record<"indisponible" | "navigateur" | "serveur", string> = {
    indisponible: "Les notifications du téléphone s'activent depuis le studio en ligne.",
    navigateur: "Ce navigateur ne reçoit pas les notifications. Sur iPhone : iOS 16.4 ou plus récent, depuis l'icône de l'écran d'accueil. Sinon, choisissez l'e-mail.",
    serveur: TELEPHONE_PAS_PRET,
  };
  return (
    <p className="flex items-start gap-2 text-sm text-texte-faible">
      <Icone nom="info" size={14} className="mt-0.5 shrink-0" />
      {textes[etat]}
    </p>
  );
}

/** Bloc « Ce téléphone » : l'état réel de l'appareil, et l'activation sur un geste de Will. */
export function CeTelephone() {
  const router = useRouter();
  const telephone = useNotificationsTelephone();
  const [enCours, setEnCours] = useState(false);
  return (
    <VueCeTelephone
      etat={telephone.etat}
      enCours={enCours}
      onActiver={async () => {
        setEnCours(true);
        const ok = await telephone.activer();
        setEnCours(false);
        if (ok) {
          notifier.succes("C'est noté", "Ce téléphone sera prévenu.");
          router.refresh();
        }
      }}
    />
  );
}

/** « Envoyer un essai » : un appui = un message (le studio refuse un second essai dans les 30 secondes). */
export function BoutonsEssai({ telephone, email }: { telephone: boolean; email: boolean }) {
  const [enCours, setEnCours] = useState<"telephone" | "email" | null>(null);
  async function essayer(canal: "telephone" | "email") {
    if (enCours) return;
    setEnCours(canal);
    const r = await envoyerEssaiNotificationAction(canal);
    setEnCours(null);
    if (r.ok) notifier.succes(r.donnees.recus ? "Essai envoyé" : "Essai non reçu", r.donnees.message);
    else notifier.erreur(r.message);
  }
  if (!telephone && !email) return null;
  return (
    <div>
      <p className="mb-2 text-sm font-semibold text-texte-doux">Envoyer un essai</p>
      <div className="flex flex-wrap gap-2">
        {telephone && (
          <Bouton variante="contour" icone="telephone" chargement={enCours === "telephone"} disabled={!!enCours} onClick={() => essayer("telephone")}>
            Sur le téléphone
          </Bouton>
        )}
        {email && (
          <Bouton variante="contour" icone="mail" chargement={enCours === "email"} disabled={!!enCours} onClick={() => essayer("email")}>
            Par e-mail
          </Bouton>
        )}
      </div>
    </div>
  );
}
