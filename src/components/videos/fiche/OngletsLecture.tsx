/**
 * Onglets en lecture de la fiche vidéo (composants serveur, sans état) :
 * Script · Qui parle · Réglages · Résultats · Historique.
 */
import Link from "next/link";
import type { ReactNode } from "react";
import { EtatVide } from "@/components/ui/EtatVide";
import { GrosChiffre } from "@/components/ui/GrosChiffre";
import { Icone, type NomIcone } from "@/components/ui/Icone";
import { LogoReseau } from "@/components/ui/LogoReseau";
import { Pastille } from "@/components/ui/Pastille";
import { Portrait } from "@/components/ui/Portrait";
import { libellePublication } from "@/domaine/buffer";
import { libelleReseauCompte } from "@/domaine/comptes-envoi";
import { LIBELLES_BRIQUES, NATURES_PERSONNAGE } from "@/domaine/libelles";
import type { BriqueFacultative, CommandeFabrication, IdReseau, MentionIA, Publication, Script, StatsPublication, VersionVideo } from "@/domaine/types";
import { trouverFormat } from "@/formats";
import { BORDURES_BLOC, TEXTES_BLOC } from "@/formats/presentation";
import { cn } from "@/lib/cn";
import { dateCourte, heure } from "@/lib/dates";
import { formaterMontant } from "@/lib/montants";
import { obtenirReseau } from "@/reseaux";
import type { VueDistribution } from "@/services/vues";
import { NOMS_NIVEAUX } from "@/components/intensite/CourbeIntensite";
import { obtenirVideoBrute, sonsDeLaVersion } from "@/services/bruitages";
import { moteurDeCommande } from "@/moteurs";
import { SonsDesPlans } from "./SonsDesPlans";

const compact = new Intl.NumberFormat("fr-FR", { notation: "compact", maximumFractionDigits: 1 });

/* --- Script -------------------------------------------------------- */

export function OngletScript({ script, formatId }: { script: Script | null; formatId: string }) {
  if (!script) return <EtatVide compact icone="document" titre="Pas de script" />;
  const recette = trouverFormat(formatId)?.recetteScript;
  return (
    <div>
      <ol className="space-y-3">
        {script.blocs.map((b) => {
          const def = recette?.blocs.find((x) => x.id === b.blocRecette);
          const couleur = def?.couleur ?? "texte-doux";
          return (
            <li key={b.id} className={cn("rounded-2xl border-l-4 bg-surface-1 py-3 pl-4 pr-3", BORDURES_BLOC[couleur])}>
              <p className={cn("mb-1 text-[11px] font-bold uppercase tracking-wider", TEXTES_BLOC[couleur])}>{def?.nom ?? b.blocRecette}</p>
              {b.segments.map((s) => (
                <div key={s.id} className="mb-1 last:mb-0">
                  <p className="text-[15px] leading-relaxed text-texte">{s.texte}</p>
                  {(s.titreEcran || s.intentionIllustration) && (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {s.titreEcran && <Pastille icone="texte">{s.titreEcran}</Pastille>}
                      {s.intentionIllustration && <Pastille icone="image">{s.intentionIllustration}</Pastille>}
                    </div>
                  )}
                </div>
              ))}
            </li>
          );
        })}
      </ol>
      <Link href={`/scripts/${script.id}`} className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-full px-1 text-sm font-semibold text-orange-vif hover:underline">
        <Icone nom="ecrire" size={16} />
        Ouvrir dans l&apos;atelier
      </Link>
    </div>
  );
}

/* --- Qui parle ----------------------------------------------------- */

export function OngletDistribution({ distribution }: { distribution: VueDistribution[] }) {
  if (!distribution.length) return <EtatVide compact icone="personnages" titre="Sans personnage" phrase="Ce format n'a pas de visage." />;
  return (
    <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      {distribution.map((x) => (
        <li key={x.role} className="flex items-center gap-3 rounded-2xl border border-trait bg-surface-1 p-3">
          <Portrait nom={x.personnage?.nom ?? "?"} photo={x.personnage?.photo} />
          <span className="min-w-0 flex-1">
            <span className="block truncate font-semibold text-texte">{x.personnage?.nom ?? "À choisir"}</span>
            <span className="block truncate text-sm text-texte-faible">{x.role}</span>
            <span className="mt-1 flex flex-wrap gap-1">
              {x.source === "rush" ? (
                <Pastille icone="camera">Images filmées</Pastille>
              ) : (
                x.visage && <Pastille icone="visage">{x.visage.nom}</Pastille>
              )}
              {x.voix && <Pastille icone="micro">{x.voix.nom}</Pastille>}
            </span>
          </span>
          {x.personnage && (
            <Link href={`/personnages/${x.personnage.id}`} aria-label={`Ouvrir ${x.personnage.nom}`} className="grid size-11 shrink-0 place-items-center rounded-full text-texte-faible hover:bg-surface-2 hover:text-texte">
              <Icone nom={NATURES_PERSONNAGE[x.personnage.nature].icone} size={18} />
            </Link>
          )}
        </li>
      ))}
    </ul>
  );
}

/* --- Réglages ------------------------------------------------------ */

/** Mêmes libellés que l'assistant (« Musique et bruitages »…). */
const BRIQUES = LIBELLES_BRIQUES;

export function OngletReglages({ commande, mentionIA, dureeLibelle, ratios }: { commande: CommandeFabrication | null; mentionIA: MentionIA; dureeLibelle: string; ratios: string[] }) {
  const s = commande?.styles;
  const tuiles: { libelle: string; icone: NomIcone; valeur: string | null | undefined; detail?: string }[] = [
    { libelle: "Durée", icone: "horloge", valeur: dureeLibelle },
    { libelle: "Formats", icone: "grille", valeur: ratios.join(" · ") },
    { libelle: "LUT", icone: "contraste", valeur: s?.lut === null ? null : s?.lut?.nom, detail: s?.lut ? `${s.lut.intensite} %` : undefined },
    { libelle: "Sous-titres", icone: "sous-titres", valeur: s?.sousTitres === null ? null : s?.sousTitres?.nom },
    { libelle: "Montage", icone: "ciseaux", valeur: s?.styleMontage?.nom },
    { libelle: "Son", icone: "son", valeur: s?.profilSon === null ? null : s?.profilSon?.nom },
    { libelle: "Musique", icone: "musique", valeur: s?.musique === null ? null : s?.musique?.nom },
    { libelle: "Habillage", icone: "calques", valeur: s?.habillage === null ? null : s?.habillage?.nom },
    // Lot « intensité · bruitages » (02/10) : réglage global figé au lancement.
    ...(commande?.intensite
      ? [
          { libelle: "Intensité", icone: "eclair" as const, valeur: NOMS_NIVEAUX[commande.intensite.niveau] },
          { libelle: "Bruitages", icone: "volume" as const, valeur: commande.intensite.bruitages === "discrets" ? "Discrets" : "Aucun" },
        ]
      : []),
  ];
  return (
    <div className="space-y-4">
      <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {tuiles.map((t) => (
          <li key={t.libelle} className={cn("rounded-2xl border border-trait bg-surface-1 p-3", t.valeur === null && "opacity-60")}>
            <p className="flex items-center gap-1.5 text-xs text-texte-faible">
              <Icone nom={t.icone} size={13} />
              {t.libelle}
            </p>
            <p className="mt-1 truncate text-sm font-semibold text-texte">{t.valeur === null ? "Coupé" : (t.valeur ?? "Par défaut")}</p>
            {t.detail && <p className="text-xs tabular-nums text-orange-vif">{t.detail}</p>}
          </li>
        ))}
      </ul>
      {commande && (
        <div className="flex flex-wrap gap-1.5">
          {(Object.keys(commande.briques) as BriqueFacultative[]).map((b) => (
            <Pastille key={b} ton={commande.briques[b] ? "sauge" : "neutre"} icone={commande.briques[b] ? BRIQUES[b].icone : "fermer"}>
              {BRIQUES[b].libelle}
            </Pastille>
          ))}
        </div>
      )}
      <div className="flex items-center gap-3 rounded-2xl border border-trait bg-surface-1 p-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-orange-doux text-orange-vif">
          <Icone nom="etincelles" size={17} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-texte">« {mentionIA.texte} »</span>
          <span className="text-xs text-texte-faible">
            {mentionIA.incrustee ? `Incrustée ${mentionIA.position.replace("-", " ")}` : "Non incrustée"} · dans le texte de publication
          </span>
        </span>
      </div>
      {/* Lot « bruitages » (02/10) : courbe et son de chaque plan, après fabrication (seul le mixage est refait). */}
      {commande?.intensite && <SonsVersion videoId={commande.videoId} refaisable={typeof moteurDeCommande(commande).recalquer === "function"} />}
    </div>
  );
}

/** Son des plans de la version choisie (composant serveur : lit la version, puis l'écran interactif). */
async function SonsVersion({ videoId, refaisable }: { videoId: string; refaisable: boolean }) {
  const donnees = await sonsDeLaVersion(videoId).catch(() => null);
  if (!donnees?.plans.length) return null;
  const video = await obtenirVideoBrute(videoId);
  return <SonsDesPlans videoId={videoId} donnees={donnees} modifiable={video?.statut !== "en_fabrication"} refaisable={refaisable} />;
}

/* --- Résultats ----------------------------------------------------- */

export function OngletResultats({
  resultats,
  exemple,
}: {
  resultats: { total: StatsPublication; parReseau: { reseau: IdReseau; nom: string; stats?: StatsPublication; date: string; url?: string }[] };
  exemple?: boolean;
}) {
  if (!resultats.parReseau.length) return <EtatVide compact icone="resultats" titre="Pas encore de résultats" phrase="Ils arrivent après la publication." />;
  const t = resultats.total;
  const chiffres = [
    { libelle: "Vues", valeur: t.vues, icone: "oeil" as const },
    { libelle: "J'aime", valeur: t.likes, icone: "etoile" as const },
    { libelle: "Commentaires", valeur: t.commentaires, icone: "citation" as const },
    { libelle: "Partages", valeur: t.partages, icone: "partager" as const },
  ];
  return (
    <div className="space-y-4">
      {exemple && <Pastille ton="ambre">Chiffres d&apos;exemple</Pastille>}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {chiffres.map((c, i) => (
          <div key={c.libelle} className="rounded-carte border border-trait bg-surface-1 p-4">
            <GrosChiffre valeur={compact.format(c.valeur)} libelle={c.libelle} icone={c.icone} accent={i === 0} />
          </div>
        ))}
      </div>
      <ul className="space-y-2">
        {resultats.parReseau.map((p) => (
          <li key={`${p.reseau}-${p.date}`} className="flex min-h-14 items-center gap-3 rounded-2xl border border-trait bg-surface-1 px-3 py-2">
            <LogoReseau reseau={p.reseau} />
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold text-texte">{p.nom}</span>
              <span className="text-xs text-texte-faible">{dateCourte(p.date)}</span>
            </span>
            <span className="text-right">
              <span className="block font-titre text-lg tabular-nums text-texte">{compact.format(p.stats?.vues ?? 0)}</span>
              {p.stats?.tauxCompletion !== undefined && <span className="text-xs tabular-nums text-texte-faible">vue jusqu&apos;au bout : {p.stats.tauxCompletion} %</span>}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* --- Historique ---------------------------------------------------- */

function PastillePublication({ p }: { p: Publication }) {
  const { libelle, ton } = libellePublication(p);
  return <Pastille ton={ton}>{libelle}</Pastille>;
}

export function OngletHistorique({ versions, publications, versionCouranteId }: { versions: VersionVideo[]; publications: Publication[]; versionCouranteId?: string }) {
  type Evt = { date: string; cle: string; contenu: ReactNode };
  const evts: Evt[] = [
    ...versions.map((v) => ({
      date: v.creeLe,
      cle: v.id,
      contenu: (
        <>
          <span className={cn("grid size-10 shrink-0 place-items-center rounded-full font-titre text-sm", v.id === versionCouranteId ? "bg-orange text-sur-orange" : "bg-surface-2 text-texte-doux")}>V{v.numero}</span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold text-texte">{v.noteRetouche ?? (v.numero === 1 ? "Première version" : "Nouvelle version")}</span>
            <span className="text-xs text-texte-faible">
              {dateCourte(v.creeLe)}
              {v.id === versionCouranteId ? " · celle-ci" : ""}
            </span>
          </span>
          {v.coutReel && <span className="text-sm tabular-nums text-texte-doux">{formaterMontant(v.coutReel)}</span>}
        </>
      ),
    })),
    ...publications.map((p) => ({
      date: p.date,
      cle: p.id,
      contenu: (
        <>
          <LogoReseau reseau={p.reseau} />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold text-texte">{libelleReseauCompte(obtenirReseau(p.reseau).nom, p.canalNom)}</span>
            <span className="text-xs text-texte-faible">
              {dateCourte(p.date)} · {heure(p.date)}
            </span>
          </span>
          {/* Une publication « simulation » n'est JAMAIS montrée comme programmée (AV2.4-4). */}
          {/* Lot R1 : « Brouillon dans Buffer », « À vérifier »… (libellé honnête, `domaine/buffer.ts`). */}
          <PastillePublication p={p} />
        </>
      ),
    })),
  ].sort((a, b) => b.date.localeCompare(a.date));

  if (!evts.length) return <EtatVide compact icone="horloge" titre="Rien pour l'instant" />;
  return (
    <ol className="relative space-y-2 before:absolute before:bottom-4 before:left-[33px] before:top-4 before:w-px before:bg-trait">
      {evts.map((e) => (
        <li key={e.cle} className="relative flex min-h-14 items-center gap-3 rounded-2xl border border-trait bg-surface-1 px-3 py-2">
          {e.contenu}
        </li>
      ))}
    </ol>
  );
}
