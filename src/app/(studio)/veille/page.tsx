import type { Metadata } from "next";
import { EnTetePage } from "@/components/ui/EnTetePage";
import { exigerSession } from "@/services/auth";
import { lireVeille } from "@/services/veille";
import { adresseSource } from "@/veille/lecture";
import { EcranVeille } from "./_composants/EcranVeille";

export const metadata: Metadata = { title: "Veille" };
export const dynamic = "force-dynamic";

/**
 * VEILLE DES OUTILS (lot B2) — une carte par outil (version utilisée, dernière version, date, état),
 * les nouveautés résumées en français dessous. « Essayer » crée une tâche, « Ignorer » range. Rien n'est appliqué seul.
 * `?nouveaute=<id>` ouvre la nouveauté (lien des notifications et des e-mails).
 */
export default async function PageVeille({ searchParams }: { searchParams: Promise<{ nouveaute?: string }> }) {
  await exigerSession();
  const [{ nouveaute }, vue] = await Promise.all([searchParams, lireVeille()]);
  const noms = Object.fromEntries(vue.outils.map((o) => [o.id, o.nom]));
  return (
    <div className="mx-auto max-w-3xl">
      <EnTetePage titre="Veille" sousTitre="Les nouveautés de vos outils. Rien ne change sans vous." />
      <EcranVeille
        outils={vue.outils.map((o) => ({
          id: o.id,
          nom: o.nom,
          role: o.role,
          etat: o.etat,
          versionUtilisee: o.versionUtilisee,
          derniereVersion: o.derniereVersion,
          derniereVersionLe: o.derniereVersionLe,
          verifieLe: o.verifieLe,
          adresse: adresseSource(o.source),
          ajouteParVous: o.ajoutePar === "will",
        }))}
        nouveautes={vue.nouveautes.map((n) => ({ id: n.id, outil: noms[n.outilId] ?? "Outil rangé", versionVue: n.versionVue, date: n.date, lien: n.lien, resume: n.resume, rouge: n.rouge, simule: n.simule, statut: n.statut, tacheCreeeLe: n.tacheCreeeLe }))}
        derniereLecture={vue.derniereLecture}
        ouverteId={nouveaute ?? null}
      />
    </div>
  );
}
