"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { definirAfficherExemplesAction, definirMentionIAAction, definirNotificationsAction, definirReseauxParDefautAction } from "@/app/(studio)/reglages/actions";
import { Bouton } from "@/components/ui/Bouton";
import { Champ } from "@/components/ui/Champ";
import { Icone } from "@/components/ui/Icone";
import { Interrupteur } from "@/components/ui/Interrupteur";
import { LogoReseau } from "@/components/ui/LogoReseau";
import { SelecteurPastilles } from "@/components/ui/SelecteurPastilles";
import { notifier } from "@/components/ui/Toast";
import type { IdReseau, MentionIA } from "@/domaine/types";
import { cn } from "@/lib/cn";
import { listerReseaux } from "@/reseaux";
import type { PreferencesNotifications } from "@/services/reglages";
import { EMAIL_PAS_PRET, TELEPHONE_PAS_PRET } from "@/domaine/notifications-textes";
import { pluriel } from "@/lib/textes";
import type { VueNotificationsServeur } from "@/services/notifications";
import { BoutonsEssai, CeTelephone } from "./NotificationsTelephone";

type Resultat = { ok: true } | { ok: false; message: string };

/** Enregistrement immédiat avec retour visuel ; annule l'état local en cas d'échec. */
function useEnregistrement() {
  const router = useRouter();
  const [enCours, demarrer] = useTransition();
  function enregistrer(action: () => Promise<Resultat>, succes?: string, annuler?: () => void) {
    demarrer(async () => {
      const r = await action();
      if (!r.ok) {
        annuler?.();
        notifier.erreur(r.message);
        return;
      }
      if (succes) notifier.succes(succes);
      router.refresh();
    });
  }
  return { enCours, enregistrer };
}

/* --- Mention IA ---------------------------------------------------- */

const POSITIONS: { valeur: MentionIA["position"]; libelle: string }[] = [
  { valeur: "haut-gauche", libelle: "↖" },
  { valeur: "haut-droite", libelle: "↗" },
  { valeur: "bas-gauche", libelle: "↙" },
  { valeur: "bas-droite", libelle: "↘" },
];

/**
 * Mention IA par défaut (B.4-6, AV2.3-11) : FACULTATIVE, coupée par défaut, jamais bloquante (décision de Will du 01/10).
 * Ces deux interrupteurs valent pour TOUS les formats et toutes les nouvelles vidéos.
 */
export function ReglagesMentionIA({ initiale }: { initiale: MentionIA }) {
  const [m, setM] = useState(initiale);
  const { enCours, enregistrer } = useEnregistrement();
  const modifie = JSON.stringify(m) !== JSON.stringify(initiale);
  return (
    <div className="space-y-4">
      {/* Aperçu : une image de vidéo avec la mention à sa place */}
      <div className="flex items-center gap-4">
        <div className="relative aspect-[9/16] w-20 shrink-0 overflow-hidden rounded-xl border border-trait bg-fond">
          <div aria-hidden className="absolute inset-0 lueur-forte" />
          {m.incrustee && (
            <span
              className={cn(
                "absolute rounded bg-fond/70 px-1 py-0.5 text-[7px] font-bold leading-none text-texte",
                m.position.startsWith("haut") ? "top-1.5" : "bottom-1.5",
                m.position.endsWith("gauche") ? "left-1.5" : "right-1.5",
              )}
            >
              {m.texte}
            </span>
          )}
        </div>
        <div className="min-w-0 flex-1 space-y-1">
          <Interrupteur libelle="Incrustée dans l'image" coche={m.incrustee} onChange={(v) => setM({ ...m, incrustee: v })} />
          <Interrupteur libelle="Dans le texte de publication" coche={m.dansLegende} onChange={(v) => setM({ ...m, dansLegende: v })} />
        </div>
      </div>
      <p className="flex items-start gap-2 text-xs text-texte-faible">
        <Icone nom="info" size={13} className="mt-0.5 shrink-0" />
        Facultative, coupée par défaut. Vous l&apos;allumez quand vous le souhaitez.
      </p>
      <Champ libelle="Texte" value={m.texte} onChange={(e) => setM({ ...m, texte: e.target.value })} maxLength={60} />
      {m.incrustee && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <SelecteurPastilles<MentionIA["position"]> libelle="Coin" valeur={m.position} onChange={(position) => setM({ ...m, position })} options={POSITIONS} />
          <SelecteurPastilles<number>
            libelle="Durée"
            valeur={m.dureeSec}
            onChange={(dureeSec) => setM({ ...m, dureeSec })}
            options={[
              { valeur: 3, libelle: "3 s" },
              { valeur: 5, libelle: "5 s" },
              { valeur: 0, libelle: "Toute la vidéo" },
            ]}
          />
        </div>
      )}
      {modifie && (
        <div className="flex justify-end gap-2">
          <Bouton variante="fantome" onClick={() => setM(initiale)}>
            Annuler
          </Bouton>
          <Bouton variante="secondaire" icone="coche" chargement={enCours} onClick={() => enregistrer(() => definirMentionIAAction(m), "Mention enregistrée")}>
            Enregistrer
          </Bouton>
        </div>
      )}
    </div>
  );
}

/* --- Réseaux par défaut ------------------------------------------- */

/** Réseaux proposés en premier dans le kit de publication et cochés par défaut pour Buffer. */
export function ReglagesReseaux({ initiaux }: { initiaux: IdReseau[] }) {
  const [reseaux, setReseaux] = useState(initiaux);
  const { enregistrer } = useEnregistrement();
  return (
    <SelecteurPastilles<IdReseau>
      multiple
      minimum={1}
      libelle="Mes réseaux"
      libelleMasque
      valeur={reseaux}
      onChange={(v) => {
        const avant = reseaux;
        setReseaux(v);
        enregistrer(() => definirReseauxParDefautAction(v), undefined, () => setReseaux(avant));
      }}
      options={listerReseaux().map((r) => ({ valeur: r.id, libelle: r.nom, visuel: <LogoReseau reseau={r.id} taille="sm" /> }))}
    />
  );
}

/* --- Notifications ------------------------------------------------- */

/**
 * Ce qui me prévient, et par où (lot R3 : téléphone et e-mail reliés). Le téléphone et l'e-mail ne sont proposés que
 * s'ils peuvent vraiment partir : carte « Notifications » reliée dans Connexions et réglage posé sur le serveur.
 * Aucun nom de réglage ni mot technique à l'écran (ordre de Will) : une phrase simple par canal.
 */
export function ReglagesNotifications({ initiales, serveur }: { initiales: PreferencesNotifications; serveur: VueNotificationsServeur }) {
  const [p, setP] = useState(initiales);
  const { enregistrer } = useEnregistrement();
  function changer(suite: PreferencesNotifications) {
    const avant = p;
    setP(suite);
    enregistrer(() => definirNotificationsAction(suite), undefined, () => setP(avant));
  }
  const simulation = serveur.carte === "simulation";
  const raison = (pret: boolean) => (pret ? undefined : simulation ? "À relier dans Connexions" : "Pas encore prêt");
  return (
    <div className="space-y-1">
      <Interrupteur icone="valide" libelle="Vidéo prête" coche={p.videoPrete} onChange={(v) => changer({ ...p, videoPrete: v })} />
      <Interrupteur icone="attention" libelle="Une étape bloque" coche={p.echec} onChange={(v) => changer({ ...p, echec: v })} />
      <Interrupteur icone="euro" libelle="Budget" coche={p.budget} onChange={(v) => changer({ ...p, budget: v })} />
      <div className="pt-3">
        <SelecteurPastilles<PreferencesNotifications["canal"]>
          libelle="Par où"
          valeur={p.canal}
          onChange={(canal) => changer({ ...p, canal })}
          options={[
            { valeur: "console", libelle: "La cloche", icone: "cloche" },
            { valeur: "telephone", libelle: "Téléphone", icone: "telephone", desactive: !serveur.telephonePret, raison: raison(serveur.telephonePret), detail: raison(serveur.telephonePret) },
            { valeur: "email", libelle: "E-mail", icone: "mail", desactive: !serveur.emailPret, raison: raison(serveur.emailPret), detail: raison(serveur.emailPret) },
          ]}
        />
      </div>

      {simulation ? (
        <p className="flex items-start gap-2 pt-3 text-xs text-texte-faible">
          <Icone nom="info" size={13} className="mt-0.5 shrink-0" />
          <span>
            Pour être prévenu sur le téléphone ou par e-mail, choisissez le service réel de la carte « Notifications » dans{" "}
            <a href="#connexions" className="font-semibold text-orange-vif hover:underline">
              Connexions
            </a>
            .
          </span>
        </p>
      ) : (
        <div className="space-y-4 pt-4">
          {[!serveur.telephonePret && TELEPHONE_PAS_PRET, !serveur.emailPret && EMAIL_PAS_PRET].filter(Boolean).map((phrase) => (
            <p key={String(phrase)} className="flex items-start gap-2 text-xs text-texte-faible">
              <Icone nom="info" size={13} className="mt-0.5 shrink-0" />
              <span>{phrase}</span>
            </p>
          ))}
          {serveur.telephonePret && (
            <div className="rounded-2xl border border-trait p-4">
              <p className="mb-3 flex items-center justify-between gap-3 text-sm">
                <span className="font-semibold text-texte">Ce téléphone</span>
                <span className="text-xs text-texte-faible">{serveur.appareils ? pluriel(serveur.appareils, "appareil relié", "appareils reliés") : "Aucun appareil pour l'instant"}</span>
              </p>
              <CeTelephone />
            </div>
          )}
          {serveur.emailPret && serveur.destinataire && (
            <p className="flex items-start gap-2 text-sm text-texte-doux">
              <Icone nom="mail" size={15} className="mt-0.5 shrink-0" />
              <span>
                Les e-mails partent à <span className="font-semibold text-texte">{serveur.destinataire}</span>.
              </span>
            </p>
          )}
          <BoutonsEssai telephone={serveur.telephonePret && serveur.appareils > 0} email={serveur.emailPret} />
        </div>
      )}
    </div>
  );
}

/* --- Exemples ------------------------------------------------------ */

/** « Afficher les exemples » (AV2.4-7) : masque les données de démonstration sans les supprimer. */
export function InterrupteurExemples({ initial }: { initial: boolean }) {
  const [v, setV] = useState(initial);
  const { enregistrer } = useEnregistrement();
  return (
    <Interrupteur
      icone="etincelles"
      libelle="Afficher les exemples"
      detail="Masqués, jamais supprimés."
      coche={v}
      onChange={(suite) => {
        setV(suite);
        enregistrer(() => definirAfficherExemplesAction(suite), suite ? "Exemples affichés" : "Exemples masqués", () => setV(!suite));
      }}
    />
  );
}
