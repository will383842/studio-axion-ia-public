"use client";

import { useState, useTransition } from "react";
import { Bouton } from "@/components/ui/Bouton";
import { Carte } from "@/components/ui/Carte";
import { EtatVide } from "@/components/ui/EtatVide";
import { Pastille } from "@/components/ui/Pastille";
import { notifier } from "@/components/ui/Toast";
import type { Resultat, VueMots } from "@/services/mots-service";
import type { EtatBranchement } from "@/services/branchements-zernio";
import type { ElementATraiter, KitLinkedinProfil } from "@/services/mots-kit";
import { KitLinkedin } from "./KitLinkedin";
import { ETATS_MOT, etatGlobalMots, phraseRefus } from "./etat-mots";
import { creerGestesMotLocal } from "./gestes-mot-local";

/** Ce que l'écran appelle : en production les gestes de `mots-gestes`, dans les tests un faux. */
export interface ServicesMots {
  mettreEnPause(mot: string, compte: string): Promise<Resultat>;
  reactiver(mot: string, compte: string): Promise<Resultat>;
  /** Mot GUIDE LOCAL (sans idWorkflow) : activation et pause dans le registre, jamais d'appel vers Zernio. */
  activerLocal(compte: string): Promise<Resultat>;
  mettreEnPauseLocal(mot: string, compte: string): Promise<Resultat>;
  refermerDisjoncteur(): Promise<{ ok: boolean }>;
  reglerPlafonds(p: { heureCompte?: number; jourMot?: number }): Promise<unknown>;
}

/**
 * Écran « Mots » : liste, état, pause / réactivation, plafonds. Peu de texte. Tout est éteint par défaut : tant que
 * l’interrupteur est éteint, les gestes sont des simulations et l’écran le dit.
 */
export function EcranMots({ vue, services, onChange, kitLinkedin, branchement }: { vue: VueMots; services: ServicesMots; onChange?: () => void; branchement?: EtatBranchement | null; kitLinkedin?: { kit: KitLinkedinProfil | null; file: readonly ElementATraiter[] } }) {
  const [enCours, demarrer] = useTransition();
  const [heure, setHeure] = useState(String(vue.plafonds.heureCompte));
  const [jour, setJour] = useState(String(vue.plafonds.jourMot));
  const global = etatGlobalMots({ interrupteurAllume: vue.interrupteurAllume, toutArrete: vue.toutArrete, disjoncteurOuvert: vue.disjoncteur.ouvert });

  const apres = (r: Resultat) => {
    if (r.issue === "refuse") notifier.erreur(phraseRefus(r.raison));
    else if (r.issue === "simule") notifier.essai(phraseRefus(r.raison));
    else notifier.succes("C’est fait.");
    onChange?.();
  };

  // Lignes locales : l'opérateur confirme (fenêtre du navigateur) AVANT tout appel ; sans accord, rien ne part.
  const local = creerGestesMotLocal(services, { confirmer: (phrase) => window.confirm(phrase), apres });

  return (
    <div className="flex flex-col gap-4" data-ecran="mots">
      <Carte className="flex flex-wrap items-center gap-3">
        <h2 className="text-lg text-texte">Mots</h2>
        <Pastille ton={global.ton} point={global.ton === "sauge"}>
          {global.libelle}
        </Pastille>
        {vue.oppositions > 0 && <Pastille>{vue.oppositions} STOP reçu{vue.oppositions > 1 ? "s" : ""}</Pastille>}
      </Carte>

      {branchement !== undefined && (
        <Carte data-carte="branchement">
          <p className="text-sm font-semibold text-texte">Branchement des messages privés</p>
          {branchement === null ? (
            <p className="mt-1 text-sm text-texte-doux">Pas encore branché dans ce processus.</p>
          ) : branchement.codes.length === 0 ? (
            <p className="mt-1 text-sm text-texte-doux">Configuration complète.</p>
          ) : (
            <p className="mt-1 text-sm text-texte-doux">À compléter sur le serveur : {branchement.codes.join(", ")}.</p>
          )}
        </Carte>
      )}

      {vue.disjoncteur.ouvert && (
        <Carte className="border-brique/30 bg-brique-doux/40" data-carte="disjoncteur">
          <p className="text-sm font-semibold text-brique">Disjoncteur ouvert{vue.disjoncteur.raison ? ` : ${vue.disjoncteur.raison}` : ""}.</p>
          <p className="mt-1 text-sm text-texte-doux">Rien ne repart tant que vous ne l’avez pas refermé.</p>
          <Bouton className="mt-3" taille="lg" chargement={enCours} onClick={() => demarrer(async () => { const r = await services.refermerDisjoncteur(); if (!r.ok) notifier.erreur("Non refermé."); onChange?.(); })}>
            Refermer le disjoncteur
          </Bouton>
        </Carte>
      )}

      {vue.lignes.length === 0 ? (
        <EtatVide icone="bouclier" titre="Aucun mot posé" phrase="Tout est éteint. Posez un mot depuis un fichier validé." compact />
      ) : (
        <ul className="flex flex-col gap-2" aria-label="Liste des mots">
          {vue.lignes.map((l) => {
            const e = ETATS_MOT[l.etat];
            return (
              <li key={`${l.mot}|${l.compte}`}>
                <Carte className="flex flex-wrap items-center gap-3" data-mot={l.mot}>
                  <span className="min-w-0 flex-1 text-[15px] font-semibold text-texte">{l.mot}</span>
                  <Pastille ton={e.ton}>{e.libelle}</Pastille>
                  {!l.idWorkflow ? (
                    l.etat === "actif" ? (
                      <Bouton variante="secondaire" chargement={enCours} onClick={() => demarrer(async () => void (await local.pause(l.mot, l.compte)))}>
                        Mettre en pause
                      </Bouton>
                    ) : (
                      l.mot === "GUIDE" && (
                        <Bouton chargement={enCours} onClick={() => demarrer(async () => void (await local.activer(l.compte)))}>
                          Activer
                        </Bouton>
                      )
                    )
                  ) : l.etat === "actif" ? (
                    <Bouton variante="secondaire" chargement={enCours} onClick={() => demarrer(async () => apres(await services.mettreEnPause(l.mot, l.compte)))}>
                      Mettre en pause
                    </Bouton>
                  ) : (
                    <Bouton chargement={enCours} onClick={() => demarrer(async () => apres(await services.reactiver(l.mot, l.compte)))}>
                      Réactiver
                    </Bouton>
                  )}
                </Carte>
              </li>
            );
          })}
        </ul>
      )}

      {kitLinkedin && <KitLinkedin kit={kitLinkedin.kit} file={kitLinkedin.file} />}

      <Carte data-carte="plafonds">
        <h3 className="text-base text-texte">Plafonds</h3>
        <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm text-texte-doux">
            Par heure et par compte (600 au maximum)
            <input inputMode="numeric" className="min-h-11 rounded-xl border border-trait bg-surface-2 px-3 text-texte" value={heure} onChange={(e) => setHeure(e.target.value)} />
          </label>
          <label className="flex flex-col gap-1 text-sm text-texte-doux">
            Par mot et par jour
            <input inputMode="numeric" className="min-h-11 rounded-xl border border-trait bg-surface-2 px-3 text-texte" value={jour} onChange={(e) => setJour(e.target.value)} />
          </label>
        </div>
        <Bouton className="mt-3" variante="secondaire" chargement={enCours} onClick={() => demarrer(async () => { await services.reglerPlafonds({ heureCompte: Number(heure), jourMot: Number(jour) }); notifier.succes("Plafonds enregistrés."); onChange?.(); })}>
          Enregistrer
        </Bouton>
      </Carte>
    </div>
  );
}
