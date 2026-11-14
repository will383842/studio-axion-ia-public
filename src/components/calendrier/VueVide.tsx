import Link from "next/link";
import { EtatVide } from "@/components/ui/EtatVide";

export const ETATS_VIDES = ["vide", "filtre-vide", "semaine-passee"] as const;
export type EtatVideCalendrier = (typeof ETATS_VIDES)[number];

const lienClasse = "inline-flex min-h-11 items-center rounded-xl border border-trait-fort px-4 text-sm font-semibold text-texte underline-offset-[3px] hover:underline";

/**
 * États « rien à montrer » du calendrier (CAL-13), trois cas distincts :
 * - vide : aucun contenu planifié, la phrase de la maquette explique comment commencer ;
 * - filtre-vide : des publications existent mais aucune ne correspond au filtre ;
 * - semaine-passee : semaine révolue sans publication, on ne propose pas d'y ajouter.
 */
export function VueVide({ etat, lienAjouter, lienTout, lienAujourdhui }: { etat: EtatVideCalendrier; lienAjouter?: string; lienTout?: string; lienAujourdhui?: string }) {
  let corps;
  if (etat === "vide") {
    corps = (
      <EtatVide icone="calendrier" titre="Rien de planifié" phrase="Votre calendrier est vide. Cliquez sur + Ajouter, choisissez le réseau, joignez la vidéo, validez : elle partira seule à l'heure choisie." action={lienAjouter ? <Link href={lienAjouter} className={lienClasse}>+ Ajouter</Link> : undefined} />
    );
  } else if (etat === "filtre-vide") {
    corps = <EtatVide icone="filtre" titre="Rien à afficher" phrase="Aucune publication ne correspond à ce filtre." action={lienTout ? <Link href={lienTout} className={lienClasse}>Tout afficher</Link> : undefined} />;
  } else {
    corps = (
      <EtatVide icone="calendrier" titre="Semaine passée" phrase="Cette semaine est passée : rien n'y est planifié." action={lienAujourdhui ? <Link href={lienAujourdhui} className={lienClasse}>Revenir à aujourd&apos;hui</Link> : undefined} />
    );
  }
  return <div data-etat={etat}>{corps}</div>;
}
