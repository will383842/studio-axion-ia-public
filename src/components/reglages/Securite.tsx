"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { changerMotDePasseAction, revoquerSessionAction } from "@/app/(studio)/reglages/actions";
import { Bouton } from "@/components/ui/Bouton";
import { Champ } from "@/components/ui/Champ";
import { FeuilleBas } from "@/components/ui/FeuilleBas";
import { Icone } from "@/components/ui/Icone";
import { Pastille } from "@/components/ui/Pastille";
import { notifier } from "@/components/ui/Toast";
import { IlYA } from "@/components/ui/IlYA";

export interface AppareilVue {
  id: string;
  appareil: string;
  derniereActivite: string;
  courante: boolean;
  resterConnecte: boolean;
}

/**
 * Mot de passe : l'ancien est exigé ; les autres appareils sont déconnectés (B.4-4).
 * `enMemoire` : vrai seulement quand les données ne sont pas gardées (développement) — en ligne,
 * le nouveau mot de passe est enregistré et survit au redémarrage, aucune mise en garde alors.
 */
export function ChangerMotDePasse({ enMemoire = false }: { enMemoire?: boolean }) {
  const [ouverte, setOuverte] = useState(false);
  const [ancien, setAncien] = useState("");
  const [nouveau, setNouveau] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, demarrer] = useTransition();
  const tropCourt = nouveau.length > 0 && nouveau.length < 12;
  const different = confirmation.length > 0 && confirmation !== nouveau;

  function fermer(o: boolean) {
    setOuverte(o);
    if (!o) {
      setAncien("");
      setNouveau("");
      setConfirmation("");
      setErreur(null);
    }
  }

  return (
    <>
      <div className="flex min-w-0 items-center gap-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-full bg-surface-2 text-texte-doux">
          <Icone nom="cle" size={19} />
        </span>
        <span className="min-w-0 flex-1 truncate font-mono text-lg tracking-[0.2em] text-texte-doux" aria-label="Mot de passe masqué">
          ••••••••
        </span>
        <Bouton variante="secondaire" className="shrink-0" onClick={() => setOuverte(true)}>
          Changer
        </Bouton>
      </div>
      {enMemoire && <p className="mt-2 text-xs text-texte-faible">Version d&apos;essai : le nouveau mot de passe s&apos;efface au prochain redémarrage.</p>}
      <FeuilleBas
        ouverte={ouverte}
        onOuverteChange={fermer}
        titre="Nouveau mot de passe"
        description="Les autres appareils seront déconnectés."
        pied={
          <Bouton
            taille="lg"
            pleineLargeur
            icone="cadenas"
            chargement={enCours}
            disabled={!ancien || nouveau.length < 12 || confirmation !== nouveau}
            onClick={() =>
              demarrer(async () => {
                setErreur(null);
                const r = await changerMotDePasseAction(ancien, nouveau);
                if (!r.ok) {
                  setErreur(r.message);
                  return;
                }
                notifier.succes("Mot de passe changé", "Les autres appareils sont déconnectés.");
                fermer(false);
              })
            }
          >
            Changer le mot de passe
          </Bouton>
        }
      >
        <form className="space-y-4" onSubmit={(e) => e.preventDefault()}>
          <Champ libelle="Mot de passe actuel" motDePasse autoComplete="current-password" value={ancien} onChange={(e) => setAncien(e.target.value)} erreur={erreur ?? undefined} />
          <Champ libelle="Nouveau" motDePasse autoComplete="new-password" value={nouveau} onChange={(e) => setNouveau(e.target.value)} aide="12 caractères au moins." erreur={tropCourt ? "Encore un peu : 12 caractères au moins." : undefined} />
          <Champ libelle="Encore une fois" motDePasse autoComplete="new-password" value={confirmation} onChange={(e) => setConfirmation(e.target.value)} erreur={different ? "Les deux ne correspondent pas." : undefined} />
        </form>
      </FeuilleBas>
    </>
  );
}

/** Appareils connectés, avec « Déconnecter » pour les autres. */
export function ListeAppareils({ appareils }: { appareils: AppareilVue[] }) {
  const router = useRouter();
  const [enCours, setEnCours] = useState<string | null>(null);
  return (
    <ul className="-my-1 divide-y divide-trait">
      {appareils.map((s) => (
        <li key={s.id} className="flex min-h-16 items-center gap-3 py-2">
          <span className="grid size-11 shrink-0 place-items-center rounded-full bg-surface-2 text-texte-doux">
            <Icone nom={/iPhone|Android|Téléphone/.test(s.appareil) ? "telephone" : "appareils"} size={19} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate font-semibold text-texte">{s.appareil}</span>
            <span className="text-xs text-texte-faible">{s.courante ? "Maintenant" : <IlYA iso={s.derniereActivite} />}</span>
          </span>
          {s.courante ? (
            <Pastille ton="sauge">Cet appareil</Pastille>
          ) : (
            <Bouton
              variante="fantome"
              chargement={enCours === s.id}
              className="text-brique hover:bg-brique-doux hover:text-brique"
              onClick={async () => {
                setEnCours(s.id);
                const r = await revoquerSessionAction(s.id);
                setEnCours(null);
                if (!r.ok) {
                  notifier.erreur(r.message);
                  return;
                }
                notifier.succes("Appareil déconnecté");
                router.refresh();
              }}
            >
              Déconnecter
            </Bouton>
          )}
        </li>
      ))}
    </ul>
  );
}
