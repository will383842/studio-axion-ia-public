import type { Metadata } from "next";
import { EcranSourcesExtraitsBranche } from "@/components/bibliotheque/EcranSourcesExtraitsBranche";
import { EnTetePage } from "@/components/ui/EnTetePage";
import { POLITIQUE_SOURCES_PAR_DEFAUT, type PolitiqueSources } from "@/briques/archive-extraits/inscription";
import type { FicheSourceExtraits } from "@/domaine/archive-extraits";
import { lireNoteInteret } from "@/briques/note-extraits/reglage";
import { nomCourtFormat } from "@/formats";
import { DONNEE_COCHEES, REGLAGE_INSCRIPTION, REGLAGE_SOURCES } from "@/services/archive-extraits";
import { depots, lireParametre } from "@/services/_commun";
import { exigerSession } from "@/services/auth";
import { listerElements } from "@/services/bibliotheque";

const LIBELLE_RESEAU: Record<string, string> = {
  linkedin: "LinkedIn",
  instagram: "Instagram",
  facebook: "Facebook",
  tiktok: "TikTok",
  youtube: "YouTube",
  "youtube-shorts": "YouTube Shorts",
};

export const metadata: Metadata = { title: "Extraits de vos vidéos" };
export const dynamic = "force-dynamic";

/**
 * BIBLIOTHÈQUE › EXTRAITS DE VOS VIDÉOS (C3-UT-3.10b-d). Lecture seule : la page lit les réglages et les fiches,
 * monte l'écran et le branche sur les 5 actions. Éteinte par défaut : sans inscription allumée, seul le bandeau s'affiche.
 * Aucune tuile : la page s'ouvre par la recherche globale.
 */
export default async function PageSourceExtraits() {
  await exigerSession();
  const inscriptionActive = (await lireParametre<unknown>(REGLAGE_INSCRIPTION, false)) === true;
  const brute = await lireParametre<unknown>(REGLAGE_SOURCES, null);
  const politique: PolitiqueSources = brute === "pretes" || brute === "cochees" ? brute : POLITIQUE_SOURCES_PAR_DEFAUT;
  const coch = await lireParametre<unknown>(DONNEE_COCHEES, []);
  const cochees = Array.isArray(coch) ? coch.filter((x): x is string => typeof x === "string") : [];
  const elements = await listerElements({ type: "source-extraits" });
  const fiches: FicheSourceExtraits[] = [];
  for (const e of elements) if (e.valeur.type === "source-extraits") fiches.push(e.valeur.fiche);
  const ids = new Set(fiches.map((f) => f.videoId));
  const titres: Record<string, string> = {};
  const generateurs: Record<string, string> = {};
  const reseaux: Record<string, string> = {};
  for (const v of await depots().videos.lister()) {
    if (!ids.has(v.id)) continue;
    titres[v.id] = v.titre;
    if (v.formatId) generateurs[v.id] = nomCourtFormat({ id: v.formatId });
    if (v.reseau) reseaux[v.id] = LIBELLE_RESEAU[v.reseau] ?? v.reseau;
  }
  const { seuils } = await lireNoteInteret(lireParametre);
  return (
    <div className="mx-auto max-w-3xl lg:max-w-5xl">
      <EnTetePage
        retour={{ href: "/bibliotheque", libelle: "Bibliothèque" }}
        titre="Extraits de vos vidéos"
        sousTitre="Les passages de vos vidéos que le studio peut réutiliser. Vous gardez la main : écarter, rétablir, valider."
        className="mb-4"
      />
      <EcranSourcesExtraitsBranche
        fiches={fiches} titres={titres} inscriptionActive={inscriptionActive} politique={politique} cochees={cochees}
        note={{ seuils, generateurs, reseaux: Object.keys(reseaux).length ? reseaux : undefined }}
      />
    </div>
  );
}
