"use client";

import dynamic from "next/dynamic";
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
import type { TableauSuivi } from "./suivi-affichage";
import { ETATS_MOT, etatGlobalMots, phraseRefus } from "./etat-mots";
import { creerGestesMotLocal, PHRASE_VALIDER_GUIDE } from "./gestes-mot-local";

/** Tableau de suivi chargé à la demande : il n'alourdit pas le premier affichage de /mots. */
const TableauSuiviMots = dynamic(() => import("./TableauSuiviMots").then((m) => m.TableauSuiviMots));

/** Ce que l'écran appelle : en production les gestes de `mots-gestes`, dans les tests un faux. */
export interface ServicesMots {
  mettreEnPause(mot: string, compte: string): Promise<Resultat>;
  reactiver(mot: string, compte: string): Promise<Resultat>;
  /** Mot GUIDE LOCAL (sans idWorkflow) : activation et pause dans le registre, jamais d'appel vers Zernio. */
  activerLocal(compte: string): Promise<Resultat>;
  mettreEnPauseLocal(mot: string, compte: string): Promise<Resultat>;
  /** Valide les textes du mot GUIDE : le serveur construit lui-même la saisie, le client n'envoie rien. */
  validerGuide?(): Promise<{ ok: boolean; raison: string }>;
  /** Valide UNE formulation d'un message privé : le client n'envoie qu'un nom de version, le serveur la contrôle contre le dictionnaire. */
  validerFormulation?(version: string): Promise<{ ok: boolean; raison: string }>;
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
const GROUPES_ECRAN: readonly (readonly [string, string])[] = [
  ["m1-lien", "Premier message avec le lien"],
  ["adresse-refusee", "Adresse refusée"],
  ["m1-adresse", "Premier message sans lien (on demande l'adresse e-mail)"],
  ["recu", "Accusé de réception"],
  ["adresse-non-reconnue", "Adresse non reconnue (on la redemande)"],
  ["lien-rappel", "Rappel avec le lien"],
  ["ig-suivre", "Instagram, réponse privée unique"],
  ["ig-pas-encore", "Instagram, la personne ne suit pas encore"],
  ["deja-envoye", "Déjà envoyé"],
  ["pub-commentaire", "Réponse publique au commentaire"],
];
/** Groupes proposés (série 6) : à relire et valider, mais aucun envoi n'est encore branché dessus. */
const GROUPES_PAS_ENCORE_BRANCHES: ReadonlySet<string> = new Set(["deja-envoye", "pub-commentaire"]);
/** Groupes branchés sur Instagram (PR 467), mais tant que le réglage Instagram est éteint rien ne part. */
const GROUPES_INSTAGRAM_ETEINTS: ReadonlySet<string> = new Set(["ig-suivre", "ig-pas-encore", "lien-rappel"]);

/**
 * Écran « Mots » : liste, état, pause / réactivation, plafonds. Peu de texte. Tout est éteint par défaut : tant que
 * l’interrupteur est éteint, les gestes sont des simulations et l’écran le dit.
 */
export function EcranMots({ vue, services, onChange, kitLinkedin, branchement, comptes, suivi, suiviIndisponible }: { suivi?: TableauSuivi | null; suiviIndisponible?: boolean; vue: VueMots; comptes?: readonly string[]; services: ServicesMots; onChange?: () => void; branchement?: EtatBranchement | null; kitLinkedin?: { kit: KitLinkedinProfil | null; file: readonly ElementATraiter[] } }) {
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

  const validerFormulation = async (version: string) => {
    if (!services.validerFormulation || !window.confirm("Valider cette formulation ? Rien n’est envoyé.")) return;
    const r = await services.validerFormulation(version);
    if (r.ok) notifier.succes("Formulation validée.");
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

      {services.validerFormulation && (
        <Carte data-carte="formulations">
          <h3 className="text-base text-texte">Messages privés : formulations</h3>
          <p className="mt-1 text-sm text-texte-doux">Chaque formulation se valide une à une. Une personne reçoit toujours la même ; une formulation non validée ne part jamais.</p>
          {GROUPES_ECRAN.map(([groupe, titre]) => (
            <div key={groupe} className="mt-3" data-groupe={groupe}>
              <h4 className="text-sm font-semibold text-texte">{titre}</h4>
              {GROUPES_PAS_ENCORE_BRANCHES.has(groupe) && <p className="mt-1 text-sm text-texte-doux">Ce groupe n’est pas encore branché : ces formulations sont des propositions, rien n’est envoyé avec.</p>}
              {GROUPES_INSTAGRAM_ETEINTS.has(groupe) && <p className="mt-1 text-sm text-texte-doux">Branché sur Instagram, mais éteint : ces textes partiront seulement quand le réglage Instagram sera allumé.</p>}
              <ul className="mt-2 flex flex-col gap-3">
                {(vue.formulations ?? []).filter((f) => f.groupe === groupe).map((f) => (
                  <li key={f.version} className="flex flex-col gap-2" data-formulation={f.version}>
                    <p className="text-sm text-texte">{f.texte}</p>
                    <div className="flex flex-wrap items-center gap-3">
                      <Pastille ton={f.valide ? "sauge" : "neutre"}>{f.valide ? "Validée" : "Non validée"}</Pastille>
                      <Bouton variante="secondaire" chargement={enCours} onClick={() => demarrer(() => validerFormulation(f.version))}>
                        Valider cette formulation
                      </Bouton>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ))}
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
      {suivi ? <TableauSuiviMots suivi={suivi} /> : suiviIndisponible ? <p role="status" className="text-sm text-texte-doux">Chiffres indisponibles pour l&apos;instant</p> : null}
    </div>
  );
}
