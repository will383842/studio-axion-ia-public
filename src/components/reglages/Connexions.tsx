"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { definirFournisseurAction, definirJeLisReelAction, definirMontageReelAction, testerConnexionAction } from "@/app/(studio)/reglages/actions";
import { Bouton } from "@/components/ui/Bouton";
import { FeuilleBas } from "@/components/ui/FeuilleBas";
import { Icone, type NomIcone } from "@/components/ui/Icone";
import { Interrupteur } from "@/components/ui/Interrupteur";
import { Pastille } from "@/components/ui/Pastille";
import { notifier } from "@/components/ui/Toast";
import type { EtatConnexion, OptionConnexion, TypeFournisseur } from "@/fournisseurs";
import { TITRES_SERVICES } from "@/fournisseurs/titres";
import { cn } from "@/lib/cn";
import { ilYA } from "@/lib/dates";
import type { CleService } from "@/services/credits";
import { formaterMontant } from "@/lib/montants";
import type { FormatJeLis, FormatMontageReel } from "@/services/reglages";

export interface ConnexionVue {
  type: TypeFournisseur;
  etat: EtatConnexion;
  /** Les vrais choix, sous leur identifiant exact (lot R0) : jamais un identifiant fabriqué depuis un libellé. */
  options: OptionConnexion[];
  /** Montage seulement : formats montés pour de vrai. */
  montageReelPour?: string[];
  /** Montage seulement (lot R6) : interrupteur « je lis » réel, par format. */
  jeLis?: FormatJeLis[];
  /** Montage seulement (lot R6) : calage des sous-titres relié. */
  calageRelie?: boolean;
  /** Montage seulement (lot R8) : « Montage réel des vidéos avocat », par format, avec son prix. */
  montageReel?: FormatMontageReel[];
}

interface PastilleEtat {
  libelle: string;
  ton: "ambre" | "sauge" | "brique" | "neutre";
}

const PASTILLES = {
  simulation: { libelle: "Essai", ton: "ambre" },
  relie: { libelle: "Relié", ton: "sauge" },
  aRelier: { libelle: "À relier", ton: "brique" },
  bientot: { libelle: "Pas encore disponible", ton: "neutre" },
} satisfies Record<string, PastilleEtat>;

/** Liste partagée (aussi employée par le Journal) : réexportée ici pour ne rien casser. */
export { TITRES_SERVICES };

const ICONES: Record<TypeFournisseur, NomIcone> = {
  script: "ecrire",
  visage: "visage",
  voix: "micro",
  montage: "ciseaux",
  illustration: "images",
  etalonnage: "contraste",
  son: "son",
  miniature: "image",
  publication: "envoyer",
  "texte-reseaux": "diese",
  notification: "cloche",
  stockage: "archive",
  alignement: "sous-titres",
  site: "lien",
};

/**
 * « À relier : un réglage manque sur le serveur ». Ni valeur, ni NOM de réglage à l'écran (ordre de Will : aucun sigle
 * ni nom technique) ; les noms restent dans les données (`OptionConnexion.manque`) et dans le relevé du lot.
 */
export function phraseARelier(manque: string[]): string {
  return manque.length > 1 ? "À relier : des réglages manquent sur le serveur" : "À relier : un réglage manque sur le serveur";
}

type EtatCarte = Pick<ConnexionVue, "etat" | "options"> & { type?: TypeFournisseur };

/**
 * Services prêts sur le serveur du studio mais qu'aucune fabrication de vidéo n'appelle encore (contrôle du paquet 2,
 * n° 6) : le moteur mixe lui-même le son, et l'étalonnage ne sert qu'à l'image « après » de la Bibliothèque. Leur carte
 * ne dit donc pas « Relié » comme si les vidéos s'en servaient déjà.
 */
const PRETS_SANS_VIDEOS: ReadonlySet<TypeFournisseur> = new Set(["son", "etalonnage"]);
const PRET_SERVEUR = { pastille: { libelle: "Prêt", ton: "neutre" } satisfies PastilleEtat, resume: "Prêt sur le serveur du studio" };

/**
 * Pastille de la carte : celle du choix en vigueur, décidée par `etatOption` (seule fonction qui tranche entre
 * « À relier » et « Pas encore disponible »). Un identifiant que plus aucun choix ne porte reste « À relier ».
 */
export function pastilleConnexion(c: EtatCarte): PastilleEtat {
  if (c.etat === "relie") return c.type && PRETS_SANS_VIDEOS.has(c.type) ? PRET_SERVEUR.pastille : PASTILLES.relie;
  if (c.etat === "simulation") return PASTILLES.simulation;
  const choisie = c.options.find((o) => o.choisi);
  if (!choisie) return PASTILLES.aRelier;
  const { libelle, ton } = etatOption(choisie);
  return { libelle, ton };
}

/** Ligne sous le titre du service, dans la liste (dérivée de `etatOption` pour « À relier » / « Pas encore disponible »). */
export function resumeConnexion(c: EtatCarte): string {
  const choisie = c.options.find((o) => o.choisi);
  if (c.etat === "relie") return c.type && PRETS_SANS_VIDEOS.has(c.type) ? PRET_SERVEUR.resume : (choisie?.nom ?? "Relié");
  if (c.etat === "a-relier") {
    // Seul un identifiant que plus aucun choix ne porte (ancien « remotion »…) « n'existe plus ».
    if (!choisie) return "Ce choix n'existe plus : choisissez à nouveau";
    const e = etatOption(choisie);
    return e.desactive ? `${choisie.nom} : pas encore disponible, le mode essai reste actif` : (e.detail ?? e.libelle);
  }
  const prevus = c.options.filter((o) => o.mode === "reel").map((o) => o.nom);
  return prevus.length > 0 ? `Prévu : ${prevus.join(", ")}` : "Essai";
}

/** Carte Montage (constat C2) : ce qui sera VRAIMENT monté. */
export function ligneMontageReel(formats: string[] | undefined): string {
  return `Montage réel pour : ${formats && formats.length > 0 ? formats.join(", ") : "—"}`;
}

/** État d'un choix, dans la feuille : « pret » décide entre « À relier » (réglage à poser) et « Pas encore disponible ». */
function etatOption(o: OptionConnexion): PastilleEtat & { detail?: string; desactive?: boolean } {
  if (o.mode === "simulation") return PASTILLES.simulation;
  if (o.inscrit) return PASTILLES.relie;
  if (!o.pret) return { ...PASTILLES.aRelier, detail: phraseARelier(o.manque) };
  return { ...PASTILLES.bientot, detail: "Réglages présents ; ce service arrive dans une prochaine version", desactive: true };
}

/**
 * Choix d'un service, dans la feuille : la simulation, puis chaque service réel sous son identifiant EXACT, avec son
 * coût et son état. Un service « À relier » peut être choisi d'avance (la simulation reste active jusqu'à ce que le
 * réglage soit posé sur le serveur) ; un service dont le code n'est pas encore livré ne peut pas l'être.
 */
export function ChoixService({ connexion, valeur, onChange }: { connexion: ConnexionVue; valeur: string; onChange: (id: string) => void }) {
  return (
    <div>
      <ul role="radiogroup" aria-label="Service" className="flex flex-col gap-2">
        {connexion.options.map((o) => {
          const e = etatOption(o);
          const actif = valeur === o.id;
          return (
            <li key={o.id}>
              <button
                type="button"
                role="radio"
                aria-checked={actif}
                data-option={o.id}
                disabled={e.desactive}
                onClick={() => onChange(o.id)}
                className={cn(
                  "flex min-h-14 w-full items-start gap-3 rounded-2xl border px-4 py-3 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-60",
                  actif ? "border-orange bg-orange-doux" : "border-trait bg-surface-1 hover:bg-surface-2",
                )}
              >
                <span className={cn("mt-1 grid size-5 shrink-0 place-items-center rounded-full border-2", actif ? "border-orange" : "border-trait-fort")}>
                  {actif && <span className="size-2.5 rounded-full bg-orange" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center justify-between gap-2">
                    <span className="min-w-0 text-[15px] font-semibold text-texte">{o.nom}</span>
                    <Pastille ton={e.ton}>{e.libelle}</Pastille>
                  </span>
                  {o.cout && <span className="block text-xs text-texte-doux">{o.cout}</span>}
                  {e.detail && <span className="block break-words text-xs text-texte-faible">{e.detail}</span>}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      {connexion.type === "montage" && <p className="mt-3 text-sm text-texte-doux">{ligneMontageReel(connexion.montageReelPour)}</p>}
      {connexion.type === "montage" && !!connexion.montageReel?.length && <BlocMontageReel formats={connexion.montageReel} />}
      {connexion.type === "montage" && !!connexion.jeLis?.length && <BlocJeLis formats={connexion.jeLis} calageRelie={!!connexion.calageRelie} />}
    </div>
  );
}

/** Ligne sous l'interrupteur « montage réel » : ce qui empêche de l'allumer, ou son prix. */
export function detailMontageReel(f: FormatMontageReel): string {
  if (!f.possible) return f.raison ?? "Il faut d'abord relier le montage.";
  const prix = `Environ ${formaterMontant(f.prix.total)} pour une vidéo de ${f.prix.dureeSec} s.`;
  return f.allume ? `${prix} Prix confirmé à chaque lancement.` : `${prix} Éteint : vos vidéos restent des essais.`;
}

/**
 * Lot R8 : « Montage réel des vidéos avocat » (voix, double, montage, réseaux). Proposé seulement quand tout est relié
 * et que le double est prêt ; sinon la ligne dit ce qui manque. Allumer : le prix d'une vidéo de 45 s s'affiche d'abord
 * (feuille à confirmer). Couper : un seul geste, rien n'est perdu (les vidéos repartent en essai).
 */
export function BlocMontageReel({ formats }: { formats: FormatMontageReel[] }) {
  const router = useRouter();
  const [etats, setEtats] = useState<Record<string, boolean>>({});
  const [aConfirmer, setAConfirmer] = useState<FormatMontageReel | null>(null);
  const [enCours, demarrer] = useTransition();
  function enregistrer(f: FormatMontageReel, v: boolean) {
    setEtats((x) => ({ ...x, [f.formatId]: v }));
    demarrer(async () => {
      const r = await definirMontageReelAction(f.formatId, v);
      setAConfirmer(null);
      if (!r.ok) {
        setEtats((x) => ({ ...x, [f.formatId]: !v }));
        notifier.erreur(r.message);
        return;
      }
      notifier.succes(v ? `${f.nom} : montage réel allumé` : `${f.nom} : retour en essai`);
      router.refresh();
    });
  }
  return (
    <div className="mt-4 border-t border-trait pt-3">
      <p className="mb-1 text-xs font-bold uppercase tracking-wider text-texte-faible">Montage réel des vidéos avec votre double</p>
      <ul className="flex flex-col">
        {formats.map((f) => {
          const coche = etats[f.formatId] ?? f.allume;
          return (
            <li key={f.formatId} data-montage-reel={f.formatId}>
              <Interrupteur
                icone="clap"
                libelle={`Montage réel des vidéos ${f.nom}`}
                detail={detailMontageReel({ ...f, allume: coche })}
                coche={coche}
                desactive={!f.possible && !coche}
                onChange={(v) => (v ? setAConfirmer(f) : enregistrer(f, false))}
              />
            </li>
          );
        })}
      </ul>
      <FeuilleBas
        ouverte={!!aConfirmer}
        onOuverteChange={(o) => !o && setAConfirmer(null)}
        titre="Monter vos vidéos pour de vrai"
        description={aConfirmer ? `Prix estimé d'une vidéo de ${aConfirmer.prix.dureeSec} s. Il s'affiche aussi avant chaque lancement.` : undefined}
        pied={
          aConfirmer && (
            <div className="flex flex-col gap-2">
              <Bouton taille="lg" pleineLargeur icone="clap" chargement={enCours} onClick={() => enregistrer(aConfirmer, true)}>
                Allumer · environ {formaterMontant(aConfirmer.prix.total, { court: true })} la vidéo
              </Bouton>
              <Bouton variante="secondaire" pleineLargeur onClick={() => setAConfirmer(null)}>
                Rester en essai
              </Bouton>
            </div>
          )
        }
      >
        {aConfirmer && (
          <>
            <p className="py-4 text-center font-titre text-[56px] tabular-nums leading-none text-orange-vif">{formaterMontant(aConfirmer.prix.total)}</p>
            <ul className="flex flex-col gap-1 text-sm">
              {aConfirmer.prix.lignes.map((l) => (
                <li key={l.quoi} className="flex justify-between gap-3">
                  <span className="text-texte-doux">{l.quoi}</span>
                  <span className="tabular-nums text-texte">{l.montant.centimes ? formaterMontant(l.montant) : "Gratuit"}</span>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-sm text-texte-doux">Vidéo verticale en haute définition. Vous pouvez repasser en essai à tout moment, sans rien perdre.</p>
          </>
        )}
      </FeuilleBas>
    </div>
  );
}

/** Ligne d'explication sous un interrupteur « je lis » : ce qui manque, ou ce que Will doit savoir. */
function detailJeLis(f: FormatJeLis, calageRelie: boolean): string {
  if (!f.possible) return `Il faut d'abord relier ${f.manque ?? "le montage"}.`;
  if (f.allume && !calageRelie) return "Sous-titres approximatifs tant que le calage des sous-titres n'est pas relié.";
  return "Montées par le studio. Gratuit.";
}

/**
 * Lot R6 : vidéos « je lis » montées pour de vrai DÈS MAINTENANT (Will filme : ni voix ni double à payer). Un
 * interrupteur par format ; il s'enregistre tout de suite (aucun coût) et agit au prochain « Monter ma prise ».
 */
export function BlocJeLis({ formats, calageRelie }: { formats: FormatJeLis[]; calageRelie: boolean }) {
  const router = useRouter();
  const [etats, setEtats] = useState<Record<string, boolean>>({});
  const [, demarrer] = useTransition();
  return (
    <div className="mt-4 border-t border-trait pt-3">
      <p className="mb-1 text-xs font-bold uppercase tracking-wider text-texte-faible">Vidéos « je lis » montées pour de vrai</p>
      <ul className="flex flex-col">
        {formats.map((f) => {
          const coche = etats[f.formatId] ?? f.allume;
          return (
            <li key={f.formatId} data-je-lis={f.formatId}>
              <Interrupteur
                icone="camera"
                libelle={f.nom}
                detail={detailJeLis({ ...f, allume: coche }, calageRelie)}
                coche={coche}
                desactive={!f.possible}
                onChange={(v) => {
                  setEtats((x) => ({ ...x, [f.formatId]: v }));
                  demarrer(async () => {
                    const r = await definirJeLisReelAction(f.formatId, v);
                    if (!r.ok) {
                      setEtats((x) => ({ ...x, [f.formatId]: !v }));
                      notifier.erreur(r.message);
                      return;
                    }
                    notifier.succes(v ? `${f.nom} · je lis : montage réel` : `${f.nom} · je lis : coupé`);
                    router.refresh();
                  });
                }}
              />
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/**
 * Réglages > Connexions : un service par ligne, état, vrais choix (simulation ou service réel sous son identifiant
 * exact) ; puis les CLÉS des services payants (lot « crédits », 02/10) : présente ou non, 4 derniers caractères,
 * dernière utilisation, « Tester ». Aucune valeur de clé n'arrive jusqu'ici.
 */
export function Connexions({ connexions, cles = [] }: { connexions: ConnexionVue[]; cles?: CleService[] }) {
  const router = useRouter();
  const [ouverte, setOuverte] = useState<ConnexionVue | null>(null);
  const [choix, setChoix] = useState("simulation");
  const [enCours, demarrer] = useTransition();
  const nbSimulees = connexions.filter((c) => c.etat === "simulation").length;

  return (
    <>
      {/* TEST-UI-REEL U3 : rien à signaler quand tout est relié (plus de « 0 services en mode essai »). */}
      {nbSimulees > 0 && (
        <p className="mb-3 flex items-center gap-2 text-sm text-texte-doux">
          <Pastille ton="ambre">Essai</Pastille>
          {nbSimulees === connexions.length ? "Tout fonctionne en mode essai." : nbSimulees === 1 ? "1 service en mode essai." : `${nbSimulees} services en mode essai.`}
        </p>
      )}
      <ul className="-mx-2 grid grid-cols-1 gap-1 sm:grid-cols-2">
        {connexions.map((c) => {
          const pastille = pastilleConnexion(c);
          return (
            <li key={c.type}>
              <button
                type="button"
                onClick={() => {
                  setChoix(c.options.find((o) => o.choisi)?.id ?? "simulation");
                  setOuverte(c);
                }}
                className="flex min-h-14 w-full items-center gap-3 rounded-2xl px-2 text-left transition-colors hover:bg-surface-2"
              >
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-surface-2 text-texte-doux">
                  <Icone nom={ICONES[c.type]} size={18} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-semibold text-texte">{TITRES_SERVICES[c.type]}</span>
                  <span className="block truncate text-xs text-texte-faible">{resumeConnexion(c)}</span>
                  {c.type === "montage" && <span className="block truncate text-xs text-texte-faible">{ligneMontageReel(c.montageReelPour)}</span>}
                </span>
                <Pastille ton={pastille.ton}>{pastille.libelle}</Pastille>
              </button>
            </li>
          );
        })}
      </ul>

      {cles.length > 0 && <ClesServices cles={cles} />}

      <FeuilleBas
        ouverte={!!ouverte}
        onOuverteChange={(o) => !o && setOuverte(null)}
        titre={ouverte ? TITRES_SERVICES[ouverte.type] : ""}
        description="Tant qu'un service n'est pas relié, le mode essai prend le relais."
        pied={
          <Bouton
            taille="lg"
            pleineLargeur
            chargement={enCours}
            onClick={() =>
              ouverte &&
              demarrer(async () => {
                const r = await definirFournisseurAction(ouverte.type, choix);
                if (!r.ok) {
                  notifier.erreur(r.message);
                  return;
                }
                const option = ouverte.options.find((o) => o.id === choix);
                if (!option || option.mode === "simulation") notifier.succes("Mode essai choisi");
                else if (option.inscrit) notifier.succes(`${option.nom} : relié`);
                else notifier.succes(`${option.nom} : choisi`, "À relier : le mode essai reste actif d'ici là.");
                setOuverte(null);
                router.refresh();
              })
            }
          >
            Enregistrer
          </Bouton>
        }
      >
        {ouverte && <ChoixService connexion={ouverte} valeur={choix} onChange={setChoix} />}
      </FeuilleBas>
    </>
  );
}

/**
 * Clés des services payants : jamais affichées en entier (« …a1B2 »), jamais renvoyées au navigateur. « Tester »
 * fait une lecture gratuite chez le service. Remplacer une clé : dans la configuration du serveur, puis redémarrer, puis « Tester ».
 */
function ClesServices({ cles }: { cles: CleService[] }) {
  const router = useRouter();
  const [enTest, setEnTest] = useState<string | null>(null);
  const [resultats, setResultats] = useState<Record<string, CleService["dernierTest"]>>({});
  const [, demarrer] = useTransition();

  return (
    <div className="mt-5 border-t border-trait pt-4">
      <p className="mb-1 text-xs font-bold uppercase tracking-wider text-texte-faible">Clés des services payants</p>
      <ul className="divide-y divide-trait">
        {cles.map((c) => {
          const test = resultats[c.fournisseur] ?? c.dernierTest;
          return (
            <li key={c.fournisseur} className="flex min-h-16 items-center gap-3 py-2">
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-surface-2 text-texte-doux">
                <Icone nom="cle" size={18} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2">
                  <span className="truncate text-[15px] font-semibold text-texte">{c.nom}</span>
                  {c.clePresente && <span className="font-mono text-xs tabular-nums text-texte-faible">{c.finCle ?? "…"}</span>}
                </span>
                <span className="block truncate text-xs text-texte-faible">
                  {!c.clePresente ? "Aucune clé" : test ? `${test.ok ? "Acceptée" : test.message} · ${ilYA(test.testeLe)}` : "Pas encore testée"}
                  {c.derniereUtilisation ? ` · utilisée ${ilYA(c.derniereUtilisation)}` : ""}
                </span>
              </span>
              {c.clePresente ? (
                <Bouton
                  variante="secondaire"
                  chargement={enTest === c.fournisseur}
                  onClick={() => {
                    setEnTest(c.fournisseur);
                    demarrer(async () => {
                      const r = await testerConnexionAction(c.fournisseur);
                      setEnTest(null);
                      if (!r.ok) {
                        notifier.erreur(r.message);
                        return;
                      }
                      setResultats((x) => ({ ...x, [c.fournisseur]: r.donnees }));
                      if (r.donnees.ok) notifier.succes(`${c.nom} : clé acceptée`, r.donnees.finCle);
                      else notifier.erreur(r.donnees.message);
                      router.refresh();
                    });
                  }}
                >
                  Tester
                </Bouton>
              ) : (
                <Pastille ton="neutre">À relier</Pastille>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
