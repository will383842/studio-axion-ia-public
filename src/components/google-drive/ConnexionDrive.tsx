"use client";

/**
 * Réglages › Mon Google Drive (lot E2) : connexion UNE SEULE FOIS, en lecture seule. « Connecter mon Drive » ouvre la
 * page Google (compte compte@exemple.fr proposé), qui revient ici. Le studio ne peut ni modifier ni effacer
 * quoi que ce soit dans le Drive.
 */
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { deconnecterDriveAction, lancerConnexionDriveAction } from "@/app/(studio)/reglages/google-drive/actions";
import type { VueDrive } from "@/services/google-drive";
import { ilYA } from "@/lib/dates";
import { Bouton } from "@/components/ui/Bouton";
import { Icone } from "@/components/ui/Icone";
import { Pastille } from "@/components/ui/Pastille";
import { PastilleEssai } from "@/components/ui/PastilleEssai";
import { notifier } from "@/components/ui/Toast";

const RETOURS: Record<string, { ok: boolean; texte: string }> = {
  relie: { ok: true, texte: "Votre Drive est relié. Vous pouvez choisir une vidéo depuis l'écran d'envoi." },
  annule: { ok: false, texte: "Connexion annulée sur la page Google. Rien n'a été relié." },
  refuse: { ok: false, texte: "Google n'a pas donné l'accès. Réessayez, ou continuez à envoyer depuis l'iPhone." },
  "lien-expire": { ok: false, texte: "La page Google est restée ouverte trop longtemps. Recommencez." },
};

export function ConnexionDrive({ etat, retour }: { etat: VueDrive; retour?: string }) {
  const router = useRouter();
  const [enCours, demarrer] = useTransition();
  const [confirmer, setConfirmer] = useState(false);
  const message = retour ? RETOURS[retour] : undefined;

  const connecter = () =>
    demarrer(async () => {
      const r = await lancerConnexionDriveAction();
      if (!r.ok) return void notifier.erreur(r.message);
      window.location.assign(r.donnees.adresse);
    });

  const deconnecter = () =>
    demarrer(async () => {
      const r = await deconnecterDriveAction();
      if (!r.ok) return void notifier.erreur(r.message);
      setConfirmer(false);
      notifier.succes("Drive déconnecté");
      router.replace("/reglages/google-drive");
    });

  return (
    <div className="space-y-4">
      {message && (
        <p role="status" className={`flex items-start gap-2 rounded-carte border p-3 text-sm ${message.ok ? "border-sauge/40 text-texte" : "border-ambre/40 text-texte"}`}>
          <Icone nom={message.ok ? "coche" : "attention"} size={16} className={`mt-0.5 shrink-0 ${message.ok ? "text-sauge" : "text-ambre"}`} />
          {message.texte}
        </p>
      )}

      <section className="rounded-carte border border-trait bg-surface-1 p-4">
        <div className="flex items-center gap-3">
          <span className="grid size-11 shrink-0 place-items-center rounded-full bg-surface-3 text-texte-doux">
            <Icone nom="prise" size={20} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="flex flex-wrap items-center gap-2 text-[15px] font-semibold text-texte">
              Google Drive
              {etat.relie ? (
                <Pastille ton="sauge" icone="coche">
                  Relié
                </Pastille>
              ) : (
                <Pastille ton="neutre">À relier</Pastille>
              )}
              {etat.simulation && <PastilleEssai />}
            </p>
            <p className="mt-0.5 truncate text-xs text-texte-faible">
              {etat.relie ? `${etat.compte || "Compte relié"}${etat.connecteLe ? ` · relié ${ilYA(etat.connecteLe)}` : ""}` : etat.aReconnecter ? "Connexion à refaire" : "Lecture seule · une seule fois"}
            </p>
          </div>
        </div>

        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          {etat.relie ? (
            confirmer ? (
              <>
                <Bouton variante="danger" icone="deconnexion" chargement={enCours} onClick={deconnecter}>
                  Oui, déconnecter
                </Bouton>
                <Bouton variante="fantome" onClick={() => setConfirmer(false)}>
                  Garder
                </Bouton>
              </>
            ) : (
              <>
                <Bouton variante="secondaire" icone="reessayer" chargement={enCours} onClick={connecter}>
                  Reconnecter
                </Bouton>
                <Bouton variante="fantome" icone="deconnexion" onClick={() => setConfirmer(true)}>
                  Déconnecter
                </Bouton>
              </>
            )
          ) : (
            <Bouton icone="cle" taille="lg" pleineLargeur chargement={enCours} onClick={connecter}>
              {etat.aReconnecter ? "Reconnecter mon Drive" : "Connecter mon Drive"}
            </Bouton>
          )}
        </div>
      </section>

      <ul className="space-y-2 text-sm text-texte-doux">
        <li className="flex items-start gap-2">
          <Icone nom="oeil" size={16} className="mt-0.5 shrink-0" />
          <span>
            Le studio peut seulement <strong className="font-semibold text-texte">lire</strong> vos vidéos : il ne modifie et n&apos;efface jamais rien dans le Drive.
          </span>
        </li>
        <li className="flex items-start gap-2">
          <Icone nom="envoyer" size={16} className="mt-0.5 shrink-0" />
          <span>La copie se fait de serveur à serveur : rien ne passe par le téléphone, jusqu&apos;à 15 Go par vidéo.</span>
        </li>
        <li className="flex items-start gap-2">
          <Icone nom="cadenas" size={16} className="mt-0.5 shrink-0" />
          <span>L&apos;accès est gardé chiffré sur le serveur. «&nbsp;Déconnecter&nbsp;» le retire aussi chez Google.</span>
        </li>
      </ul>
    </div>
  );
}
