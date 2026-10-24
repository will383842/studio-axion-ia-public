"use client";

/**
 * La feuille « Votre vidéo » : la promesse, les étapes, les chiffres et leur source, les réseaux, le mot à commenter
 * (interrupteur « Avec le mot », éteint par défaut, actif seulement si le mot est branché sur un réseau coché, X6), puis le bouton commun « Fabriquer la vidéo » avec le montant estimé. Quand la voix du
 * format n'est pas prête, la feuille le dit avec le lien, avant tout clic, et le bouton est inactif.
 * X7 : tout refus que la fabrication opposerait sans dépense (`refusAvantPrix`, le même que le lancement) est dit ici, avant
 * le prix, et le bouton est inactif.
 * Brique 3 : un cas qui a un script validé ne se lance qu'après relecture : le bouton ouvre l'écran commun « Relire le
 * script » (modifiable, chiffre tiré d'un fait verrouillé), qui confirme le prix et lance.
 * P2S · cas né de la porte B : la mention « Exemple, pas un cas réel », l'offre déduite parmi les quatre, et « Ce qui
 * manque » : chaque chiffre « à confirmer » se confirme ou se retire ; tant qu'il en reste un, le bouton est inactif.
 */
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { CONSIGNE_VOIX_CAS_CONCRET } from "@/moteurs/montage-cas-concret/avant-prix";
import { motNormalise, PHRASE_MOT_INDISPONIBLE, PHRASE_MOT_TROP_FREQUENT, type EtatMotsFeuille } from "@/formats/cas-concret/mots-branches";
import { Bouton } from "@/components/ui/Bouton";
import { BoutonRetirerCas } from "./BoutonRetirerCas";
import { Champ } from "@/components/ui/Champ";
import { FeuilleBas } from "@/components/ui/FeuilleBas";
import { Interrupteur } from "@/components/ui/Interrupteur";
import { Pastille } from "@/components/ui/Pastille";
import { BoutonFabriquer } from "@/components/formats/commun/BoutonFabriquer";
import { ChoixReseaux } from "@/components/formats/commun/ChoixReseaux";
import { MENTION_EXEMPLE, OFFRES_PASTILLES, RESEAUX_ECRAN, type VueCas } from "./vue";
import { ScriptEcrans } from "../fiche-video/ScriptEcrans";
import type { AvertissementSujet, DejaTraiteCas } from "@/services/cas-concret";
import { PanneauSujetDejaTraite } from "./PanneauSujetDejaTraite";
import { choixApresEstimation, choixApresInterrupteur, nouveauScriptPourEstimation, peutFabriquer, sujetAEnvoyer, type ChoixSujet } from "./sujet-deja-traite";

/** La seule phrase du choix « Avec le mot » (X4). */
export const PHRASE_AVEC_MOT = "À cocher seulement si vous envoyez vous-même le document à chaque personne qui écrit le mot.";

/** « Instagram et Facebook ». */
const listeReseaux = (t: readonly string[]): string => (t.length <= 1 ? (t[0] ?? "") : `${t.slice(0, -1).join(", ")} et ${t[t.length - 1]}`);

/** La voix du format : prête, ou le lien où la vérifier. */
export interface EtatVoix {
  prete: boolean;
  lien: string;
}

export interface ChoixVideo {
  reseaux: string[];
  mot: string;
  avecMot: boolean;
  /** LOT F : écrire un script neuf au lieu de rejouer le script validé (cas à script validé seulement). */
  nouveauScript?: boolean;
  /** Lot L3 : le choix de Will devant un cas déjà traité (renvoyé tel quel au serveur). */
  sujet?: ChoixSujet;
}

/** Ce que l'estimation rend : le prix, un refus avant le prix, et le sujet déjà traité (lot L3). */
export interface EstimationFeuille {
  centimes: number;
  refus?: string;
  dejaTraite?: DejaTraiteCas;
  avertissement?: AvertissementSujet;
}

/** LOT F · le choix « Nouveau script » (cas à script validé) : libellé et explication, en français simple. */
/** Le prix d'un cas ouvert sans montant d'avance n'a pas pu être calculé : le bouton reste inactif. */
export const PHRASE_PRIX_INTROUVABLE = "Le prix n'a pas pu être calculé. Fermez cette fenêtre et rouvrez le cas.";

/** Ce que la feuille dit du texte exact d'une vidéo dont le cas a un récit : honnête sur le moment et le prix. */
export const PHRASE_TEXTE_ECRIT_AU_LANCEMENT = "Le texte exact dit dans la vidéo est écrit au lancement (compris dans le prix affiché, ≈ 0,5 €) puis relu par vous avant la voix.";
export const LIBELLE_NOUVEAU_SCRIPT = "Nouveau script (autre structure)";
export const PHRASE_NOUVEAU_SCRIPT = "Claude écrit un nouveau script pour cette vidéo, dans une autre structure. Vous le relisez avant que la voix soit payée. Le script validé reste tel quel tant que vous ne validez pas le nouveau.";

export function FeuilleVotreVideo({
  cas,
  essai,
  montantInitial,
  refusInitial,
  voix,
  mots,
  onFermer,
  onRetire,
  estimer,
  onFabriquer,
  onValider,
  onRelire,
  onFait,
  onAutreCas,
  occupe = false,
}: {
  cas: VueCas;
  essai: boolean;
  /** Montant d'avance (centimes) ; absent (cas du stock hors de la page) : la feuille l'estime à l'ouverture, bouton inactif d'ici là. */
  montantInitial?: number;
  /** Refus avant le prix pour le choix par défaut (X7) ; absent : rien ne s'y oppose. */
  refusInitial?: string | null;
  voix?: EtatVoix;
  /** Où chaque mot est branché, comptes chargés en mot (X6) ; absent : rien n'est branché. */
  mots?: EtatMotsFeuille;
  onFermer: () => void;
  /** « Retirer ce cas » : après le retrait, ferme la feuille. Absent : le bouton n'est pas montré. */
  onRetire?: () => void;
  /** Montant (centimes) pour ce choix, et le refus avant le prix (X7) ; `null` : l'estimation a échoué. */
  estimer: (choix: ChoixVideo) => Promise<EstimationFeuille | null>;
  /** Lot L3 : « Choisir un autre sujet » ouvre l'autre cas. */
  onAutreCas?: (casId: string) => void;
  /** Envoie l'accord ; rend `{ centimes }` si le serveur demande un autre montant, sinon la phrase d'un refus. */
  onFabriquer: (choix: ChoixVideo, accord: number) => Promise<{ centimes: number } | { phrase: string; dejaTraite?: DejaTraiteCas } | void>;
  onValider: () => void;
  /** Cas avec un script validé : ouvre la relecture avec ce choix et ce montant (le lancement part de là). */
  onRelire?: (choix: ChoixVideo, montant: number) => void;
  /** Porte B : « Confirmer » ou « Retirer » un chiffre à confirmer. */
  onFait?: (faitId: string, decision: "confirmer" | "retirer") => void;
  occupe?: boolean;
}) {
  const [reseaux, setReseaux] = useState<string[]>(RESEAUX_ECRAN.map((r) => r.valeur));
  const [mot, setMot] = useState(cas.mot);
  // Éteint par défaut (X4) : le mot n'est dit que là où le cadeau est réellement envoyé.
  const [avecMot, setAvecMot] = useState(false);
  const [nouveauScriptVoulu, setNouveauScript] = useState(false);
  /** Lot L3 : cas déjà traité (annoncé par l'estimation) et choix de Will ; « Nouvel angle » allume « Nouveau script ». */
  const [dejaTraite, setDejaTraite] = useState<DejaTraiteCas | undefined>();
  const [avertissement, setAvertissement] = useState<AvertissementSujet | undefined>();
  const [choixSujet, setChoixSujet] = useState<ChoixSujet | undefined>();
  const nouveauScript = nouveauScriptPourEstimation(nouveauScriptVoulu, choixSujet);
  /** « Nouvel angle » et l'interrupteur « Nouveau script » sont synchronisés. */
  function changerNouveauScript(v: boolean) {
    setNouveauScript(v);
    setChoixSujet((c) => choixApresInterrupteur(v, c, dejaTraite));
  }
  function choisirSujet(c: ChoixSujet) {
    setChoixSujet(c);
    if (c.choix === "nouvel-angle") setNouveauScript(true);
  }
  function changerChoixSujet() {
    if (choixSujet?.choix === "nouvel-angle") setNouveauScript(false);
    setChoixSujet(undefined);
  }
  const [montant, setMontant] = useState<number | null>(montantInitial ?? null);
  const [refus, setRefus] = useState<string | null>(null);
  const [blocage, setBlocage] = useState<string | null>(refusInitial ?? null);
  const premiere = useRef(true);
  /** Le prix de cette feuille est connu (montant d'avance, ou estimation revenue) : une estimation plus ancienne ne le remplace pas. */
  const prixRecu = useRef(montantInitial !== undefined);

  useEffect(() => {
    if (premiere.current) {
      premiere.current = false;
      return;
    }
    let courant = true;
    void estimer({ reseaux, mot, avecMot, ...(nouveauScript ? { nouveauScript } : {}), ...(choixSujet ? { sujet: sujetAEnvoyer(choixSujet) } : {}) }).then((e) => {
      if (!courant || !e) return;
      prixRecu.current = true;
      setMontant(e.centimes);
      setBlocage(e.refus ?? null);
      setDejaTraite(e.dejaTraite);
      setAvertissement(e.avertissement);
      // Une estimation qui annonce encore le sujet (jeton périmé) : le choix tombe, Will choisit de nouveau.
      setChoixSujet((c) => choixApresEstimation(c, e.dejaTraite));
    });
    return () => {
      courant = false;
    };
  }, [reseaux, avecMot, mot, nouveauScript, choixSujet, estimer]);

  // Lot L3 : à l'ouverture, une seule estimation pour savoir si le cas est déjà traité (avant tout prix confirmé).
  useEffect(() => {
    let courant = true;
    void estimer({ reseaux, mot, avecMot }).then((e) => {
      if (!courant) return;
      if (!e) {
        if (!prixRecu.current) setBlocage(PHRASE_PRIX_INTROUVABLE);
        return;
      }
      // Sans montant d'avance : le prix et le refus viennent de cette estimation (comme au changement de réseau ou de mot).
      if (!prixRecu.current) {
        prixRecu.current = true;
        setMontant(e.centimes);
        setBlocage(e.refus ?? null);
      }
      setDejaTraite(e.dejaTraite);
      setAvertissement(e.avertissement);
    });
    return () => {
      courant = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- seulement à l'ouverture de la feuille
  }, []);

  async function fabriquer(accord: number) {
    setRefus(null);
    const r = await onFabriquer({ reseaux, mot, avecMot, ...(nouveauScript ? { nouveauScript } : {}), ...(choixSujet ? { sujet: sujetAEnvoyer(choixSujet) } : {}) }, accord);
    if (r && "phrase" in r) {
      setRefus(r.phrase);
      // Le serveur a répondu « déjà traité » (jeton périmé, ou cas traité depuis un autre onglet) : les trois choix reviennent.
      if (r.dejaTraite) {
        setDejaTraite(r.dejaTraite);
        setChoixSujet(undefined);
      }
      return;
    }
    return r ?? undefined;
  }

  return (
    <FeuilleBas
      ouverte
      onOuverteChange={(v) => !v && onFermer()}
      titre="Votre vidéo"
      description={cas.promesse}
      pied={
        <PiedVotreVideo
          montant={montant}
          refus={refus}
          blocage={blocage}
          desactive={!reseaux.length}
          voix={voix}
          onFabriquer={fabriquer}
          sujetEnAttente={!peutFabriquer(dejaTraite, choixSujet)}
          {...(cas.script && onRelire && !nouveauScript ? { onRelire: () => onRelire({ reseaux, mot, avecMot, ...(choixSujet ? { sujet: sujetAEnvoyer(choixSujet) } : {}) }, montant ?? 0) } : {})}
        />
      }
    >
      {dejaTraite && !choixSujet && <PanneauSujetDejaTraite dejaTraite={dejaTraite} onChoisir={choisirSujet} {...(onAutreCas ? { onAutreCas } : {})} />}
      {choixSujet && (
        <p role="status" className="flex flex-wrap items-center gap-2 px-1 text-[15px] text-texte-doux">
          {choixSujet.choix === "nouvel-angle" ? "Nouvel angle : un nouveau script sera écrit." : "Vous refaites ce cas quand même."}
          <Bouton variante="fantome" onClick={changerChoixSujet}>
            Changer
          </Bouton>
        </p>
      )}
      {avertissement && (
        <p role="status" className="px-1 text-[15px] text-texte-doux">
          Ce sujet existe déjà dans un autre type de vidéo : {avertissement.precedents.slice(0, 3).map((p) => p.titre).join(" · ")}.
        </p>
      )}
      <ContenuVotreVideo cas={cas} essai={essai} reseaux={reseaux} onReseaux={setReseaux} mot={mot} onMot={setMot} avecMot={avecMot} onAvecMot={setAvecMot} nouveauScript={nouveauScript} onNouveauScript={changerNouveauScript} mots={mots} onValider={onValider} onFait={onFait} occupe={occupe} {...(onRetire ? { onRetire } : {})} />
    </FeuilleBas>
  );
}

/** Le bas de la feuille : un refus en une phrase (ou pourquoi le bouton est inactif), puis le bouton commun avec le montant. */
export function PiedVotreVideo({
  montant,
  refus,
  blocage = null,
  desactive,
  voix,
  onFabriquer,
  onRelire,
  sujetEnAttente = false,
}: {
  /** Lot L3 : cas déjà traité, choix pas encore fait : les boutons attendent (les trois choix sont affichés au-dessus). */
  sujetEnAttente?: boolean;
  /** `null` : le prix n'est pas encore revenu, le bouton reste inactif et aucun montant n'est affiché. */
  montant: number | null;
  refus: string | null;
  /** X7 : refus connu avant le prix (même phrase que le lancement) ; le bouton est alors inactif. */
  blocage?: string | null;
  desactive: boolean;
  voix?: EtatVoix;
  onFabriquer: (accord: number) => Promise<{ centimes: number } | void>;
  /** Script validé : le bouton ouvre la relecture (le prix est confirmé là, au lancement). */
  onRelire?: () => void;
}) {
  // La voix pas prête a sa consigne avec le lien ; tout autre refus avant le prix s'affiche comme un refus.
  const sansVoix = voix?.prete === false || blocage === CONSIGNE_VOIX_CAS_CONCRET;
  const lienVoix = voix?.lien ?? "/personnages";
  const alerte = refus ?? (blocage && blocage !== CONSIGNE_VOIX_CAS_CONCRET ? blocage : null);
  return (
    <div className="space-y-2">
      {sansVoix && !alerte && (
        <p role="status" className="rounded-2xl border border-brique/40 bg-brique-doux px-4 py-3 text-[15px] text-texte">
          {CONSIGNE_VOIX_CAS_CONCRET}{" "}
          <Link href={lienVoix} className="font-semibold underline underline-offset-2">
            Ouvrir mes voix
          </Link>
        </p>
      )}
      {alerte && (
        <p role="alert" className="rounded-2xl border border-brique/40 bg-brique-doux px-4 py-3 text-[15px] text-texte">
          {alerte}
        </p>
      )}
      {desactive && !alerte && <p className="px-1 text-[15px] text-texte-doux">Choisissez au moins un réseau.</p>}
      {onRelire ? (
        <Bouton icone="oeil" taille="lg" pleineLargeur disabled={desactive || sansVoix || !!blocage || sujetEnAttente || montant === null} onClick={onRelire}>
          Relire le script, puis lancer
        </Bouton>
      ) : montant === null ? (
        <Bouton taille="lg" pleineLargeur disabled>
          Calcul du prix…
        </Bouton>
      ) : (
        <BoutonFabriquer montantCentimes={montant} desactive={desactive || sansVoix || !!blocage || sujetEnAttente} onFabriquer={onFabriquer} />
      )}
    </div>
  );
}

/** Le corps de la feuille : étapes, chiffres et leur source, réseaux, mot à commenter. */
export function ContenuVotreVideo({
  cas,
  essai,
  reseaux,
  onReseaux,
  mot,
  onMot,
  avecMot,
  onAvecMot,
  nouveauScript = false,
  onNouveauScript,
  mots,
  onValider,
  onFait,
  occupe = false,
  onRetire,
}: {
  cas: VueCas;
  essai: boolean;
  reseaux: string[];
  onReseaux: (v: string[]) => void;
  mot: string;
  onMot: (v: string) => void;
  avecMot: boolean;
  onAvecMot: (v: boolean) => void;
  /** LOT F : visible seulement pour un cas qui a un script validé (et si l'écran fournit le geste). */
  nouveauScript?: boolean;
  onNouveauScript?: (v: boolean) => void;
  mots?: EtatMotsFeuille;
  onValider: () => void;
  onFait?: (faitId: string, decision: "confirmer" | "retirer") => void;
  occupe?: boolean;
  /** Montre « Retirer ce cas » (jamais en porte B) ; appelé après le retrait. */
  onRetire?: () => void;
}) {
  const aConfirmer = new Set(cas.porteB?.aConfirmer.map((f) => f.id) ?? []);
  // X6 : le mot n'est dit que sur les comptes cochés où il est branché ; sans aucun, l'option est grisée.
  const branches = mots?.branches[motNormalise(mot)] ?? [];
  const surReseaux = RESEAUX_ECRAN.filter((r) => reseaux.includes(r.valeur) && branches.includes(r.valeur));
  const disponible = surReseaux.length > 0;
  const charges = surReseaux.filter((r) => mots?.charges.includes(r.valeur));
  return (
    <div className="space-y-6">
      {essai && <p className="text-sm text-texte-doux">Essai : cas à confirmer par Will, ne pas publier.</p>}
      {cas.porteB && (
        <section aria-label="L'offre" className="space-y-2">
          <Pastille ton="ambre" taille="md">
            {MENTION_EXEMPLE}
          </Pastille>
          <ul className="flex flex-wrap gap-2">
            {OFFRES_PASTILLES.filter((o) => o.valeur !== "tous").map((o) => (
              <li key={o.valeur} aria-current={o.valeur === cas.offre ? "true" : undefined}>
                <Pastille ton={o.valeur === cas.offre ? "orange" : "neutre"} taille="md">
                  {o.libelle}
                </Pastille>
              </li>
            ))}
          </ul>
        </section>
      )}
      {cas.recit && (
        <section aria-label="Le récit de la vidéo" className="space-y-2">
          <div>
            <h3 className="text-sm font-semibold text-texte-doux">De quoi parle la vidéo</h3>
            <p className="text-[15px] text-texte">{cas.recit.sujet}</p>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-texte-doux">La scène</h3>
            <p className="text-[15px] text-texte">{cas.recit.scene}</p>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-texte-doux">L&apos;exemple suivi</h3>
            <p className="text-[15px] text-texte">{cas.recit.exemple}</p>
          </div>
          {/* Un script validé à jour est rejoué sans écriture payée : la phrase ne vaut que sans lui, ou avec « Nouveau script ». */}
          {(!cas.script || nouveauScript) && <p className="text-sm text-texte-doux">{PHRASE_TEXTE_ECRIT_AU_LANCEMENT}</p>}
        </section>
      )}
      <section aria-label="Les étapes">
        <h3 className="mb-1 text-sm font-semibold text-texte-doux">Les étapes</h3>
        <ol className="list-decimal space-y-1 pl-5 text-[15px] text-texte">
          {cas.etapes.map((e, i) => (
            <li key={e}>
              {e}
              {/* P2C : écran derrière une connexion, Will dépose l'image (réglage `casConcret.ecranFourni` ; cas du catalogue seulement). */}
              {!cas.porteB && cas.ecransAFournir?.includes(i + 1) && (
                <>
                  {" · "}
                  <Link href={`/cas-concret/ecran-fourni/${cas.id}`} className="font-semibold underline underline-offset-2">
                    Fournir cet écran
                  </Link>
                </>
              )}
            </li>
          ))}
        </ol>
      </section>
      {/* Nouveau script : le script validé n'est pas utilisé pour cette vidéo, il n'est donc pas montré. */}
      {cas.script && !nouveauScript && (
        <section aria-label="Le script validé">
          <h3 className="mb-1 text-sm font-semibold text-texte-doux">Le script validé, dit mot pour mot</h3>
          <p className="mb-2 text-sm text-texte-faible">Vous le relirez, et pourrez le modifier, avant le lancement.</p>
          <ScriptEcrans ecrans={cas.script} />
        </section>
      )}
      {cas.script && onNouveauScript && (
        <section aria-label="Nouveau script">
          <Interrupteur libelle={LIBELLE_NOUVEAU_SCRIPT} detail={PHRASE_NOUVEAU_SCRIPT} coche={nouveauScript} onChange={onNouveauScript} />
        </section>
      )}
      {cas.faits.length > 0 && (
        <section aria-label="Les chiffres">
          <h3 className="mb-1 text-sm font-semibold text-texte-doux">Les chiffres</h3>
          <ul className="space-y-1 text-[15px] text-texte">
            {cas.faits.map((f) => (
              <li key={f.id} className="space-y-2">
                <p>
                  {f.phrase} <span className="text-texte-faible">({f.source})</span> {aConfirmer.has(f.id) && <Pastille ton="ambre">à confirmer</Pastille>}
                </p>
                {aConfirmer.has(f.id) && onFait && (
                  <div className="flex flex-wrap gap-2">
                    <Bouton variante="secondaire" disabled={occupe} onClick={() => onFait(f.id, "confirmer")} aria-label={`Confirmer : ${f.phrase}`}>
                      Confirmer
                    </Bouton>
                    <Bouton variante="secondaire" disabled={occupe} onClick={() => onFait(f.id, "retirer")} aria-label={`Retirer : ${f.phrase}`}>
                      Retirer
                    </Bouton>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
      {cas.porteB && (
        <section aria-label="Ce qui manque">
          <h3 className="mb-1 text-sm font-semibold text-texte-doux">Ce qui manque</h3>
          <p className="text-[15px] text-texte">
            {aConfirmer.size ? (aConfirmer.size === 1 ? "Un chiffre à confirmer : confirmez-le ou retirez-le." : `${aConfirmer.size} chiffres à confirmer : confirmez-les ou retirez-les.`) : cas.faits.length ? "Rien : chaque chiffre vient de votre texte." : "Aucun chiffre : la vidéo n'en dira aucun."}
          </p>
        </section>
      )}
      <ChoixReseaux reseaux={RESEAUX_ECRAN} valeurs={reseaux} onChange={onReseaux} />
      <section aria-label="Le mot à commenter" className="space-y-2">
        {/* Toujours modifiable (X6) : l'option dépend du mot écrit, branché ou non sur les réseaux cochés. */}
        <Champ libelle="Le mot à commenter" value={mot} maxLength={24} onChange={(e) => onMot(e.target.value.replace(/\s/g, ""))} />
        <Interrupteur libelle="Avec le mot" detail={disponible ? PHRASE_AVEC_MOT : PHRASE_MOT_INDISPONIBLE} coche={avecMot && disponible} desactive={!disponible} onChange={onAvecMot} />
        {avecMot && disponible && <p className="px-1 text-[15px] text-texte-doux">Le mot sera dit sur {listeReseaux(surReseaux.map((r) => r.libelle))}.</p>}
        {avecMot &&
          charges.map((r) => (
            <p key={r.valeur} role="status" className="rounded-2xl border border-brique/40 bg-brique-doux px-4 py-3 text-[15px] text-texte">
              {r.libelle} : {PHRASE_MOT_TROP_FREQUENT}
            </p>
          ))}
      </section>
      {!cas.valide && !essai && !cas.porteB && (
        <Bouton variante="secondaire" onClick={onValider}>
          Je valide ce cas
        </Bouton>
      )}
      {onRetire && !cas.porteB && <BoutonRetirerCas casId={cas.id} titre={cas.titre} onRetire={onRetire} />}
    </div>
  );
}
