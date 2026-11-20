"use client";

/**
 * T-EXT-24 · ÉCRAN DE VALIDATION du tutoriel d'outil : Williams voit tout (genre de vidéo, fiche de valeur, les deux scripts,
 * parcours, verdict, textes mot pour mot) et choisit AVANT la voix et le rendu. Rien ici ne lance la voix ni le rendu : les
 * gestes appellent les actions de T-EXT-33, qui figent le registre et relancent le travail. Le texte corrigé par Williams
 * fait foi : il n'est ni nettoyé, ni reformulé, ni renvoyé à Claude.
 *
 * Les gestes sont de petites fonctions exportées (`surChoixVersion`, `surCorrection`, `surProposition`, `surRefaire`,
 * `surValidation`) : testées en appel direct avec des actions simulées, le projet n'ayant pas de DOM dans ses tests.
 */
import { useRouter } from "next/navigation";
import { useState } from "react";
import { choisirPropositionAction, choisirVersionAction, corrigerScriptAction, refaireEcrireAction, validerTutorielAction } from "@/app/(studio)/tutoriel-outil/actions";
import { RelireScript } from "@/components/script/RelireScript";
import { Bouton } from "@/components/ui/Bouton";
import { CaseACocher } from "@/components/ui/CaseACocher";
import type { DifferenceLigne, LigneScript, ResultatLancement } from "@/domaine/relecture-script";
import type { DossierValidation, VersionVue } from "@/moteurs/montage-tutoriel-outil/equipe/dossier-validation";

/* ------------------------------------------------------------------ */
/* Gestes                                                              */
/* ------------------------------------------------------------------ */

type Retour = { ok: true; donnees: { statut: "ok" | "refusee"; phrase: string } } | { ok: false; message: string };

export interface ActionsValidation {
  choisirVersion: (videoId: string, version: "A" | "B") => Promise<Retour>;
  corrigerScript: (videoId: string, differences: DifferenceLigne[]) => Promise<Retour>;
  choisirProposition: (videoId: string, id: string, choisi: boolean) => Promise<Retour>;
  refaireEcrire: (videoId: string) => Promise<Retour>;
  valider: (videoId: string, options: { empreinteDevis?: string }) => Promise<Retour>;
}

export const ACTIONS_VALIDATION: ActionsValidation = {
  choisirVersion: choisirVersionAction,
  corrigerScript: corrigerScriptAction,
  choisirProposition: choisirPropositionAction,
  refaireEcrire: refaireEcrireAction,
  valider: validerTutorielAction,
};

/** La phrase à montrer à Williams après un geste. */
export function phraseDuRetour(r: Retour): { reussi: boolean; phrase: string } {
  if (!r.ok) return { reussi: false, phrase: r.message };
  return { reussi: r.donnees.statut === "ok", phrase: r.donnees.phrase };
}

export const surChoixVersion = async (videoId: string, version: "A" | "B", actions: ActionsValidation = ACTIONS_VALIDATION) => phraseDuRetour(await actions.choisirVersion(videoId, version));

/** Seules les différences partent : le texte de Williams est gardé tel quel. */
export const surCorrection = async (videoId: string, differences: DifferenceLigne[], actions: ActionsValidation = ACTIONS_VALIDATION) => phraseDuRetour(await actions.corrigerScript(videoId, differences));

export const surProposition = async (videoId: string, id: string, choisi: boolean, actions: ActionsValidation = ACTIONS_VALIDATION) => phraseDuRetour(await actions.choisirProposition(videoId, id, choisi));

export const surRefaire = async (videoId: string, actions: ActionsValidation = ACTIONS_VALIDATION) => phraseDuRetour(await actions.refaireEcrire(videoId));

/** « Valider et lancer la fabrication » vaut accord du devis : l'empreinte part à l'action, qui écrit l'accord. */
export const surValidation = async (videoId: string, empreinteDevis: string | undefined, actions: ActionsValidation = ACTIONS_VALIDATION) =>
  phraseDuRetour(await actions.valider(videoId, empreinteDevis ? { empreinteDevis } : {}));

/** Pourquoi « Valider » est inactif ; `null` quand on peut valider. */
export function raisonInactif(d: DossierValidation): string | null {
  if (!d.controle.peutValider) return "Le contrôle a trouvé des défauts : corrigez-les d'abord, puis revenez ici.";
  if (!d.choix) return "Choisissez d'abord la version A ou la version B.";
  return null;
}

/* ------------------------------------------------------------------ */
/* Écran                                                               */
/* ------------------------------------------------------------------ */

const carte = "rounded-carte border border-trait bg-surface-1 p-4";

function Section({ titre, children }: { titre: string; children: React.ReactNode }) {
  return (
    <section className={carte}>
      <h2 className="mb-3 text-lg text-texte">{titre}</h2>
      {children}
    </section>
  );
}

function ColonneVersion({ version, choisie, occupe, surChoix }: { version: VersionVue; choisie: boolean; occupe: boolean; surChoix: () => void }) {
  const bloquee = version.blocages.length > 0;
  return (
    <div className={`${carte} flex flex-col gap-3`} aria-label={`Version ${version.id}`}>
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-base text-texte">Version {version.id}</h3>
        <span className="text-sm text-texte-doux">environ {Math.round(version.dureeSec)} s</span>
      </div>
      <p className="text-sm text-texte-doux">{version.origine}</p>
      <ol className="space-y-3">
        {version.phrases.map((p, i) => (
          <li key={i} className="space-y-1">
            <p className="text-[15px] text-texte">{p.texte}</p>
            <p className="text-xs text-texte-doux">
              {[p.temps, p.apport && `Apporte : ${p.apport}`, p.zone && `À l'écran : ${p.zone}`, `${p.dureeSec} s`].filter(Boolean).join(" · ")}
            </p>
          </li>
        ))}
      </ol>
      {version.remarques.length > 0 && (
        <ul className="space-y-1 text-sm text-texte-doux" aria-label={`Remarques sur la version ${version.id}`}>
          {version.remarques.map((r, i) => (
            <li key={i}>{r}</li>
          ))}
        </ul>
      )}
      {bloquee && (
        <ul className="space-y-1 rounded-carte bg-brique-doux p-3 text-sm font-semibold text-brique" role="alert">
          {version.blocages.map((b, i) => (
            <li key={i}>{b}</li>
          ))}
        </ul>
      )}
      <Bouton variante={choisie ? "principal" : "secondaire"} disabled={occupe} onClick={surChoix} sansDecompte>
        {choisie ? `Version ${version.id} choisie` : `Choisir la version ${version.id}`}
      </Bouton>
    </div>
  );
}

export function EcranValidationTutoriel({ videoId, dossier, actions = ACTIONS_VALIDATION }: { videoId: string; dossier: DossierValidation; actions?: ActionsValidation }) {
  const router = useRouter();
  const [occupe, setOccupe] = useState(false);
  const [message, setMessage] = useState<{ reussi: boolean; phrase: string } | null>(null);
  const [correction, setCorrection] = useState(false);
  const [versionChoisie, setVersionChoisie] = useState<"A" | "B" | null>(null);
  const [cochees, setCochees] = useState<Record<string, boolean>>(() => Object.fromEntries(dossier.textes.propositions.map((p) => [p.id, p.choisi])));
  const { entete, valeur, controle, textes } = dossier;

  async function geste(f: () => Promise<{ reussi: boolean; phrase: string }>, apres?: (reussi: boolean) => void) {
    setOccupe(true);
    try {
      const r = await f();
      setMessage(r);
      apres?.(r.reussi);
      if (r.reussi) router.refresh();
    } catch {
      setMessage({ reussi: false, phrase: "Ça n'a pas pu se faire. Réessayez dans un instant." });
    } finally {
      setOccupe(false);
    }
  }

  const raison = raisonInactif(dossier);
  const lignesScript: LigneScript[] = dossier.parcours.map((l) => ({ id: `voix-${l.numero}`, dit: l.phrase }));
  const lancerCorrection = async (script: { modifications: DifferenceLigne[] }): Promise<ResultatLancement> => {
    const r = phraseDuRetour(await actions.corrigerScript(videoId, script.modifications));
    if (r.reussi) router.refresh();
    return r.reussi ? { ok: true } : { ok: false, message: r.phrase };
  };
  const autres = textes.lignes.filter((l) => l.origine !== "Proposition du Studio");

  return (
    <div className="space-y-6">
      <Section titre="Le genre de vidéo">
        <dl className="grid gap-x-6 gap-y-2 text-[15px] sm:grid-cols-2">
          <div>
            <dt className="text-sm text-texte-doux">Ce que montre la vidéo</dt>
            <dd className="text-texte">{entete.cas}</dd>
          </div>
          <div>
            <dt className="text-sm text-texte-doux">Façon de la raconter</dt>
            <dd className="text-texte">{entete.gabarits.join(" puis ")}</dd>
          </div>
          <div>
            <dt className="text-sm text-texte-doux">Fin choisie</dt>
            <dd className="text-texte">{entete.fin}</dd>
          </div>
          <div>
            <dt className="text-sm text-texte-doux">Formats</dt>
            <dd className="text-texte">{entete.formats.join(" · ")}</dd>
          </div>
          <div>
            <dt className="text-sm text-texte-doux">Durée visée</dt>
            <dd className="text-texte">{entete.dureeVisee}</dd>
          </div>
        </dl>
      </Section>

      <Section titre="À qui parle la vidéo">
        <p className="text-[15px] text-texte">
          {valeur.persona.metier} — {valeur.persona.journee}
        </p>
        <p className="mt-1 text-sm text-texte-doux">{valeur.persona.perte}</p>
        <h3 className="mt-4 text-sm text-texte-doux">Avant</h3>
        <ul className="list-disc space-y-1 pl-5 text-[15px] text-texte">
          {valeur.avant.map((a, i) => (
            <li key={i}>{a}</li>
          ))}
        </ul>
        <h3 className="mt-4 text-sm text-texte-doux">Les moments « ça change tout »</h3>
        <ul className="space-y-2 text-[15px] text-texte">
          {valeur.moments.map((m) => (
            <li key={m.id}>
              <span>
                {m.zone} — {m.geste}
              </span>
              {m.evite && <span className="block text-sm text-texte-doux">Évite : {m.evite}</span>}
              {m.permet && <span className="block text-sm text-texte-doux">Permet : {m.permet}</span>}
            </li>
          ))}
        </ul>
        <h3 className="mt-4 text-sm text-texte-doux">Ce que l&apos;entreprise gagne</h3>
        <p className="text-[15px] text-texte">
          {valeur.gain.devient} — {valeur.gain.pourquoi}
        </p>
        <p className="mt-1 text-sm text-texte-doux">Sentiment recherché : {valeur.emotion}</p>
      </Section>

      <Section titre="Les deux versions du script">
        <div className="grid gap-4 md:grid-cols-2">
          {dossier.versions.map((v) => (
            <ColonneVersion key={v.id} version={v} choisie={versionChoisie === v.id} occupe={occupe} surChoix={() => void geste(() => surChoixVersion(videoId, v.id, actions), (r) => r && setVersionChoisie(v.id))} />
          ))}
        </div>
        {dossier.choix && (
          <p className="mt-4 text-sm text-texte-doux">{dossier.choix.source === "corrige" ? "Votre texte corrigé fait foi, mot pour mot." : "Le script choisi est gardé."}</p>
        )}
        <div className="mt-4 flex flex-wrap gap-3">
          <Bouton variante="contour" disabled={occupe || !dossier.choix} onClick={() => setCorrection((c) => !c)} sansDecompte>
            Corriger le texte
          </Bouton>
          <Bouton variante="discret" disabled={occupe} onClick={() => void geste(() => surRefaire(videoId, actions))} sansDecompte>
            Refaire écrire
          </Bouton>
        </div>
        {correction && dossier.choix && (
          <div className="mt-4">
            <RelireScript lignes={lignesScript} controler={async () => []} lancer={(s) => lancerCorrection(s)} action={{ libelle: "Garder mes corrections" }} apresLancement={() => setCorrection(false)} />
          </div>
        )}
      </Section>

      <Section titre="Le parcours, étape par étape">
        <ol className="space-y-3">
          {dossier.parcours.map((l) => (
            <li key={l.numero} className="flex gap-3">
              {l.miniatureDisponible ? (
                // eslint-disable-next-line @next/next/no-img-element -- adresse signée du stockage, taille inconnue
                <img src={l.miniature} alt={`Étape ${l.numero}`} className="h-16 w-24 shrink-0 rounded-carte border border-trait object-cover" />
              ) : (
                <span className="grid h-16 w-24 shrink-0 place-items-center rounded-carte border border-dashed border-trait px-1 text-center text-xs text-texte-doux">{l.miniature}</span>
              )}
              <div className="min-w-0">
                <p className="text-[15px] text-texte">{l.phrase}</p>
                <p className="text-xs text-texte-doux">
                  {l.zone} · {l.geste}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </Section>

      <Section titre="Ce que dit le contrôle">
        <p className={controle.peutValider ? "text-[15px] text-texte" : "rounded-carte bg-brique-doux p-3 text-[15px] font-semibold text-brique"} role={controle.peutValider ? undefined : "alert"}>
          {controle.resume.split("\n").map((l, i) => (
            <span key={i} className="block">
              {l}
            </span>
          ))}
        </p>
      </Section>

      <Section titre="Tous les textes de la vidéo, mot pour mot">
        <ul className="space-y-2">
          {autres.map((l, i) => (
            <li key={i} className="text-[15px] text-texte">
              <span className="block text-xs text-texte-doux">
                {l.ou} · {l.origine}
              </span>
              {l.texte}
            </li>
          ))}
        </ul>
        {textes.finSansTexte && <p className="mt-3 text-sm text-texte-doux">Le texte exact de la fin n&apos;est pas encore donné : le Studio ne l&apos;invente pas.</p>}
        {textes.propositions.length > 0 && (
          <div className="mt-4">
            <h3 className="mb-1 text-sm text-texte-doux">Propositions du Studio : rien ne sera montré sans votre case cochée</h3>
            {textes.propositions.map((p) => (
              <CaseACocher
                key={p.id}
                libelle={p.texte}
                detail={p.ou}
                coche={cochees[p.id] === true}
                desactive={occupe}
                onChange={(v) => void geste(() => surProposition(videoId, p.id, v, actions), (r) => r && setCochees((c) => ({ ...c, [p.id]: v })))}
              />
            ))}
          </div>
        )}
      </Section>

      {dossier.devis && (
        <Section titre="Ce que la fabrication utilisera">
          <ul className="space-y-1 text-[15px] text-texte">
            {dossier.devis.phrases.map((p, i) => (
              <li key={i}>{p}</li>
            ))}
          </ul>
          <p className="mt-2 text-sm text-texte-doux">Valider la fabrication vaut accord de ces limites.</p>
        </Section>
      )}

      <div className="space-y-2">
        {message && (
          <p role="status" className={message.reussi ? "text-sm text-texte" : "rounded-carte bg-brique-doux px-4 py-3 text-[15px] font-semibold text-brique"}>
            {message.phrase}
          </p>
        )}
        {raison && <p className="text-sm text-texte-doux">{raison}</p>}
        <Bouton variante="principal" taille="lg" pleineLargeur disabled={occupe || raison !== null} onClick={() => void geste(() => surValidation(videoId, dossier.empreinteDevis, actions))}>
          Valider et lancer la fabrication
        </Bouton>
      </div>
    </div>
  );
}
