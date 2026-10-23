import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { EnTetePage, EnTeteSection } from "@/components/ui/EnTetePage";
import { EtatVide } from "@/components/ui/EtatVide";
import { Icone } from "@/components/ui/Icone";
import { LogoReseau } from "@/components/ui/LogoReseau";
import { Pastille } from "@/components/ui/Pastille";
import { libellePublication } from "@/domaine/buffer";
import { CarteVideo } from "@/components/videos/CarteVideo";
import { cn } from "@/lib/cn";
import { ajouterJours, cleJour, heure } from "@/lib/dates";
import { listerAProgrammer, listerCalendrier, type JourCalendrier } from "@/services/publications";
import { exigerSession } from "@/services/auth";

export const metadata: Metadata = { title: "Calendrier" };
export const dynamic = "force-dynamic";

const FUSEAU = "Europe/Paris";
const jourSemaine = new Intl.DateTimeFormat("fr-FR", { weekday: "short", timeZone: FUSEAU });
const jourMois = new Intl.DateTimeFormat("fr-FR", { day: "numeric", timeZone: FUSEAU });
const moisAnnee = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", timeZone: FUSEAU });

/** Lundi (midi, pour éviter les changements d'heure) de la semaine décalée de `decalage`. */
function lundi(decalage: number): Date {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  const jour = (d.getDay() + 6) % 7; // 0 = lundi
  return ajouterJours(d, -jour + decalage * 7);
}

type Pub = JourCalendrier["publications"][number];

/**
 * CALENDRIER (AV2.4-2) — niveau 3 : semaine par semaine. Liste par jour sur mobile,
 * 7 colonnes sur ordinateur, « À programmer » en bas.
 * Les publications « simulation » ne sont JAMAIS montrées comme programmées (pastille Essai).
 */
export default async function PageCalendrier({ searchParams }: { searchParams: Promise<{ semaine?: string }> }) {
  await exigerSession();
  const decalage = Math.max(-52, Math.min(52, Number.parseInt((await searchParams).semaine ?? "0", 10) || 0));
  const debut = lundi(decalage);
  const jours = Array.from({ length: 7 }, (_, i) => ajouterJours(debut, i));
  const [calendrier, aProgrammer] = await Promise.all([
    listerCalendrier(ajouterJours(debut, -1).toISOString(), ajouterJours(debut, 7).toISOString()),
    listerAProgrammer(),
  ]);
  const parJour = new Map(calendrier.map((j) => [j.jour, j.publications]));
  const aujourdhui = cleJour(new Date());
  // Les essais (rien n'a été envoyé) ne comptent pas comme des publications : ils sont annoncés à part.
  const semaine = jours.flatMap((j) => parJour.get(cleJour(j)) ?? []);
  const total = semaine.filter((p) => p.via !== "simulation").length;
  const essais = semaine.length - total;
  const libelleSemaine = decalage === 0 ? "Cette semaine" : decalage === 1 ? "Semaine prochaine" : decalage === -1 ? "Semaine dernière" : `${moisAnnee.format(jours[0])} – ${moisAnnee.format(jours[6])}`;

  return (
    <div>
      <EnTetePage titre="Calendrier" />

      {/* Navigation de semaine */}
      <div className="mb-5 flex items-center gap-2">
        <Link href={`/calendrier?semaine=${decalage - 1}`} aria-label="Semaine précédente" className="grid size-11 place-items-center rounded-full border border-trait bg-surface-1 text-texte-doux hover:text-texte">
          <Icone nom="chevron-gauche" size={18} />
        </Link>
        <div className="flex-1 text-center">
          <p className="font-titre text-lg text-texte">{libelleSemaine}</p>
          <p className="text-xs tabular-nums text-texte-faible">
            {moisAnnee.format(jours[0])} – {moisAnnee.format(jours[6])} · {total} publication{total > 1 ? "s" : ""}
            {essais > 0 && ` · ${essais} essai${essais > 1 ? "s" : ""}`}
          </p>
        </div>
        <Link href={`/calendrier?semaine=${decalage + 1}`} aria-label="Semaine suivante" className="grid size-11 place-items-center rounded-full border border-trait bg-surface-1 text-texte-doux hover:text-texte">
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

      {/* Ordinateur : semaine en 7 colonnes */}
      <ol className="hidden grid-cols-7 gap-2 lg:grid">
        {jours.map((j) => {
          const cle = cleJour(j);
          const pubs = parJour.get(cle) ?? [];
          const estAujourdhui = cle === aujourdhui;
          return (
            <li key={cle} className={cn("flex min-h-64 flex-col rounded-carte border p-2", estAujourdhui ? "border-orange/50 bg-orange-doux" : "border-trait bg-surface-1")}>
              <p className="mb-2 flex items-baseline gap-1.5 px-1">
                <span className="text-xs font-bold uppercase text-texte-faible">{jourSemaine.format(j).replace(".", "")}</span>
                <span className={cn("font-titre text-lg tabular-nums", estAujourdhui ? "text-orange-vif" : "text-texte")}>{jourMois.format(j)}</span>
              </p>
              <ul className="space-y-1.5">
                {pubs.map((p) => (
                  <li key={p.id}>
                    <Link href={`/videos/${p.videoId}`} className="block overflow-hidden rounded-xl border border-trait bg-surface-2 transition-colors hover:border-trait-fort">
                      {p.video?.vignette && (
                        <span className="relative block aspect-video">
                          <Image src={p.video.vignette} alt="" fill sizes="160px" className="object-cover" />
                        </span>
                      )}
                      <span className="block p-2">
                        <span className="mb-1 flex items-center gap-1.5">
                          <LogoReseau reseau={p.reseau} taille="sm" />
                          <span className="min-w-0 truncate text-[11px] tabular-nums text-texte-faible">
                            {heure(p.date)}
                            {p.canalNom ? ` · ${p.canalNom}` : ""}
                          </span>
                        </span>
                        <span className="line-clamp-2 text-xs font-semibold text-texte">{p.video?.titre}</span>
                        <span className="mt-1 block">
                          <EtatPublication p={p} />
                        </span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </li>
          );
        })}
      </ol>

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
