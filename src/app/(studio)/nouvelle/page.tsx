import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Apparition } from "@/components/ui/Apparition";
import { Carrousel } from "@/components/ui/Carrousel";
import { CarteFormat } from "@/components/ui/CarteFormat";
import { EnTetePage, EnTeteSection } from "@/components/ui/EnTetePage";
import { EtatVide } from "@/components/ui/EtatVide";
import { Icone } from "@/components/ui/Icone";
import { libelleDuree, nomCourtFormat } from "@/formats";
import { listerFormatsAvecCompteurs } from "@/services/formats";
import { listerModeles } from "@/services/modeles";
import { exigerSession } from "@/services/auth";

export const metadata: Metadata = { title: "Nouvelle vidéo" };
export const dynamic = "force-dynamic";

/**
 * NOUVELLE VIDÉO (refonte R4, maquette M1) : d'abord « Choisir un format », puis « Repartir d'un modèle » (mes modèles intégrés).
 * 12/11 (Williams) : « L'erreur corrigée » est seule, sans carte « Tableau animé » à quatre recettes.
 */
const AFFICHAGE_FORMAT: Record<string, { nomAffiche: string; accrocheAffichee: string }> = {
  "tableau-anime": { nomAffiche: "L'erreur corrigée", accrocheAffichee: "Une erreur courante, puis la bonne façon de faire, dessinées sur un tableau" },
};

export default async function PageNouvelle() {
  await exigerSession();
  const [formats, modeles] = await Promise.all([listerFormatsAvecCompteurs(), listerModeles()]);
  // 08/11 (Williams, remplace la décision du 17/10) : un format sans générateur n'apparaît plus, même grisé — « ça évite
  // d'avoir du bruit pour rien ». Il réapparaît seul quand son statut passe à « actif ».
  const actifs = formats.filter((f): f is typeof f & { statut: "actif" } => f.statut === "actif").map((f) => ({ ...f, ...AFFICHAGE_FORMAT[f.id] }));
  return (
    <div>
      <EnTetePage titre="Nouvelle vidéo" sousTitre="Choisissez un format, ou repartez d'un modèle." />

      {actifs.length ? (
        <section className="mb-10">
          <EnTeteSection titre="Choisir un format" />
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {actifs.map((f, i) => (
              <li key={f.id}>
                <Apparition index={i}>
                  <CarteFormat format={f} href={f.adresseCreation} />
                </Apparition>
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <EtatVide icone="clap" titre="Aucun format prêt" phrase="Les formats arrivent bientôt." />
      )}

      {modeles.length > 0 && (
        <section>
          <EnTeteSection titre="Repartir d'un modèle" sousTitre="Un modèle garde les réglages d'une vidéo réussie. Vous n'avez plus qu'à donner l'idée." lien={{ href: "/modeles", libelle: "Mes modèles" }} />
          <Carrousel libelle="Mes modèles" largeurElement="w-[78%] sm:w-80">
            {modeles.map((m, i) => (
              <Apparition key={m.id} index={i}>
                <Link
                  href={`/nouvelle/${m.formatId}?modele=${m.id}`}
                  className="group relative isolate flex items-center gap-3 overflow-hidden rounded-carte border border-trait bg-surface-1 p-2.5 pr-3 transition-[border-color,transform] duration-200 hover:-translate-y-0.5 hover:border-trait-fort"
                >
                  <span className="relative aspect-[9/16] w-14 shrink-0 overflow-hidden rounded-xl bg-surface-2">
                    {m.vignette ? <Image src={m.vignette} alt="" fill sizes="56px" className="object-cover" /> : <Icone nom="modele" size={18} className="absolute inset-0 m-auto text-texte-faible" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1 text-[11px] font-semibold text-texte-faible">
                      <Icone nom={m.format.icone} size={12} />
                      <span className="truncate">{nomCourtFormat(m.format)}</span>
                    </span>
                    <span className="mt-0.5 block truncate text-[15px] font-semibold text-texte">{m.nom}</span>
                    <span className="mt-1 flex items-center gap-1.5 text-xs tabular-nums text-texte-faible">
                      <Icone nom="horloge" size={12} />
                      {libelleDuree(m.dureeSec)}
                      <span>·</span>
                      {m.ratios.join(" ")}
                    </span>
                  </span>
                  <span className="grid size-10 shrink-0 place-items-center rounded-full border border-trait-fort bg-surface-1 text-texte transition-colors group-hover:bg-surface-2">
                    <Icone nom="repeter" size={17} />
                  </span>
                </Link>
              </Apparition>
            ))}
          </Carrousel>
        </section>
      )}
    </div>
  );
}
