"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { lireEssaiZernioAction, poserEssaiZernioAction, retirerEssaiZernioAction } from "@/app/(studio)/reglages/actions-zernio";
import { Bouton } from "@/components/ui/Bouton";
import { notifier } from "@/components/ui/Toast";
import type { EtatEssaiVu } from "@/services/essai-zernio";

/** « 18/11 à 14:30 » en heure de Paris, ou « — » si l'instant est illisible. */
export function heureParis(iso: string): string {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return "—";
  const p = new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date(t));
  const v = (k: string) => p.find((x) => x.type === k)?.value ?? "";
  return `${v("day")}/${v("month")} à ${v("hour")}:${v("minute")}`;
}

const NOMS: Record<string, string> = { linkedin: "LinkedIn", instagram: "Instagram", facebook: "Facebook" };
const jjmm = (j: string): string => `${j.slice(8, 10)}/${j.slice(5, 7)}`;

/**
 * Bloc « Essai d'un brouillon » (Réglages › Zernio) : UN créneau, UN compte, brouillon seulement, 24 h au plus.
 * Le compte et le réseau sont lus du créneau, jamais saisis. Ne promeut rien et n'ouvre aucun des trois réglages.
 */
export function EssaiBrouillon() {
  const [etat, setEtat] = useState<EtatEssaiVu | null>(null);
  const [creneau, setCreneau] = useState("");
  const [heures, setHeures] = useState(4);
  const [enCours, demarrer] = useTransition();
  const [erreur, setErreur] = useState(false);

  const recharger = useCallback(async () => {
    const r = await lireEssaiZernioAction();
    if (r.ok) {
      setEtat(r.donnees);
      setErreur(false);
    } else setErreur(true);
  }, []);
  useEffect(() => {
    void recharger();
  }, [recharger]);

  return (
    <section aria-labelledby="essai-titre" data-carte="essai-brouillon" className="mt-6 rounded-carte border border-trait bg-surface-1 p-4 shadow-carte sm:p-5">
      <h3 id="essai-titre" className="text-base font-semibold text-texte">
        Essai d’un brouillon
      </h3>
      <p className="mt-1 text-sm text-texte-doux">
        Crée UN brouillon, pour UN créneau validé et son compte, sans ouvrir les réglages d’envoi. Rien n’est programmé ni publié. L’essai s’arrête seul au bout de 24 h au plus ; le retrait du brouillon reste possible 24 h de plus.
      </p>
      {erreur && <p role="alert" className="mt-2 text-sm text-brique">L’état de l’essai n’a pas pu être lu.</p>}
      {etat?.essai ? (
        <div className="mt-3">
          <p role="status" className="text-sm text-texte">
            {etat.actif ? `Essai actif sur « ${etat.essai.creneauId} » jusqu’à ${heureParis(etat.essai.expireLe)}, heure de Paris.` : `Essai expiré (${heureParis(etat.essai.expireLe)}) : plus aucun brouillon ne sera créé ; le retrait reste possible quelque temps.`}
          </p>
          <div className="mt-2">
            <Bouton
              variante="secondaire"
              chargement={enCours}
              onClick={() =>
                demarrer(async () => {
                  const r = await retirerEssaiZernioAction();
                  if (!r.ok) notifier.erreur(r.message);
                  await recharger();
                })
              }
            >
              Retirer l’essai
            </Bouton>
          </div>
        </div>
      ) : (
        <div className="mt-3 flex flex-col gap-3">
          <p role="status" className="text-sm text-texte-doux">Aucun essai.</p>
          <label className="flex flex-col gap-1 text-sm text-texte">
            Créneau (validé, un seul réseau, dans 1 à 6 jours)
            <select value={creneau} onChange={(e) => setCreneau(e.target.value)} className="rounded-champ border border-trait bg-surface-1 px-3 py-2">
              <option value="">Choisir un créneau</option>
              {(etat?.eligibles ?? []).map((c) => (
                <option key={c.id} value={c.id}>{`${jjmm(c.jour)} · ${NOMS[c.reseau] ?? c.reseau} · ${c.id}`}</option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm text-texte">
            Durée (heures, 1 à 24)
            <input type="number" min={1} max={24} step={1} value={heures} onChange={(e) => setHeures(Number(e.target.value))} className="w-24 rounded-champ border border-trait bg-surface-1 px-3 py-2" />
          </label>
          <div>
            <Bouton
              chargement={enCours}
              disabled={!creneau}
              onClick={() =>
                demarrer(async () => {
                  const r = await poserEssaiZernioAction({ creneauId: creneau, dureeHeures: heures });
                  if (!r.ok) notifier.erreur(r.message);
                  else notifier.succes("Essai posé.");
                  await recharger();
                })
              }
            >
              Poser l’essai
            </Bouton>
          </div>
        </div>
      )}
    </section>
  );
}
