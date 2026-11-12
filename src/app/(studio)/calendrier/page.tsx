import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { EnTetePage } from "@/components/ui/EnTetePage";
import { EtatVide } from "@/components/ui/EtatVide";
import { Icone } from "@/components/ui/Icone";
import { LogoReseau } from "@/components/ui/LogoReseau";
import { Pastille } from "@/components/ui/Pastille";
import { libellePublication } from "@/domaine/buffer";
import { SemaineAvecApercu } from "@/components/calendrier/ApercuPublication";
import { RESEAUX_CALENDRIER, basculerReseau } from "@/components/calendrier/BarreFiltres";
import { libellePeriode } from "@/components/calendrier/BarreVue";
import { EnTeteCalendrier } from "@/components/calendrier/EnTeteCalendrier";
import { BandeauDepart, PanneauAFaire } from "@/components/calendrier/PanneauAFaire";
import { ReserveAPlacer } from "@/components/calendrier/ReserveAPlacer";
import { VueJour, debutDeTexte } from "@/components/calendrier/VueJour";
import type { IdReseau } from "@/domaine/types";
import { entreeDepuisPublication } from "@/components/calendrier/apercu-reseau";
import { cn } from "@/lib/cn";
import { cleJour, heure } from "@/lib/dates";
import { ajouterJoursParis, instantParis } from "@/lib/horloge-paris";
import { adresseVueJour, plageMois, plageSemaine } from "@/lib/calendrier-plages";
import { GrilleMois } from "@/components/calendrier/GrilleMois";
import type { EntreeCarte } from "@/components/calendrier/CarteEntreeCalendrier";
import { etatDepuisStatut } from "@/components/calendrier/PastilleStatutPlan";
import { listerAProgrammer, listerCalendrier, type JourCalendrier } from "@/services/publications";
import { exigerSession } from "@/services/auth";

export const metadata: Metadata = { title: "Calendrier" };
export const dynamic = "force-dynamic";

const FUSEAU = "Europe/Paris";
const jourSemaine = new Intl.DateTimeFormat("fr-FR", { weekday: "short", timeZone: FUSEAU });
const jourMois = new Intl.DateTimeFormat("fr-FR", { day: "numeric", timeZone: FUSEAU });
const moisAnnee = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", timeZone: FUSEAU });

const libelleJourLong = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long", timeZone: FUSEAU });
const libelleMois = new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric", timeZone: "UTC" });

/** « AAAA-MM-JJ » réel, ou « AAAA-MM » (→ le 1er) ; sinon null. */
function lireDate(brut: string | undefined): string | null {
  const m = /^(\d{4})-(\d{2})(?:-(\d{2}))?$/.exec(brut ?? "");
  if (!m) return null;
  const jour = `${m[1]}-${m[2]}-${m[3] ?? "01"}`;
  const d = new Date(`${jour}T12:00:00Z`);
  return Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== jour ? null : jour;
}

/** Réseaux allumés d'après ?reseaux=a,b (absent : les quatre ; vide ou inconnu : aucun). Toujours dans l'ordre de la maquette. */
function lireReseaux(brut: string | string[] | undefined): IdReseau[] {
  if (brut === undefined) return [...RESEAUX_CALENDRIER];
  const demandes = new Set((Array.isArray(brut) ? brut.join(",") : brut).split(","));
  return RESEAUX_CALENDRIER.filter((r) => demandes.has(r));
}

/** « &reseaux=… » à ajouter aux adresses quand un filtre est actif ; rien si les quatre réseaux sont allumés. */
function suiteReseaux(actifs: readonly IdReseau[]): string {
  return actifs.length === RESEAUX_CALENDRIER.length ? "" : `&reseaux=${actifs.join(",")}`;
}

/** Ajoute le filtre des réseaux à une adresse du calendrier (rien si les quatre sont allumés). */
function avecReseaux(base: string, actifs: readonly IdReseau[]): string {
  const suite = suiteReseaux(actifs);
  return !suite ? base : base.includes("?") ? `${base}${suite}` : `${base}?${suite.slice(1)}`;
}

/** « + Ajouter » mène à la journée d'aujourd'hui, en attendant le formulaire d'ajout (CAL-26b). */
const lienAjouter = () => `/calendrier?vue=jour&date=${cleJour(new Date())}`;

function moisVoisin(mois: string, delta: number): string {
  const d = new Date(`${mois}-01T12:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + delta);
  return d.toISOString().slice(0, 7);
}

type Pub = JourCalendrier["publications"][number];

/**
 * CALENDRIER (AV2.4-2) — niveau 3 : semaine par semaine. Liste par jour sur mobile,
 * 7 colonnes sur ordinateur, « À programmer » en bas.
 * Les publications « simulation » ne sont JAMAIS montrées comme programmées (pastille Essai).
 */
export default async function PageCalendrier({ searchParams }: { searchParams: Promise<{ semaine?: string; vue?: string; date?: string; reseaux?: string }> }) {
  await exigerSession();
  const params = await searchParams;
  const dateDemandee = lireDate(params.date);
  const reseauxActifs = lireReseaux(params.reseaux);
  const suite = suiteReseaux(reseauxActifs);
  if (params.vue === "jour") {
    const jour = dateDemandee ?? cleJour(new Date());
    // Journée de Paris, de minuit à minuit (23 h ou 25 h le jour d'un changement d'heure).
    const finIso = new Date(new Date(instantParis(ajouterJoursParis(jour, 1), "00:00")).getTime() - 1).toISOString();
    return <PageJour jour={jour} reseauxActifs={reseauxActifs} calendrier={await listerCalendrier(instantParis(jour, "00:00"), finIso)} />;
  }
  if (params.vue === "mois") {
    const plage = plageMois(dateDemandee ?? cleJour(new Date()));
    return <VueMois plage={plage} repere={dateDemandee ?? cleJour(new Date())} calendrier={await listerCalendrier(plage.debutIso, plage.finIso)} suite={suite} reseauxActifs={reseauxActifs} />;
  }
  const aujourdhuiCle = cleJour(new Date());
  const decalageDemande = Math.max(-52, Math.min(52, Number.parseInt(params.semaine ?? "0", 10) || 0));
  // La semaine est toujours construite en jours de Paris (jamais à l'heure du serveur).
  // ?date= (vue semaine) : la semaine qui contient ce jour ; ?semaine=N reste le décalage relatif (borné à ±52).
  const plage = plageSemaine(dateDemandee ?? ajouterJoursParis(aujourdhuiCle, decalageDemande * 7));
  const lundiCle = plage.jours[0];
  const decalage = Math.round((Date.parse(`${lundiCle}T12:00:00Z`) - Date.parse(`${plageSemaine(aujourdhuiCle).jours[0]}T12:00:00Z`)) / (7 * 86_400_000));
  // Avec ?date=, la navigation reste portée par ?date= (pas de saut si la date dépasse ±52 semaines).
  const lienSemaine = (delta: number) => (dateDemandee ? `/calendrier?vue=semaine&date=${ajouterJoursParis(lundiCle, delta * 7)}` : `/calendrier?semaine=${decalageDemande + delta}`);
  const jours = plage.jours.map((j) => new Date(`${j}T12:00:00Z`));
  const [calendrier, aProgrammer] = await Promise.all([listerCalendrier(plage.debutIso, plage.finIso), listerAProgrammer()]);
  const parJour = new Map(calendrier.map((j) => [j.jour, j.publications]));
  const aujourdhui = aujourdhuiCle;
  // Les essais (rien n'a été envoyé) ne comptent pas comme des publications : ils sont annoncés à part.
  const semaine = jours.flatMap((j) => parJour.get(cleJour(j)) ?? []);
  const total = semaine.filter((p) => p.via !== "simulation").length;
  const essais = semaine.length - total;
  const adresseSemaine = dateDemandee ? `/calendrier?vue=semaine&date=${dateDemandee}` : decalageDemande ? `/calendrier?semaine=${decalageDemande}` : "/calendrier";
  // « À faire » : à corriger, à valider, brouillons ; les essais n'y sont pas.
  const aFaire = semaine.filter((p) => p.via !== "simulation").map((p) => {
    const e = entreeDepuisPublication(p);
    return { cle: e.cle, etat: e.etat, titre: debutDeTexte(p.texte) || e.titre, href: e.lienSource ?? adresseVueJour(e.jour) };
  });
  const libelleSemaine = decalage === 0 ? "Cette semaine" : decalage === 1 ? "Semaine prochaine" : decalage === -1 ? "Semaine dernière" : `${moisAnnee.format(jours[0])} – ${moisAnnee.format(jours[6])}`;

  return (
    <div>
      <EnTetePage titre="Calendrier" />
      <BandeauDepart />
      <EnTeteCalendrier
        vue="semaine"
        periode={libelleSemaine}
        reseauxActifs={reseauxActifs}
        lienReseau={(r) => avecReseaux(adresseSemaine, basculerReseau(reseauxActifs, r))}
        lienTout={adresseSemaine}
        lienAjouter={lienAjouter()}
        liens={{
          precedent: lienSemaine(-1),
          suivant: lienSemaine(1),
          aujourdhui: `/calendrier${suite ? `?${suite.slice(1)}` : ""}`,
          // « Semaine » garde la date d'une vue datée ; sans date, il reste /calendrier.
          semaine: dateDemandee ? `/calendrier?vue=semaine&date=${dateDemandee}${suite}` : `/calendrier${suite ? `?${suite.slice(1)}` : ""}`,
          mois: `/calendrier?vue=mois${dateDemandee ? `&date=${dateDemandee}` : ""}${suite}`,
        }}
      />
      <PanneauAFaire entrees={aFaire} />
      <p className="mb-5 text-center text-xs tabular-nums text-texte-faible">
        {moisAnnee.format(jours[0])} – {moisAnnee.format(jours[6])} · {total} publication{total > 1 ? "s" : ""}
        {essais > 0 && ` · ${essais} essai${essais > 1 ? "s" : ""}`}
      </p>

      {/* Mobile : liste par jour */}
      <ol className="space-y-4 lg:hidden">
        {jours.map((j) => {
          const cle = cleJour(j);
          const pubs = parJour.get(cle) ?? [];
          const estAujourdhui = cle === aujourdhui;
          if (!pubs.length && !estAujourdhui) return null;
          return (
            <li key={cle} className="flex gap-3">
              {/* Un clic sur un jour ouvre la vue du jour (heure par heure). */}
              <Link href={`/calendrier?vue=jour&date=${cle}${suite}`} aria-label={`Ouvrir la journée du ${libelleJourLong.format(j)}`} className={cn("flex w-12 shrink-0 flex-col items-center self-start rounded-2xl py-2", estAujourdhui ? "bg-orange text-sur-orange" : "bg-surface-1 text-texte-doux")}>
                <span className="text-[11px] font-bold uppercase">{jourSemaine.format(j).replace(".", "")}</span>
                <span className="font-titre text-xl tabular-nums">{jourMois.format(j)}</span>
              </Link>
              <ul className="min-w-0 flex-1 space-y-2">
                {pubs.length ? pubs.map((p) => <LignePublication key={p.id} p={p} />) : <li className="flex min-h-14 items-center text-sm text-texte-faible">Rien de prévu.</li>}
              </ul>
            </li>
          );
        })}
      </ol>
      {/* « Libre » seulement quand rien n'est listé, essais compris (E2E-1 n° 16). */}
      {semaine.length === 0 && !jours.some((j) => cleJour(j) === aujourdhui) && (
        <div className="lg:hidden">
          <EtatVide compact icone="calendrier" titre="Semaine libre" phrase="Rien de prévu cette semaine." />
        </div>
      )}

      {/* Ordinateur : la semaine en couloirs ; un clic sur une carte ouvre l'aperçu à droite, sans quitter le calendrier (RC-36). */}
      <div className="hidden lg:block">
        <SemaineAvecApercu entrees={semaine.map(entreeDepuisPublication)} semaineDu={lundiCle} aujourdhui={aujourdhui} />
      </div>

      <ReserveAPlacer contenus={aProgrammer.map((v) => ({ id: v.id, titre: v.titre, vignette: v.vignette }))} />
    </div>
  );
}

/** Lot R1 : le libellé dit ce qui est vrai (« Brouillon dans Buffer », « À vérifier », « Essai »…). */
function EtatPublication({ p }: { p: Pub }) {
  const { libelle, ton } = libellePublication(p);
  return (
    <Pastille ton={ton} className={ton === "orange" ? "text-texte" : undefined}>
      {libelle}
    </Pastille>
  );
}

function LignePublication({ p }: { p: Pub }) {
  return (
    <li>
      <Link href={`/videos/${p.videoId}`} className="flex min-h-16 items-center gap-3 rounded-2xl border border-trait bg-surface-1 p-2 pr-3 transition-colors hover:border-trait-fort">
        <span className="relative aspect-[9/16] w-10 shrink-0 overflow-hidden rounded-lg bg-surface-2">
          {p.video?.vignette && <Image src={p.video.vignette} alt="" fill sizes="40px" className="object-cover" />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold text-texte">{p.video?.titre}</span>
          <span className="flex min-w-0 items-center gap-1.5 text-xs text-texte-faible">
            <LogoReseau reseau={p.reseau} taille="sm" />
            <span className="shrink-0">{heure(p.date)}</span>
            {/* Lot R1b : le compte visé (deux LinkedIn, deux Facebook). */}
            {p.canalNom && <span className="min-w-0 truncate">· {p.canalNom}</span>}
          </span>
        </span>
        <EtatPublication p={p} />
      </Link>
    </li>
  );
}

/**
 * Vue du jour (CAL-02) : heure par heure, publications de tous les réseaux, créneaux libres.
 * Le jour est celui de Paris.
 */
function PageJour({ jour, reseauxActifs, calendrier }: { jour: string; reseauxActifs: IdReseau[]; calendrier: JourCalendrier[] }) {
  const aujourdhui = cleJour(new Date());
  // Seules les publications qui tombent vraiment ce jour-là, à l'heure de Paris.
  const entrees = calendrier
    .flatMap((j) => j.publications)
    .filter((p) => cleJour(p.date) === jour)
    .map((p) => {
      const e = entreeDepuisPublication(p);
      return { ...e, titre: debutDeTexte(p.texte) || e.titre };
    });
  const liens = new Map(entrees.map((e) => [e.cle, e.lienSource]));
  const adresse = (vue: "jour" | "semaine" | "mois", date: string, actifs: readonly IdReseau[] = reseauxActifs) => `/calendrier?vue=${vue}&date=${date}${suiteReseaux(actifs)}`;
  return (
    <div>
      <EnTetePage titre="Calendrier" />
      <EnTeteCalendrier
        vue="jour"
        periode={libellePeriode("jour", jour)}
        reseauxActifs={reseauxActifs}
        lienReseau={(r) => adresse("jour", jour, basculerReseau(reseauxActifs, r))}
        lienTout={adresse("jour", jour, [...RESEAUX_CALENDRIER])}
        lienAjouter={lienAjouter()}
        liens={{ precedent: adresse("jour", ajouterJoursParis(jour, -1)), suivant: adresse("jour", ajouterJoursParis(jour, 1)), aujourdhui: adresse("jour", aujourdhui), semaine: adresse("semaine", jour), mois: adresse("mois", jour) }}
      />
      <Link href={adresse("semaine", jour)} className="mb-2 inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-texte-doux underline underline-offset-4">
        ← Retour à la semaine
      </Link>
      <VueJour jour={jour} aujourdhui={aujourdhui} entrees={entrees} reseaux={reseauxActifs} lienEntree={(e) => liens.get(e.cle) ?? null} />
    </div>
  );
}

/** Vue mois : grille de 6 semaines (lundi d'abord), jours hors mois estompés. */
function VueMois({ plage, repere, calendrier, suite, reseauxActifs }: { plage: ReturnType<typeof plageMois>; repere: string; calendrier: JourCalendrier[]; suite: string; reseauxActifs: IdReseau[] }) {
  const parJour = new Map(calendrier.map((j) => [j.jour, j.publications]));
  const aujourdhui = cleJour(new Date());
  const total = plage.jours.filter((j) => j.startsWith(plage.mois)).flatMap((j) => parJour.get(j) ?? []).filter((p) => p.via !== "simulation").length;
  const toutes = plage.jours.flatMap((j) => parJour.get(j) ?? []);
  const essais = toutes.filter((p) => p.via === "simulation").length;
  // Une entrée par publication réelle, rangée sous la clé du jour déjà calculée (jour de Paris) ; les essais restent à part.
  const entrees: EntreeCarte[] = plage.jours.flatMap((j) =>
    (parJour.get(j) ?? []).filter((p) => p.via !== "simulation").map((p, i) => ({ cle: `publication:${p.id ?? `${j}-${i}`}|${p.reseau}`, jour: j, reseau: p.reseau as IdReseau, type: p.videoId ? ("video" as const) : ("image" as const), etat: etatDepuisStatut(p.statut) ?? ("inconnu" as const) })),
  );
  const lienMois = (delta: number) => `/calendrier?vue=mois&date=${moisVoisin(plage.mois, delta)}${suite}`;
  return (
    <div>
      <EnTetePage titre="Calendrier" />
      <EnTeteCalendrier
        vue="mois"
        periode={libellePeriode("mois", plage.mois)}
        reseauxActifs={reseauxActifs}
        lienReseau={(r) => `/calendrier?vue=mois&date=${plage.mois}${suiteReseaux(basculerReseau(reseauxActifs, r))}`}
        lienTout={`/calendrier?vue=mois&date=${plage.mois}`}
        lienAjouter={lienAjouter()}
        liens={{
          precedent: lienMois(-1),
          suivant: lienMois(1),
          aujourdhui: `/calendrier?vue=mois${suite}`,
          // « Semaine » garde la date (celle demandée, ou celle d'aujourd'hui) et les filtres.
          semaine: `/calendrier?vue=semaine&date=${repere}${suite}`,
          mois: `/calendrier?vue=mois&date=${plage.mois}${suite}`,
        }}
      />
      <p className="mb-5 text-center text-xs tabular-nums text-texte-faible">{total} publication{total > 1 ? "s" : ""}</p>
      {/* CAL-05 : chaque jour (même vide, même d'un mois voisin) mène à la vue Jour ; un repère par réseau (picto, nom, nombre). Les essais ne sont pas des publications. */}
      <GrilleMois mois={plage.mois} aujourdhui={aujourdhui} entrees={entrees} lienJour={(j) => adresseVueJour(j, suite)} />
      {essais > 0 && (
        <p className="mt-2 text-center text-xs tabular-nums text-texte-faible">
          {essais} essai{essais > 1 ? "s" : ""} sur cette période (rien n&apos;a été envoyé)
        </p>
      )}
    </div>
  );
}
