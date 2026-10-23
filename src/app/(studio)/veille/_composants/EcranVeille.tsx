"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Bouton } from "@/components/ui/Bouton";
import { Champ } from "@/components/ui/Champ";
import { EtatVide } from "@/components/ui/EtatVide";
import { FeuilleBas } from "@/components/ui/FeuilleBas";
import { Icone } from "@/components/ui/Icone";
import { IlYA } from "@/components/ui/IlYA";
import { Pastille } from "@/components/ui/Pastille";
import { notifier } from "@/components/ui/Toast";
import { compteEtatVeille, ETATS_VEILLE, INTERETS_VEILLE, STATUTS_NOUVEAUTE } from "@/domaine/libelles";
import type { EtatVeille, StatutNouveaute, VeilleNouveaute } from "@/domaine/types";
import { cn } from "@/lib/cn";
import { ajouterOutilAction, essayerNouveauteAction, ignorerNouveauteAction, rangerOutilAction, reprendreNouveauteAction, verifierMaintenantAction } from "../actions";
import { formateurDate } from "@/lib/intl";

export interface OutilAffiche {
  id: string;
  nom: string;
  role: string;
  etat: EtatVeille;
  versionUtilisee?: string;
  derniereVersion?: string;
  derniereVersionLe?: string;
  verifieLe?: string;
  adresse: string;
  ajouteParVous: boolean;
}

export interface NouveauteAffichee {
  id: string;
  outil: string;
  versionVue: string;
  date: string;
  lien?: string;
  resume: VeilleNouveaute["resume"];
  rouge: boolean;
  /** CORRECTEUR 1 — B7 : résumé fait par les règles du studio, pas par Claude (absent : ancien, simulé aussi). */
  simule?: boolean;
  statut: StatutNouveaute;
  tacheCreeeLe?: string;
}

type Resultat = { ok: true } | { ok: false; message: string };

const FUSEAU = "Europe/Paris";

function dateAvecAnnee(iso: string): string {
  return formateurDate("fr-FR", { day: "numeric", month: "short", year: "numeric", timeZone: FUSEAU }).format(new Date(iso));
}

/** « 2026-09-28 » → « 28 sept. 2026 » ; « 2026-09 » → « sept. 2026 » ; le reste tel quel. */
function afficherVersion(v: string | undefined): string {
  if (!v) return "—";
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return dateAvecAnnee(`${v}T12:00:00Z`);
  if (/^\d{4}-\d{2}$/.test(v)) return formateurDate("fr-FR", { month: "short", year: "numeric", timeZone: FUSEAU }).format(new Date(`${v}-15T12:00:00Z`));
  return v;
}

function useGeste() {
  const router = useRouter();
  const [enCours, demarrer] = useTransition();
  function faire(action: () => Promise<Resultat>, succes?: string, ensuite?: () => void) {
    demarrer(async () => {
      const r = await action();
      if (!r.ok) {
        notifier.erreur(r.message);
        return;
      }
      if (succes) notifier.succes(succes);
      ensuite?.();
      router.refresh();
    });
  }
  return { enCours, faire };
}

export function EcranVeille({ outils, nouveautes, derniereLecture, ouverteId }: { outils: OutilAffiche[]; nouveautes: NouveauteAffichee[]; derniereLecture: string | null; ouverteId: string | null }) {
  const router = useRouter();
  const [ouverte, setOuverte] = useState<string | null>(ouverteId && nouveautes.some((n) => n.id === ouverteId) ? ouverteId : null);
  const [ajout, setAjout] = useState(false);
  const [verification, demarrerVerification] = useTransition();
  const aRegarder = nouveautes.filter((n) => n.statut === "nouvelle" || n.statut === "essayer");
  const rangees = nouveautes.filter((n) => n.statut === "ignoree" || n.statut === "appliquee");
  const courante = nouveautes.find((n) => n.id === ouverte) ?? null;
  // Un outil jamais lu n'est pas « impossible à vérifier » : il attend sa première lecture (compté à part).
  const compte = (e: EtatVeille) => outils.filter((o) => o.etat === e && (e !== "injoignable" || !!o.verifieLe)).length;
  const jamaisLus = outils.filter((o) => o.etat === "injoignable" && !o.verifieLe).length;

  function verifier() {
    demarrerVerification(async () => {
      const r = await verifierMaintenantAction();
      if (!r.ok) return void notifier.erreur(r.message);
      if (r.donnees.saute) notifier.info("Vérification déjà en cours.");
      else notifier.succes(r.donnees.nouveautes ? `${r.donnees.nouveautes} nouveauté${r.donnees.nouveautes > 1 ? "s" : ""}` : "Rien de nouveau", r.donnees.muets ? `${r.donnees.muets} outil${r.donnees.muets > 1 ? "s" : ""} impossible${r.donnees.muets > 1 ? "s" : ""} à vérifier` : undefined);
      router.refresh();
    });
  }

  return (
    <div className="space-y-8">
      {/* Bilan + vérification */}
      <div className="flex flex-wrap items-center gap-2">
        {(["attention", "nouveaute", "a-jour", "injoignable"] as const).map((e) =>
          compte(e) ? (
            <Pastille key={e} ton={ETATS_VEILLE[e].tonalite} icone={ETATS_VEILLE[e].icone} taille="md">
              {compteEtatVeille(e, compte(e))}
            </Pastille>
          ) : null,
        )}
        {jamaisLus > 0 && (
          <Pastille ton="neutre" icone="horloge" taille="md">
            {jamaisLus} pas encore lu{jamaisLus > 1 ? "s" : ""}
          </Pastille>
        )}
        <span className="ml-auto flex items-center gap-2">
          <span className="text-xs text-texte-faible">{derniereLecture ? <>Vérifiée <IlYA iso={derniereLecture} /></> : "Jamais vérifiée"}</span>
          <Bouton variante="secondaire" icone="actualiser" chargement={verification} onClick={verifier}>
            Vérifier
          </Bouton>
        </span>
      </div>

      {/* Nouveautés à regarder */}
      <section aria-labelledby="titre-nouveautes" className="space-y-3">
        <h2 id="titre-nouveautes" className="text-lg text-texte">
          À regarder {aRegarder.length ? <span className="text-texte-faible">· {aRegarder.length}</span> : null}
        </h2>
        {aRegarder.length ? (
          <ul className="space-y-3">
            {aRegarder.map((n) => (
              <li key={n.id}>
                <CarteNouveaute n={n} onOuvrir={() => setOuverte(n.id)} />
              </li>
            ))}
          </ul>
        ) : (
          <EtatVide compact icone="valide" titre="Rien à regarder" phrase="On vous prévient dès qu'un outil change." />
        )}
      </section>

      {/* Une carte par outil */}
      <section aria-labelledby="titre-outils" className="space-y-3">
        <div className="flex items-center gap-3">
          <h2 id="titre-outils" className="flex-1 text-lg text-texte">
            Outils <span className="text-texte-faible">· {outils.length}</span>
          </h2>
          <Bouton variante="fantome" icone="plus" onClick={() => setAjout(true)}>
            Ajouter
          </Bouton>
        </div>
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {outils.map((o) => (
            <li key={o.id} className="min-w-0">
              <CarteOutil o={o} />
            </li>
          ))}
        </ul>
        <p className="text-xs text-texte-faible">Résumés simplifiés, faits par le studio (pas par Claude). Une lecture par jour.</p>
      </section>

      {rangees.length > 0 && (
        <details className="group rounded-carte border border-trait bg-surface-1 p-4">
          <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between text-sm font-semibold text-texte-doux">
            Rangées · {rangees.length}
            <Icone nom="chevron-bas" size={18} className="transition-transform group-open:rotate-180" />
          </summary>
          <ul className="mt-3 space-y-3">
            {rangees.map((n) => (
              <li key={n.id}>
                <CarteNouveaute n={n} onOuvrir={() => setOuverte(n.id)} />
              </li>
            ))}
          </ul>
        </details>
      )}

      <FeuilleNouveaute n={courante} onFermer={() => setOuverte(null)} />
      <FeuilleAjout ouverte={ajout} onOuverteChange={setAjout} />
    </div>
  );
}

function CarteOutil({ o }: { o: OutilAffiche }) {
  // Jamais lu : « Pas encore lu », pas « Impossible de vérifier » (aucune lecture n'a encore échoué).
  const e = o.etat === "injoignable" && !o.verifieLe ? { ...ETATS_VEILLE.injoignable, libelle: "Pas encore lu", icone: "horloge" as const } : ETATS_VEILLE[o.etat];
  const { enCours, faire } = useGeste();
  const gris = o.etat === "injoignable";
  return (
    <article
      className={cn(
        "flex h-full flex-col gap-3 rounded-carte border bg-surface-1 p-4 shadow-carte",
        o.etat === "attention" ? "border-brique/50" : o.etat === "nouveaute" ? "border-orange/40" : "border-trait",
      )}
    >
      <header className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-[15px] font-semibold text-texte">{o.nom}</h3>
          <p className="truncate text-xs text-texte-faible">{o.role}</p>
        </div>
        <Pastille ton={e.tonalite} icone={e.icone}>
          {e.libelle}
        </Pastille>
      </header>
      <dl className="grid grid-cols-2 gap-3 text-sm">
        <div className="min-w-0">
          <dt className="text-xs text-texte-faible">Utilisée</dt>
          <dd className="truncate font-semibold tabular-nums text-texte">{o.versionUtilisee ?? "—"}</dd>
        </div>
        <div className="min-w-0">
          <dt className="text-xs text-texte-faible">Dernière</dt>
          <dd className={cn("truncate font-semibold tabular-nums", gris && !o.derniereVersion ? "text-texte-faible" : "text-texte")}>{afficherVersion(o.derniereVersion)}</dd>
        </div>
      </dl>
      <footer className="mt-auto flex items-center gap-2 text-xs text-texte-faible">
        <span className="min-w-0 flex-1 truncate">
          {o.derniereVersionLe && !/^\d{4}-\d{2}/.test(o.derniereVersion ?? "") ? <>Sortie le {dateAvecAnnee(o.derniereVersionLe)}</> : o.verifieLe ? <>Lu <IlYA iso={o.verifieLe} /></> : "Pas encore lu"}
        </span>
        <a href={o.adresse} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center gap-1 font-semibold text-texte-doux hover:text-texte">
          Source <Icone nom="lien" size={13} />
        </a>
        {o.ajouteParVous && (
          <button type="button" disabled={enCours} onClick={() => faire(() => rangerOutilAction(o.id), "Outil rangé")} className="inline-flex min-h-11 items-center gap-1 font-semibold text-texte-doux hover:text-texte">
            <Icone nom="archive" size={13} /> Ranger
          </button>
        )}
      </footer>
    </article>
  );
}

function CarteNouveaute({ n, onOuvrir }: { n: NouveauteAffichee; onOuvrir: () => void }) {
  const interet = INTERETS_VEILLE[n.resume.interet];
  return (
    <button
      type="button"
      onClick={onOuvrir}
      className={cn(
        "flex w-full flex-col gap-2 rounded-carte border bg-surface-1 p-4 text-left shadow-carte transition-colors hover:bg-surface-2",
        n.rouge && (n.statut === "nouvelle" || n.statut === "essayer") ? "border-brique/50" : "border-trait",
      )}
    >
      <span className="flex items-center gap-2">
        <span className="min-w-0 flex-1 truncate text-[15px] font-semibold text-texte">
          {n.outil} <span className="font-normal text-texte-doux">· {afficherVersion(n.versionVue)}</span>
        </span>
        <Icone nom="chevron-droite" size={18} className="shrink-0 text-texte-faible" />
      </span>
      <span className="flex flex-wrap gap-1.5">
        {n.rouge && (
          <Pastille ton="brique" icone="attention">
            Alerte
          </Pastille>
        )}
        <Pastille ton={interet.tonalite}>{interet.libelle}</Pastille>
        {n.statut !== "nouvelle" && <Pastille ton={STATUTS_NOUVEAUTE[n.statut].tonalite}>{STATUTS_NOUVEAUTE[n.statut].libelle}</Pastille>}
      </span>
      <span className="line-clamp-2 text-sm text-texte-doux">{n.resume.ceQueCaChange}</span>
    </button>
  );
}

function FeuilleNouveaute({ n, onFermer }: { n: NouveauteAffichee | null; onFermer: () => void }) {
  const { enCours, faire } = useGeste();
  const ouverte = n !== null;
  return (
    <FeuilleBas
      ouverte={ouverte}
      onOuverteChange={(v) => !v && onFermer()}
      titre={n ? `${n.outil} · ${afficherVersion(n.versionVue)}` : "Nouveauté"}
      description={n ? `Vue le ${dateAvecAnnee(n.date)}` : undefined}
      pied={
        n && (n.statut === "nouvelle" || n.statut === "essayer") ? (
          <div className="grid grid-cols-2 gap-2">
            <Bouton variante="secondaire" icone="archive" disabled={enCours} onClick={() => faire(() => ignorerNouveauteAction(n.id), "Rangée", onFermer)}>
              Ignorer
            </Bouton>
            <Bouton icone="coche" chargement={enCours} disabled={n.statut === "essayer"} onClick={() => faire(() => essayerNouveauteAction(n.id), "Ajouté à vos tâches", onFermer)}>
              {n.statut === "essayer" ? "Déjà à essayer" : "Essayer"}
            </Bouton>
          </div>
        ) : n ? (
          <Bouton variante="secondaire" icone="repeter" pleineLargeur disabled={enCours} onClick={() => faire(() => reprendreNouveauteAction(n.id), "Remise à regarder", onFermer)}>
            Remettre à regarder
          </Bouton>
        ) : null
      }
    >
      {n && (
        <div className="space-y-4">
          {n.rouge && (
            <p className="flex gap-2 rounded-xl border border-brique/30 bg-brique-doux p-3 text-sm font-semibold text-brique">
              <Icone nom="attention" size={18} className="shrink-0" />
              {n.resume.risque ?? "À relire avant toute mise à jour."}
            </p>
          )}
          <div>
            <p className="mb-1 text-xs font-bold uppercase tracking-wider text-texte-faible">Ce que ça change pour vos vidéos</p>
            <p className="text-[15px] leading-relaxed text-texte">{n.resume.ceQueCaChange}</p>
            {n.simule !== false && <p className="mt-1 text-xs text-texte-faible">Résumé simplifié, fait par le studio (pas par Claude).</p>}
          </div>
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-xs text-texte-faible">Intérêt pour nous</dt>
              <dd className="mt-1">
                <Pastille ton={INTERETS_VEILLE[n.resume.interet].tonalite} taille="md">
                  {INTERETS_VEILLE[n.resume.interet].libelle}
                </Pastille>
              </dd>
            </div>
            <div>
              <dt className="text-xs text-texte-faible">Risque</dt>
              <dd className="mt-1 font-semibold text-texte">{n.resume.risque && !n.rouge ? n.resume.risque : n.rouge ? "Oui, lisez l'alerte" : "Aucun repéré"}</dd>
            </div>
          </dl>
          {n.tacheCreeeLe && <p className="text-sm text-texte-doux">À essayer depuis le {dateAvecAnnee(n.tacheCreeeLe)}, sur le banc d&apos;essai d&apos;abord.</p>}
          <p className="text-xs text-texte-faible">Rien n&apos;est mis à jour sans votre accord.</p>
          {n.lien && (
            <a href={n.lien} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-orange-vif hover:underline">
              Voir la source <Icone nom="lien" size={14} />
            </a>
          )}
        </div>
      )}
    </FeuilleBas>
  );
}

function FeuilleAjout({ ouverte, onOuverteChange }: { ouverte: boolean; onOuverteChange: (v: boolean) => void }) {
  const [nom, setNom] = useState("");
  const [adresse, setAdresse] = useState("");
  const { enCours, faire } = useGeste();
  return (
    <FeuilleBas
      ouverte={ouverte}
      onOuverteChange={onOuverteChange}
      titre="Surveiller un outil"
      description="Un nom et l'adresse de ses nouveautés."
      pied={
        <Bouton
          pleineLargeur
          taille="lg"
          icone="plus"
          chargement={enCours}
          disabled={!nom.trim() || !adresse.trim()}
          onClick={() =>
            faire(() => ajouterOutilAction(nom, adresse), "Outil ajouté", () => {
              setNom("");
              setAdresse("");
              onOuverteChange(false);
            })
          }
        >
          Ajouter
        </Bouton>
      }
    >
      <div className="space-y-4">
        <Champ libelle="Nom" value={nom} onChange={(e) => setNom(e.target.value)} placeholder="Ex. Kling" maxLength={60} />
        <Champ libelle="Adresse" value={adresse} onChange={(e) => setAdresse(e.target.value)} placeholder="https://…" inputMode="url" aide="La page où l'outil annonce ses nouveautés." />
      </div>
    </FeuilleBas>
  );
}
