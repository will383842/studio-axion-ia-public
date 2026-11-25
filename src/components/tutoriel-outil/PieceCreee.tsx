"use client";

import { useState, useTransition } from "react";
import { Bouton } from "@/components/ui/Bouton";
import { Carte } from "@/components/ui/Carte";
import { Champ } from "@/components/ui/Champ";
import { Section } from "@/components/ui/Section";
import { ZoneDepot } from "@/components/ui/ZoneDepot";
import type { DecisionChiffre } from "@/briques/donnees-video/relecture-chiffres";
import type { DemandeCorrection, IssuePiece, VuePieceCreee } from "@/services/tutoriel-piece-creee";
import { arreterAction, autrePropositionAction, corrigerTexteAction, deposerApercuAction, garderPieceAction } from "@/app/(studio)/tutoriel-outil/maquette/actions";

/** Les gestes de l'écran (injectables pour les tests de présentation ; par défaut, les actions du serveur). */
export interface GestesPiece {
  deposer: (videoId: string, ids: string[]) => Promise<IssuePiece>;
  garder: (videoId: string, empreinte: string, chiffres?: Record<string, DecisionChiffre>) => Promise<IssuePiece>;
  corriger: (videoId: string, demande: DemandeCorrection) => Promise<IssuePiece>;
  autre: (videoId: string) => Promise<IssuePiece>;
  arreter: (videoId: string) => Promise<IssuePiece>;
}

const GESTES_SERVEUR: GestesPiece = { deposer: deposerApercuAction, garder: garderPieceAction, corriger: corrigerTexteAction, autre: autrePropositionAction, arreter: arreterAction };

export const PHRASE_CAS: Record<VuePieceCreee["cas"], string> = {
  "tableau-de-bord": "un tableau de bord à créer",
  automatisation: "une automatisation montrée de bout en bout",
};

const MOT_ETAT = { avant: "avant", maintenant: "maintenant" } as const;

/** « Votre maquette » : l'aperçu, chaque texte mot pour mot, les chiffres d'exemple, puis garder, corriger, en demander une autre ou arrêter. */
export function PieceCreee({ videoId, vue, gestes = GESTES_SERVEUR }: { videoId: string; vue: VuePieceCreee; gestes?: GestesPiece }) {
  const [attente, demarrer] = useTransition();
  const [message, setMessage] = useState<{ ok: boolean; texte: string } | null>(null);
  const [decisions, setDecisions] = useState<Record<string, DecisionChiffre>>({});
  const [corrections, setCorrections] = useState<Record<string, string>>({});
  const [cible, setCible] = useState("");

  const lance = (f: () => Promise<IssuePiece>) =>
    demarrer(async () => {
      const r = await f();
      setMessage({ ok: r.ok, texte: r.message });
    });

  const estFlux = vue.genre === "flux";
  const touchable = (vue.statut === "a-valider" || vue.statut === "a-construire") && !vue.autreEnAttente && !vue.nomsIllisibles;
  // Une proposition « à revoir » ne se garde ni ne se corrige : on en demande une autre, ou on arrête.
  const autrePossible = (touchable || vue.statut === "a-revoir") && !vue.autreEnAttente && !vue.nomsIllisibles && vue.propositionsRestantes === 1;
  const peutGarder = vue.statut === "a-valider" && vue.defauts.length === 0 && !vue.nomsIllisibles;
  const tousLesTextes = vue.textes.flatMap((e) => e.textes.map((t) => ({ ecranId: e.ecranId, titre: e.titre, texte: t })));
  const choisi = tousLesTextes.find((t) => `${t.ecranId}|${t.texte}` === cible);

  return (
    <div className="space-y-6">
      <Carte>
        <p className="text-sm font-semibold text-texte-doux">Votre phrase</p>
        <p className="mt-1 text-lg text-texte">{vue.phrase}</p>
        <p className="mt-3 text-[15px] text-texte-doux">
          Le Studio a compris : {PHRASE_CAS[vue.cas]}. Si ce n&apos;est pas cela, arrêtez et reformulez votre phrase.
        </p>
        {vue.statut === "gardee" && <p className="mt-3 text-[15px] font-semibold text-texte">Vous avez gardé {estFlux ? "cette automatisation" : "cette maquette"}.</p>}
        {vue.message && <p className="mt-3 text-[15px] font-semibold text-texte">{vue.message}</p>}
        {vue.statut === "refusee" && <p className="mt-3 text-[15px] font-semibold text-texte">Vous avez arrêté : rien n&apos;a été fabriqué.</p>}
      </Carte>

      {message && (
        <p role="status" className={message.ok ? "rounded-champ border border-trait bg-surface-1 p-3 text-[15px] text-texte" : "rounded-champ border border-brique bg-brique-doux p-3 text-[15px] text-texte"}>
          {message.texte}
        </p>
      )}

      {estFlux && vue.etapes.length > 0 && (
        <Section id="etapes" titre="Le déroulé" sousTitre="Du déclencheur au résultat, étape par étape : ce que l'automatisation fera.">
          <ol className="space-y-2" aria-label="Étapes de l'automatisation">
            {vue.etapes.map((e) => (
              <li key={e.id} className="rounded-champ border border-trait bg-surface-1 p-3 text-[15px] text-texte">
                <span className="font-semibold">{e.libelle}</span>
                <span className="block text-sm text-texte-doux">
                  {e.acteur ? `${e.acteur} · ` : ""}
                  {e.ecran}
                </span>
              </li>
            ))}
          </ol>
        </Section>
      )}

      {vue.statut !== "a-revoir" && (
      <Section id="apercu" titre="Aperçu" sousTitre={`Chaque écran, avant puis maintenant. Rien n'est filmé ni dit avant que vous gardiez ${estFlux ? "l'automatisation" : "la maquette"}.`}>
        {vue.apercu.length > 0 ? (
          <ul className="grid gap-4 sm:grid-cols-2" aria-label="Images d'aperçu">
            {vue.apercu.map((a) => (
              <li key={`${a.ecranId}-${a.etat}`}>
                {/* eslint-disable-next-line @next/next/no-img-element -- aperçu déposé : adresse de lecture du stockage, taille inconnue */}
                <img src={a.url} alt={`Aperçu : ${a.titre}, ${MOT_ETAT[a.etat]}`} className="w-full rounded-champ border border-trait" />
                <p className="mt-1 text-sm text-texte-doux">
                  {a.titre} · {MOT_ETAT[a.etat]}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-[15px] text-texte-doux">{vue.apercuDuStudio ? "L'image de votre maquette sera filmée après votre accord." : "L'aperçu se prépare."}</p>
        )}
        {vue.statut === "a-construire" && (
          <div className="mt-4">
            <ZoneDepot
              libelle="Déposer l'aperçu"
              detail="Le fichier « apercu-piece.json » et les images fabriquées sur le poste."
              accepte="image/*,.json,application/json"
              onFichiers={() => undefined}
              envoi={{
                typeEntite: "entree",
                entiteId: videoId,
                onEnvoyes: (fichiers) => lance(() => gestes.deposer(videoId, fichiers.map((f) => f.fichierId))),
                onErreur: (texte) => setMessage({ ok: false, texte }),
              }}
            />
          </div>
        )}
      </Section>
      )}

      {vue.defauts.length > 0 && (
        <Section id="defauts" titre="À revoir">
          <ul className="list-disc space-y-1 pl-5 text-[15px] text-texte">
            {vue.defauts.map((d) => (
              <li key={d}>{d}</li>
            ))}
          </ul>
        </Section>
      )}

      {vue.textes.length > 0 && (
      <Section id="textes" titre="Tous les textes" sousTitre={`Mot pour mot, écran par écran : ce que ${estFlux ? "l'automatisation" : "la maquette"} montrera.`}>
        <div className="space-y-4">
          {vue.textes.map((e) => (
            <div key={e.ecranId}>
              <h3 className="text-sm font-semibold text-texte-doux">{e.titre}</h3>
              <ul className="mt-1 space-y-1 text-[15px] text-texte">
                {e.textes.map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        {touchable && !estFlux && tousLesTextes.length > 0 && (
          <div className="mt-6 space-y-3 border-t border-trait pt-4">
            <div>
              <label htmlFor="texte-a-corriger" className="mb-1.5 block text-sm font-semibold text-texte-doux">
                Texte à remplacer
              </label>
              <select id="texte-a-corriger" value={cible} onChange={(e) => setCible(e.target.value)} className="min-h-12 w-full rounded-champ border border-trait bg-surface-1 px-3 text-texte">
                <option value="">Choisissez un texte</option>
                {tousLesTextes.map((t) => (
                  <option key={`${t.ecranId}|${t.texte}`} value={`${t.ecranId}|${t.texte}`}>
                    {t.titre} : {t.texte}
                  </option>
                ))}
              </select>
            </div>
            <Champ libelle="Votre texte" aide="Votre texte est repris tel quel." value={corrections[cible] ?? ""} onChange={(e) => setCorrections({ ...corrections, [cible]: e.target.value })} />
            <Bouton variante="secondaire" disabled={attente || !choisi || !(corrections[cible] ?? "").trim()} onClick={() => choisi && lance(() => gestes.corriger(videoId, { ecranId: choisi.ecranId, avant: choisi.texte, apres: corrections[cible] ?? "" }))}>
              Corriger un texte
            </Bouton>
          </div>
        )}
      </Section>
      )}

      {vue.chiffres.length > 0 && (
        <Section id="chiffres" titre="Chiffres d'exemple" sousTitre="Inventés pour la démonstration : gardez-les, changez-les ou retirez-les.">
          <ul className="space-y-4">
            {vue.chiffres.map((c) => {
              const dec = decisions[c.cle] ?? { type: "valide" };
              return (
                <li key={c.cle} className="flex flex-wrap items-end gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-[15px] font-semibold text-texte">{c.libelle}</p>
                    <p className="text-sm text-texte-doux">
                      {c.valeur} {c.unite}
                    </p>
                  </div>
                  <Champ
                    libelle={`Chiffre pour ${c.libelle}`}
                    libelleMasque
                    type="number"
                    inputMode="decimal"
                    className="w-32"
                    disabled={dec.type === "refuse" || !touchable}
                    value={dec.type === "corrige" ? String(dec.valeur) : String(c.valeur)}
                    onChange={(e) => {
                      const v = Number(e.target.value);
                      setDecisions({ ...decisions, [c.cle]: e.target.value !== "" && Number.isFinite(v) && v !== c.valeur ? { type: "corrige", valeur: v } : { type: "valide" } });
                    }}
                  />
                  <label className="flex min-h-11 items-center gap-2 text-sm text-texte">
                    <input type="checkbox" checked={dec.type === "refuse"} disabled={!touchable} onChange={(e) => setDecisions({ ...decisions, [c.cle]: e.target.checked ? { type: "refuse" } : { type: "valide" } })} />
                    Retirer ce chiffre
                  </label>
                </li>
              );
            })}
          </ul>
        </Section>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <Bouton variante="principal" disabled={attente || !peutGarder} onClick={() => lance(() => gestes.garder(videoId, vue.empreinte, Object.keys(decisions).length ? decisions : undefined))}>
          {estFlux ? "Garder cette automatisation" : "Garder cette maquette"}
        </Bouton>
        <Bouton variante="secondaire" disabled={attente || !autrePossible} onClick={() => lance(() => gestes.autre(videoId))}>
          En proposer une autre
        </Bouton>
        <Bouton variante="danger" disabled={attente || vue.statut === "refusee" || vue.statut === "gardee"} onClick={() => lance(() => gestes.arreter(videoId))}>
          Arrêter
        </Bouton>
      </div>
      {vue.autreEnAttente && <p className="text-sm text-texte-doux">Une autre proposition se prépare : attendez-la.</p>}
      <p className="text-sm text-texte-doux">{vue.propositionsRestantes === 1 ? "Il vous reste 1 autre proposition." : "Vous avez déjà demandé une autre proposition."}</p>
    </div>
  );
}
