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
import { creerGestesMotLocal, PHRASE_VALIDER_GUIDE } from "./gestes-mot-local";

/** Ce que l'écran appelle : en production les gestes de `mots-gestes`, dans les tests un faux. */
export interface ServicesMots {
  mettreEnPause(mot: string, compte: string): Promise<Resultat>;
  reactiver(mot: string, compte: string): Promise<Resultat>;
  /** Mot GUIDE LOCAL (sans idWorkflow) : activation et pause dans le registre, jamais d'appel vers Zernio. */
  activerLocal(compte: string): Promise<Resultat>;
  mettreEnPauseLocal(mot: string, compte: string): Promise<Resultat>;
  /** Valide les textes du mot GUIDE : le serveur construit lui-même la saisie, le client n'envoie rien. */
  validerGuide?(): Promise<{ ok: boolean; raison: string }>;
  /** Valide le message « adresse refusée » (texte du dictionnaire, côté serveur) : le client n'envoie rien. */
  validerAdresseRefusee?(): Promise<{ ok: boolean; raison: string }>;
  refermerDisjoncteur(): Promise<{ ok: boolean }>;
  reglerPlafonds(p: { heureCompte?: number; jourMot?: number }): Promise<unknown>;
}

/** Ne garde que les champs réellement modifiés ; un champ vidé ou non numérique devient NaN (refusé côté service, jamais 0 ni défaut). */
export function champsModifies(actuel: { heureCompte: number; jourMot: number }, heure: string, jour: string): { heureCompte?: number; jourMot?: number } {
  const n = (t: string) => (t.trim() === "" ? Number.NaN : Number(t));
  const r: { heureCompte?: number; jourMot?: number } = {};
  if (heure.trim() !== String(actuel.heureCompte)) r.heureCompte = n(heure);
  if (jour.trim() !== String(actuel.jourMot)) r.jourMot = n(jour);
  return r;
}

/**
 * Écran « Mots » : liste, état, pause / réactivation, plafonds. Peu de texte. Tout est éteint par défaut : tant que
 * l’interrupteur est éteint, les gestes sont des simulations et l’écran le dit.
 */
export function EcranMots({ vue, services, onChange, kitLinkedin, branchement, comptes }: { vue: VueMots; comptes?: readonly string[]; services: ServicesMots; onChange?: () => void; branchement?: EtatBranchement | null; kitLinkedin?: { kit: KitLinkedinProfil | null; file: readonly ElementATraiter[] } }) {
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
  const apresLocal = (r: Resultat) => {
    if (r.issue === "refuse") {
      notifier.erreur(phraseRefus(r.raison));
      onChange?.();
    } else apres(r);
  };
  const local = creerGestesMotLocal(services, { confirmer: (phrase) => window.confirm(phrase), apres: apresLocal });
  const comptesSansLigne = (comptes ?? []).filter((c) => !vue.lignes.some((l) => l.mot === "GUIDE" && l.compte === c));
  const validerGuide = async () => {
    if (!services.validerGuide || !window.confirm(PHRASE_VALIDER_GUIDE)) return;
    const r = await services.validerGuide();
    if (r.ok) notifier.succes("Textes du mot GUIDE validés.");
    else notifier.erreur(phraseRefus(r.raison));
    onChange?.();
  };

  const validerAdresseRefusee = async () => {
    if (!services.validerAdresseRefusee || !window.confirm("Valider le message « adresse refusée » (texte officiel du serveur) ? Rien n’est envoyé.")) return;
    const r = await services.validerAdresseRefusee();
    if (r.ok) notifier.succes("Message « adresse refusée » validé.");
    else notifier.erreur(phraseRefus(r.raison));
    onChange?.();
  };

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

      {services.validerAdresseRefusee && (
        <Carte data-carte="adresse-refusee">
          <h3 className="text-base text-texte">Message « adresse refusée »</h3>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <Pastille ton={vue.adresseRefuseeValide ? "sauge" : "neutre"}>{vue.adresseRefuseeValide ? "Texte validé" : "Texte non validé"}</Pastille>
            <Bouton variante="secondaire" chargement={enCours} onClick={() => demarrer(validerAdresseRefusee)}>
              Valider le message « adresse refusée »
            </Bouton>
          </div>
        </Carte>
      )}

      <Carte data-carte="mot-guide">
        <h3 className="text-base text-texte">Mot GUIDE</h3>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <Pastille ton={vue.guideValide ? "sauge" : vue.guidePerime ? "ambre" : "neutre"}>{vue.guideValide ? "Textes validés" : vue.guidePerime ? "Textes à revalider" : "Textes non validés"}</Pastille>
          <Bouton variante="secondaire" chargement={enCours} onClick={() => demarrer(validerGuide)}>
            Valider les textes du mot GUIDE
          </Bouton>
        </div>
        {comptesSansLigne.length > 0 && (
          <ul className="mt-3 flex flex-col gap-2" aria-label="Comptes sans mot GUIDE">
            {comptesSansLigne.map((c) => (
              <li key={c} className="flex flex-wrap items-center gap-3" data-compte={c}>
                <span className="min-w-0 flex-1 text-sm text-texte">{c}</span>
                <Bouton chargement={enCours} onClick={() => demarrer(async () => void (await local.activer(c)))}>
                  Activer le mot GUIDE
                </Bouton>
              </li>
            ))}
          </ul>
        )}
      </Carte>

      {vue.lignes.length === 0 ? (
        <EtatVide icone="bouclier" titre="Aucun mot posé" phrase="Tout est éteint. Posez un mot depuis un fichier validé." compact />
      ) : (
        <ul className="flex flex-col gap-2" aria-label="Liste des mots">
          {vue.lignes.map((l) => {
            const e = ETATS_MOT[l.etat];
            return (
              <li key={`${l.mot}|${l.compte}`}>
                <Carte className="flex flex-wrap items-center gap-3" data-mot={l.mot} data-compte={l.compte}>
                  <span className="min-w-0 flex-1 text-[15px] font-semibold text-texte">
                    {l.mot}
                    <span className="block text-sm font-normal text-texte-doux">{l.compte}</span>
                  </span>
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
        <div className="mt-2 flex flex-wrap items-center gap-2" data-etat-parcours>
          <Pastille ton={vue.parcoursAllume ? "sauge" : "neutre"}>Parcours des messages privés : {vue.parcoursAllume ? "allumé" : "éteint"}</Pastille>
          <Pastille ton={vue.guideValide ? "sauge" : "ambre"}>{vue.guideValide ? "Textes validés" : "Textes non validés"}</Pastille>
          <Pastille ton={vue.oppositionsNonTransmises > 0 ? "ambre" : "neutre"}>{vue.oppositionsNonTransmises > 0 ? `${vue.oppositionsNonTransmises} « stop » pas encore transmis` : "Aucun « stop » pas encore transmis"}</Pastille>
        </div>
        <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm text-texte-doux">
            Par heure et par compte (600 au maximum) : réglage lu par le parcours
            <input inputMode="numeric" className="min-h-11 rounded-xl border border-trait bg-surface-2 px-3 text-texte" value={heure} onChange={(e) => setHeure(e.target.value)} />
          </label>
          <label className="flex flex-col gap-1 text-sm text-texte-doux">
            Par mot et par jour
            <input inputMode="numeric" className="min-h-11 rounded-xl border border-trait bg-surface-2 px-3 text-texte" value={jour} onChange={(e) => setJour(e.target.value)} />
          </label>
        </div>
        <Bouton className="mt-3" variante="secondaire" chargement={enCours} onClick={() => demarrer(async () => { const ch = champsModifies(vue.plafonds, heure, jour); if (Object.keys(ch).length === 0) { notifier.succes("Rien à changer."); return; } try { await services.reglerPlafonds(ch); notifier.succes("Plafonds enregistrés."); } catch (e) { notifier.erreur(e instanceof Error ? e.message : "Plafond refusé."); } onChange?.(); })}>
          Enregistrer
        </Bouton>
      </Carte>
    </div>
  );
}
