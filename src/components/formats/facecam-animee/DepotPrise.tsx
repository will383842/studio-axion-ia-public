"use client";

/**
 * FACE CAMÉRA ANIMÉE · DÉPOSER LES PRISES (Lot I ; essai réel du 17/10). Will dépose UNE OU PLUSIEURS vidéos filmées (sélection multiple,
 * glisser-déposer) : elles partent l'une après l'autre au stockage (envoi par morceaux qui reprend tout seul après une coupure ou un
 * redémarrage du studio), chacune avec sa progression, son aperçu ENTIER et, s'il veut, le texte qu'il a dit (repliable, par prise). Un
 * seul bouton « Animer mes N vidéos » : chaque prise devient une vidéo distincte, mise dans la file de fabrication du studio ; Will peut
 * ensuite quitter la page. Format en essai : la première fois, Will coche l'accord d'essai réel. Aucun prix, aucune musique.
 */
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BoutonImporterTexte } from "@/assistant/express/BoutonImporterTexte";
import { compterMots } from "@/domaine/derivations";
import { deposerFacecamAnimeeLotAction } from "@/app/(studio)/face-camera-animee/actions";
import { Bouton } from "@/components/ui/Bouton";
import { BarreActionCollee } from "@/components/ui/BarreActionCollee";
import { CaseACocher } from "@/components/ui/CaseACocher";
import { Carte } from "@/components/ui/Carte";
import { Icone } from "@/components/ui/Icone";
import { BarreProgression } from "@/components/ui/ProgressionEtapes";
import { ZoneDepot } from "@/components/ui/ZoneDepot";
import { ZoneTexte } from "@/components/ui/ZoneTexte";
import { envoyerFichier, ErreurEnvoi, MESSAGE_ENVOI_RATE, phraseAttente } from "@/lib/envoi-multipart";
import { ErreurLisible } from "@/lib/erreur-lisible";
import { EstimationCout } from "./EstimationCout";
import { notifier } from "@/components/ui/Toast";
import { clicIgnore, phraseAvertissement } from "./sujet-deja-traite";
import { FeuilleScriptsValides } from "./FeuilleScriptsValides";
import { PHRASE_TEXTE_RACCOURCI, texteDitDuScript } from "./scripts-valides";
import type { IssueLotFA, RefusSujetFA } from "@/services/facecam-animee";
import { ACCEPTE_PRISES, consigneDepart, etatPrise, libelleAnimer, phraseOrientation, pretesALancer, prochaineAEnvoyer, trierDepot, tropCourte, type Prise } from "./prises";

/** Destination de l'envoi (même valeur que `CIBLE_DEPOT_FA` du service). */
const CIBLE_DEPOT = { typeEntite: "entree", entiteId: "facecam-animee" };

/** Durée et taille lues par le navigateur (0 si la vidéo ne s'ouvre pas). */
function lireVideo(url: string): Promise<{ dureeSec: number; largeur: number; hauteur: number }> {
  return new Promise((ok) => {
    const v = document.createElement("video");
    v.preload = "metadata";
    v.onloadedmetadata = () => ok({ dureeSec: Number.isFinite(v.duration) ? v.duration : 0, largeur: v.videoWidth || 0, hauteur: v.videoHeight || 0 });
    v.onerror = () => ok({ dureeSec: 0, largeur: 0, hauteur: 0 });
    v.src = url;
  });
}

let compteur = 0;

export function DepotPrise({ accordDejaDonne }: { accordDejaDonne: boolean }) {
  const router = useRouter();
  const [prises, setPrises] = useState<Prise[]>([]);
  const fichiers = useRef(new Map<string, File>());
  const [accord, setAccord] = useState(accordDejaDonne);
  const [refus, setRefus] = useState<string | null>(null);
  const [lancement, setLancement] = useState(false);
  const enCours = useRef<string | null>(null);
  /** « Refaire quand même » en cours (anti double clic). */
  const verrouRefaire = useRef(false);
  const [refaitEnCours, setRefaitEnCours] = useState(false);
  /** Prise pour laquelle la feuille « Reprendre un script validé » est ouverte. */
  const [scriptPour, setScriptPour] = useState<string | null>(null);

  const modifier = useCallback((id: string, champs: Partial<Prise>) => setPrises((l) => l.map((p) => (p.id === id ? { ...p, ...champs } : p))), []);

  // Aperçus libérés quand la page se ferme.
  const urls = useRef(new Set<string>());
  useEffect(() => () => urls.current.forEach((u) => URL.revokeObjectURL(u)), []);

  async function recevoir(liste: File[]) {
    setRefus(null);
    const { gardes, refus: phrase } = trierDepot(liste, prises.length);
    if (phrase) setRefus(phrase);
    const nouvelles: Prise[] = [];
    for (const f of gardes) {
      const id = `prise-${Date.now().toString(36)}-${++compteur}`;
      const url = URL.createObjectURL(f);
      urls.current.add(url);
      fichiers.current.set(id, f);
      const m = await lireVideo(url);
      nouvelles.push({ id, nom: f.name, taille: f.size, url, ...m, etape: "a-envoyer", envoi: 0, texte: "", texteOuvert: false });
    }
    if (nouvelles.length) setPrises((l) => [...l, ...nouvelles]);
  }

  const envoyer = useCallback(
    async (p: Prise) => {
      const f = fichiers.current.get(p.id);
      if (!f) return;
      enCours.current = p.id;
      modifier(p.id, { etape: "envoi", erreur: undefined, attente: undefined, reprenable: undefined });
      try {
        const r = await envoyerFichier(f, CIBLE_DEPOT, {
          onProgression: (envoi) => modifier(p.id, { envoi }),
          onAttente: (a) => modifier(p.id, { attente: a ? phraseAttente(a) : undefined }),
        });
        modifier(p.id, { etape: "prete", fichierId: r.fichierId, envoi: 100, attente: undefined });
      } catch (e) {
        const reprenable = !(e instanceof ErreurEnvoi) || e.reprenable;
        modifier(p.id, { etape: "arretee", attente: undefined, reprenable, erreur: e instanceof ErreurLisible && e.message ? e.message : MESSAGE_ENVOI_RATE });
      } finally {
        enCours.current = null;
      }
    },
    [modifier],
  );

  // File d'envoi : une prise à la fois (chacune envoie déjà ses morceaux en parallèle).
  useEffect(() => {
    if (enCours.current) return;
    const suivante = prochaineAEnvoyer(prises);
    if (suivante) void envoyer(suivante);
  }, [prises, envoyer]);

  function retirer(id: string) {
    setPrises((l) => l.filter((p) => p.id !== id));
    fichiers.current.delete(id);
  }

  async function animer() {
    if (!pretesALancer(prises)) return;
    setLancement(true);
    setRefus(null);
    const r = await deposerFacecamAnimeeLotAction(prises.map((p) => ({ fichierId: p.fichierId as string, dureeSec: p.dureeSec, texte: p.texte, accordEssai: accord })));
    setLancement(false);
    if (!r.ok) return setRefus(r.message);
    suiteDuDepot(r.donnees);
  }

  /** Après un envoi : les vidéos parties quittent l'écran ; les prises refusées ou déjà traitées restent avec leur phrase. */
  function suiteDuDepot(donnees: { issues: IssueLotFA[]; phraseSautees?: string }) {
    const lancees = donnees.issues.filter((i): i is Extract<typeof i, { statut: "lancee" }> => i.statut === "lancee");
    const refusees = new Map<string, { phrase: string; refusSujet?: RefusSujetFA }>();
    for (const i of donnees.issues) {
      if (i.statut === "refusee") refusees.set(i.fichierId, { phrase: i.phrase });
      if (i.statut === "sujet-deja-traite") refusees.set(i.fichierId, { phrase: i.jetonPerime ? "Les vidéos ont changé. Choisissez de nouveau." : i.phrase, refusSujet: i });
    }
    const avert = phraseAvertissement(lancees.flatMap((i) => i.avertissement?.precedents.map((p) => p.titre) ?? []));
    if (!refusees.size) {
      // La page change : l'avertissement (autre type de vidéo) passe par la notification, qui reste affichée après la redirection.
      if (avert) notifier.info("Cette vidéo existe déjà ailleurs", avert);
      router.push(lancees.length === 1 ? `/videos/${lancees[0].videoId}` : "/formats/facecam-animee");
      return;
    }
    // Les prises refusées restent à l'écran avec leur phrase ; celles qui sont parties sont retirées.
    setPrises((l) => l.filter((p) => refusees.has(p.fichierId ?? "")).map((p) => ({ ...p, erreur: refusees.get(p.fichierId ?? "")?.phrase, refusSujet: refusees.get(p.fichierId ?? "")?.refusSujet, reprenable: false })));
    const parties = lancees.length ? `${lancees.length} vidéo${lancees.length > 1 ? "s" : ""} partie${lancees.length > 1 ? "s" : ""} en fabrication ; les autres sont restées ci-dessous.` : null;
    // `phraseSautees` dit déjà combien de vidéos partent : elle remplace la phrase générale quand elle existe.
    setRefus([donnees.phraseSautees ?? parties, avert].filter(Boolean).join(" ") || null);
  }

  /** « Refaire quand même » : cette prise seule, avec le même jeton ; un seul envoi à la fois. */
  async function refaireQuandMeme(p: Prise) {
    if (!p.refusSujet || !p.fichierId || clicIgnore(verrouRefaire.current)) return;
    verrouRefaire.current = true;
    setRefaitEnCours(true);
    try {
      const r = await deposerFacecamAnimeeLotAction([{ fichierId: p.fichierId, dureeSec: p.dureeSec, texte: p.texte, accordEssai: accord, sujet: { choix: "refaire", jeton: p.refusSujet.jeton } }]);
      if (!r.ok) return void setRefus(r.message);
      const i = r.donnees.issues[0];
      if (i?.statut === "lancee") {
        const avert = phraseAvertissement(i.avertissement?.precedents.map((x) => x.titre) ?? []);
        if (prises.length > 1) {
          // D'autres prises restent à l'écran : seule celle-ci part, sans quitter la page.
          setPrises((l) => l.filter((x) => x.id !== p.id));
          setRefus(["1 vidéo partie en fabrication.", avert].filter(Boolean).join(" "));
        } else {
          if (avert) notifier.info("Cette vidéo existe déjà ailleurs", avert);
          router.push(`/videos/${i.videoId}`);
        }
      } else if (i?.statut === "refusee") modifier(p.id, { erreur: i.phrase, refusSujet: undefined });
      else if (i?.statut === "sujet-deja-traite") modifier(p.id, { erreur: i.jetonPerime ? "Les vidéos ont changé. Choisissez de nouveau." : i.phrase, refusSujet: i });
    } finally {
      verrouRefaire.current = false;
      setRefaitEnCours(false);
    }
  }

  function reprendreScript(texte: string, tronque: boolean) {
    if (scriptPour) modifier(scriptPour, { texte, texteOuvert: true, avisTexte: tronque ? PHRASE_TEXTE_RACCOURCI : undefined });
  }

  const n = prises.length;
  const pret = pretesALancer(prises) && accord && !lancement;
  const consigne = consigneDepart(prises);
  // Une estimation par prise ; ne change que si une durée ou le nombre de mots du texte change.
  const aEstimer = useMemo(() => prises.map((p) => ({ dureeSec: p.dureeSec, motsTexte: compterMots(p.texte) })), [prises]);
  return (
    <section aria-label="Déposer vos vidéos filmées" className="space-y-6">
      <ZoneDepot
        libelle={n ? "Ajouter d'autres vidéos" : "Déposez vos vidéos filmées"}
        detail={n ? "Glissez-les ici ou touchez pour choisir" : "Une ou plusieurs · MP4 ou MOV, avec votre voix · glissez-les ici ou touchez pour choisir"}
        accepte={ACCEPTE_PRISES}
        multiple
        icone="camera"
        essai={false}
        compacte={n > 0}
        onFichiers={(f) => void recevoir(f)}
      />

      {prises.map((p, i) => (
        <Carte key={p.id} sansMarge className="overflow-hidden">
          {/* Aperçu ENTIER : la vidéo garde ses proportions dans le cadre, jamais rognée. */}
          <div className="grid place-items-center bg-surface-2">
            <video
              src={p.url}
              controls
              playsInline
              preload="metadata"
              className="block h-auto max-h-[60vh] w-auto max-w-full object-contain"
              style={p.largeur && p.hauteur ? { aspectRatio: `${p.largeur} / ${p.hauteur}` } : undefined}
            />
          </div>
          <div className="space-y-3 p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-[15px] font-semibold text-texte">
                  {n > 1 ? `${i + 1}. ` : ""}
                  {p.nom}
                </p>
                <p className="text-sm tabular-nums text-texte-doux">{etatPrise(p)}</p>
              </div>
              <Bouton variante="fantome" icone="corbeille" onClick={() => retirer(p.id)} disabled={p.etape === "envoi" || lancement} aria-label={`Retirer ${p.nom}`}>
                Retirer
              </Bouton>
            </div>
            {p.etape === "envoi" && <BarreProgression valeur={p.envoi} libelle={`Envoi de ${p.nom}`} />}
            {p.attente && (
              <p className="text-sm font-semibold text-ambre" aria-live="polite">
                {p.attente}
              </p>
            )}
            {phraseOrientation(p) && (
              <p className="flex items-center gap-2 text-sm text-texte-doux">
                <Icone nom="ecran-partage" size={16} className="shrink-0 text-orange-vif" />
                {phraseOrientation(p)}
              </p>
            )}
            {tropCourte(p) && <p className="text-sm font-semibold text-brique">Cette vidéo est trop courte (moins de 5 secondes) : retirez-la.</p>}
            {p.refusSujet && (
              <section aria-label="Vidéo déjà traitée" role="alert" className="space-y-3 rounded-2xl border border-brique/40 bg-brique-doux px-4 py-3 text-[15px] text-texte">
                <p className="font-semibold">{p.erreur}</p>
                <ul className="space-y-1 text-sm">
                  {p.refusSujet.precedents.slice(0, 5).map((pr) => (
                    <li key={pr.videoId ?? pr.sujetId ?? pr.lien}>
                      <Link href={pr.lien} className="underline">
                        {pr.titre}
                      </Link>{" "}
                      <span className="text-texte-doux">le {new Date(pr.le).toLocaleDateString("fr-FR")}</span>
                    </li>
                  ))}
                </ul>
                <div className="flex flex-wrap gap-2">
                  <Bouton variante="secondaire" onClick={() => retirer(p.id)} disabled={refaitEnCours}>
                    Choisir une autre prise
                  </Bouton>
                  <Bouton variante="secondaire" chargement={refaitEnCours} disabled={refaitEnCours || !accord} onClick={() => void refaireQuandMeme(p)}>
                    Refaire quand même
                  </Bouton>
                </div>
              </section>
            )}
            {p.erreur && !p.refusSujet && (
              <div role="alert" className="space-y-2 rounded-2xl bg-brique-doux px-4 py-3">
                <p className="text-[15px] font-semibold text-brique">{p.erreur}</p>
                {p.etape === "arretee" && p.reprenable && (
                  <Bouton variante="secondaire" icone="reessayer" onClick={() => modifier(p.id, { etape: "a-envoyer", erreur: undefined })}>
                    Reprendre l&apos;envoi
                  </Bouton>
                )}
              </div>
            )}
            <div className="space-y-2">
              <button type="button" className="flex items-center gap-1.5 text-sm font-semibold text-orange-vif" aria-expanded={p.texteOuvert} onClick={() => modifier(p.id, { texteOuvert: !p.texteOuvert })}>
                <Icone nom="chevron-bas" size={16} className={p.texteOuvert ? "rotate-180" : undefined} />
                {p.texte.trim() ? "Ce que vous dites (ajouté)" : "Ajouter ce que vous dites (facultatif)"}
              </button>
              <Bouton variante="secondaire" icone="document" onClick={() => setScriptPour(p.id)} disabled={lancement}>
                Utiliser un script validé
              </Bouton>
              {p.avisTexte && <p className="text-sm font-semibold text-ambre">{p.avisTexte}</p>}
              {p.texteOuvert && (
                <>
                  <ZoneTexte
                    className="mt-2"
                    libelle={`Ce que vous dites dans ${p.nom} (facultatif)`}
                    aide="Collez votre texte : les sous-titres prennent son orthographe et les reprises sont mieux coupées."
                    value={p.texte}
                    onChange={(e) => modifier(p.id, { texte: e.target.value })}
                    longueurMax={20000}
                    auto
                  />
                  <BoutonImporterTexte
                    onTexte={(t) => {
                      const r = texteDitDuScript(t);
                      modifier(p.id, { texte: r.texte, avisTexte: r.tronque ? PHRASE_TEXTE_RACCOURCI : undefined });
                    }}
                  />
                </>
              )}
            </div>
          </div>
        </Carte>
      ))}

      <FeuilleScriptsValides ouverte={scriptPour !== null} onOuverteChange={(v) => !v && setScriptPour(null)} onChoisir={reprendreScript} />

      {!accordDejaDonne && (
        <CaseACocher libelle="J'accepte l'essai réel de ce format" detail="Format en essai, visible seulement par vous : les vidéos sont vraiment fabriquées (sans prix)." coche={accord} onChange={setAccord} />
      )}
      {refus && (
        <p role="alert" className="rounded-2xl bg-brique-doux px-4 py-3 text-[15px] font-semibold text-brique">
          {refus}
        </p>
      )}
      <EstimationCout prises={aEstimer} />
      {consigne && <p className="text-sm text-texte-doux">{consigne}</p>}
      <BarreActionCollee>
        <Bouton taille="lg" pleineLargeur icone="baguette" chargement={lancement} disabled={!pret} onClick={() => void animer()}>
          {libelleAnimer(n)}
        </Bouton>
      </BarreActionCollee>
    </section>
  );
}
