import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Apparition } from "@/components/ui/Apparition";
import { BarreActionCollee } from "@/components/ui/BarreActionCollee";
import { Bouton } from "@/components/ui/Bouton";
import { Carte } from "@/components/ui/Carte";
import { EnTetePage, EnTeteSection } from "@/components/ui/EnTetePage";
import { EtatVide } from "@/components/ui/EtatVide";
import { Icone } from "@/components/ui/Icone";
import { Pastille } from "@/components/ui/Pastille";
import { PucesActives } from "@/components/ui/PanneauFiltres";
import { Section } from "@/components/ui/Section";
import { FormeRatio } from "@/components/ui/SelecteurPastilles";
import { BoutonMePrevenir } from "@/components/videos/BoutonMePrevenir";
import { NettoyerNonTerminees } from "@/components/videos/NettoyerNonTerminees";
import { GalerieVideos } from "@/components/videos/GalerieVideos";
import { formatBientot, titrePageFormat } from "@/components/videos/formatBientot";
import { OngletsMesVideos } from "@/components/videos/OngletsMesVideos";
import { FiltresMesVideos, PLURIEL } from "@/components/videos/FiltresMesVideos";
import { compterParReseau, filtrerCartes, lienFiltres, lireFiltres, type ParametresAdresse } from "@/domaine/filtres-mes-videos";
import { compteursMesVideos } from "@/domaine/mes-videos";
import { adresseCreationFormat, libelleDuree, listerFormats, nomCourtFormat, trouverFormat, valeursDuree } from "@/formats";
import { obtenirReseau } from "@/reseaux";
import { statsFormat } from "@/services/C-videos-publication-complements";
import { obtenirFicheFormat } from "@/services/formats";
import { listerSeries, listerVideos } from "@/services/videos";
import { exigerSession } from "@/services/auth";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  await exigerSession();
  return { title: nomCourtFormat(trouverFormat((await params).id) ?? { id: "format", nom: "Format" }) };
}

const compact = new Intl.NumberFormat("fr-FR", { notation: "compact", maximumFractionDigits: 1 });

/**
 * ONGLET D'UN FORMAT (B.8 #6, AV2.1) = onglet de galerie dans Mes vidéos + fiche du format — niveau 1.
 * En-tête du format, chiffres (vues moyennes), UNE galerie de toutes ses vidéos non archivées, scripts.
 * Action : « Nouvelle vidéo de ce format » (actif) ou « Me prévenir » (bientôt).
 */
export default async function PageFormat({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<ParametresAdresse> }) {
  await exigerSession();
  const { id } = await params;
  const sp = await searchParams;
  const [fiche, toutes, stats, series] = await Promise.all([obtenirFicheFormat(id), listerVideos({ inclureArchivees: true }), statsFormat(id), listerSeries()]);
  if (!fiche) notFound();
  const f = fiche.format;
  const actif = f.statut === "actif";
  // « Bientôt » seulement pour un format réellement pas fait : pas pour un format ouvert dans la navigation (Image → vidéo, essai).
  const ouvert = trouverFormat(f.id)?.ouvertDansLaNavigation === true;
  const bientot = formatBientot(f.statut, ouvert);
  // Lot M : mêmes rangées Réseau et Étape que Mes vidéos (le format est déjà celui de la page).
  const filtres = lireFiltres({ ...sp, format: undefined });
  const sansReseau = filtrerCartes(fiche.videos, { etape: filtres.etape });
  const reseaux = compterParReseau(sansReseau);
  const affichees = filtres.reseau ? filtrerCartes(sansReseau, { reseau: filtres.reseau }) : sansReseau;
  const compteurs = compteursMesVideos(toutes, listerFormats({ inclureMasques: true, inclureReservesAWill: true }).map((x) => x.id));

  // Même barre que Mes vidéos : un bouton « Filtres (n) » dans la galerie, des puces retirables.
  const base = `/formats/${id}`;
  const puces = [
    ...(filtres.reseau ? [{ libelle: obtenirReseau(filtres.reseau).nom, href: lienFiltres(base, sp, { reseau: undefined }) }] : []),
    ...(filtres.etape ? [{ libelle: PLURIEL[filtres.etape], href: lienFiltres(base, sp, { etape: undefined }) }] : []),
  ];
  const effacerHref = lienFiltres(base, sp, { reseau: undefined, etape: undefined });
  const filtresAdresse = {
    contenu: <FiltresMesVideos base={base} params={sp} filtres={filtres} reseaux={reseaux} disposition="panneau" />,
    puces: <PucesActives puces={puces} effacerHref={effacerHref} sansEffacer />,
    nombre: puces.length,
    effacerHref,
  };

  const chiffres = [
    // Le nombre de vidéos est dans l'en-tête de la galerie unique plus bas (E2E-1 n° 31) : ici, les scripts.
    { libelle: "Scripts", valeur: String(fiche.scripts.length), icone: "document" as const },
    { libelle: "Vues moyennes", valeur: stats.vuesMoyennes !== null ? compact.format(stats.vuesMoyennes) : "—", icone: "oeil" as const },
    { libelle: "Qualité", valeur: stats.qualiteMoyenne !== null ? String(stats.qualiteMoyenne) : "—", icone: "etoile" as const },
  ];

  return (
    <div>
      <EnTetePage titre={titrePageFormat(f.nom, bientot)} sousTitre={f.accroche} />
      <OngletsMesVideos
        actif={id}
        compteParFormat={compteurs.parFormat}
        nbToutes={compteurs.toutes}
        nbBrouillons={compteurs.brouillons}
        nbArchivees={compteurs.archivees}
        nbAutres={compteurs.autres}
        className="mb-5"
      />

      {/* Fiche du format : icône, durées, formats d'image, éléments à fournir */}
      <Apparition>
        <Carte className="mb-6 p-5 sm:p-7">
          <div className="flex items-center gap-4">
            <span className="grid size-14 shrink-0 place-items-center rounded-2xl bg-surface-2 text-texte-faible">
              <Icone nom={f.icone} size={26} />
            </span>
            <div className="flex min-w-0 flex-1 flex-wrap gap-1.5">
              {bientot && (
                <Pastille ton="ambre" icone="horloge">
                  Bientôt
                </Pastille>
              )}
              {valeursDuree(f).map((d) => (
                <Pastille key={d} taille="md" icone="horloge">
                  {libelleDuree(d)}
                </Pastille>
              ))}
              {f.ratios.map((r) => (
                <Pastille key={r} ton="neutre" taille="md">
                  <FormeRatio ratio={r} className="scale-75" />
                  {r}
                </Pastille>
              ))}
            </div>
          </div>
        </Carte>
        {bientot && f.aFournir.length > 0 && (
          <Section id="a-fournir" titre="À fournir" className="mb-6">
            <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {f.aFournir.map((a) => (
                <li key={a} className="flex items-center gap-2.5 text-sm text-texte">
                  <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-surface-2 text-texte-faible">
                    <Icone nom="coche" size={14} />
                  </span>
                  {a}
                </li>
              ))}
            </ul>
          </Section>
        )}
      </Apparition>

      {/* Chiffres du format */}
      {(actif || stats.nbPretes > 0) && (
        <ul className="mb-8 grid grid-cols-3 gap-2 sm:gap-3">
          {chiffres.map((c, i) => (
            <li key={c.libelle}>
              <Apparition index={i + 1}>
                <div className="rounded-carte border border-trait bg-surface-1 p-3 sm:p-4">
                  <p className="flex items-center gap-1.5 text-[11px] font-semibold text-texte-faible sm:text-xs">
                    <Icone nom={c.icone} size={13} />
                    {c.libelle}
                  </p>
                  <p className="mt-1.5 font-titre text-2xl tabular-nums text-texte sm:text-3xl">{c.valeur}</p>
                </div>
              </Apparition>
            </li>
          ))}
        </ul>
      )}

      {/* Exemples d'un format bientôt */}
      {f.exemples.length > 0 && !fiche.videos.length && (
        <section className="mb-8">
          <EnTeteSection titre="Exemples" />
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {f.exemples.map((e, i) => (
              <li key={e.titre}>
                <Apparition index={i}>
                  <div className="theme-sombre relative aspect-[9/16] overflow-hidden rounded-carte border border-trait">
                    <Image src={e.vignette} alt={e.titre} fill sizes="(max-width: 640px) 50vw, 240px" className="object-cover" />
                    <div aria-hidden className="absolute inset-x-0 bottom-0 h-1/2 bg-linear-to-t from-fond/90 to-transparent" />
                    <p className="absolute inset-x-3 bottom-3 line-clamp-2 text-sm font-semibold text-texte">{e.titre}</p>
                  </div>
                </Apparition>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Toutes les vidéos non archivées du format, tous statuts (même règle que l'onglet et la barre latérale) */}
      <section className="mb-8">
        <EnTeteSection titre="Vidéos" compteur={fiche.videos.length} />
        <div className="mb-3 flex justify-end">
          <NettoyerNonTerminees formatId={f.id} />
        </div>
        <GalerieVideos
          key={`${filtres.etape ?? ""}-${filtres.reseau ?? ""}`}
          videos={affichees}
          series={series.map((s) => ({ id: s.id, nom: s.nom }))}
          filtresAdresse={filtresAdresse}
          afficherFormat={false}
          ratioForce={f.ratioMaitre}
          vide={<EtatVide compact icone={f.icone} titre="Pas encore de vidéo" phrase={bientot ? "Ce format arrive bientôt." : "Lancez la première."} />}
        />
        {fiche.nbArchivees > 0 && (
          <p className="mt-4 text-sm">
            <Link href={`/videos?vue=archivees&format=${encodeURIComponent(f.id)}`} className="font-semibold text-texte-doux underline-offset-4 hover:text-texte hover:underline">
              Archivées de ce format ({fiche.nbArchivees})
            </Link>
          </p>
        )}
      </section>

      {/* Scripts de ce format */}
      {fiche.scripts.length > 0 && (
        <section>
          <EnTeteSection titre="Scripts" compteur={fiche.scripts.length} lien={{ href: "/ecrire", libelle: "Écrire" }} />
          <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {fiche.scripts.slice(0, 3).map((s) => (
              <li key={s.id}>
                <Link href={`/scripts/${s.id}`} className="flex min-h-16 items-center gap-3 rounded-2xl border border-trait bg-surface-1 p-3 transition-colors hover:border-trait-fort hover:bg-surface-2">
                  <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-surface-2 text-texte-doux">
                    <Icone nom={s.reference ? "signet" : "document"} size={18} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-texte">{s.sujet}</span>
                    <span className="text-xs tabular-nums text-texte-faible">
                      {libelleDuree(s.dureeEstimeeSec)}
                      {s.notes ? ` · ${s.notes.globale}/100` : ""}
                    </span>
                  </span>
                  <Icone nom="chevron-droite" size={16} className="text-texte-faible" />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <BarreActionCollee>
        {actif || ouvert ? (
          <Bouton asChild taille="lg" icone="plus">
            <Link href={adresseCreationFormat(f)}>Nouvelle vidéo de ce format</Link>
          </Bouton>
        ) : (
          <BoutonMePrevenir formatId={f.id} dejaNote={fiche.prevenir} />
        )}
      </BarreActionCollee>
    </div>
  );
}
