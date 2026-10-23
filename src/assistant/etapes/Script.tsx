"use client";

import { motion } from "motion/react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ameliorerBlocAction, noterScriptAction } from "@/app/(studio)/nouvelle/[format]/actions";
import { EditeurBlocs } from "@/components/ecrire/EditeurBlocs";
import { ResumeTexte } from "@/components/ecrire/ResumeTexte";
import { PastillesMotsARisque } from "@/components/prononciations/PastillesMotsARisque";
import { Bouton } from "@/components/ui/Bouton";
import { Champ } from "@/components/ui/Champ";
import { EtatVide } from "@/components/ui/EtatVide";
import { Icone } from "@/components/ui/Icone";
import { Onglets } from "@/components/ui/Onglets";
import { SelecteurPastilles } from "@/components/ui/SelecteurPastilles";
import { notifier } from "@/components/ui/Toast";
import { alerteAdresse } from "@/domaine/adresse";
import { texteScript } from "@/domaine/derivations";
import { scriptFacultatif } from "@/domaine/facecam-script";
import { LIBELLE_COPIER, LIBELLE_LECTURE, LIBELLE_TELECHARGER, lienLecture, nomFichierTxt, texteTeleprompteur } from "@/domaine/teleprompteur";
import { lienEcrireTexte, retourAssistant } from "@/domaine/retour-video";
import { estScriptColle } from "@/domaine/relecture-script";
import { entreesAvecOrigine } from "@/domaine/voyant-rouge";
import type { Adresse } from "@/domaine/types";
import { debitLecture, estimerDureeTexte, libelleDuree, obtenirFormat } from "@/formats";
import { cn } from "@/lib/cn";
import { dateCourte } from "@/lib/dates";
import type { ScriptExpress } from "@/services/express";
import { sujetDepuisScript } from "../express/logique";
import { ZoneColler } from "../express/ZoneColler";
import type { ProprietesEtape } from "./types";

export type OngletScript = "mes-scripts" | "coller" | "idee";

/**
 * Étape « script » : trois façons d'avoir un texte (B.0 §16) — « Mes scripts » (ceux du format, triés par note puis
 * par date), « Coller » (un texte à vous, découpé sans être réécrit, ou un fichier importé) et « Une idée » : le VRAI
 * générateur l'écrit (écran Sujet, idée remplie), puis « Utiliser dans ma vidéo » revient ici avec le texte (correcteur 3,
 * B1 : plus de textes types simulés). Pastille Vous / Tu en haut (B.0 §15). Ensuite : éditeur par blocs, durée en
 * direct, les mots que la voix risque de mal dire (lot A1) ; la note et « Améliorer » (simulés) seulement en essai, sans
 * Claude relié (B10).
 * Parcours classique : raccourci « Fabriquer avec les réglages habituels » (AV2.4-5). Compact (écran « Votre vidéo ») : sans.
 */
export function EtapeScript({ formatId, brouillon, modifier, allerA, contexte, compacte, ongletDepart }: ProprietesEtape & { ongletDepart?: OngletScript }) {
  const format = obtenirFormat(formatId);
  const recette = format.recetteScript;
  const scripts = contexte.express?.scripts ?? [];
  const aTexte = brouillon.blocs.length > 0;
  // « Une idée » sur l'écran « Votre vidéo » ouvre CET onglet (E2E-1 n° 3), sujet déjà rempli (n° 4).
  const ongletInitial: OngletScript = ongletDepart ?? (!compacte && brouillon.sujet.trim() ? "idee" : scripts.length ? "mes-scripts" : "coller");
  const [onglet, setOnglet] = useState<OngletScript>(ongletInitial);
  // Les onglets de choix s'affichent tant qu'il n'y a pas de texte, ou quand Will veut changer de texte.
  const [choix, setChoix] = useState(!aTexte && !brouillon.versions);
  const [idee, setIdee] = useState(brouillon.sujet);
  const [depart, setDepart] = useState(false);
  const router = useRouter();
  const dejaNote = useRef(brouillon.notes ? JSON.stringify(brouillon.blocs) : "");
  const ecritureReelle = !!contexte.ecritureReelle;

  /** B1 : l'idée part au vrai générateur ; le brouillon est gardé (s'il y a déjà une saisie) pour y revenir avec le texte. */
  async function ecrireAvecGenerateur(texteIdee: string) {
    if (texteIdee.trim().length < 3) return notifier.info("Décrivez votre idée en quelques mots");
    setDepart(true);
    const videoId = brouillon.videoId ?? (contexte.aSaisi?.() ? await contexte.enregistrer() : null) ?? undefined;
    router.push(lienEcrireTexte({ idee: texteIdee, retour: retourAssistant(formatId, videoId) }));
  }

  // Notes recalculées après une retouche (attente courte pour ne pas noter à chaque lettre). En essai seulement (B10).
  const cleTexte = JSON.stringify(brouillon.blocs);
  useEffect(() => {
    if (ecritureReelle || !brouillon.blocs.length || cleTexte === dejaNote.current) return;
    const t = setTimeout(async () => {
      const r = await noterScriptAction(formatId, brouillon.blocs, brouillon.dureeCibleSec, brouillon.adresse);
      if (r.ok) {
        dejaNote.current = cleTexte;
        modifier({ notes: r.donnees });
      }
    }, 900);
    return () => clearTimeout(t);
  }, [cleTexte, brouillon.blocs, brouillon.dureeCibleSec, brouillon.adresse, formatId, modifier, ecritureReelle]);

  const texte = texteScript(brouillon.blocs);
  // TEST-UI-REEL U2 : la durée suit la voix qui lira (voix HeyGen : son débit réel), comme le prix.
  const lecteur = brouillon.distribution[0];
  const voixLecture = contexte.personnages.find((p) => p.personnage.id === lecteur?.personnageId)?.voix.find((v) => v.id === lecteur?.voixId);
  const duree = estimerDureeTexte(format, texte, debitLecture(format, voixLecture));
  // Texte collé ou importé par Will : pris à l'identique, aucun avis tu/vous (décision du 18/10).
  const alerte = aTexte && !estScriptColle(brouillon.blocs) ? alerteAdresse(texte, brouillon.adresse) : null;

  // Export téléprompteur (face caméra) : le texte dit seul, copié, téléchargé en .txt, ou lu en plein écran sur l'iPad.
  const exportable = scriptFacultatif(formatId) && aTexte;
  const textePrompteur = exportable ? texteTeleprompteur(brouillon.blocs) : "";
  const titrePrompteur = brouillon.titre || brouillon.sujet;
  async function copierTexte() {
    try {
      await navigator.clipboard.writeText(textePrompteur);
      notifier.succes("Texte copié");
    } catch {
      notifier.erreur("Copie impossible : utilisez « Télécharger en .txt »");
    }
  }
  function telechargerTexte() {
    const url = URL.createObjectURL(new Blob([textePrompteur], { type: "text/plain;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = nomFichierTxt(titrePrompteur);
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function choisirScript(s: ScriptExpress) {
    dejaNote.current = "";
    modifier({ entrees: entreesAvecOrigine(brouillon.entrees), blocs: s.blocs, scriptId: s.id, versions: undefined, versionChoisie: undefined, notes: undefined, adresse: s.adresse ?? brouillon.adresse, sujet: brouillon.sujet || s.sujet });
    setChoix(false);
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <SelecteurPastilles<Adresse>
          libelle="S'adresser au spectateur"
          libelleMasque
          options={[
            { valeur: "vous", libelle: "Vous" },
            { valeur: "tu", libelle: "Tu" },
          ]}
          valeur={brouillon.adresse}
          onChange={(a) => modifier({ adresse: a })}
        />
        {aTexte && (
          <span className="ml-auto flex items-center gap-1.5 text-sm font-semibold tabular-nums text-texte-doux">
            <Icone nom="horloge" size={14} className="text-orange-vif" />≈ {libelleDuree(duree)}
          </span>
        )}
      </div>
      {alerte && (
        <p className="flex items-center gap-2 rounded-xl bg-ambre-doux px-3 py-2 text-sm text-ambre">
          <Icone nom="attention" size={15} className="shrink-0" />
          {alerte}
        </p>
      )}

      {choix ? (
        <Onglets
          libelle="D'où vient le texte"
          valeur={onglet}
          onChange={(v) => setOnglet(v as OngletScript)}
          onglets={[
            {
              valeur: "mes-scripts",
              libelle: "Mes scripts",
              icone: "document",
              compteur: scripts.length || undefined,
              contenu: <ListeMesScripts scripts={scripts} onChoisir={choisirScript} />,
            },
            {
              valeur: "coller",
              libelle: "Coller",
              icone: "copier",
              contenu: (
                <ZoneColler
                  formatId={formatId}
                  onBlocs={(blocs) => {
                    dejaNote.current = "";
                    modifier({ entrees: entreesAvecOrigine(brouillon.entrees), blocs, scriptId: undefined, versions: undefined, versionChoisie: undefined, notes: undefined, sujet: brouillon.sujet || sujetDepuisScript(blocs) });
                    setChoix(false);
                  }}
                />
              ),
            },
            {
              valeur: "idee",
              libelle: "Une idée",
              icone: "idee",
              contenu: (
                <form
                  className="space-y-3"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void ecrireAvecGenerateur(idee);
                  }}
                >
                  <Champ libelle="Votre idée" libelleMasque placeholder="Relancer automatiquement les devis qui dorment" value={idee} onChange={(e) => setIdee(e.target.value)} />
                  <Bouton type="submit" icone="etincelles" pleineLargeur chargement={depart} disabled={idee.trim().length < 3}>
                    Écrire le texte
                  </Bouton>
                  <p className="text-sm text-texte-faible">Le texte s&apos;écrit dans « Écrire », avec son prix. Ensuite, « Utiliser dans ma vidéo » vous ramène ici.</p>
                </form>
              ),
            },
          ]}
        />
      ) : (
        <>
          {aTexte && <ResumeTexte dureeSec={duree} cibleSec={brouillon.dureeCibleSec} notes={ecritureReelle ? undefined : brouillon.notes} criteres={recette.criteres} />}

          {/* Prononciations (lot A1, n° 2) : les mots que la voix risque de mal dire, à écouter et ajouter en un toucher. */}
          {aTexte && <PastillesMotsARisque texte={texte} />}

          <EditeurBlocs
            formatId={formatId}
            blocs={brouillon.blocs}
            notes={ecritureReelle ? undefined : brouillon.notes}
            onChange={(blocs) => modifier({ blocs, versionChoisie: undefined })}
            ameliorer={ecritureReelle ? undefined : async (bloc, consigne) => {
              const r = await ameliorerBlocAction(formatId, bloc, consigne, brouillon.adresse);
              if (!r.ok) {
                notifier.erreur(r.message);
                return null;
              }
              notifier.essai("Retouche simulée");
              return r.donnees;
            }}
          />

          {exportable && (
            <div className="flex flex-wrap gap-2" role="group" aria-label="Téléprompteur">
              <Bouton variante="secondaire" icone="copier" onClick={() => void copierTexte()}>
                {LIBELLE_COPIER}
              </Bouton>
              <Bouton variante="secondaire" icone="telecharger" onClick={telechargerTexte}>
                {LIBELLE_TELECHARGER}
              </Bouton>
              <a
                href={lienLecture(textePrompteur, titrePrompteur)}
                target="_blank"
                rel="noopener"
                className="inline-flex min-h-11 items-center gap-2 rounded-full border border-trait px-4 text-sm font-semibold text-texte"
              >
                {LIBELLE_LECTURE}
              </a>
            </div>
          )}

          <Bouton variante="fantome" icone="actualiser" onClick={() => setChoix(true)} className="-ml-2">
            Changer de texte
          </Bouton>
        </>
      )}

      {!compacte && aTexte && !choix && (
        <motion.button
          type="button"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          onClick={() => allerA("apercu")}
          className="group relative isolate flex min-h-16 w-full items-center gap-3 overflow-hidden rounded-carte border border-orange/40 bg-surface-1 p-3 pl-4 text-left transition-colors hover:border-orange"
        >
          <span aria-hidden className="absolute inset-0 -z-10 lueur opacity-70" />
          <span className="grid size-11 shrink-0 place-items-center rounded-full bg-orange-doux text-orange-vif transition-transform duration-300 group-hover:scale-110">
            <Icone nom="eclair" size={20} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[15px] font-semibold text-texte">Fabriquer avec les réglages habituels</span>
            <span className="block truncate text-sm text-texte-faible">Droit à l&apos;aperçu</span>
          </span>
          <Icone nom="fleche-droite" size={18} className="shrink-0 text-orange-vif transition-transform group-hover:translate-x-0.5" />
        </motion.button>
      )}
    </div>
  );
}

/** « Référence » ou « Copie du 3 oct. » : ce qui sépare deux scripts au même sujet. */
export function distinctionScript(s: Pick<ScriptExpress, "reference" | "modifieLe">): string {
  return s.reference ? "Référence" : `Copie du ${dateCourte(s.modifieLe)}`;
}

/** « Mes scripts » : ceux du format, la note d'abord. Un toucher le choisit. */
function ListeMesScripts({ scripts, onChoisir }: { scripts: ScriptExpress[]; onChoisir: (s: ScriptExpress) => void }) {
  if (!scripts.length) return <EtatVide compact icone="document" titre="Aucun script pour ce format" phrase="Collez un texte, ou partez d'une idée." />;
  // Deux scripts au même sujet (la référence et sa copie) : on les distingue (E2E-1 n° 15).
  const parSujet = new Map<string, number>();
  for (const s of scripts) parSujet.set(s.sujet, (parSujet.get(s.sujet) ?? 0) + 1);
  return (
    <ul className="space-y-2">
      {scripts.map((s) => (
        <li key={s.id}>
          <button
            type="button"
            onClick={() => onChoisir(s)}
            className="flex min-h-16 w-full items-start gap-3 rounded-carte border border-trait bg-surface-1 p-3 text-left transition-colors hover:border-trait-fort"
          >
            <span
              className={cn(
                "grid size-11 shrink-0 place-items-center rounded-xl font-titre text-base tabular-nums",
                s.note === undefined ? "bg-surface-2 text-texte-faible" : s.note >= 70 ? "bg-sauge-doux text-sauge" : "bg-ambre-doux text-ambre",
              )}
            >
              {s.note ?? "—"}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[15px] font-semibold text-texte">{s.sujet}</span>
              {(parSujet.get(s.sujet) ?? 0) > 1 && <span className="block text-xs font-semibold text-orange-vif">{distinctionScript(s)}</span>}
              <span className="line-clamp-2 text-sm text-texte-faible">{s.apercu}</span>
            </span>
            <span className="shrink-0 pt-0.5 text-xs font-semibold tabular-nums text-texte-doux">≈ {libelleDuree(s.dureeEstimeeSec)}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}
