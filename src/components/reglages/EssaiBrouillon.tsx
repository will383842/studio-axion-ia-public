"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import {
  lireEssaiZernioAction,
  poserEssaiZernioAction,
  retirerEssaiZernioAction,
  type EtatEssaiZernio,
} from "@/app/(studio)/reglages/actions-zernio";
import { Bouton } from "@/components/ui/Bouton";
import { notifier } from "@/components/ui/Toast";

const RESEAUX: Record<string, string> = { linkedin: "LinkedIn", instagram: "Instagram", facebook: "Facebook" };
const jjmm = (jour: string): string => `${jour.slice(8, 10)}/${jour.slice(5, 7)}`;
const heureParis = (iso: string): string => new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Paris" }).format(new Date(iso));

/**
 * Essai d'UN brouillon : un créneau validé, un compte, 24 h au plus. Ne programme rien, ne publie rien : le Studio crée UN brouillon
 * chez le diffuseur, que vous retirez ensuite. Compte et réseau viennent du créneau, jamais d'une saisie.
 */
export function EssaiBrouillon() {
  const router = useRouter();
  const [etat, setEtat] = useState<EtatEssaiZernio | null>(null);
  const [creneauId, setCreneauId] = useState("");
  const [heures, setHeures] = useState(4);
  const [enCours, demarrer] = useTransition();

  async function recharger() {
    try {
      const r = await lireEssaiZernioAction();
      if (r.ok) setEtat(r.donnees);
    } catch {
      /* l'écran garde son dernier état */
    }
  }
  useEffect(() => {
    let vivant = true;
    lireEssaiZernioAction().then(
      (r) => {
        if (vivant && r.ok) setEtat(r.donnees);
      },
      () => undefined,
    );
    return () => {
      vivant = false;
    };
  }, []);

  function geste(f: () => ReturnType<typeof poserEssaiZernioAction>, succes: string) {
    demarrer(async () => {
      let r;
      try {
        r = await f();
      } catch {
        notifier.erreur("Le geste n'a pas été enregistré. Réessayez.");
        return;
      }
      if (!r.ok) notifier.erreur(r.message);
      else notifier.succes(succes);
      await recharger();
      router.refresh();
    });
  }

  const essai = etat?.essai ?? null;
  return (
    <section aria-label="Essai d'un brouillon" className="mt-4 rounded-[12px] border border-trait-fort bg-surface-1 p-3">
      <h3 className="font-titre text-base text-texte">Essai d&apos;un brouillon</h3>
      <p className="mt-1 text-xs text-texte-faible">
        Un seul créneau validé, un seul compte, 24 heures au plus. Le Studio crée UN brouillon chez le diffuseur : rien n&apos;est programmé ni publié.
      </p>
      <p role="status" className="mt-2 text-sm font-bold text-texte">
        {essai?.expire
          ? `Essai expiré — retrait possible jusqu'à ${heureParis(new Date(Date.parse(essai.expireLe) + 24 * 3600_000).toISOString())} (heure de Paris).`
          : essai
          ? `Essai actif sur ${RESEAUX[essai.reseau] ?? essai.reseau}${essai.jour ? ` du ${jjmm(essai.jour)}` : ""}, jusqu'à ${heureParis(essai.expireLe)} (heure de Paris).`
          : "Aucun essai."}
      </p>
      {essai?.aCompleter && (
        <p role="status" className="mt-1 text-sm text-texte">{essai.aCompleter}</p>
      )}
      {essai?.dernierRefus && (
        <p role="status" className="mt-1 text-sm text-texte">
          {`Dernier envoi refusé${essai.dernierRefus.le ? ` le ${jjmm(essai.dernierRefus.le.slice(0, 10))} à ${heureParis(essai.dernierRefus.le)}` : ""} : ${essai.dernierRefus.raison}`}
        </p>
      )}
      {essai ? (
        <div className="mt-2">
          <Bouton variante="secondaire" chargement={enCours} onClick={() => geste(retirerEssaiZernioAction, "Essai retiré")}>
            Retirer l&apos;essai
          </Bouton>
        </div>
      ) : (
        <div className="mt-2 flex flex-wrap items-end gap-2">
          <label className="text-sm text-texte">
            Créneau
            <select className="mt-1 block min-h-11 rounded-[10px] border border-trait-fort bg-surface-1 px-2" value={creneauId} onChange={(e) => setCreneauId(e.target.value)}>
              <option value="">Choisir un créneau</option>
              {(etat?.eligibles ?? []).map((c) => (
                <option key={c.id} value={c.id}>{`${jjmm(c.jour)} · ${RESEAUX[c.reseau] ?? c.reseau} · ${c.titre}${c.aCompleter ? " · légende à écrire" : ""}`}</option>
              ))}
            </select>
          </label>
          <label className="text-sm text-texte">
            Durée (heures)
            <input type="number" min={1} max={24} step={1} className="mt-1 block min-h-11 w-24 rounded-[10px] border border-trait-fort bg-surface-1 px-2" value={heures} onChange={(e) => setHeures(Number(e.target.value))} />
          </label>
          <Bouton variante="secondaire" chargement={enCours} disabled={!creneauId} onClick={() => geste(() => poserEssaiZernioAction({ creneauId, dureeHeures: heures }), "Essai posé")}>
            Poser l&apos;essai
          </Bouton>
        </div>
      )}
      {!essai && (etat?.eligibles.length ?? 0) === 0 && etat && <p className="mt-2 text-xs text-texte-faible">Aucun créneau éligible : il faut un créneau validé, avec un visuel, sur un seul réseau, entre demain et dans 6 jours.</p>}
    </section>
  );
}
