"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { createContext, useContext, useEffect, useState, useTransition } from "react";
import {
  ajouterDeclinaisonAction,
  archiverSujetAction,
  enregistrerOrdrePublicationAction,
  garderEnIdeeAction,
  regenererVarianteAction,
  rejeterVersionAction,
  reprendreEcritureArreteeAction,
  restaurerSujetAction,
  resumeDepenseAction,
  validerLimiteAction,
  validerVersionsAction,
  versionAvantAction,
} from "@/app/(studio)/ecrire/sujets/actions";
import { cocherVerificationAction, programmerSujetAction, verificationsAvantProgrammerAction } from "@/app/(studio)/mesures/actions";
import type { VerificationsVersion } from "@/services/publications";
import { BarreActionCollee } from "@/components/ui/BarreActionCollee";
import { BoutonCopier } from "@/components/ui/BoutonCopier";
import { Bouton } from "@/components/ui/Bouton";
import { Carte } from "@/components/ui/Carte";
import { FeuilleBas } from "@/components/ui/FeuilleBas";
import { Icone, type NomIcone } from "@/components/ui/Icone";
import { LogoReseau } from "@/components/ui/LogoReseau";
import { PastilleEssai } from "@/components/ui/PastilleEssai";
import { notifier } from "@/components/ui/Toast";
import { deplacerDansOrdre, planifierPublications } from "@/domaine/classement-generateur";
import { MOTIFS_REFUS } from "@/domaine/libelles";
import type { ModeDiction, ModeEnvoiPublication, ReseauDeclinaison } from "@/domaine/types";
import { lienRetourAvecVersion } from "@/domaine/retour-video";
import { cn } from "@/lib/cn";
import { obtenirReseau } from "@/reseaux";
import { RESEAUX_DECLINAISON } from "@/reseaux/codes";
import type { LigneGrilleAffichee } from "./donnees";
import { BoutonVideoHeygen } from "./VideoHeygen";
import { BoutonMonterPrise, BoutonSecondeOuverture, CarteFabriquerLesN, EtatFabricationVersion, type EtatFabricationAffiche, type PlanFabricationAffiche } from "./FabricationReseaux";
import { MiniGrille } from "./MiniGrille";
import { MatieresSansAccord, SaisieMatiereSujet, type MatiereSansAccord } from "./SaisieMatiereSujet";
import { avecConfirmationPrix } from "@/components/ui/ConfirmationPrix";
import { formateurDate } from "@/lib/intl";

export interface VersionAffichee {
  id: string;
  /** CORRECTEUR FINAL A : format de la version (le prix dit « Essai » quand ce format partira au moteur d'essai). */
  formatId?: string;
  code: string;
  reseau: ReseauDeclinaison;
  ligne: string;
  lettres?: string;
  accroche: string;
  texte: string;
  dureeSec: number;
  etatCase: string;
  etat: string;
  souci: string | null;
  note: number;
  version: number;
  aUneVersionAvant: boolean;
  videoId?: string;
  gardeFous: string[];
  /** Lot G7a (B.5.5) : lien suivi de la version. */
  lienSuivi?: string;
  /* Lot G4 */
  prompteur?: string;
  trame?: { reperes: string[]; chiffres: string[]; verbatim: { accroche: string; appel: string }; casesWill: { avis?: { texte: string }; limite: { texte: string } } };
  /** Avis des juges (indicatifs avant le calibrage G5). */
  juges?: { id: string; oui: boolean }[];
  /* Lot G6 / G6b */
  fabrication?: EtatFabricationAffiche;
  /** Prix de la 2e ouverture Reels, si elle est possible. */
  secondeOuverture?: string;
  /** Lot R7e : « Votre avatar parle dans cette vidéo : environ … », si la 2e ouverture le fait parler. */
  avatarParleSecondeOuverture?: string;
  /** « Je lis » : la prise est rangée, prête à être montée. */
  aMonter?: boolean;
  /** Prix du montage de la prise (service de l'argent) et pastille ESSAI. */
  prixMonter?: string;
  essaiMonter?: boolean;
  /* Vérification E2E n° 1 (03/10) */
  /** Voyant « Corps court » (C12) : « Plus court » n'est pas proposé. */
  corpsCourt?: boolean;
  /** Retouches payantes restantes sur cette version (plafond visible). */
  retouchesRestantes?: number;
  /** Phrases de la version (corrigeables à la main, gratuit). */
  phrases?: { id: string; texte: string }[];
  /** « Programmée : dim. 4 oct. 9 h » (essai compris, marqué). */
  programmee?: string;
  /** Prix de la fabrication de cette version (feuille « Fabriquer »). */
  /** Lot R7e : `avatarParle` = phrase à montrer si l'avatar (payant) parle dans cette vidéo. */
  prixFabrication?: { centimes: number; texte: string; avatarParle?: string };
}

/** « Programmer les N » (lot G7a, B.5.5) : versions retenues et créneaux J à J+4. */
export interface ProgrammationAffichee {
  formatNom?: string;
  creneaux: { code: string; reseau: ReseauDeclinaison; jour: string; heure?: string; heureParDefaut: boolean; decaleWeekEnd: boolean; rang: number }[];
  autresFormats: number;
  envoiSimule: boolean;
  /** Lot R1 : envoi réel en brouillon dans Buffer (défaut) ou programmé directement. */
  modeBuffer?: ModeEnvoiPublication;
}

/**
 * Prix annoncés (G4, B.3.4 n° 8) : la réserve maximale tant que le p90 n'est pas mesuré en production, CALCULÉE par le
 * service (plafond × taux du réglage ; correcteur 3, B11). Une retouche réserve le plafond d'un supplément.
 * Le même contexte dit si l'écriture est un essai (B9) et où revenir à la vidéo (B1).
 */
interface ContexteFiche {
  prix: { supplement: string; adresse: string; retouche: string } | null;
  ecritureSimulee: boolean;
  retourVideo?: string;
}
const Fiche = createContext<ContexteFiche>({ prix: null, ecritureSimulee: true });
const auPlus = (prix: string | undefined) => (prix ? `au plus ${prix}` : "prix calculé au lancement");

function duree(sec: number): string {
  return `${Math.floor(sec / 60)}:${String(Math.round(sec % 60)).padStart(2, "0")}`;
}

type Motif = keyof typeof MOTIFS_REFUS;

/**
 * Fiche sujet (B.6.7, maquette « Résultat » validée) : grille, onglets réseaux, une ligne par version (logo, accroche,
 * durée, voyant), limite proposée, ajouts avec leur prix, « Détails » replié, valider, ordre de publication.
 * L'étiquette IA n'apparaît JAMAIS parmi les points ambre.
 */
export function FicheSujet(p: {
  id: string;
  numero?: number;
  idee: string;
  etat: string;
  archive: boolean;
  manque: { libelle: string; ceQuIlFaudrait: string; horsDomaine?: boolean } | null;
  limite: { texte: string; validee: boolean } | null;
  lignes: LigneGrilleAffichee[];
  versions: VersionAffichee[];
  reseauActif: ReseauDeclinaison | null;
  reseauxSujet: ReseauDeclinaison[];
  ajouts: { formatId: string; jeLis: boolean; tu: boolean; autresFormats: { id: string; nom: string; icone: NomIcone; moteurAVenir: boolean; modeParDefaut: ModeDiction }[] };
  ordre: ReseauDeclinaison[];
  /** Jour J des feuilles « Ordre » et « Programmer » (le même pour les deux). */
  jourJ?: string;
  heures: Partial<Record<ReseauDeclinaison, string>>;
  aDesVideos: boolean;
  programmation?: ProgrammationAffichee;
  /** Version dépliée à l'arrivée (lien direct vers une version). */
  versionOuverteInitiale?: string;
  /** Ouvre la feuille « Programmer » à l'arrivée (depuis la feuille Buffer). */
  ouvrirProgrammation?: boolean;
  /** Lot G6 : « Fabriquer les N » (versions validées sans vidéo). */
  fabricationN?: PlanFabricationAffiche | null;
  /** E2E-2 argent n° 2 : un ajout arrêté sur une panne (raison en mots simples), à reprendre d'un toucher. */
  arret?: string | null;
  /** Relecture finale G1 : supplément possible de la reprise (mis en forme), confirmé sur la feuille de prix. */
  arretSupplement?: string | null;
  /** Prix au plus des ajouts, calculés par le service (E2E-2 parcours n° 8 : « + Tu » réécrit aussi ses accroches). */
  prixAjouts?: { supplement: string; adresse: string; retouche: string };
  /** Claude n'est pas relié : l'écriture est un essai, « rien n'est payé » (B9). */
  ecritureSimulee?: boolean;
  /** Sujet ouvert depuis « Nouvelle vidéo » (B1) : « Utiliser dans ma vidéo » sur chaque version. */
  retourVideo?: string;
  /** E2E-2 données n° 4 : matières de ce sujet qui attendent un accord (elles ne sont pas citées sans lui). */
  sansAccord?: MatiereSansAccord[];
}) {
  const router = useRouter();
  const [enCours, demarrer] = useTransition();
  const [ouverte, setOuverte] = useState<string | null>(p.versionOuverteInitiale ?? null);
  const [laisses, setLaisses] = useState<string[]>([]);
  const [feuille, setFeuille] = useState<"format" | "ordre" | "programmer" | null>(p.ouvrirProgrammation && !!p.programmation?.creneaux.length ? "programmer" : null);
  // Navigation (03/10) : pendant une fabrication, la fiche se met à jour seule (comme pendant l'écriture), sans recharger.
  const fabricationEnCours = p.versions.some((v) => enFabrication(v.fabrication));
  useEffect(() => {
    if (!fabricationEnCours) return;
    const t = setInterval(() => router.refresh(), 5000);
    return () => clearInterval(t);
  }, [fabricationEnCours, router]);

  const contexte: ContexteFiche = { prix: p.prixAjouts ?? null, ecritureSimulee: p.ecritureSimulee ?? true, retourVideo: p.retourVideo };
  if (p.numero === undefined)
    return (
      <Fiche.Provider value={contexte}>
        <CarteManque id={p.id} idee={p.idee} manque={p.manque} sansAccord={p.sansAccord ?? []} />
      </Fiche.Provider>
    );


  const visibles = p.versions.filter((v) => !p.reseauActif || v.reseau === p.reseauActif);
  const limiteEnAttente = !!p.limite && !p.limite.validee;
  // Limite à valider : « Valider les N » reste visible, verrouillé (les versions « à compléter » faute de limite comptent).
  const aValider = p.versions.filter((v) => v.etat === "a-relire" || v.etat === "a-reverifier" || (limiteEnAttente && v.etat === "a-completer"));
  const lignes = [...new Set(visibles.map((v) => v.ligne))];

  function lancer(f: () => Promise<{ ok: boolean; message?: string }>, succes?: string) {
    demarrer(async () => {
      const r = await f();
      if (!r.ok) {
        notifier.erreur(r.message ?? "Impossible pour l'instant.");
        return;
      }
      if (succes) notifier.succes(succes);
      router.refresh();
    });
  }

  function ajouter(options: Parameters<typeof ajouterDeclinaisonAction>[1], libelle: string) {
    demarrer(async () => {
      const r = await ajouterDeclinaisonAction(p.id, { reseaux: p.reseauxSujet, ...options });
      if (!r.ok) {
        notifier.erreur(r.message);
        return;
      }
      if (!r.donnees.ecrit) notifier.erreur(r.donnees.message ?? "Il manque une matière.");
      // L'écriture se fait ensuite dans la boucle : rien n'est « écrit » à ce moment (vérification E2E n° 1, problème n° 1).
      else if (contexte.ecritureSimulee) notifier.essai(`${libelle} : écriture lancée, rien n'est payé`);
      else notifier.succes(`${libelle} : écriture lancée`);
      setFeuille(null);
      router.refresh();
    });
  }

  return (
    <Fiche.Provider value={contexte}>
    <div className="space-y-4">
      {p.archive && (
        <div className="flex min-h-12 items-center justify-between gap-3 rounded-carte border border-trait bg-surface-2 px-4 text-sm text-texte-doux">
          Sujet archivé
          <Bouton variante="contour" chargement={enCours} onClick={() => lancer(() => restaurerSujetAction(p.id), "Sujet restauré")}>
            Restaurer
          </Bouton>
        </div>
      )}

      {/* Un ajout (« Je lis », « Tu », autre format) arrêté APRÈS la numérotation : l'arrêt est montré, avec ce qu'il faut. */}
      {p.manque && !p.archive && <CarteArretAjout id={p.id} manque={p.manque} sansAccord={p.sansAccord ?? []} />}
      {p.arret && !p.archive && <CartePanneAjout id={p.id} message={p.arret} supplement={p.arretSupplement ?? undefined} />}

      {/* La grille, puis les onglets réseaux */}
      <Carte>
        <MiniGrille lignes={p.lignes} reseauActif={p.reseauActif} />
      </Carte>
      <nav aria-label="Réseau" className="flex items-center justify-between gap-1">
        <Link
          href={`/ecrire/sujets/${p.id}`}
          scroll={false}
          aria-current={!p.reseauActif ? "page" : undefined}
          className={cn("grid min-h-11 place-items-center rounded-full px-3 text-sm font-semibold", !p.reseauActif ? "bg-surface-2 text-texte" : "text-texte-doux")}
        >
          Tout
        </Link>
        {RESEAUX_DECLINAISON.map((r) => {
          const actif = p.reseauActif === r;
          return (
            <Link key={r} href={`/ecrire/sujets/${p.id}?reseau=${r}`} scroll={false} aria-current={actif ? "page" : undefined} className={cn("grid size-11 place-items-center rounded-xl", actif && "bg-orange-doux ring-2 ring-orange")}>
              <LogoReseau reseau={r} className={cn(actif && "border-orange text-orange-vif")} />
            </Link>
          );
        })}
      </nav>

      {/* Limite proposée par la machine : à valider d'un toucher */}
      {p.limite &&
        (limiteEnAttente ? (
          <Carte className="border-ambre/50">
            <p className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-ambre">
              <Icone nom="attention" size={14} />
              Limite proposée
            </p>
            <p className="mb-4 text-[17px] font-semibold leading-snug text-texte">{p.limite.texte}</p>
            <div className="flex gap-2 [&>*:last-child]:flex-1">
              <Bouton variante="secondaire" icone="coche" chargement={enCours} onClick={() => lancer(() => validerLimiteAction(p.id))}>
                C&apos;est juste
              </Bouton>
              <BoutonCorrigerLimite onCorriger={(t) => lancer(() => validerLimiteAction(p.id, t), "Limite corrigée")} />
            </div>
          </Carte>
        ) : (
          <div className="flex min-h-11 items-center gap-2 rounded-full bg-sauge-doux px-4 text-sm font-semibold text-sauge">
            <Icone nom="coche" size={16} />
            Limite validée
          </div>
        ))}

      {/* E2E-2 parcours n° 14 : une prise filmée et rangée se monte d'ici, sans déplier la version. */}
      {!p.archive && p.versions.some((v) => v.aMonter) && (
        <Carte className="border-sauge/40" role="status">
          <p className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-sauge">
            <Icone nom="camera" size={14} />
            {p.versions.filter((v) => v.aMonter).length > 1 ? "Vos prises sont prêtes" : "Votre prise est prête"}
          </p>
          <ul className="space-y-2">
            {p.versions
              .filter((v) => v.aMonter)
              .map((v) => (
                <li key={v.id} className="flex flex-wrap items-center gap-3">
                  <LogoReseau reseau={v.reseau} lettres={v.lettres} />
                  {/* Vérif V3 : base de 7 rem — à 390 px, le bouton passe dessous au lieu d'écraser le code (« 000… »). */}
                  <span className="min-w-0 flex-1 basis-28 truncate font-mono text-xs text-texte-doux">{v.code}</span>
                  <BoutonMonterPrise sujetId={p.id} varianteId={v.id} prix={v.prixMonter} essai={v.essaiMonter} />
                </li>
              ))}
          </ul>
        </Carte>
      )}

      {/* Une ligne par version */}
      {lignes.map((ligne) => (
        <section key={ligne} aria-label={ligne}>
          {lignes.length > 1 || p.lignes.length > 1 ? <h2 className="mb-2 font-texte text-xs font-bold uppercase tracking-wider text-texte-faible">{ligne}</h2> : null}
          <Carte sansMarge>
            <ul className="divide-y divide-trait">
              {visibles
                .filter((v) => v.ligne === ligne)
                .map((v) => {
                  const ambre = !!v.souci && !laisses.includes(v.id);
                  const deplie = ouverte === v.id;
                  return (
                    <li key={v.id} className="p-4">
                      <button type="button" aria-expanded={deplie} onClick={() => setOuverte(deplie ? null : v.id)} className="flex w-full items-start gap-3 text-left">
                        <LogoReseau reseau={v.reseau} lettres={v.lettres} />
                        <span className="line-clamp-2 min-w-0 flex-1 text-[15px] font-semibold leading-snug text-texte">{v.accroche}</span>
                        <span className="flex shrink-0 flex-col items-end gap-2 pt-0.5">
                          <span className="text-sm tabular-nums text-texte-doux">{duree(v.dureeSec)}</span>
                          <span role="img" aria-label={ambre ? "à regarder" : "prête"} className={cn("size-2.5 rounded-full", ambre ? "bg-ambre shadow-[0_0_0_4px_var(--ambre-doux)]" : "bg-sauge")} />
                        </span>
                      </button>
                      {ambre && (
                        <div className="mt-3 pl-12">
                          <p className="mb-2 text-[13px] text-ambre">{v.souci}</p>
                          <div className="flex flex-wrap gap-2">
                            {/* E2E-2 parcours n° 32 : « Raccourcir » seulement quand le souci est une longueur (pas « même longueur »). */}
                            {v.etat !== "validee" && !v.corpsCourt && (v.retouchesRestantes ?? 1) > 0 && !limiteEnAttente && !!v.souci && /trop long|raccourc|dure /i.test(v.souci) && !/même longueur/i.test(v.souci) && (
                              <BoutonRetouche libelle="Raccourcir" icone="ciseaux" disabled={enCours} onClick={() => lancer(() => regenererVarianteAction(p.id, v.id, "plus-court"), "Nouvelle version")} />
                            )}
                            <button type="button" onClick={() => setLaisses((x) => [...x, v.id])} className="inline-flex min-h-11 items-center rounded-full px-3 text-sm font-semibold text-texte-doux hover:text-texte">
                              Laisser
                            </button>
                          </div>
                        </div>
                      )}
                      {v.programmee && (
                        <p className="mt-2 flex items-center gap-1.5 pl-12 text-[13px] font-semibold text-sauge">
                          <Icone nom="calendrier" size={13} />
                          {v.programmee}
                        </p>
                      )}
                      {/* Navigation (03/10) : la vidéo d'une version se voit et s'ouvre sans déplier la ligne. */}
                      {!deplie && v.videoId && <LienVideoVersion videoId={v.videoId} fabrication={v.fabrication} />}
                      {deplie && <DetailVersion v={v} sujetId={p.id} enCours={enCours} lancer={lancer} />}
                    </li>
                  );
                })}
            </ul>
          </Carte>
        </section>
      ))}

      {/* Lot G6 : « Fabriquer les N » (la plus longue d'abord, les autres reprennent son milieu) */}
      {!p.archive && p.fabricationN && !limiteEnAttente && <CarteFabriquerLesN sujetId={p.id} plan={p.fabricationN} />}

      {/* Ajouter une déclinaison : chaque bouton payant porte son prix */}
      {!p.archive && (p.ajouts.jeLis || p.ajouts.tu || p.ajouts.autresFormats.length > 0) && (
        <section aria-labelledby="titre-ajouter">
          <h2 id="titre-ajouter" className="mb-2 flex items-center gap-1.5 font-texte text-xs font-bold uppercase tracking-wider text-texte-faible">
            <Icone nom="plus" size={12} />
            Ajouter
            <PastilleEssai className="ml-auto" />
          </h2>
          <div className="flex flex-wrap gap-2">
            {p.ajouts.jeLis && <BoutonAjout icone="texte" libelle="Je lis" prix={auPlus(p.prixAjouts?.supplement)} disabled={enCours} onClick={() => ajouter({ formatId: p.ajouts.formatId, mode: "teleprompteur" }, "« Je lis »")} />}
            {p.ajouts.tu && <BoutonAjout icone="personne" libelle="Tu" prix={auPlus(p.prixAjouts?.adresse)} disabled={enCours} onClick={() => ajouter({ formatId: p.ajouts.formatId, adresse: "tu" }, "« Tu »")} />}
            {p.ajouts.autresFormats.length > 0 && <BoutonAjout icone="grille" libelle="Autre format" prix={auPlus(p.prixAjouts?.supplement)} disabled={enCours} onClick={() => setFeuille("format")} />}
            <Link href="/ecrire/matieres?ajout=matiere" className="inline-flex min-h-11 items-center gap-2 rounded-full border border-dashed border-trait-fort px-4 text-sm font-semibold text-texte-doux hover:text-texte">
              <Icone nom="micro" size={16} className="text-orange-vif" />
              Matière
              <span className="font-medium text-texte-faible">· 0 €</span>
            </Link>
          </div>
        </section>
      )}

      <details className="group rounded-carte border border-trait bg-surface-1 px-4">
        <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between text-sm font-semibold text-texte-doux">
          Détails
          <Icone nom="chevron-bas" size={16} className="transition-transform group-open:rotate-180" />
        </summary>
        <div className="space-y-5 pb-4">
          <ul className="space-y-2">
            {[...new Set(p.versions.flatMap((v) => v.gardeFous))].map((g) => (
              <li key={g} className="flex items-center gap-2 text-sm text-texte">
                <Icone nom="attention" size={14} className="text-ambre" />
                {g}
              </li>
            ))}
            {!p.versions.some((v) => v.gardeFous.length) && (
              <li className="flex items-center gap-2 text-sm text-texte">
                <Icone nom="coche" size={14} className="text-sauge" />
                Rien à signaler
              </li>
            )}
          </ul>
          <ul className="grid grid-cols-2 gap-x-4 gap-y-1.5">
            {p.versions.map((v) => (
              <li key={v.id} className="flex items-baseline justify-between gap-2 text-sm">
                <span className="truncate font-mono text-xs text-texte-faible">{v.code}</span>
                <span className="font-titre tabular-nums text-texte">{v.note > 0 ? v.note : "—"}</span>
              </li>
            ))}
          </ul>
          <div className="text-sm text-texte-doux">
            <p className="mb-1.5">
              <span className="font-semibold text-texte">Avis des juges</span> (indicatif)
            </p>
            {p.versions.some((v) => v.juges?.length) ? (
              <ul className="flex flex-wrap gap-1.5">
                {[...new Map(p.versions.flatMap((v) => v.juges ?? []).map((j) => [j.id, j])).values()].map((j) => (
                  <li key={j.id} className={cn("rounded-full px-2.5 py-1 font-mono text-xs", j.oui ? "bg-sauge-doux text-sauge" : "bg-ambre-doux text-ambre")}>
                    {j.id}
                  </li>
                ))}
              </ul>
            ) : (
              <p>pas encore.</p>
            )}
          </div>
        </div>
      </details>

      <div className="grid grid-cols-2 gap-2">
        <Bouton variante="secondaire" icone="calendrier" onClick={() => setFeuille("ordre")}>
          Ordre J à J+4
        </Bouton>
        {p.aDesVideos ? (
          <Bouton asChild variante="secondaire" icone="telecharger">
            <a href={`/api/telechargements?sujet=${p.id}`} download>
              Tout le sujet
            </a>
          </Bouton>
        ) : (
          <Bouton variante="secondaire" icone="telecharger" disabled>
            Tout le sujet
          </Bouton>
        )}
      </div>
      {!p.archive && (
        <button type="button" onClick={() => lancer(() => archiverSujetAction(p.id), "Sujet archivé")} className="mx-auto flex min-h-11 items-center gap-2 rounded-full px-4 text-sm font-semibold text-texte-faible hover:text-texte">
          <Icone nom="archive" size={15} />
          Archiver le sujet
        </button>
      )}

      {/* Placés AVANT la barre collée : sous elle, ils seraient cachés à l'écran (mobile). */}
      {aValider.length > 0 && limiteEnAttente && <p className="text-center text-xs text-ambre">Validez la limite ci-dessus.</p>}
      {aValider.length === 0 && !p.programmation?.creneaux.length && (
        <p className="text-center text-xs text-texte-faible">{p.versions.some((v) => v.programmee) ? "Tout est programmé." : "Rien à programmer pour l'instant."}</p>
      )}
      <BarreActionCollee>
        {aValider.length > 0 ? (
          <Bouton taille="lg" icone={limiteEnAttente ? "cadenas" : "coche"} disabled={limiteEnAttente || p.archive} chargement={enCours} onClick={() => lancer(() => validerVersionsAction(p.id, aValider.map((v) => v.id)), "Validé")}>
            Valider les {aValider.length}
          </Bouton>
        ) : p.programmation?.creneaux.length ? (
          <Bouton taille="lg" icone="calendrier" disabled={p.archive} essai={p.programmation.envoiSimule} onClick={() => setFeuille("programmer")}>
            {p.programmation.creneaux.length > 1 ? `Programmer les ${p.programmation.creneaux.length}` : "Programmer la version"}
          </Bouton>
        ) : (
          // Lot G7a : la mesure est branchée, « Programmer » est ouvert (versions qui ont leur vidéo, un format à la fois).
          <Bouton taille="lg" icone="calendrier" disabled>
            Programmer
          </Bouton>
        )}
      </BarreActionCollee>
      {p.programmation && p.programmation.creneaux.length > 0 && (
        <FeuilleProgrammer ouverte={feuille === "programmer"} onOuverteChange={(v) => setFeuille(v ? "programmer" : null)} sujetId={p.id} programmation={p.programmation} />
      )}

      <FeuilleBas ouverte={feuille === "format"} onOuverteChange={(v) => setFeuille(v ? "format" : null)} titre="Autre format">
        <ul className="space-y-2">
          {p.ajouts.autresFormats.map((f) => (
            <li key={f.id}>
              <button
                type="button"
                disabled={enCours}
                onClick={() => ajouter({ formatId: f.id, mode: f.modeParDefaut }, f.nom)}
                className="flex min-h-14 w-full items-center gap-3 rounded-champ border border-trait bg-surface-2 px-4 text-left hover:border-trait-fort"
              >
                <Icone nom={f.icone} size={18} className="text-orange-vif" />
                <span className="flex-1 font-semibold text-texte">{f.nom}</span>
                {f.moteurAVenir && <span className="text-xs text-texte-faible">moteur à venir</span>}
                <span className="text-sm tabular-nums text-texte-doux">{auPlus(p.prixAjouts?.supplement)}</span>
              </button>
            </li>
          ))}
        </ul>
      </FeuilleBas>
      <FeuilleOrdre ouverte={feuille === "ordre"} onOuverteChange={(v) => setFeuille(v ? "ordre" : null)} jourJ={p.jourJ} ordreInitial={p.ordre} heures={p.heures} reseaux={[...new Set(p.versions.map((v) => v.reseau))]} />
    </div>
    </Fiche.Provider>
  );
}

/** La vidéo est-elle encore en route (en file, en fabrication, ou en attente de sa mère ou du crédit) ? */
export function enFabrication(f: EtatFabricationAffiche | undefined): boolean {
  return !!f && (f.enCours || f.attendMere || !!f.attendCredit);
}

/** Ligne repliée d'une version : « Vidéo en fabrication » ou « Voir la vidéo », d'un toucher. */
function LienVideoVersion({ videoId, fabrication }: { videoId: string; fabrication?: EtatFabricationAffiche }) {
  const attend = enFabrication(fabrication);
  return (
    <Link
      href={`/videos/${videoId}`}
      className={cn("ml-12 mt-2 inline-flex min-h-11 items-center gap-1.5 text-[13px] font-semibold underline-offset-4 hover:underline", attend ? "text-texte-doux" : "text-orange-vif")}
    >
      <Icone nom={attend ? "horloge" : "film"} size={14} className={cn(attend && "animate-pulse")} />
      {attend ? "Vidéo en fabrication" : "Voir la vidéo"}
      <Icone nom="chevron-droite" size={14} />
    </Link>
  );
}

function BoutonAjout({ icone, libelle, prix, onClick, disabled }: { icone: NomIcone; libelle: string; prix: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="inline-flex min-h-11 items-center gap-2 rounded-full border border-trait bg-surface-1 px-4 text-sm font-semibold text-texte hover:border-trait-fort hover:bg-surface-2 disabled:opacity-50"
    >
      <Icone nom={icone} size={16} className="text-orange-vif" />
      {libelle}
      <span className="font-medium tabular-nums text-texte-faible">· {prix}</span>
    </button>
  );
}

function DetailVersion({ v, sujetId, enCours, lancer }: { v: VersionAffichee; sujetId: string; enCours: boolean; lancer: (f: () => Promise<{ ok: boolean; message?: string }>, succes?: string) => void }) {
  const [motifs, setMotifs] = useState<Motif[]>([]);
  const { retourVideo } = useContext(Fiche);
  const lienVideo = retourVideo ? lienRetourAvecVersion(retourVideo, v.id) : undefined;
  return (
    <div className="mt-3 space-y-3 pl-12">
      <p className="font-mono text-xs text-texte-faible">
        {v.code}
        {v.version > 1 && ` · version ${v.version}`}
      </p>
      <p className="whitespace-pre-line text-[15px] leading-relaxed text-texte">{v.texte}</p>
      {v.fabrication && <EtatFabricationVersion sujetId={sujetId} etat={v.fabrication} />}
      {v.prompteur && (
        <div className="rounded-champ bg-surface-2 p-3">
          <p className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-texte-faible">
            <Icone nom="lecture" size={12} />
            Je lis
          </p>
          <p className="whitespace-pre-line font-mono text-[13px] leading-relaxed text-texte">{v.prompteur}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {v.etat === "validee" && !v.videoId && (
              <Bouton asChild variante="secondaire" icone="camera">
                <Link href={`/ecrire/tournage?v=${v.id}`}>Filmer ici</Link>
              </Bouton>
            )}
            {/* Lot R7 : la vidéo faite avec le double dans l'application HeyGen, rattachée à cette version. */}
            {v.etat === "validee" && (!v.videoId || v.aMonter) && <BoutonVideoHeygen sujetId={sujetId} varianteId={v.id} code={v.code} />}
            {v.aMonter && <BoutonMonterPrise sujetId={sujetId} varianteId={v.id} prix={v.prixMonter} essai={v.essaiMonter} />}
            <Bouton asChild variante="secondaire" icone="appareils">
              <Link href={`/ecrire/sujets/${sujetId}/lire/${v.id}`}>Lire sur un autre appareil</Link>
            </Bouton>
          </div>
        </div>
      )}
      {v.trame && (
        <div className="space-y-2 rounded-champ bg-surface-2 p-3 text-sm">
          <p className="font-semibold text-texte">« {v.trame.verbatim.accroche} »</p>
          <ul className="flex flex-wrap gap-1.5">
            {v.trame.reperes.map((r) => (
              <li key={r} className="rounded-full bg-surface-1 px-3 py-1 text-texte">
                {r}
              </li>
            ))}
            {v.trame.chiffres.map((c) => (
              <li key={c} className="rounded-full border-2 border-orange px-3 py-1 font-bold text-orange-vif">
                {c}
              </li>
            ))}
          </ul>
          {v.trame.casesWill.avis && (
            <p className="text-texte-doux">
              <span className="font-bold text-texte">Votre avis · </span>
              {v.trame.casesWill.avis.texte}
            </p>
          )}
          <p className="text-texte-doux">
            <span className="font-bold text-texte">Votre limite · </span>
            {v.trame.casesWill.limite.texte}
          </p>
          {v.trame.verbatim.appel && <p className="font-semibold text-texte">« {v.trame.verbatim.appel} »</p>}
        </div>
      )}
      {v.lienSuivi && (
        <div className="flex min-h-11 items-center gap-2 rounded-champ bg-surface-2 pl-3">
          <Icone nom="lien" size={14} className="shrink-0 text-texte-faible" />
          <span className="min-w-0 flex-1 truncate font-mono text-xs text-texte-doux">{v.lienSuivi.replace(/^https:\/\//, "")}</span>
          <BoutonCopier texte={v.lienSuivi} compact />
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        {/* B1 : sujet écrit depuis « Nouvelle vidéo » : le texte de CETTE version revient dans la vidéo, mot pour mot. */}
        {lienVideo && v.etat !== "a-completer" && (
          <Bouton asChild icone="film">
            <Link href={lienVideo}>Utiliser dans ma vidéo</Link>
          </Bouton>
        )}
        {v.videoId && (
          <Bouton asChild variante="secondaire" icone="film">
            <Link href={`/videos/${v.videoId}`}>Vidéo</Link>
          </Bouton>
        )}
        {v.etat !== "validee" && (v.retouchesRestantes ?? 1) > 0 && (
          <>
            <BoutonRetouche libelle="Autre accroche" icone="repeter" disabled={enCours} onClick={() => lancer(() => regenererVarianteAction(sujetId, v.id, "autre-accroche"), "Nouvelle version")} />
            {!v.corpsCourt && <BoutonRetouche libelle="Plus court" icone="ciseaux" disabled={enCours} onClick={() => lancer(() => regenererVarianteAction(sujetId, v.id, "plus-court"), "Nouvelle version")} />}
            <BoutonRetouche libelle="Améliorer" icone="baguette" disabled={enCours} onClick={() => lancer(() => regenererVarianteAction(sujetId, v.id, "ameliorer"), "Nouvelle version")} />
          </>
        )}
        {/* Relire et modifier le script (0 €) : avant validation, et pour une version « je lis » pas encore filmée (téléprompteur). */}
        {(v.etat !== "validee" || (!!v.prompteur && !v.videoId)) && v.phrases && v.phrases.length > 0 && (
          <Link
            href={`/ecrire/sujets/${sujetId}/relire?version=${v.id}&but=modifier`}
            className="inline-flex min-h-11 items-center gap-2 rounded-full border border-trait px-3 text-sm font-semibold text-texte hover:border-trait-fort"
          >
            <Icone nom="ecrire" size={15} className="text-orange-vif" />
            Relire et modifier
            <span className="font-medium tabular-nums text-texte-faible">· 0 €</span>
          </Link>
        )}
        {/* Une version « je lis » se filme (« Filmer ici », « Monter ma prise ») : jamais de fabrication par le double. */}
        {v.etat === "validee" && !v.videoId && !v.prompteur && <BoutonFabriquer sujetId={sujetId} varianteId={v.id} formatId={v.formatId} prix={v.prixFabrication} />}
        {v.secondeOuverture && <BoutonSecondeOuverture sujetId={sujetId} varianteId={v.id} prix={v.secondeOuverture} avatarParle={v.avatarParleSecondeOuverture} />}
        {v.etat !== "validee" && v.retouchesRestantes !== undefined && (
          <p className="w-full text-xs text-texte-faible">
            {v.retouchesRestantes > 0
              ? `${v.retouchesRestantes} retouche${v.retouchesRestantes > 1 ? "s" : ""} payante${v.retouchesRestantes > 1 ? "s" : ""} possible${v.retouchesRestantes > 1 ? "s" : ""} sur cette version.`
              : "Plus de retouche payante sur cette version : relisez et modifiez le script à la main (0 €)."}
          </p>
        )}
        {v.aUneVersionAvant && (
          <Bouton variante="fantome" icone="repeter" disabled={enCours} onClick={() => lancer(() => versionAvantAction(sujetId, v.id), "Version d'avant reprise")}>
            Version d&apos;avant
          </Bouton>
        )}
      </div>
      {(v.etat === "a-relire" || v.etat === "validee") && (
        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-wider text-texte-faible">Pas comme ça ?</p>
          <div className="flex flex-wrap gap-1.5">
            {(Object.keys(MOTIFS_REFUS) as Motif[])
              .filter((m) => m !== "autre")
              .map((m) => (
                <button
                  key={m}
                  type="button"
                  aria-pressed={motifs.includes(m)}
                  onClick={() => setMotifs((x) => (x.includes(m) ? x.filter((y) => y !== m) : [...x, m]))}
                  className={cn("min-h-11 rounded-full border px-3 text-sm font-semibold", motifs.includes(m) ? "border-brique bg-brique-doux text-brique" : "border-trait text-texte-doux")}
                >
                  {MOTIFS_REFUS[m]}
                </button>
              ))}
          </div>
          {motifs.length > 0 && (
            <Bouton className="mt-2" variante="contour" disabled={enCours} onClick={() => lancer(() => rejeterVersionAction(sujetId, v.id, motifs), "C'est noté")}>
              Refuser cette version
            </Bouton>
          )}
        </div>
      )}
    </div>
  );
}

function BoutonRetouche({ libelle, icone, onClick, disabled }: { libelle: string; icone: NomIcone; onClick: () => void; disabled?: boolean }) {
  const { prix } = useContext(Fiche);
  return (
    <button type="button" disabled={disabled} onClick={onClick} className="inline-flex min-h-11 items-center gap-2 rounded-full border border-trait px-3 text-sm font-semibold text-texte hover:border-trait-fort disabled:opacity-50">
      <Icone nom={icone} size={15} className="text-orange-vif" />
      {libelle}
      <span className="font-medium tabular-nums text-texte-faible">· {auPlus(prix?.retouche)}</span>
    </button>
  );
}

/**
 * « Fabriquer » (intérim G4) : feuille du prix (B.6.6), puis « Relire le script » : la fabrication ne part JAMAIS sans
 * cette relecture (le serveur exige le repère « script relu ») ; l'écran de relecture lance après la confirmation du prix.
 */
function BoutonFabriquer({ sujetId, varianteId, formatId, prix }: { sujetId: string; varianteId: string; formatId?: string; prix?: { centimes: number; texte: string; avatarParle?: string } }) {
  const [ouverte, setOuverte] = useState(false);
  const [resume, setResume] = useState<ResumeDepense | null>(null);
  return (
    <>
      <Bouton
        variante="secondaire"
        icone="film"
        onClick={() => {
          setOuverte(true);
          // Vérification E2E n° 1, n° 3 : prix, total du jour et budget restant AVANT le toucher qui lance (lecture seule).
          if (prix) void resumeDepenseAction(prix.centimes, formatId ? [formatId] : undefined).then((r) => setResume(r.ok ? r.donnees : null));
        }}
      >
        Fabriquer
      </Bouton>
      <FeuilleBas ouverte={ouverte} onOuverteChange={setOuverte} titre="Fabriquer cette version">
        <p className="mb-4 text-[15px] text-texte-doux">
          {resume?.essai ? "Une vidéo d'essai : rien n'est payé, et ce n'est pas encore votre vraie vidéo." : "La vidéo complète, avec votre double et votre voix. Le coût réel s'affiche ensuite sur la vidéo."}
        </p>
        <dl className="mb-4 space-y-1.5 rounded-champ bg-surface-2 p-3 text-sm">
          <div className="flex items-center justify-between gap-2">
            <dt className="text-texte-doux">Prix</dt>
            <dd className="flex items-center gap-2 font-semibold tabular-nums text-texte">
              {resume?.prix ?? prix?.texte ?? "calculé au lancement"}
              {resume?.essai && <PastilleEssai />}
            </dd>
          </div>
          {resume && (
            <>
              <div className="flex items-center justify-between gap-2">
                <dt className="text-texte-doux">Aujourd&apos;hui</dt>
                <dd className="tabular-nums text-texte">
                  {resume.jourAvant} → {resume.jourApres}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-2">
                <dt className="text-texte-doux">Budget du mois restant</dt>
                <dd className="tabular-nums text-texte">{resume.budgetRestant}</dd>
              </div>
              {resume.credits.map((c) => (
                <div key={c.nom} className="flex items-center justify-between gap-2">
                  <dt className="text-texte-doux">Crédit {c.nom}</dt>
                  <dd className="tabular-nums text-texte">{c.disponible}</dd>
                </div>
              ))}
            </>
          )}
        </dl>
        {resume?.messageEssai && <p className="mb-3 text-sm text-texte-doux">{resume.messageEssai}</p>}
        {prix?.avatarParle && !resume?.essai && <p className="mb-3 text-sm font-semibold text-texte">{prix.avatarParle}</p>}
        {resume?.auDelaDuRepere && <p className="mb-3 text-sm font-semibold text-ambre">Au-dessus de votre repère de confirmation.</p>}
        <Bouton asChild taille="lg" pleineLargeur icone="ecrire">
          <Link href={`/ecrire/sujets/${sujetId}/relire?version=${varianteId}${prix ? `&prix=${prix.centimes}` : ""}`}>Relire le script</Link>
        </Bouton>
        <p className="mt-2 text-center text-xs text-texte-faible">La vidéo part après votre relecture.</p>
      </FeuilleBas>
    </>
  );
}

function BoutonCorrigerLimite({ onCorriger }: { onCorriger: (texte: string) => void }) {
  const [ouverte, setOuverte] = useState(false);
  const [texte, setTexte] = useState("");
  return (
    <>
      <Bouton variante="contour" icone="micro" onClick={() => setOuverte(true)}>
        Corriger au micro
      </Bouton>
      <FeuilleBas
        ouverte={ouverte}
        onOuverteChange={setOuverte}
        titre="La bonne limite"
        description="Dictez-la avec le micro du clavier : elle est reprise mot pour mot."
        pied={
          <Bouton
            pleineLargeur
            taille="lg"
            disabled={!texte.trim()}
            onClick={() => {
              onCorriger(texte);
              setOuverte(false);
            }}
          >
            Garder cette limite
          </Bouton>
        }
      >
        <textarea
          value={texte}
          onChange={(e) => setTexte(e.target.value)}
          rows={3}
          autoFocus
          placeholder="Sauf si…"
          aria-label="La limite"
          className="block w-full resize-none rounded-champ border border-trait bg-surface-1 p-3 text-base text-texte outline-none focus:border-orange"
        />
      </FeuilleBas>
    </>
  );
}

/** Ordre de publication proposé (B.5.5, B.6.12) : J à J+4, modifiable d'un toucher, heure réglée par réseau si elle existe. */
function FeuilleOrdre({
  ouverte,
  onOuverteChange,
  ordreInitial,
  heures,
  reseaux,
  jourJ: jourJDonne,
}: {
  ouverte: boolean;
  onOuverteChange: (v: boolean) => void;
  jourJ?: string;
  ordreInitial: ReseauDeclinaison[];
  heures: Partial<Record<ReseauDeclinaison, string>>;
  reseaux: ReseauDeclinaison[];
}) {
  const [ordre, setOrdre] = useState(ordreInitial);
  const [enCours, demarrer] = useTransition();
  // Même jour J que « Programmer les N » (vérification E2E n° 1, n° 21).
  const jourJ = jourJDonne ?? new Date().toISOString().slice(0, 10);
  const creneaux = planifierPublications(jourJ, reseaux, ordre, heures);
  const fmt = (j: string) => formateurDate("fr-FR", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${j}T12:00:00Z`));
  return (
    <FeuilleBas
      ouverte={ouverte}
      onOuverteChange={onOuverteChange}
      titre="Ordre de publication"
      description="Un réseau par jour, au moins 24 h d'écart."
      pied={
        <Bouton
          pleineLargeur
          taille="lg"
          chargement={enCours}
          onClick={() =>
            demarrer(async () => {
              const r = await enregistrerOrdrePublicationAction(ordre);
              if (!r.ok) notifier.erreur(r.message);
              else {
                notifier.succes("Ordre gardé pour les prochains sujets");
                onOuverteChange(false);
              }
            })
          }
        >
          Garder cet ordre
        </Bouton>
      }
    >
      <ol className="space-y-2">
        {creneaux.map((c, i) => (
          <li key={c.reseau} className="flex min-h-14 items-center gap-3 rounded-champ border border-trait bg-surface-2 px-3">
            <span className="w-10 font-titre text-sm text-orange-vif">J+{c.rang}</span>
            <LogoReseau reseau={c.reseau} />
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold text-texte">{obtenirReseau(c.reseau).nom}</span>
              <span className="block text-xs text-texte-faible">
                {fmt(c.jour)}
                {c.heure && ` · ${c.heure.replace(":", " h ")}`}
                {c.decaleWeekEnd && " · décalé au lundi"}
              </span>
            </span>
            <button type="button" aria-label={`Avancer ${obtenirReseau(c.reseau).nom}`} disabled={i === 0} onClick={() => setOrdre((o) => deplacerDansOrdre(o, c.reseau, -1))} className="grid size-11 place-items-center rounded-full text-texte-doux hover:bg-surface-3 disabled:opacity-30">
              <Icone nom="chevron-bas" size={18} className="rotate-180" />
            </button>
            <button type="button" aria-label={`Reculer ${obtenirReseau(c.reseau).nom}`} disabled={i === creneaux.length - 1} onClick={() => setOrdre((o) => deplacerDansOrdre(o, c.reseau, 1))} className="grid size-11 place-items-center rounded-full text-texte-doux hover:bg-surface-3 disabled:opacity-30">
              <Icone nom="chevron-bas" size={18} />
            </button>
          </li>
        ))}
      </ol>
    </FeuilleBas>
  );
}

/**
 * Arrêt d'un ajout sur un sujet déjà numéroté (vérification E2E n° 1, problème n° 1) : jamais en silence. La raison est
 * affichée ; une matière dictée relance l'écriture depuis l'étape arrêtée (les étapes terminées ne sont pas repayées).
 */
function CarteArretAjout({ id, manque, sansAccord }: { id: string; manque: { libelle: string; ceQuIlFaudrait: string }; sansAccord: MatiereSansAccord[] }) {
  const { ecritureSimulee } = useContext(Fiche);
  return (
    <Carte className="border-ambre/50" role="status">
      <p className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-ambre">
        <Icone nom="attention" size={14} />
        L&apos;ajout s&apos;est arrêté
      </p>
      <p className="text-[17px] font-semibold leading-snug text-texte">{manque.libelle}</p>
      <p className="mt-1 text-[15px] text-texte-doux">{manque.ceQuIlFaudrait}</p>
      {sansAccord.length > 0 && (
        <div className="mt-3">
          <MatieresSansAccord id={id} matieres={sansAccord} />
        </div>
      )}
      <SaisieMatiereSujet id={id} libelleBouton="Ajouter et reprendre" messageSucces={ecritureSimulee ? "écriture relancée, rien n'est payé" : "écriture relancée"} essai={ecritureSimulee} />
    </Carte>
  );
}

/** E2E-2 argent n° 2 : un ajout arrêté sur une panne de Claude ; rien n'est perdu, la reprise est un toucher. */
function CartePanneAjout({ id, message, supplement }: { id: string; message: string; supplement?: string }) {
  const router = useRouter();
  const [enCours, demarrer] = useTransition();
  return (
    <Carte className="border-brique/40" role="status">
      <p className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-brique">
        <Icone nom="attention" size={14} />
        L&apos;ajout s&apos;est arrêté
      </p>
      <p className="text-[15px] text-texte">{message}</p>
      <p className="mt-1 text-sm text-texte-faible">Ce qui est déjà écrit est gardé ; les autres sujets continuent.</p>
      <Bouton
        className="mt-3"
        pleineLargeur
        icone="repeter"
        chargement={enCours}
        onClick={() =>
          demarrer(async () => {
            // Relecture finale G1 : le supplément possible passe par la feuille « Confirmer ce prix ».
            const r = await avecConfirmationPrix(await reprendreEcritureArreteeAction(id), (accord) => reprendreEcritureArreteeAction(id, accord));
            if (!r.ok) {
              if (r.code !== "CONFIRMATION_REQUISE") notifier.erreur(r.message);
            } else notifier.succes("L'écriture reprend");
            router.refresh();
          })
        }
      >
        {supplement ? `Reprendre l'écriture (jusqu'à ${supplement} de plus)` : "Reprendre l'écriture"}
      </Bouton>
    </Carte>
  );
}

type ResumeDepense = { prix: string; jourAvant: string; jourApres: string; budgetRestant: string; credits: { nom: string; disponible: string }[]; essai: boolean; messageEssai?: string; auDelaDuRepere: boolean };


/** Carte « Il manque une matière » (B.6.9, maquette GM) : arrêt AVANT toute dépense ; toujours une action, jamais une impasse. */
function CarteManque({ id, idee, manque, sansAccord }: { id: string; idee: string; manque: { libelle: string; ceQuIlFaudrait: string; horsDomaine?: boolean } | null; sansAccord: MatiereSansAccord[] }) {
  const { ecritureSimulee } = useContext(Fiche);
  const router = useRouter();
  const [enCours, demarrer] = useTransition();
  const [garde, setGarde] = useState(false);
  // Hors du domaine (vérification E2E n° 1, n° 15) : ajouter une matière ne change pas le sujet ; on la garde en idée.
  const horsDomaine = !!manque?.horsDomaine;
  return (
    <div className="space-y-4">
      <Carte lueur className="text-center">
        <span className="mx-auto mb-4 grid size-14 place-items-center rounded-2xl bg-ambre-doux text-ambre">
          <Icone nom="idee" size={26} />
        </span>
        <h2 className="text-2xl text-texte">{manque?.libelle ?? "Il manque une matière"}</h2>
        <p className="mt-2 text-[15px] text-texte-doux">{manque?.ceQuIlFaudrait ?? "Une matière vraie : une scène vécue, une question reçue…"}</p>
        {!horsDomaine && sansAccord.length > 0 && (
          <div className="mt-4">
            <MatieresSansAccord id={id} matieres={sansAccord} />
          </div>
        )}
        {!horsDomaine && <SaisieMatiereSujet id={id} libelleBouton="Ajouter et écrire" messageSucces={ecritureSimulee ? "texte d'essai, rien n'est payé" : "écriture lancée"} essai={ecritureSimulee} />}
        <p className="mt-5 inline-flex items-center gap-1.5 rounded-full bg-sauge-doux px-3 py-1 text-xs font-bold text-sauge">
          <Icone nom="euro" size={12} />0 € dépensé
        </p>
      </Carte>
      <Bouton
        variante={horsDomaine ? "secondaire" : "fantome"}
        pleineLargeur
        icone="idee"
        disabled={enCours || garde}
        onClick={() =>
          demarrer(async () => {
            // Un seul toucher crée une seule idée (vérification E2E n° 1, n° 27), puis retour aux idées.
            setGarde(true);
            const r = await garderEnIdeeAction(idee, id);
            if (!r.ok) {
              setGarde(false);
              notifier.erreur(r.message);
              return;
            }
            notifier.succes("Gardé dans vos idées");
            router.push("/ecrire?onglet=idees");
          })
        }
      >
        {garde ? "Gardé en idée" : "Garder en idée"}
      </Bouton>
    </div>
  );
}

/**
 * E2E-1 n° 11 : sous un créneau de « Programmer les N », ce qui reste à vérifier sur CETTE vidéo, chaque case cochable
 * d'un toucher, et le lien vers la vidéo pour la regarder. Rien quand tout est coché.
 */
export function VerificationsDeLaVersion({ v, onCocher }: { v: VerificationsVersion; onCocher: (cle: VerificationsVersion["manquantes"][number]["cle"]) => void }) {
  if (v.pasPrete) return <p className="pb-3 text-[13px] text-texte-faible">Vidéo pas encore prête : elle ne partira pas.</p>;
  if (!v.manquantes.length && !v.licenceBloque) return null;
  return (
    <div className="space-y-2 pb-3">
      {v.manquantes.length > 0 && (
        <>
          <p className="text-[13px] text-ambre">
            Il reste {v.manquantes.length} vérification{v.manquantes.length > 1 ? "s" : ""} sur {v.total}. Touchez ce que vous avez vérifié :
          </p>
          <ul className="flex flex-wrap gap-1.5">
            {v.manquantes.map((m) => (
              <li key={m.cle}>
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={false}
                  onClick={() => onCocher(m.cle)}
                  className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-trait bg-surface-1 px-3.5 text-sm font-semibold text-texte-doux hover:border-trait-fort hover:text-texte"
                >
                  <span aria-hidden className="size-3.5 rounded-[4px] border-2 border-current" />
                  {m.libelle}
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
      {v.licenceBloque && <p className="text-[13px] text-ambre">Une licence bloque cette vidéo : voyez « Droits » sur la vidéo.</p>}
      <Link href={`/videos/${v.videoId}`} className="inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-orange-vif underline-offset-4 hover:underline">
        Voir la vidéo
        <Icone nom="fleche-droite" size={14} />
      </Link>
    </div>
  );
}

/**
 * « Programmer les N » (lot G7a, B.5.5) : un format à la fois, chaque version sur SON réseau, ordre J à J+4 ; un toucher
 * pour confirmer. Chaque envoi suit l'interrupteur de Buffer (essai tant que l'envoi réel n'est pas activé).
 */
function FeuilleProgrammer({ ouverte, onOuverteChange, sujetId, programmation }: { ouverte: boolean; onOuverteChange: (v: boolean) => void; sujetId: string; programmation: ProgrammationAffichee }) {
  const router = useRouter();
  const [enCours, demarrer] = useTransition();
  // E2E-1 n° 11 : ce qui manque avant de publier, version par version, cochable ici (lu à chaque ouverture).
  const [verifs, setVerifs] = useState<VerificationsVersion[] | null>(null);
  useEffect(() => {
    if (!ouverte) return;
    let actif = true;
    void verificationsAvantProgrammerAction(sujetId).then((r) => {
      if (actif) setVerifs(r.ok ? r.donnees : null);
    });
    return () => {
      actif = false;
    };
  }, [ouverte, sujetId]);
  const fmt = (j: string) => formateurDate("fr-FR", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${j}T12:00:00Z`));
  const n = programmation.creneaux.length;
  const verifDe = (code: string) => verifs?.find((v) => v.code === code);
  function cocher(v: VerificationsVersion, cle: VerificationsVersion["manquantes"][number]["cle"]) {
    // Affichage immédiat ; en cas d'échec, la case revient et l'erreur est dite.
    setVerifs((x) => x?.map((y) => (y.videoId === v.videoId ? { ...y, manquantes: y.manquantes.filter((m) => m.cle !== cle) } : y)) ?? null);
    void cocherVerificationAction(sujetId, v.videoId, cle, true).then((r) => {
      if (r.ok) return;
      notifier.erreur(r.message);
      setVerifs((x) => x?.map((y) => (y.videoId === v.videoId ? v : y)) ?? null);
    });
  }
  function confirmer() {
    demarrer(async () => {
      const r = await programmerSujetAction(sujetId);
      if (!r.ok) {
        notifier.erreur(r.message);
        return;
      }
      const { programmees, ignorees, simulation } = r.donnees;
      if (programmees.length) {
        if (simulation) notifier.essai("rien n'a été envoyé à Buffer");
        else if (r.donnees.modeBuffer === "brouillon") notifier.succes(`${programmees.length} brouillon${programmees.length > 1 ? "s" : ""} dans Buffer`, "Relisez et programmez dans Buffer.");
        else notifier.succes(`${programmees.length} version${programmees.length > 1 ? "s" : ""} programmée${programmees.length > 1 ? "s" : ""}`);
      }
      if (ignorees.length) notifier.erreur(`${ignorees[0].code} : ${ignorees[0].message}`);
      onOuverteChange(false);
      router.refresh();
    });
  }
  return (
    <FeuilleBas
      ouverte={ouverte}
      onOuverteChange={onOuverteChange}
      titre={n > 1 ? `Programmer les ${n}` : "Programmer la version"}
      description={programmation.formatNom}
      pied={
        <Bouton pleineLargeur taille="lg" icone="calendrier" essai={programmation.envoiSimule} chargement={enCours} onClick={confirmer}>
          Confirmer
        </Bouton>
      }
    >
      {programmation.envoiSimule && (
        <p className="mb-4 flex items-center gap-2 rounded-2xl border border-ambre/30 bg-ambre-doux px-3 py-2.5 text-sm text-texte">
          <PastilleEssai />
          Rien ne partira vraiment.
        </p>
      )}
      {!programmation.envoiSimule && programmation.modeBuffer === "brouillon" && (
        <p className="mb-4 flex items-center gap-2 rounded-2xl border border-trait bg-surface-2 px-3 py-2.5 text-sm text-texte-doux">
          <Icone nom="envoyer" size={16} className="shrink-0 text-orange-vif" />
          Chaque version part en brouillon dans Buffer, avec sa date : vous la programmez dans Buffer.
        </p>
      )}
      <ol className="space-y-2">
        {programmation.creneaux.map((c) => {
          const v = verifDe(c.code);
          return (
            <li key={c.code} className="rounded-champ border border-trait bg-surface-2 px-3">
              <div className="flex min-h-14 items-center gap-3">
                <span className="w-10 font-titre text-sm text-orange-vif">J+{c.rang}</span>
                <LogoReseau reseau={c.reseau} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-mono text-xs text-texte-doux">{c.code}</span>
                  <span className="block text-sm font-semibold text-texte">
                    {fmt(c.jour)} · {(c.heure ?? "09:00").replace(":", " h ")}
                    {c.decaleWeekEnd && <span className="font-normal text-texte-faible"> · lundi</span>}
                  </span>
                </span>
                {v && !v.pasPrete && !v.manquantes.length && !v.licenceBloque && (
                  <span className="shrink-0 text-sauge">
                    <Icone nom="coche" size={16} />
                    <span className="sr-only">Tout est vérifié</span>
                  </span>
                )}
              </div>
              {v && <VerificationsDeLaVersion v={v} onCocher={(cle) => cocher(v, cle)} />}
            </li>
          );
        })}
      </ol>
      {programmation.autresFormats > 0 && (
        <p className="mt-3 text-center text-xs text-texte-faible">
          {programmation.autresFormats} autre{programmation.autresFormats > 1 ? "s" : ""} ensuite (un format à la fois)
        </p>
      )}
    </FeuilleBas>
  );
}
