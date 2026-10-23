import type { Metadata } from "next";
import Link from "next/link";
import { RelireVersions } from "@/components/generateur/RelireVersions";
import { Carte } from "@/components/ui/Carte";
import { EnTetePage } from "@/components/ui/EnTetePage";
import type { Ratio } from "@/domaine/types";
import { ErreurStudio } from "@/services/_commun";
import { exigerSession } from "@/services/auth";
import { planFabricationSujet } from "@/services/fabrication-reseaux";
import { lotARelire } from "@/services/generateur-ecran";

export const metadata: Metadata = { title: "Relire le script" };
export const dynamic = "force-dynamic";

/**
 * RELIRE LE SCRIPT AVANT LA VIDÉO (grande chaîne, briques 4 et 5). `?version=…` : une version (`&but=modifier` :
 * « Relire et modifier », 0 €) ; sans version : « Fabriquer les N » (`&ratios=4:5,1:1`). La fabrication ne part que
 * d'ici : le serveur exige le repère « script relu ».
 */
export default async function PageRelireSujet({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  await exigerSession();
  const { id } = await params;
  const sp = await searchParams;
  const varianteId = sp.version || undefined;
  const but = sp.but === "modifier" && varianteId ? "modifier" : "fabriquer";
  const ratiosOption = (sp.ratios ?? "").split(",").filter((r): r is Ratio => r === "4:5" || r === "1:1");
  const retour = { href: `/ecrire/sujets/${id}`, libelle: "Sujet" };

  let lot: Awaited<ReturnType<typeof lotARelire>>;
  try {
    lot = await lotARelire({ sujetId: id, ...(varianteId ? { varianteId } : {}) }, { fabriquer: but === "fabriquer" });
  } catch (e) {
    if (!(e instanceof ErreurStudio)) throw e;
    return (
      <div className="mx-auto max-w-2xl">
        <EnTetePage retour={retour} titre="Relire le script" />
        <Carte role="status">
          <p className="text-[15px] text-texte">{e.message}</p>
          <Link href={retour.href} className="mt-3 inline-flex min-h-11 items-center font-semibold text-orange-vif">
            Revenir au sujet
          </Link>
        </Carte>
      </div>
    );
  }

  // Prix au plus : celui du plan de fabrication (la version, ou le total des N avec les formats cochés).
  let prixCentimes = 0;
  if (but === "fabriquer") {
    const plan = await planFabricationSujet(id, { ratiosOption });
    const aFaire = plan?.versions.filter((x) => !x.videoId) ?? [];
    prixCentimes = varianteId ? (aFaire.find((x) => lot.codes.includes(x.code))?.cout.centimes ?? Number(sp.prix ?? 0)) : (plan?.total.centimes ?? 0);
  }
  const n = lot.codes.length;

  return (
    <div className="mx-auto max-w-2xl">
      <EnTetePage
        retour={retour}
        surTitre={lot.codes.join(" · ")}
        titre={but === "modifier" ? "Relire et modifier" : n > 1 ? `Relire les ${n}` : "Relire avant la vidéo"}
        sousTitre={n > 1 ? "Le milieu commun change sur toutes les versions." : "Touchez une phrase pour la modifier."}
        className="mb-4 [&_h1]:break-words"
      />
      <RelireVersions sujetId={id} varianteId={varianteId} lignes={lot.lignes} debit={lot.debit} formatId={lot.formatId} but={but} prixCentimes={Number.isFinite(prixCentimes) ? Math.max(0, prixCentimes) : 0} ratiosOption={ratiosOption} />
    </div>
  );
}
