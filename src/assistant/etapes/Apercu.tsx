"use client";

import { motion } from "motion/react";
import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { apercuAction, choisirIllustrationAction, intensiteApercuAction, maquetteAction, modeEconomiqueAction, sonDuPlanAction } from "@/app/(studio)/nouvelle/[format]/actions";
import { CourbeIntensite } from "@/components/intensite/CourbeIntensite";
import { SonDuPlan } from "@/components/intensite/SonDuPlan";
import type { IntensiteApercu } from "@/services/intensite";
import { CadreApercu, texteDeborde } from "@/components/creation/CadreApercu";
import { BarreActionCollee } from "@/components/ui/BarreActionCollee";
import { Bouton } from "@/components/ui/Bouton";
import { EtatVide } from "@/components/ui/EtatVide";
import { FeuilleBas } from "@/components/ui/FeuilleBas";
import { Icone, type NomIcone } from "@/components/ui/Icone";
import { Interrupteur } from "@/components/ui/Interrupteur";
import { LecteurVideo } from "@/components/ui/LecteurVideo";
import { Pastille } from "@/components/ui/Pastille";
import { FormeRatio, SelecteurPastilles } from "@/components/ui/SelecteurPastilles";
import { Squelette } from "@/components/ui/Squelette";
import { notifier } from "@/components/ui/Toast";
import { phraseAvatarParle } from "@/domaine/double-reel";
import { resoudreVisagesParAngle } from "@/domaine/distribution";
import type { AngleVisage, ChoixBruitagePlan, Montant, Ratio } from "@/domaine/types";
import { briquesEffectives, libelleDuree, obtenirFormat } from "@/formats";
import { chrono } from "@/lib/dates";
import { cn } from "@/lib/cn";
import { formaterMontant } from "@/lib/montants";
import { sansAccents } from "@/lib/textes";
import type { ApercuFabrication, IllustrationsApercu } from "@/services/fabrication";
import type { OrigineCascade } from "@/domaine/illustrations";
import type { VueElement, VuePlan } from "@/services/vues";
import type { CleEtape } from "./meta";
import { lancerAvecVoyant, type OuiVoyant } from "./lancer-avec-voyant";
import type { ProprietesEtape } from "./types";
import { avecConfirmationPrix } from "@/components/ui/ConfirmationPrix";

/** Écran « Votre vidéo » : l'étape à corriger → la feuille qui la porte (E2E-1 n° 5). */
export const FEUILLE_DE_L_ETAPE: Partial<Record<CleEtape, "script" | "plateau" | "voix" | "style">> = { script: "script", distribution: "plateau", reglages: "style" };

/** Lot M5 : d'où vient l'illustration (cascade), affiché sur le plan. */
const ORIGINES: Record<OrigineCascade, { libelle: string; icone: NomIcone; ton: "orange" | "ambre" | "neutre" | "sauge" }> = {
  "mes-images": { libelle: "Mes images", icone: "images", ton: "sauge" },
  reutilisee: { libelle: "Réutilisée · 0 €", icone: "repeter", ton: "neutre" },
  banque: { libelle: "Banque · 0 €", icone: "image", ton: "neutre" },
  "a-fabriquer": { libelle: "À fabriquer", icone: "etincelles", ton: "ambre" },
  choix: { libelle: "Mon choix", icone: "cadenas", ton: "orange" },
  double: { libelle: "Mon double", icone: "visage", ton: "orange" },
};

function sourcePlan(p: VuePlan, illustrations?: IllustrationsApercu): { libelle: string; icone: NomIcone; ton: "orange" | "ambre" | "neutre" | "sauge" } {
  const origine = illustrations?.parPlan[p.id]?.origine;
  if (origine && origine !== "choix") return ORIGINES[origine];
  if (p.sourceImage === "illustration") {
    if (p.illustration?.source === "generee-ia") return { libelle: "IA", icone: "etincelles", ton: "ambre" };
    if (p.illustration?.source === "banque") return { libelle: "Banque d'images", icone: "images", ton: "neutre" };
    return { libelle: "Bibliothèque", icone: "bibliotheque", ton: "neutre" };
  }
  if (p.sourceImage === "rush") return { libelle: "Images filmées", icone: "camera", ton: "neutre" };
  if (p.sourceImage === "motion") return { libelle: "Animation", icone: "baguette", ton: "neutre" };
  return { libelle: "Mon double", icone: "visage", ton: "orange" };
}

function motsDe(t: string | undefined): string[] {
  return sansAccents(t ?? "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((m) => m.length > 3);
}

/** Illustrations triées par proximité avec la requête du plan (mots-clés, nom). */
function candidatsPour(plan: VuePlan, elements: VueElement[]) {
  const requete = motsDe(plan.illustration?.requete ?? plan.texte);
  const score = (e: VueElement) => {
    const cible = motsDe([e.nom, ...e.motsCles].join(" "));
    return requete.filter((m) => cible.some((c) => c.startsWith(m.slice(0, 5)) || m.startsWith(c.slice(0, 5)))).length + (plan.illustration?.candidats.includes(e.id) ? 2 : 0);
  };
  return elements.map((e) => ({ e, s: score(e) })).sort((a, b) => b.s - a.s);
}

/**
 * Étape « apercu » : plan de montage plan par plan (vignettes au ratio choisi), pastille de source,
 * « Remplacer » (choix verrouillé), pastilles de ratio, zones des réseaux, coût en GROS chiffre,
 * « Voir une maquette rapide », confirmation au-delà du seuil (AV2.3-2/6/9/10, AV2.4-6).
 */
export function EtapeApercu({ formatId, brouillon, modifier, allerA, contexte, compacte, ouvrirFeuille }: ProprietesEtape) {
  const format = obtenirFormat(formatId);
  const briques = briquesEffectives(format, brouillon.briquesCoupees, brouillon.briquesAllumees);
  const [donnees, setDonnees] = useState<ApercuFabrication | null>(null);
  const [erreur, setErreur] = useState<{ message: string; code?: string } | null>(null);
  const [ratio, setRatio] = useState<Ratio>(brouillon.ratios[0] ?? format.ratioMaitre);
  const [zones, setZones] = useState(false);
  const [actif, setActif] = useState(0);
  const [aRemplacer, setARemplacer] = useState<VuePlan | null>(null);
  const [confirmation, setConfirmation] = useState(false);
  // Paquet 4 (D2) : prix renvoyé par le serveur au-delà du seuil (plus haut que l'estimation affichée) : c'est lui qui s'affiche et repart.
  const [montantServeur, setMontantServeur] = useState<number | null>(null);
  const [maquette, setMaquette] = useState<{ url: string; vignette: string; ratio: Ratio } | null>(null);
  const [occupe, setOccupe] = useState<"maquette" | "lancement" | "remplacement" | null>(null);
  const [intensite, setIntensite] = useState<IntensiteApercu | null>(null);
  const charge = useRef(false);
  const ouiVoyant = useRef<OuiVoyant>({ current: false });
  // Coût ouvert sans texte (E2E-1 n° 6) : rien à calculer, et surtout aucun brouillon vide créé.
  const sansTexte = !brouillon.videoId && !brouillon.blocs.some((b) => b.segments.some((s) => s.texte.trim()));

  // « Mes images » non validées ne sont jamais proposées (confidentialité, lot A2).
  const illustrations = useMemo(
    () => contexte.elements.filter((e) => (e.type === "illustration-image" || e.type === "illustration-video") && !e.archiveLe && (e.origine !== "personnelle" || e.confidentialite?.statut === "prete")),
    [contexte.elements],
  );

  const charger = useCallback(async () => {
    setErreur(null);
    const id = brouillon.videoId ?? (await contexte.enregistrer());
    if (!id) return setErreur({ message: "Le brouillon n'a pas pu être enregistré." });
    const r = await apercuAction(id);
    if (r.ok) setDonnees(r.donnees);
    else setErreur({ message: r.message, code: r.code });
    // Lot « intensité » : la courbe arrive après les plans (jamais bloquante).
    const i = await intensiteApercuAction(id);
    if (i.ok) setIntensite(i.donnees);
  }, [brouillon.videoId, contexte]);

  async function changerSon(planId: string, choix: ChoixBruitagePlan | null) {
    const r = await sonDuPlanAction(planId, choix);
    if (r.ok) setIntensite(r.donnees);
    else notifier.erreur(r.message);
  }

  useEffect(() => {
    if (charge.current || sansTexte) return;
    const t = setTimeout(() => {
      charge.current = true;
      void charger();
    }, 0);
    return () => clearTimeout(t);
  }, [charger, sansTexte]);

  // Image d'un plan « double » : le visage de l'ANGLE du plan (visages par angle, B.0 §3), même tenue et même posture ;
  // sans visage pour cet angle, le visage principal (mode « 1 angle, effet 2 caméras par recadrage »).
  const distribution = brouillon.distribution[0];
  const personnage = contexte.personnages.find((p) => p.personnage.id === distribution?.personnageId);
  const choisi = personnage?.visages.find((v) => v.id === distribution?.visageId);
  const parAngle = choisi && personnage ? resoudreVisagesParAngle({ visages: personnage.visages, principal: choisi, partSecond: 1, imposes: distribution?.visagesParAngle }).visagesParAngle : {};
  const visageDe = (angle?: AngleVisage) => {
    const id = (angle && parAngle[angle]) || choisi?.id;
    return personnage?.visages.find((v) => v.id === id)?.vignette ?? null;
  };
  const imagePlan = (p: VuePlan) => (p.sourceImage === "illustration" ? (p.illustrationVignette ?? p.vignette) : (visageDe(p.angle) ?? p.vignette));

  async function lancer(confirme: boolean | number) {
    const id = brouillon.videoId;
    if (!id) return;
    setOccupe("lancement");
    const r = await lancerAvecVoyant(id, confirme, undefined, ouiVoyant.current);
    setOccupe(null);
    if (r.ok) {
      setConfirmation(false);
      modifier({ travailId: r.donnees.travailId });
      allerA("fabrication", { sansEnregistrer: true });
      return;
    }
    if (r.code === "CONFIRMATION_REQUISE") {
      setMontantServeur(r.montant ?? null);
      return setConfirmation(true);
    }
    notifier.erreur(r.message);
    if (r.code === "ACCORD_MANQUANT" || r.code === "DISTRIBUTION_INCOMPLETE") allerA("distribution");
  }

  async function basculerEconomique(actif: boolean) {
    const id = brouillon.videoId;
    if (!id) return;
    const r = await modeEconomiqueAction(id, actif);
    if (r.ok) setDonnees(r.donnees);
    else notifier.erreur(r.message);
  }

  async function voirMaquette() {
    if (!brouillon.videoId) return;
    setOccupe("maquette");
    const videoId = brouillon.videoId;
    let r = await maquetteAction(videoId);
    r = await avecConfirmationPrix(r, (accord) => maquetteAction(videoId, accord));
    setOccupe(null);
    if (r.ok) {
      setMaquette(r.donnees);
      notifier.essai("maquette de démonstration");
    } else notifier.erreur(r.message);
  }

  async function remplacer(plan: VuePlan, element: VueElement | null) {
    setOccupe("remplacement");
    const r = await choisirIllustrationAction(plan.id, element?.id ?? null);
    setOccupe(null);
    if (!r.ok) return notifier.erreur(r.message);
    setDonnees((d) =>
      d
        ? {
            ...d,
            plans: d.plans.map((p) => (p.id === plan.id ? { ...p, ...r.donnees, vignette: element?.vignette ?? p.vignette, illustrationVignette: element?.vignette ?? null, illustrationNom: element?.nom } : p)),
          }
        : d,
    );
    setARemplacer(null);
    notifier.succes(element ? "Image remplacée" : "Plan sur votre double");
  }

  if (sansTexte) {
    return (
      <EtatVide
        compact={compacte}
        icone="ecrire"
        titre="D'abord le texte"
        phrase="Le prix se calcule dès qu'il y a un texte."
        action={
          <Bouton icone="ecrire" onClick={() => (ouvrirFeuille ? ouvrirFeuille("script") : allerA("script"))}>
            Écrire le texte
          </Bouton>
        }
      />
    );
  }

  if (erreur) {
    const versEtape: Partial<Record<string, CleEtape>> = { ACCORD_MANQUANT: "distribution", DISTRIBUTION_INCOMPLETE: "distribution", SCRIPT_MANQUANT: "script", REGLAGES_INVALIDES: "reglages" };
    const cible = erreur.code ? versEtape[erreur.code] : undefined;
    return (
      <EtatVide
        icone="attention"
        titre="L'aperçu n'est pas prêt"
        phrase={erreur.message}
        action={
          cible ? (
            // En mode Rapide, l'étape « script » n'existe pas : « Corriger » ouvre la bonne feuille (E2E-1 n° 5).
            <Bouton icone="ecrire" onClick={() => (ouvrirFeuille ? ouvrirFeuille(FEUILLE_DE_L_ETAPE[cible] ?? "script") : allerA(cible))}>
              Corriger
            </Bouton>
          ) : (
            <Bouton variante="secondaire" icone="reessayer" onClick={() => void charger()}>
              Réessayer
            </Bouton>
          )
        }
      />
    );
  }

  if (!donnees) return compacte ? <Squelette className="h-56 rounded-carte" /> : <ChargementApercu />;

  if (compacte) {
    // Bloc Coût de l'écran « Votre vidéo » (lot M3) : le prix, les formats d'image (9:16 coché), le reste du mois.
    const changerFormats = async (ratios: Ratio[]) => {
      if (!ratios.length) return notifier.info("Gardez au moins un format");
      modifier({ ratios });
      setDonnees(null);
      await contexte.enregistrer();
      await charger();
    };
    return (
      <div className="space-y-4">
        {!format.sansPrix && <BlocCout donnees={donnees} nbFormats={brouillon.ratios.length} onEconomique={briques.illustrations ? basculerEconomique : undefined} />}
        <FormatsImage disponibles={format.ratios} choisis={brouillon.ratios} onChange={(r) => void changerFormats(r)} />
        {/* Lot « intensité » : sur l'écran « Votre vidéo » (formats sans étape Aperçu, dont l'avocat), la courbe et
            le son de chaque plan restent accessibles ici, en version courte. */}
        {intensite && donnees.plans.length > 0 && (
          <section aria-label="Rythme" className="space-y-2">
            <CourbeIntensite rapport={intensite.rapport} />
            {briques.son && (
              <>
                <div role="group" aria-label="Plans" className="sans-barre -mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
                  {donnees.plans.map((p, i) => {
                    const choisi = i === Math.min(actif, donnees.plans.length - 1);
                    const sonne = !!intensite.sonsParPlan[p.id] && intensite.choixParPlan[p.id]?.mode !== "retire";
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setActif(i)}
                        aria-label={`Plan ${i + 1}${sonne ? ", avec un son" : ""}`}
                        aria-current={choisi || undefined}
                        className={cn("relative grid size-11 shrink-0 place-items-center rounded-full border text-sm font-bold tabular-nums transition-colors", choisi ? "border-orange bg-orange text-sur-orange" : "border-trait bg-surface-2 text-texte")}
                      >
                        {i + 1}
                        {sonne && (
                          <span className="absolute -right-0.5 -top-0.5 grid size-4 place-items-center rounded-full bg-fond text-texte">
                            <Icone nom="volume" size={9} />
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
                {(() => {
                  const p = donnees.plans[Math.min(actif, donnees.plans.length - 1)];
                  return <SonDuPlan choix={intensite.choixParPlan[p.id] ?? null} prevu={intensite.choixParPlan[p.id] ? undefined : intensite.sonsParPlan[p.id]} onChange={(c) => void changerSon(p.id, c)} />;
                })()}
                {intensite.sonsValides === 0 && intensite.bruitages === "discrets" && (
                  <Link href="/bibliotheque/bruitage" className="inline-flex min-h-11 items-center gap-1.5 text-xs font-semibold text-orange-vif hover:underline">
                    <Icone nom="casque" size={13} />
                    Écouter et valider les sons
                  </Link>
                )}
              </>
            )}
          </section>
        )}
      </div>
    );
  }

  const plans = donnees.plans;
  const plan = plans[Math.min(actif, plans.length - 1)];
  const cout = donnees.estimation.total;
  const prixAConfirmer = { centimes: Math.max(cout.centimes, montantServeur ?? 0), devise: cout.devise };
  const depasse = donnees.budget.depasse;
  const nbDebordements = zones ? plans.filter((p) => briques["texte-ecran"] && texteDeborde(p.texteEcran, ratio)).length : 0;
  const lut = contexte.elements.find((e) => e.id === (brouillon.styles.lutId ?? format.stylesParDefaut.lut));

  const precedente = format.etapes[format.etapes.indexOf("apercu") - 1];

  return (
    <div>
      <div className="space-y-6 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-start lg:gap-8 lg:space-y-0">
        {/* Colonne image (collée sur ordinateur) */}
        <div className="space-y-4 lg:sticky lg:top-6">
          {plan ? (
            <CadreApercu
              ratio={ratio}
              cle={`${plan.id}-${ratio}`}
              image={imagePlan(plan)}
              texteEcran={briques["texte-ecran"] ? plan.texteEcran : undefined}
              sousTitre={briques["sous-titres"] ? plan.texte.split(/\s+/).slice(0, 7).join(" ") : undefined}
              motsEnValeur={plan.motsEnValeur}
              mention={briques["mention-ia"] ? brouillon.mentionIA : null}
              zones={zones}
              cadrage={plan.cadrage}
              debutSec={plan.debutSec}
            />
          ) : (
            <EtatVide compact icone="film" titre="Aucun plan" phrase="Ajoutez du texte pour voir le montage." />
          )}
          <div className="flex flex-wrap items-center justify-between gap-2">
            {brouillon.ratios.length > 1 ? (
              <SelecteurPastilles
                libelle="Voir en"
                libelleMasque
                options={brouillon.ratios.map((r) => ({ valeur: r, libelle: r, visuel: <FormeRatio ratio={r} /> }))}
                valeur={ratio}
                onChange={setRatio}
              />
            ) : (
              <Pastille taille="md" icone="video">
                {ratio}
              </Pastille>
            )}
          </div>
          {(ratio === "9:16" || ratio === "4:5") && (
            <Interrupteur
              icone="grille"
              libelle="Afficher les zones des réseaux"
              detail={zones ? (nbDebordements ? `${nbDebordements} texte${nbDebordements > 1 ? "s" : ""} à raccourcir` : "Rien ne déborde") : undefined}
              coche={zones}
              onChange={setZones}
              className="rounded-carte border border-trait bg-surface-1 px-3"
            />
          )}
        </div>

        {/* Colonne plans + coût */}
        <div className="space-y-6">
          <section>
            <div className="mb-2 flex items-baseline justify-between">
              <h2 className="font-texte text-sm font-semibold text-texte-doux">Plan par plan</h2>
              <span className="text-xs tabular-nums text-texte-faible">
                {plans.length} plans · {libelleDuree(brouillon.dureeCibleSec)}
              </span>
            </div>
            <ol aria-label="Plans" className="sans-barre -mx-4 flex snap-x gap-2 overflow-x-auto px-4 pb-2 lg:mx-0 lg:grid lg:grid-cols-5 lg:overflow-visible lg:px-0">
              {plans.map((p, i) => {
                const choisi = i === actif;
                return (
                  <li key={p.id} className="w-[64px] shrink-0 snap-start lg:w-auto">
                    <button
                      type="button"
                      onClick={() => setActif(i)}
                      aria-label={`Plan ${i + 1}`}
                      aria-current={choisi || undefined}
                      className={cn("relative block aspect-[9/16] w-full overflow-hidden rounded-xl border-2 bg-surface-2 transition-all", choisi ? "border-orange shadow-orange" : "border-transparent opacity-80 hover:opacity-100")}
                    >
                      {imagePlan(p) && donnees.illustrations?.parPlan[p.id]?.origine !== "a-fabriquer" && <Image src={imagePlan(p)!} alt="" fill sizes="80px" className="object-cover" />}
                      {donnees.illustrations?.parPlan[p.id]?.origine === "a-fabriquer" && (
                        <span className="absolute inset-0 grid place-items-center border border-dashed border-ambre/60 bg-ambre/10 text-ambre">
                          <Icone nom="etincelles" size={16} />
                        </span>
                      )}
                      <span className="absolute left-1 top-1 rounded bg-fond/80 px-1 text-[10px] font-bold tabular-nums text-texte">{i + 1}</span>
                      {p.illustration?.verrouille && (
                        <span className="absolute right-1 top-1 grid size-4 place-items-center rounded-full bg-orange text-sur-orange">
                          <Icone nom="cadenas" size={9} />
                        </span>
                      )}
                      {p.sourceImage === "illustration" && !p.illustration?.verrouille && <span className="absolute inset-x-0 bottom-0 h-1 bg-ambre" />}
                      {intensite?.sonsParPlan[p.id] && intensite.choixParPlan[p.id]?.mode !== "retire" && (
                        <span className="absolute bottom-1.5 right-1 grid size-4 place-items-center rounded-full bg-fond/80 text-texte" aria-label="Son">
                          <Icone nom="volume" size={9} />
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ol>
            {/* Lot « intensité » : la courbe unique que tous les effets consultent (plafond en pointillé). */}
            {intensite && <CourbeIntensite rapport={intensite.rapport} className="mt-1" />}
            {plan && (
              <motion.div key={plan.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="mt-2 rounded-carte border border-trait bg-surface-1 p-4">
                <div className="mb-2 flex flex-wrap items-center gap-1.5">
                  <span className="text-xs font-bold tabular-nums text-texte-faible">
                    {chrono(plan.debutSec)} – {chrono(plan.finSec)}
                  </span>
                  <Pastille ton={sourcePlan(plan, donnees.illustrations).ton} icone={sourcePlan(plan, donnees.illustrations).icone}>
                    {sourcePlan(plan, donnees.illustrations).libelle}
                  </Pastille>
                  {donnees.illustrations?.parPlan[plan.id]?.ia && (
                    <Pastille ton="orange" icone="etincelles">
                      IA
                    </Pastille>
                  )}
                  {plan.illustration?.verrouille && (
                    <Pastille ton="orange" icone="cadenas">
                      Mon choix
                    </Pastille>
                  )}
                </div>
                <p className="text-[15px] leading-relaxed text-texte">{plan.texte}</p>
                {plan.illustrationNom && plan.sourceImage === "illustration" && <p className="mt-1 truncate text-xs text-texte-faible">{plan.illustrationNom}</p>}
                {donnees.illustrations?.parPlan[plan.id]?.licence && <p className="truncate text-[11px] text-texte-faible">Licence : {donnees.illustrations.parPlan[plan.id].licence}</p>}
                {donnees.illustrations?.parPlan[plan.id]?.origine === "a-fabriquer" && <p className="mt-1 text-xs text-texte-faible">Rien de juste dans vos images ni dans les banques : elle sera fabriquée, sans personne.</p>}
                {briques.illustrations && (
                  <Bouton variante="secondaire" icone="images" className="mt-3" onClick={() => setARemplacer(plan)}>
                    Remplacer l&apos;image
                  </Bouton>
                )}
                {/* Lot « bruitages » : retirer ou ajouter le son de CE plan (gratuit, seul le mixage change). */}
                {briques.son && intensite && (
                  <div className="mt-3">
                    <SonDuPlan choix={intensite.choixParPlan[plan.id] ?? null} prevu={intensite.choixParPlan[plan.id] ? undefined : intensite.sonsParPlan[plan.id]} onChange={(c) => void changerSon(plan.id, c)} />
                    {intensite.sonsValides === 0 && intensite.bruitages === "discrets" && (
                      <Link href="/bibliotheque/bruitage" className="mt-1 inline-flex min-h-11 items-center gap-1.5 text-xs font-semibold text-orange-vif hover:underline">
                        <Icone nom="casque" size={13} />
                        Écouter et valider les sons
                      </Link>
                    )}
                  </div>
                )}
              </motion.div>
            )}
          </section>

          {!format.sansPrix && <BlocCout donnees={donnees} nbFormats={brouillon.ratios.length} onEconomique={briques.illustrations ? basculerEconomique : undefined} />}

          <section aria-label="Récapitulatif" className="flex flex-wrap gap-2">
            <Recap icone="idee" texte={brouillon.sujet} onClick={() => allerA("sujet")} />
            {personnage && <Recap icone="personnages" texte={personnage.personnage.nom} onClick={() => allerA("distribution")} />}
            {briques.etalonnage && lut && <Recap icone="contraste" texte={lut.nom} onClick={() => allerA("reglages")} />}
          </section>

          <Bouton variante="contour" icone="lecture" essai pleineLargeur chargement={occupe === "maquette"} onClick={() => void voirMaquette()}>
            Voir une maquette rapide
          </Bouton>
        </div>
      </div>

      <BarreActionCollee secondaire={precedente ? <Bouton variante="secondaire" taille="lg" icone="fleche-gauche" aria-label="Étape précédente" onClick={() => allerA(precedente)} /> : undefined}>
        {/* E2E-2 argent n° 4 : pendant la maquette, « Fabriquer » attend (sa voix sera reprise, pas repayée) ; un
            bouton grisé dit toujours pourquoi, juste dessous. Le serveur fait de même (un geste à la fois par vidéo). */}
        <div className="flex min-w-0 flex-col gap-1">
          <Bouton
            taille="lg"
            pleineLargeur
            icone="clap"
            essai={!donnees.budget.double && !donnees.budget.montageReel}
            disabled={depasse || !plans.length || occupe === "maquette" || !!donnees.refus}
            chargement={occupe === "lancement"}
            onClick={() => (donnees.budget.confirmationRequise ? setConfirmation(true) : void lancer(false))}
          >
            Fabriquer · {formaterMontant(cout, { court: true })}
          </Bouton>
          {donnees.refus ? (
            <p role="alert" className="text-center text-xs text-ambre">
              {donnees.refus}{" "}
              <Link href="/reglages#connexions" className="font-semibold underline">
                Ouvrir Réglages › Connexions
              </Link>
            </p>
          ) : occupe === "maquette" ? (
            <p className="text-center text-xs text-texte-doux">La maquette se prépare : sa voix servira à la vidéo.</p>
          ) : depasse ? (
            <p className="text-center text-xs text-ambre">
              Budget du mois dépassé ·{" "}
              <Link href="/reglages#budget" className="font-semibold underline">
                Augmenter le budget
              </Link>
            </p>
          ) : !plans.length ? (
            <p className="text-center text-xs text-texte-doux">Ajoutez d&apos;abord le texte de la vidéo.</p>
          ) : null}
        </div>
      </BarreActionCollee>

      <FeuilleBas
        ouverte={confirmation}
        onOuverteChange={setConfirmation}
        titre={donnees.budget.double ? "Votre avatar parle" : donnees.budget.montageReel ? "Cette vidéo sera montée pour de vrai" : "Plus cher que d'habitude"}
        description={
          donnees.budget.double
            ? phraseAvatarParle(donnees.budget.double)
            : donnees.budget.montageReel
              ? "Prix estimé de cette vidéo. Pour repasser en essai : Réglages, Connexions, Montage."
              : `Au-dessus de votre seuil de ${formaterMontant(donnees.budget.seuil, { court: true })}.`
        }
        pied={
          <Bouton taille="lg" pleineLargeur icone="clap" essai={!donnees.budget.double && !donnees.budget.montageReel} chargement={occupe === "lancement"} onClick={() => void lancer(prixAConfirmer.centimes)}>
            Confirmer et fabriquer
          </Bouton>
        }
      >
        <p className="py-4 text-center font-titre text-[64px] tabular-nums leading-none text-orange-vif">{formaterMontant(prixAConfirmer)}</p>
        <p className="text-center text-sm text-texte-doux">Reste ce mois après la vidéo : {formaterMontant({ centimes: Math.max(0, donnees.budget.restant.centimes - prixAConfirmer.centimes), devise: cout.devise }, { court: true })}</p>
      </FeuilleBas>

      <FeuilleBas ouverte={!!aRemplacer} onOuverteChange={(o) => !o && setARemplacer(null)} titre="Remplacer l'image" description={aRemplacer?.illustration?.requete ? `« ${aRemplacer.illustration.requete} »` : undefined}>
        {aRemplacer && (
          <ul className="grid grid-cols-3 gap-2 pt-1 sm:grid-cols-4">
            <li>
              <button
                type="button"
                disabled={occupe === "remplacement"}
                onClick={() => void remplacer(aRemplacer, null)}
                className="flex aspect-[3/4] w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-trait-fort bg-surface-2 text-xs font-semibold text-texte-doux hover:text-texte"
              >
                <Icone nom="visage" size={22} />
                Mon double
              </button>
            </li>
            {candidatsPour(aRemplacer, illustrations).map(({ e, s }) => {
              const actuel = aRemplacer.illustration?.elementId === e.id;
              return (
                <li key={e.id}>
                  <button
                    type="button"
                    disabled={occupe === "remplacement"}
                    onClick={() => void remplacer(aRemplacer, e)}
                    className={cn("group relative block aspect-[3/4] w-full overflow-hidden rounded-xl border-2 bg-surface-2", actuel ? "border-orange" : "border-transparent hover:border-trait-fort")}
                  >
                    {e.vignette && <Image src={e.vignette} alt={e.nom} fill sizes="120px" className="object-cover transition-transform group-hover:scale-105" />}
                    <span className="absolute inset-x-0 bottom-0 truncate bg-fond/80 px-1.5 py-1 text-left text-[10px] font-semibold text-texte">{e.nom}</span>
                    {/* Les deux pastilles se rangent l'une sous l'autre si la vignette est étroite (jamais superposées). */}
                    {((s > 0 && !actuel) || e.etatLicence !== "ok") && (
                      <span className="absolute inset-x-1 top-1 flex flex-wrap items-start justify-between gap-1">
                        {s > 0 && !actuel && (
                          <Pastille ton="orange" icone="etoile">
                            Conseillé
                          </Pastille>
                        )}
                        {e.etatLicence !== "ok" && (
                          <Pastille ton="ambre" icone="attention" className="ml-auto">
                            Droits
                          </Pastille>
                        )}
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </FeuilleBas>

      <FeuilleBas ouverte={!!maquette} onOuverteChange={(o) => !o && setMaquette(null)} titre="Maquette rapide" description="Sans visage ni voix : le rythme et les textes.">
        {maquette && <LecteurVideo src={maquette.url} affiche={maquette.vignette} ratio={maquette.ratio} titre="Maquette rapide" autoLecture className="mx-auto max-h-[60dvh]" />}
      </FeuilleBas>
    </div>
  );
}

/** Lot R2 : les textes des réseaux que Claude écrira à la fin, déjà comptés dans le coût affiché au-dessus. */
export function LigneTextesReseaux({ montant }: { montant: Montant }) {
  return (
    <p className="mt-4 flex items-baseline justify-between gap-2 rounded-xl bg-fond/40 px-3 py-2.5 text-sm">
      <span className="text-texte-doux">Textes des réseaux</span>
      <span className="text-right">
        <span className="font-semibold tabular-nums text-texte">environ {formaterMontant(montant)}</span> <span className="text-texte-faible">(compris dans le total)</span>
      </span>
    </p>
  );
}

/** Coût estimé en GROS chiffre, temps de fabrication, formats, reste du mois et étapes (AV2.4-6). */
export function BlocCout({ donnees, nbFormats, onEconomique }: { donnees: ApercuFabrication; nbFormats: number; onEconomique?: (actif: boolean) => void }) {
  const cout = donnees.estimation.total;
  const depasse = donnees.budget.depasse;
  const illus = donnees.illustrations;
  return (
    <section className={cn("relative isolate overflow-hidden rounded-carte border p-5", depasse ? "border-brique/40 bg-brique-doux" : "border-orange/30 bg-surface-1")}>
      {!depasse && <span aria-hidden className="absolute inset-0 -z-10 lueur" />}
      <p className="text-sm font-semibold text-texte-doux">Coût estimé</p>
      <p className={cn("mt-1 font-titre text-[56px] tabular-nums leading-none", depasse ? "text-brique" : "text-texte")}>{formaterMontant(cout)}</p>
      <ul className="mt-4 grid grid-cols-3 gap-2 text-center">
        <li className="rounded-xl bg-fond/40 px-2 py-2.5">
          <span className="block font-titre text-lg tabular-nums text-texte">~{libelleDuree(donnees.estimation.dureeFabricationSec)}</span>
          <span className="text-[11px] text-texte-faible">Fabrication</span>
        </li>
        <li className="rounded-xl bg-fond/40 px-2 py-2.5">
          <span className="block font-titre text-lg tabular-nums text-texte">{nbFormats}</span>
          <span className="text-[11px] text-texte-faible">Format{nbFormats > 1 ? "s" : ""}</span>
        </li>
        <li className="rounded-xl bg-fond/40 px-2 py-2.5">
          <span className={cn("block truncate font-titre text-lg tabular-nums", depasse ? "text-brique" : "text-texte")}>{formaterMontant({ centimes: Math.round(donnees.budget.restant.centimes / 100) * 100, devise: donnees.budget.restant.devise }, { court: true })}</span>
          <span className="text-[11px] text-texte-faible">Reste ce mois</span>
        </li>
      </ul>
      {donnees.textesReseaux && <LigneTextesReseaux montant={donnees.textesReseaux} />}
      {illus && (illus.resume.mesImages + illus.resume.reutilisees + illus.resume.banques + illus.resume.aFabriquer > 0 || illus.economique) && (
        <div className="mt-4 rounded-xl bg-fond/40 p-3">
          <p className="mb-2 text-xs font-semibold text-texte-faible">Illustrations</p>
          <ul className="grid gap-1.5 text-sm">
            <li className="flex items-baseline justify-between gap-2">
              <span className="text-texte-doux">Réutilisé</span>
              <span className="font-semibold tabular-nums text-texte">{illus.resume.mesImages + illus.resume.reutilisees + illus.resume.banques} · 0 €</span>
            </li>
            <li className="flex items-baseline justify-between gap-2">
              <span className="text-texte-doux">À fabriquer</span>
              <span className={cn("font-semibold tabular-nums", illus.resume.aFabriquer ? "text-ambre" : "text-texte")}>
                {illus.resume.aFabriquer} · {formaterMontant({ centimes: illus.resume.centimesAFabriquer, devise: cout.devise })}
              </span>
            </li>
          </ul>
          <ul aria-label="Illustrations des plans" className="sans-barre -mx-1 mt-3 flex gap-2 overflow-x-auto px-1 pb-1">
            {donnees.plans
              .filter((p) => illus.parPlan[p.id])
              .map((p) => {
                const o = ORIGINES[illus.parPlan[p.id].origine];
                const image = illus.parPlan[p.id].origine === "a-fabriquer" ? null : (p.illustrationVignette ?? null);
                return (
                  <li key={p.id} className="w-[76px] shrink-0">
                    <span className={cn("relative grid aspect-[9/16] w-full place-items-center overflow-hidden rounded-lg", image ? "bg-surface-2" : "border border-dashed border-ambre/60 bg-ambre/10 text-ambre")}>
                      {image ? <Image src={image} alt="" fill sizes="76px" className="object-cover" /> : <Icone nom={o.icone} size={18} />}
                      {illus.parPlan[p.id].ia && <span className="absolute right-1 top-1 rounded bg-orange px-1 text-[9px] font-bold text-sur-orange">IA</span>}
                    </span>
                    <span className={cn("mt-1 block truncate text-[10px] font-semibold", o.ton === "sauge" ? "text-sauge" : o.ton === "ambre" ? "text-ambre" : o.ton === "orange" ? "text-orange-vif" : "text-texte-doux")}>{o.libelle}</span>
                  </li>
                );
              })}
          </ul>
          {(illus.resume.mesImages > 0 || illus.resume.banques > 0) && (
            <p className="mt-1.5 text-[11px] text-texte-faible">
              {[illus.resume.mesImages && `${illus.resume.mesImages} de Mes images`, illus.resume.banques && `${illus.resume.banques} de banque gratuite`].filter(Boolean).join(" · ")}
            </p>
          )}
          {onEconomique && (
            <Interrupteur icone="euro" libelle="Mode économique" detail="Banques gratuites seulement, rien n'est fabriqué" coche={illus.economique} onChange={onEconomique} className="mt-2" />
          )}
        </div>
      )}
      {depasse && (
        <Link href="/reglages#budget" className="mt-3 flex min-h-11 items-center gap-2 text-sm font-semibold text-brique">
          <Icone nom="attention" size={16} />
          Budget du mois dépassé : l&apos;augmenter
          <Icone nom="chevron-droite" size={16} className="ml-auto" />
        </Link>
      )}
      {donnees.budget.depasseIndicatif && (
        <Link href="/reglages#budget" className="mt-3 flex min-h-11 items-center gap-2 text-sm font-semibold text-ambre">
          <Icone nom="attention" size={16} />
          Au-delà du budget indicatif du mois : la vidéo part quand même
          <Icone nom="chevron-droite" size={16} className="ml-auto" />
        </Link>
      )}
      {donnees.etapes.length > 0 && (
        <div className="sans-barre mt-4 flex items-center gap-1 overflow-x-auto text-[11px] font-semibold text-texte-faible">
          {donnees.etapes.map((e, i) => (
            <span key={e.cle} className="flex shrink-0 items-center gap-1">
              {i > 0 && <Icone nom="chevron-droite" size={11} />}
              {e.nom}
            </span>
          ))}
        </div>
      )}
    </section>
  );
}

const NOMS_RATIOS: Partial<Record<Ratio, string>> = { "9:16": "Vertical", "4:5": "4:5", "1:1": "Carré", "16:9": "Horizontal" };

/**
 * Formats d'image (B.9, ajout du 01/10) : Vertical coché par défaut, 4:5 et Carré en plus si Will veut les recevoir
 * en même temps. Un oubli se rattrape après coup (« Ajouter un format », sans refaire le double ni la voix).
 */
export function FormatsImage({ disponibles, choisis, onChange }: { disponibles: Ratio[]; choisis: Ratio[]; onChange: (r: Ratio[]) => void }) {
  return (
    <div>
      <p className="mb-2 text-sm font-semibold text-texte-doux">Formats</p>
      <div role="group" aria-label="Formats d'image" className="flex flex-wrap gap-2">
        {disponibles.map((r) => {
          const actif = choisis.includes(r);
          return (
            <button
              key={r}
              type="button"
              aria-pressed={actif}
              onClick={() => onChange(actif ? choisis.filter((x) => x !== r) : disponibles.filter((x) => x === r || choisis.includes(x)))}
              className={cn(
                "flex min-h-11 items-center gap-2 rounded-full border px-3.5 text-sm font-semibold transition-colors",
                actif ? "border-orange bg-orange-doux text-orange-vif" : "border-trait bg-surface-1 text-texte-doux hover:border-trait-fort",
              )}
            >
              <FormeRatio ratio={r} />
              {NOMS_RATIOS[r] ?? r}
              {actif && <Icone nom="coche" size={14} strokeWidth={3} />}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Recap({ icone, texte, onClick }: { icone: NomIcone; texte: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-h-11 max-w-full items-center gap-2 rounded-full border border-trait bg-surface-1 px-3.5 text-sm font-semibold text-texte-doux transition-colors hover:border-trait-fort hover:text-texte"
    >
      <Icone nom={icone} size={14} className="shrink-0 text-orange-vif" />
      <span className="truncate">{texte}</span>
      <Icone nom="ecrire" size={13} className="shrink-0 text-texte-faible" />
    </button>
  );
}

function ChargementApercu() {
  return (
    <div aria-busy="true" className="space-y-4">
      <Squelette className="mx-auto aspect-[9/16] w-[64%] max-w-[300px] rounded-[20px]" />
      <div className="flex gap-2">
        {[0, 1, 2, 3, 4].map((i) => (
          <Squelette key={i} className="aspect-[9/16] w-[64px] rounded-xl" />
        ))}
      </div>
      <Squelette className="h-40 rounded-carte" />
    </div>
  );
}
