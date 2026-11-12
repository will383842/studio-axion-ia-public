import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { EnTetePage, EnTeteSection } from "@/components/ui/EnTetePage";
import { EtatVide } from "@/components/ui/EtatVide";
import { Icone } from "@/components/ui/Icone";
import { LogoReseau } from "@/components/ui/LogoReseau";
import { Pastille } from "@/components/ui/Pastille";
import { libellePublication } from "@/domaine/buffer";
import { SemaineAvecApercu } from "@/components/calendrier/ApercuPublication";
import { entreeDepuisPublication } from "@/components/calendrier/apercu-reseau";
import { CarteVideo } from "@/components/videos/CarteVideo";
import { cn } from "@/lib/cn";
import { cleJour, heure } from "@/lib/dates";
import { ajouterJoursParis } from "@/lib/horloge-paris";
import { plageMois, plageSemaine } from "@/lib/calendrier-plages";
import { listerAProgrammer, listerCalendrier, type JourCalendrier } from "@/services/publications";
import { exigerSession } from "@/services/auth";

export const metadata: Metadata = { title: "Calendrier" };
export const dynamic = "force-dynamic";

const FUSEAU = "Europe/Paris";
const jourSemaine = new Intl.DateTimeFormat("fr-FR", { weekday: "short", timeZone: FUSEAU });
const jourMois = new Intl.DateTimeFormat("fr-FR", { day: "numeric", timeZone: FUSEAU });
const moisAnnee = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", timeZone: FUSEAU });

const libelleMois = new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric", timeZone: "UTC" });

/** « AAAA-MM-JJ » réel, ou « AAAA-MM » (→ le 1er) ; sinon null. */
function lireDate(brut: string | undefined): string | null {
  const m = /^(\d{4})-(\d{2})(?:-(\d{2}))?$/.exec(brut ?? "");
  if (!m) return null;
  const jour = `${m[1]}-${m[2]}-${m[3] ?? "01"}`;
  const d = new Date(`${jour}T12:00:00Z`);
  return Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== jour ? null : jour;
}

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
export default async function PageCalendrier({ searchParams }: { searchParams: Promise<{ semaine?: string; vue?: string; date?: string }> }) {
  await exigerSession();
  const params = await searchParams;
  const dateDemandee = lireDate(params.date);
  if (params.vue === "mois") {
    const plage = plageMois(dateDemandee ?? cleJour(new Date()));
    return <VueMois plage={plage} calendrier={await listerCalendrier(plage.debutIso, plage.finIso)} />;
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
  const libelleSemaine = decalage === 0 ? "Cette semaine" : decalage === 1 ? "Semaine prochaine" : decalage === -1 ? "Semaine dernière" : `${moisAnnee.format(jours[0])} – ${moisAnnee.format(jours[6])}`;

  return (
    <div>
      <EnTetePage titre="Calendrier" />
      <ChoixVue vue="semaine" />

      {/* Navigation de semaine */}
      <div className="mb-5 flex items-center gap-2">
        <Link href={lienSemaine(-1)} aria-label="Semaine précédente" className="grid size-11 place-items-center rounded-full border border-trait bg-surface-1 text-texte-doux hover:text-texte">
          <Icone nom="chevron-gauche" size={18} />
        </Link>
        <div className="flex-1 text-center">
          <p className="font-titre text-lg text-texte">{libelleSemaine}</p>
          <p className="text-xs tabular-nums text-texte-faible">
            {moisAnnee.format(jours[0])} – {moisAnnee.format(jours[6])} · {total} publication{total > 1 ? "s" : ""}
            {essais > 0 && ` · ${essais} essai${essais > 1 ? "s" : ""}`}
          </p>
        </div>
        <Link href={lienSemaine(1)} aria-label="Semaine suivante" className="grid size-11 place-items-center rounded-full border border-trait bg-surface-1 text-texte-doux hover:text-texte">
          <Icone nom="chevron-droite" size={18} />
        </Link>
      </div>
      {decalage !== 0 && (
        <div className="-mt-3 mb-4 text-center">
          <Link href="/calendrier" className="inline-flex min-h-11 items-center gap-1.5 rounded-full px-3 text-sm font-semibold text-orange-vif">
            <Icone nom="calendrier" size={15} />
            Aujourd&apos;hui
          </Link>
        </div>
      )}

      {/* Mobile : liste par jour */}
      <ol className="space-y-4 lg:hidden">
        {jours.map((j) => {
          const cle = cleJour(j);
          const pubs = parJour.get(cle) ?? [];
          const estAujourdhui = cle === aujourdhui;
          if (!pubs.length && !estAujourdhui) return null;
          return (
            <li key={cle} className="flex gap-3">
              <div className={cn("flex w-12 shrink-0 flex-col items-center rounded-2xl py-2", estAujourdhui ? "bg-orange text-sur-orange" : "bg-surface-1 text-texte-doux")}>
                <span className="text-[11px] font-bold uppercase">{jourSemaine.format(j).replace(".", "")}</span>
                <span className="font-titre text-xl tabular-nums">{jourMois.format(j)}</span>
              </div>
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

      {aProgrammer.length > 0 && (
        <section className="mt-10">
          <EnTeteSection titre="À programmer" compteur={aProgrammer.length} />
          <ul className="sans-barre -mx-4 flex gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:grid sm:grid-cols-4 sm:px-0 lg:grid-cols-6">
            {aProgrammer.map((v) => (
              <li key={v.id} className="w-36 shrink-0 sm:w-auto">
                <CarteVideo video={v} ratioForce="9:16" />
              </li>
            ))}
          </ul>
        </section>
      )}
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

function ChoixVue({ vue, mois }: { vue: "semaine" | "mois"; mois?: string }) {
  const lien = (actif: boolean) => cn("inline-flex min-h-11 items-center rounded-full px-4 text-sm font-semibold", actif ? "bg-orange text-sur-orange" : "border border-trait bg-surface-1 text-texte-doux");
  return (
    <nav aria-label="Choix de la vue" className="mb-4 flex gap-2">
      <Link href="/calendrier" className={lien(vue === "semaine")}>Semaine</Link>
      <Link href={`/calendrier?vue=mois${mois ? `&date=${mois}` : ""}`} className={lien(vue === "mois")}>Mois</Link>
    </nav>
  );
}

/** Vue mois : grille de 6 semaines (lundi d'abord), jours hors mois estompés. */
function VueMois({ plage, calendrier }: { plage: ReturnType<typeof plageMois>; calendrier: JourCalendrier[] }) {
  const parJour = new Map(calendrier.map((j) => [j.jour, j.publications]));
  const aujourdhui = cleJour(new Date());
  const total = plage.jours.filter((j) => j.startsWith(plage.mois)).flatMap((j) => parJour.get(j) ?? []).filter((p) => p.via !== "simulation").length;
  const lienMois = (delta: number) => `/calendrier?vue=mois&date=${moisVoisin(plage.mois, delta)}`;
  return (
    <div>
      <EnTetePage titre="Calendrier" />
      <ChoixVue vue="mois" mois={plage.mois} />
      <div className="mb-5 flex items-center gap-2">
        <Link href={lienMois(-1)} aria-label="Mois précédent" className="grid size-11 place-items-center rounded-full border border-trait bg-surface-1 text-texte-doux hover:text-texte">
          <Icone nom="chevron-gauche" size={18} />
        </Link>
        <div className="flex-1 text-center">
          <p className="font-titre text-lg capitalize text-texte">{libelleMois.format(new Date(`${plage.mois}-01T12:00:00Z`))}</p>
          <p className="text-xs tabular-nums text-texte-faible">{total} publication{total > 1 ? "s" : ""}</p>
        </div>
        <Link href={lienMois(1)} aria-label="Mois suivant" className="grid size-11 place-items-center rounded-full border border-trait bg-surface-1 text-texte-doux hover:text-texte">
          <Icone nom="chevron-droite" size={18} />
        </Link>
      </div>
      <ol className="grid grid-cols-7 gap-1">
        {plage.jours.map((j) => {
          const toutes = parJour.get(j) ?? [];
          const pubs = toutes.filter((p) => p.via !== "simulation");
          const essais = toutes.length - pubs.length;
          const dansMois = j.startsWith(plage.mois);
          return (
            <li key={j} className={cn("min-h-14 rounded-xl border p-1 text-xs", j === aujourdhui ? "border-orange bg-surface-1" : "border-trait", !dansMois && "opacity-40")}>
              <span className="tabular-nums text-texte-doux">{Number(j.slice(8))}</span>
              {toutes.length > 0 && (
                <Link href={`/calendrier?vue=semaine&date=${j}`} className="mt-1 block truncate font-semibold text-texte">
                  {pubs.length > 0 && (
                    <>
                      {pubs.length} <span className="sr-only">publication{pubs.length > 1 ? "s" : ""}</span>
                    </>
                  )}
                  {essais > 0 && <span className="block text-[11px] font-normal text-texte-faible">{essais} essai{essais > 1 ? "s" : ""}</span>}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
