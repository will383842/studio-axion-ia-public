import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { EcranBruitages } from "@/components/bibliotheque/EcranBruitages";
import { EcranDecors } from "@/components/bibliotheque/EcranDecors";
import { EcranIllustrations } from "@/components/bibliotheque/EcranIllustrations";
import { EcranListe, EcranRushs } from "@/components/bibliotheque/EcranListe";
import { EcranLut } from "@/components/bibliotheque/EcranLut";
import { EcranMesImages } from "@/components/bibliotheque/mes-images/EcranMesImages";
import { EcranPrononciations } from "@/components/bibliotheque/EcranPrononciations";
import { ElementsRanges } from "@/components/bibliotheque/ElementsRanges";
import { EcranSousTitres } from "@/components/bibliotheque/EcranSousTitres";
import { EnTetePage } from "@/components/ui/EnTetePage";
import { TYPES_BIBLIOTHEQUE } from "@/domaine/libelles";
import type { TypeElement } from "@/domaine/types";
import { donneesApercuImage, formatsCourts, listerLuts, listerRushs } from "@/services/B-personnages-bibliotheque";
import { listerElements, listerPrononciations } from "@/services/bibliotheque";
import { banqueBruitages } from "@/services/bruitages";
import { ecranDecors } from "@/services/decors";
import { listerMesImages } from "@/services/mes-images";
import { exigerSession } from "@/services/auth";

export const dynamic = "force-dynamic";

const SOUS_TITRES: Partial<Record<string, string>> = {
  lut: "Le traitement des couleurs de vos vidéos.",
  "style-sous-titres": "Touchez un style pour le régler.",
  "illustration-image": "Le moteur y pioche selon le script.",
  "illustration-video": "Le moteur y pioche selon le script.",
  "mes-images": "Vos lieux et documents, utilisés en premier.",
  prononciations: "Comment la voix dit certains mots.",
  rushs: "Les images que vous avez filmées.",
  habillage: "Début, fin, logo animé, carte finale.",
  "style-montage": "Rythme, zooms, transitions.",
  "profil-son": "Musique, voix, bruitages, volume.",
  decor: "Chaque décor, montré sur votre double.",
  bruitage: "Des sons discrets, liés à l'image.",
};

function trouverType(type: string) {
  if (type === "rushs") return { type: "rushs" as const, nom: "Mes rushs", icone: "camera" as const };
  return TYPES_BIBLIOTHEQUE.find((t) => t.type === type);
}

export async function generateMetadata({ params }: { params: Promise<{ type: string }> }): Promise<Metadata> {
  await exigerSession();
  const { type } = await params;
  return { title: trouverType(type)?.nom ?? "Bibliothèque" };
}

/**
 * UN TYPE DE LA BIBLIOTHÈQUE (/bibliotheque/lut, /bibliotheque/illustration-image…). Propriétaire : développeur B.
 * Écrans spécifiques : LUT, Illustrations (images + vidéos), Sous-titres ; Prononciations et Rushs dédiés ;
 * tous les autres types : ListeElements commun. `?ajouter=1` ouvre directement la feuille d'ajout.
 */
export default async function PageTypeBibliotheque({ params, searchParams }: { params: Promise<{ type: string }>; searchParams: Promise<{ ajouter?: string }> }) {
  await exigerSession();
  const [{ type }, { ajouter }] = await Promise.all([params, searchParams]);
  const meta = trouverType(type);
  if (!meta) notFound();
  const ajouterAuDepart = ajouter === "1";
  const entete = <EnTetePage retour={{ href: "/bibliotheque", libelle: "Bibliothèque" }} titre={meta.type === "illustration-image" || meta.type === "illustration-video" ? "Illustrations" : meta.nom} sousTitre={SOUS_TITRES[type]} />;

  let ecran: React.ReactNode;
  switch (meta.type) {
    case "prononciations":
      ecran = <EcranPrononciations liste={await listerPrononciations()} ranges={await listerPrononciations({ ranges: true })} ajouterAuDepart={ajouterAuDepart} />;
      break;
    case "mes-images": {
      const [images, ranges] = await Promise.all([listerMesImages(), listerMesImages({ ranges: true })]);
      ecran = <EcranMesImages images={images} ranges={ranges} ajouterAuDepart={ajouterAuDepart} />;
      break;
    }
    // Lot B1 : « Mes décors » (récurrents, demandes, réalistes ; rangés listés dans l'écran).
    case "decor":
      ecran = <EcranDecors donnees={await ecranDecors()} ajouterAuDepart={ajouterAuDepart} />;
      break;
    case "rushs":
      ecran = <EcranRushs rushs={await listerRushs()} ajouterAuDepart={ajouterAuDepart} />;
      break;
    case "lut": {
      const [luts, formats] = await Promise.all([listerLuts(), formatsCourts()]);
      ecran = <EcranLut luts={luts} formats={formats} ajouterAuDepart={ajouterAuDepart} />;
      break;
    }
    case "style-sous-titres": {
      const [styles, formats, apercu] = await Promise.all([listerElements({ type: "style-sous-titres" }), formatsCourts(), donneesApercuImage()]);
      const avant = apercu.luts.find((l) => l.id === apercu.defauts.lutId)?.apres ?? apercu.luts[0]?.avant ?? null;
      ecran = <EcranSousTitres styles={styles} formats={formats} avant={avant} logo={apercu.logo} ajouterAuDepart={ajouterAuDepart} />;
      break;
    }
    case "illustration-image":
    case "illustration-video": {
      const [tous, formats] = await Promise.all([listerElements({ type: ["illustration-image", "illustration-video"] }), formatsCourts()]);
      // Les images de Will ont leur écran (« Mes images ») : elles n'apparaissent pas ici.
      const elements = tous.filter((e) => e.origine !== "personnelle");
      ecran = <EcranIllustrations elements={elements} formats={formats} filtreInitial={meta.type} ajouterAuDepart={ajouterAuDepart} />;
      break;
    }
    // Lot « bruitages » (02/10) : la banque à écouter et valider, puis les autres sons (jamais posés seuls).
    case "bruitage": {
      const [banque, elements, formats] = await Promise.all([banqueBruitages(), listerElements({ type: "bruitage" }), formatsCourts()]);
      const autres = elements.filter((e) => e.valeur.type !== "bruitage" || !e.valeur.declencheur);
      ecran = (
        <>
          <EcranBruitages banque={banque} />
          <h2 className="mb-2 mt-2 font-texte text-sm font-semibold text-texte-doux">Autres sons</h2>
          <EcranListe type="bruitage" nomType={meta.nom} icone={meta.icone} elements={autres} formats={formats} ajouterAuDepart={ajouterAuDepart} />
        </>
      );
      break;
    }
    default: {
      const [elements, formats] = await Promise.all([listerElements({ type: meta.type as TypeElement }), formatsCourts()]);
      ecran = <EcranListe type={meta.type as TypeElement} nomType={meta.nom} icone={meta.icone} elements={elements} formats={formats} ajouterAuDepart={ajouterAuDepart} />;
    }
  }

  // Éléments rangés du type (jamais effacés) : listés en bas, avec « Remettre ».
  const typesRanges: TypeElement[] | null =
    meta.type === "prononciations" || meta.type === "rushs" || meta.type === "mes-images" || meta.type === "decor" ? null : meta.type === "illustration-image" || meta.type === "illustration-video" ? ["illustration-image", "illustration-video"] : [meta.type as TypeElement];
  const ranges = typesRanges ? await listerElements({ type: typesRanges, ranges: true }) : [];

  return (
    <div>
      {entete}
      {ecran}
      <ElementsRanges elements={ranges.map((e) => ({ id: e.id, type: e.type, nom: e.nom, vignette: e.vignette }))} />
    </div>
  );
}
