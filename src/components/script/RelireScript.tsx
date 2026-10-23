"use client";

/**
 * RELIRE LE SCRIPT AVANT LA VIDÉO (brique 1 sur 8 : l'écran COMMUN, branché par chaque format via son adaptateur, voir
 * `domaine/relecture-script`). Une carte par phrase : la toucher l'ouvre pour la modifier (une ligne verrouillée ou un
 * écrit tiré d'un fait ne se modifie pas). Mode « Texte libre » (formats en blocs) : toutes les phrases ouvertes d'un
 * coup. Les contrôles se relancent ~900 ms après la frappe (action serveur gratuite du format), la durée suit le texte.
 * Le bouton collé en bas passe par la confirmation du prix (`confirmerPrix`), puis appelle `lancer`.
 * Même logique que `ScriptEcrans` (image → vidéo) et `ValidationScript` (cas concret) : seules les différences partent.
 * Options FACULTATIVES d'un format (tableau animé) : le libellé du bouton, la raison d'un lancement pas encore possible,
 * l'enregistrement des modifications avant de lancer, le suivi du texte relu. Sans elles, l'écran ne change pas.
 * Option `observation` (socle qualité commun, `domaine/qualite-script`) : un encadré repliable de pastilles « info »,
 * calculé ici sans aucun appel ; il ne compte jamais parmi les blocages et ne change aucun contrôle du format.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { BarreActionCollee } from "@/components/ui/BarreActionCollee";
import { Bouton, BoutonIcone } from "@/components/ui/Bouton";
import { Champ } from "@/components/ui/Champ";
import { avecConfirmationPrix, confirmerPrix } from "@/components/ui/ConfirmationPrix";
import { Icone, type NomIcone } from "@/components/ui/Icone";
import { Pastille } from "@/components/ui/Pastille";
import { ZoneTexte } from "@/components/ui/ZoneTexte";
import type { NiveauControle } from "@/domaine/controles-script/types";
import type { Tonalite } from "@/domaine/libelles";
import { appliquerSaisie, dureeEstimee, scriptReluDe, type AdaptateurFormat, type LigneScript, type PastilleControle, type ResultatLancement, type ScriptRelu } from "@/domaine/relecture-script";
import { cn } from "@/lib/cn";
import { formaterMontant } from "@/lib/montants";

/** Délai entre la dernière frappe et le contrôle (ms). */
export const DELAI_CONTROLE_MS = 900;

const TON: Record<NiveauControle, Tonalite> = { bloquant: "brique", alerte: "ambre", correction: "neutre", info: "neutre" };
const ORDRE: Record<NiveauControle, number> = { bloquant: 0, alerte: 1, correction: 2, info: 3 };

/** « *15* MINUTES » : le mot entre deux * en orange. */
function Ecrit({ t }: { t: string }) {
  return (
    <span className="font-titre uppercase tracking-wide">
      {t
        .split(/(\*[^*]+\*)/)
        .filter(Boolean)
        .map((m, i) => (m.length > 2 && m.startsWith("*") && m.endsWith("*") ? <span key={i} className="text-orange-vif">{m.slice(1, -1)}</span> : <span key={i}>{m}</span>))}
    </span>
  );
}

function Pastilles({ liste }: { liste: PastilleControle[] }) {
  if (!liste.length) return null;
  return (
    <ul className="mt-2 flex flex-wrap gap-1.5">
      {[...liste]
        .sort((a, b) => ORDRE[a.niveau] - ORDRE[b.niveau])
        .map((p, i) => (
          <li key={`${p.code ?? ""}-${i}`}>
            <Pastille ton={TON[p.niveau]} icone={p.niveau === "bloquant" ? "alerte" : p.niveau === "alerte" ? "attention" : "info"} className="whitespace-normal text-left">
              {p.texte}
            </Pastille>
          </li>
        ))}
    </ul>
  );
}

/** « 42 s », « 1 min 05 ». */
export function dureeLisible(sec: number): string {
  const s = Math.round(sec);
  return s < 60 ? `${s} s` : `${Math.floor(s / 60)} min ${String(s % 60).padStart(2, "0")}`;
}

/** Résultat d'un enregistrement sans lancement : la phrase de confirmation (ex. « Script enregistré (version 2) ») ou celle du refus. */
export type ResultatEnregistrement = { ok: true; message: string } | { ok: false; message: string };

export interface ProprietesRelireScript {
  /** Le script écrit, en lignes (`adaptateur.versLignes`). */
  lignes: LigneScript[];
  controler: AdaptateurFormat<unknown>["controler"];
  lancer: AdaptateurFormat<unknown>["lancer"];
  /** Prix au plus de la vidéo, en centimes (montré sur le bouton et dans la confirmation) ; absent : rien à payer à ce
   *  geste (ex. valider le script, la voix est payée ensuite) : ni prix, ni confirmation. Tout prix défini, 0 compris, passe
   *  TOUJOURS par la confirmation, sauf 0 avec `prixDejaPaye`. */
  prixCentimes?: number;
  /** Le prix 0 est déjà payé (ex. voix reprise du tableau) : accord 0, sans confirmation. Sans effet sur un prix non nul. */
  prixDejaPaye?: boolean;
  /** Libellé du bouton principal : une phrase entière (le prix compris), ou selon le nombre de phrases modifiées (le
   *  prix s'y ajoute) ; défaut : « Lancer la vidéo (≈ prix) ». */
  libelleLancer?: string | ((modifiees: number) => string);
  /** Débit du format (mots/s) ; sinon 2,8. */
  debit?: number;
  /** Format en blocs : propose le mode « Texte libre ». */
  texteLibre?: boolean;
  /** Après un lancement réussi (rafraîchir la page, suivre la fabrication…). */
  apresLancement?: () => void;
  /** Icône du bouton principal ; défaut : « film ». */
  iconeLancer?: NomIcone;
  /** Lancement pas encore possible : le bouton est inactif et cette phrase dit pourquoi. */
  bloque?: string | null;
  /** Le format enregistre les modifications avant de lancer : tant qu'il y en a, le bouton les enregistre (gratuit). */
  enregistrer?: (script: ScriptRelu) => Promise<ResultatLancement>;
  /** Geste GRATUIT secondaire « Enregistrer sans lancer » : garde les phrases modifiées sans lancer la vidéo (pas de confirmation de prix, `lancer` n'est pas appelé). Absent : pas de bouton. */
  enregistrerSansLancer?: (script: ScriptRelu) => Promise<ResultatEnregistrement>;
  /** Lignes déjà retouchées (relecture rouverte) ; absent : le script écrit. Les différences restent « modifiées ». */
  saisie?: LigneScript[];
  /** À chaque changement de la saisie (pour la garder quand l'écran se ferme, ou dans le formulaire du format). */
  surChangement?: (script: ScriptRelu) => void;
  /** Geste GRATUIT à la place de « Lancer la vidéo » (ex. « Enregistrer ») : pas de confirmation du prix, `lancer` reçoit `true`. */
  action?: { libelle: string; icone?: NomIcone };
  /** Socle qualité en OBSERVATION (fonction pure, gratuite) : la 1re pastille sert de titre, toutes s'affichent en « info ». */
  observation?: (lignes: LigneScript[]) => PastilleControle[];
}

export function RelireScript({ lignes: depart, controler, lancer, prixCentimes, prixDejaPaye, libelleLancer, debit, texteLibre, apresLancement, iconeLancer, bloque, enregistrer, saisie, surChangement, action, observation, enregistrerSansLancer }: ProprietesRelireScript) {
  const [lignes, setLignes] = useState<LigneScript[]>(saisie ?? depart);
  const [ouverte, setOuverte] = useState<string | null>(null);
  const [libre, setLibre] = useState(false);
  const [controle, setControle] = useState<{ empreinte: string; pastilles: PastilleControle[] } | null>(null);
  const [occupe, setOccupe] = useState(false);
  const [phrase, setPhrase] = useState<string | null>(null);
  const [gardeSansLancer, setGardeSansLancer] = useState<{ empreinte: string; message: string } | null>(null);
  const premier = useRef(true);
  const demande = useRef(0);

  const script = useMemo(() => scriptReluDe(depart, lignes), [depart, lignes]);
  useEffect(() => surChangement?.(script), [script, surChangement]);
  const modifiees = new Set(script.modifications.map((m) => m.id));
  const duree = dureeEstimee(lignes, debit);
  const aJour = controle?.empreinte === script.empreinte;
  const pastilles = controle?.pastilles ?? [];
  const bloquants = pastilles.filter((p) => p.niveau === "bloquant").length;
  const prix = prixCentimes === undefined ? null : formaterMontant({ centimes: prixCentimes, devise: "EUR" }, { court: true });
  const libelle = typeof libelleLancer === "string" ? libelleLancer : `${libelleLancer?.(modifiees.size) ?? "Lancer la vidéo"}${prix ? ` (≈ ${prix})` : ""}`;
  const aEnregistrer = !!enregistrer && modifiees.size > 0;
  const observees = useMemo(() => {
    if (!observation) return [];
    try {
      return observation(lignes).map((p): PastilleControle => ({ ...p, niveau: "info" }));
    } catch {
      return [];
    }
  }, [observation, lignes]);

  // Contrôles en direct : ~900 ms après la dernière frappe (tout de suite à l'ouverture). Une réponse périmée est ignorée.
  useEffect(() => {
    const delai = premier.current ? 0 : DELAI_CONTROLE_MS;
    premier.current = false;
    const n = ++demande.current;
    const minuterie = setTimeout(() => {
      controler(script)
        .then((p) => n === demande.current && setControle({ empreinte: script.empreinte, pastilles: p }))
        .catch(() => n === demande.current && setControle({ empreinte: script.empreinte, pastilles: [{ niveau: "alerte", texte: "Vérification indisponible. Elle sera refaite au lancement." }] }));
    }, delai);
    return () => clearTimeout(minuterie);
  }, [script, controler]);

  const changer = (id: string, saisie: Parameters<typeof appliquerSaisie>[2]) => setLignes((v) => appliquerSaisie(v, id, saisie));
  const retablir = (id: string) => setLignes((v) => v.map((l) => (l.id === id ? (depart.find((d) => d.id === id) ?? l) : l)));

  async function lancerVideo() {
    if (occupe || bloquants || bloque) return;
    setOccupe(true);
    setPhrase(null);
    try {
      const fige = script;
      if (prixCentimes === undefined) {
        const r = await lancer(fige, true);
        if (!r.ok) return setPhrase(r.message);
        return apresLancement?.();
      }
      // Geste gratuit (`action`) : accord `true`. Seul un prix de 0 déclaré déjà payé (voix reprise du tableau) se passe de
      // confirmation ; tout autre prix se confirme.
      const accord = action ? true : prixDejaPaye && prixCentimes === 0 ? 0 : await confirmerPrix({ message: fige.modifications.length ? "Avec vos modifications." : "Avec ce script.", montant: prixCentimes });
      if (accord === null) return setPhrase("Rien n'a été payé.");
      const r = await avecConfirmationPrix(await lancer(fige, accord), (a) => lancer(fige, a));
      if (!r.ok) return setPhrase(r.message);
      apresLancement?.();
    } catch {
      setPhrase("Le lancement n'a pas abouti. Rien n'a été payé.");
    } finally {
      setOccupe(false);
    }
  }

  async function enregistrerModifications() {
    if (occupe || bloquants || !enregistrer) return;
    setOccupe(true);
    setPhrase(null);
    try {
      const r = await enregistrer(script);
      if (!r.ok) setPhrase(r.message);
    } catch {
      setPhrase("L'enregistrement n'a pas abouti. Rien n'a été payé.");
    } finally {
      setOccupe(false);
    }
  }

  async function enregistrerSansLancerLeScript() {
    if (occupe || bloquants || !enregistrerSansLancer) return;
    setOccupe(true);
    setPhrase(null);
    setGardeSansLancer(null);
    try {
      const fige = script;
      const r = await enregistrerSansLancer(fige);
      if (r.ok) setGardeSansLancer({ empreinte: fige.empreinte, message: r.message });
      else setPhrase(r.message);
    } catch {
      setPhrase("L'enregistrement n'a pas abouti. Rien n'a été payé.");
    } finally {
      setOccupe(false);
    }
  }

  return (
    <section aria-label="Relire le script" className="mx-auto max-w-2xl">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Pastille taille="md" icone="horloge">
          ≈ {dureeLisible(duree)}
        </Pastille>
        {modifiees.size > 0 && (
          <Pastille taille="md" ton="orange" icone="ecrire">
            {modifiees.size} modifiée{modifiees.size > 1 ? "s" : ""}
          </Pastille>
        )}
        {!controle || !aJour ? (
          <Pastille taille="md" point>
            Vérification
          </Pastille>
        ) : bloquants ? (
          <Pastille taille="md" ton="brique" icone="alerte">
            {bloquants} à corriger
          </Pastille>
        ) : (
          <Pastille taille="md" ton="sauge" icone="coche">
            Prêt
          </Pastille>
        )}
        {texteLibre && (
          <div role="group" aria-label="Affichage" className="ml-auto flex rounded-full border border-trait bg-surface-1 p-0.5">
            {[
              { v: false, t: "Phrases" },
              { v: true, t: "Texte libre" },
            ].map((o) => (
              <button
                key={o.t}
                type="button"
                aria-pressed={libre === o.v}
                onClick={() => setLibre(o.v)}
                className={cn("min-h-9 rounded-full px-3 text-xs font-semibold", libre === o.v ? "bg-surface-3 text-texte" : "text-texte-doux")}
              >
                {o.t}
              </button>
            ))}
          </div>
        )}
      </div>

      <Pastilles liste={pastilles.filter((p) => !p.ligneId)} />

      {observees.length > 0 && (
        <details aria-label="Socle qualité (observation)" className="mt-2 rounded-xl border border-trait bg-surface-1 px-3 py-2 text-sm">
          <summary className="cursor-pointer text-texte-doux">{observees[0].texte}</summary>
          <Pastilles liste={observees.slice(1)} />
        </details>
      )}

      <ol className="mt-3 space-y-2">
        {lignes.map((l, i) => {
          const titreGroupe = l.groupe && l.groupe !== lignes[i - 1]?.groupe ? l.groupe : null;
          const enEdition = !l.verrouille && (libre || ouverte === l.id);
          const modifiee = modifiees.has(l.id);
          const siennes = pastilles.filter((p) => p.ligneId === l.id);
          return (
            <li key={l.id}>
              {titreGroupe && <p className="mb-1.5 mt-4 px-1 text-[11px] font-bold uppercase tracking-wider text-texte-faible first:mt-0">{titreGroupe}</p>}
              <div
                className={cn(
                  "rounded-carte border bg-surface-1 transition-colors",
                  enEdition && !libre ? "border-orange" : modifiee ? "border-orange/50" : siennes.some((p) => p.niveau === "bloquant") ? "border-brique/60" : "border-trait",
                )}
              >
                {enEdition ? (
                  <div className="space-y-2 p-3">
                    <ZoneTexte libelle={`Phrase ${i + 1}`} libelleMasque value={l.dit} rows={2} autoFocus={!libre} onChange={(e) => changer(l.id, { dit: e.target.value })} />
                    {(l.ecrits ?? []).map((e, k) => (
                      <Champ
                        key={k}
                        libelle={`À l'écran ${k + 1}`}
                        value={e.texte}
                        disabled={!e.modifiable}
                        icone={e.modifiable ? "texte" : "cadenas"}
                        aide={!e.modifiable ? "Tiré d'un fait." : undefined}
                        onChange={(ev) => changer(l.id, { ecrit: { index: k, texte: ev.target.value } })}
                      />
                    ))}
                    {!libre && (
                      <div className="flex justify-end gap-2">
                        {modifiee && (
                          <Bouton variante="fantome" icone="repeter" onClick={() => retablir(l.id)}>
                            Rétablir
                          </Bouton>
                        )}
                        <Bouton variante="secondaire" icone="coche" onClick={() => setOuverte(null)}>
                          OK
                        </Bouton>
                      </div>
                    )}
                    <Pastilles liste={siennes} />
                  </div>
                ) : (
                  <button
                    type="button"
                    disabled={l.verrouille}
                    aria-label={l.verrouille ? `Phrase ${i + 1}, non modifiable` : `Modifier la phrase ${i + 1}`}
                    onClick={() => setOuverte(l.id)}
                    className="flex w-full items-start gap-3 p-3 text-left disabled:cursor-default"
                  >
                    <span className="mt-0.5 w-5 shrink-0 text-right text-xs tabular-nums text-texte-faible">{i + 1}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[15px] leading-snug text-texte">{l.dit}</span>
                      {!!l.ecrits?.length && (
                        <span className="mt-1 block text-sm text-texte-doux">
                          <Ecrit t={l.ecrits.map((e) => e.texte).join(" · ")} />
                        </span>
                      )}
                      <Pastilles liste={siennes} />
                    </span>
                    <Icone nom={l.verrouille ? "cadenas" : "ecrire"} size={16} className={cn("mt-0.5 shrink-0", modifiee ? "text-orange-vif" : "text-texte-faible")} />
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ol>

      {phrase && (
        <p role="alert" className="mt-3 text-sm text-brique">
          {phrase}
        </p>
      )}
      {gardeSansLancer?.empreinte === script.empreinte && (
        <p role="status" className="mt-3 text-sm text-sauge">
          {gardeSansLancer.message}
        </p>
      )}
      {bloque && !aEnregistrer && <p className="mt-3 text-sm text-texte-doux">{bloque}</p>}

      <BarreActionCollee
        secondaire={
          modifiees.size > 0 || enregistrerSansLancer ? (
            <>
              {modifiees.size > 0 && <BoutonIcone icone="repeter" libelle="Annuler mes modifications" variante="secondaire" taille="lg" onClick={() => setLignes(depart)} />}
              {enregistrerSansLancer && (
                <Bouton variante="secondaire" taille="lg" icone="coche" className="whitespace-nowrap" chargement={occupe} disabled={modifiees.size === 0 || bloquants > 0} onClick={() => void enregistrerSansLancerLeScript()}>
                  Enregistrer sans lancer
                </Bouton>
              )}
            </>
          ) : undefined
        }
      >
        {aEnregistrer ? (
          <Bouton taille="lg" icone="coche" className="whitespace-nowrap" chargement={occupe} disabled={bloquants > 0} onClick={() => void enregistrerModifications()}>
            Enregistrer mes modifications
          </Bouton>
        ) : (
          <Bouton taille="lg" icone={action?.icone ?? iconeLancer ?? "film"} className="whitespace-nowrap" chargement={occupe} disabled={bloquants > 0 || !!bloque} onClick={() => void lancerVideo()}>
            {action ? action.libelle : libelle}
          </Bouton>
        )}
      </BarreActionCollee>
    </section>
  );
}
