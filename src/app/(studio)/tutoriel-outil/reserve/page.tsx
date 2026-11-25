import type { Metadata } from "next";
import Link from "next/link";
import { GabaritCreation } from "@/components/creation/GabaritCreation";
import { AjoutReserve } from "@/components/tutoriel-outil/reserve/AjoutReserve";
import { ListeReserve } from "@/components/tutoriel-outil/reserve/ListeReserve";
import { exigerSession } from "@/services/auth";
import { lireReglagesReserve, listerReserve } from "@/services/tutoriel-reserve";
import { amorcerMaquettesDemo } from "@/services/tutoriel-reserve-depot";
import { ajouterDossierAction, ajouterIdeeAction, essayerTirageAction, remettreAction, retirerAction } from "./actions";

export const metadata: Metadata = { title: "Réserve de tutoriels" };
export const dynamic = "force-dynamic";

/**
 * Réserve de tutoriels (RES-5). `reserve` est un segment statique : il passe avant `[videoId]` (le plus précis gagne).
 * Session exigée ; les 7 démos sont amorcées une fois ; aucun montant à l'écran.
 */
export default async function PageReserveTutoriel() {
  await exigerSession();
  await amorcerMaquettesDemo();
  const [elements, reglages] = await Promise.all([listerReserve(), lireReglagesReserve()]);
  return (
    <GabaritCreation entete={{ titre: "Réserve de tutoriels", sousTitre: "Déposez vos dossiers et vos idées une fois : le Studio les prend dans l'ordre." }}>
      <div className="space-y-8">
        <p className="rounded-carte border border-trait bg-surface-1 p-3.5 text-sm" data-zone="etat-reserve">
          {reglages.actif ? `Prise automatique : allumée, ${reglages.parSemaine} par semaine` : "Prise automatique : éteinte"}.{" "}
          <Link href="/reglages/tutoriel-outil" className="font-semibold underline underline-offset-4">
            Régler la prise automatique
          </Link>
        </p>
        <AjoutReserve ajouterDossier={ajouterDossierAction} ajouterIdee={ajouterIdeeAction} />
        <ListeReserve elements={elements} retirer={retirerAction} remettre={remettreAction} essayer={essayerTirageAction} />
      </div>
    </GabaritCreation>
  );
}
