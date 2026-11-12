import type { Metadata } from "next";
import { ConteneurPage } from "@/components/ui/ConteneurPage";
import { EnTetePage } from "@/components/ui/EnTetePage";
import { EtatVide } from "@/components/ui/EtatVide";
import { exigerSession } from "@/services/auth";
import { listerJournalEnvoi } from "@/services/journal-envoi-base";

export const metadata: Metadata = { title: "Historique des envois" };
export const dynamic = "force-dynamic";

const heureParis = new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeStyle: "short", timeZone: "Europe/Paris" });

function quand(ts: string): string {
  const d = new Date(ts);
  return Number.isNaN(d.getTime()) ? ts : heureParis.format(d);
}

/**
 * HISTORIQUE DES ENVOIS (D7-02) : le journal durable, conservé sans purge. Lecture seule : aucun appel à un
 * fournisseur. Un envoi refusé y laisse une ligne avec son code ; jamais de texte, de compte ni de clé.
 */
export default async function PageHistoriqueEnvois() {
  await exigerSession();
  const lignes = await listerJournalEnvoi();
  return (
    <ConteneurPage largeur="lecture">
      <EnTetePage retour={{ href: "/calendrier", libelle: "Calendrier" }} titre="Historique des envois" sousTitre={lignes.length ? `${lignes.length} ligne${lignes.length > 1 ? "s" : ""}` : undefined} />
      {lignes.length === 0 ? (
        <EtatVide icone="calendrier" titre="Aucun envoi noté pour l'instant" phrase="Chaque envoi, accepté ou refusé, laissera ici une ligne avec son code." />
      ) : (
        <ul className="divide-y divide-trait rounded-xl border border-trait bg-surface-1">
          {lignes.map((l, i) => (
            <li key={`${l.ts}-${i}`} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-4 py-3 text-sm">
              <span className="tabular-nums text-texte-faible">{quand(l.ts)}</span>
              <span className="font-medium text-texte">{String(l.action)}</span>
              {l.reseau !== undefined && <span className="text-texte-doux">{String(l.reseau)}</span>}
              {l.outil !== undefined && <span className="text-texte-doux">{String(l.outil)}</span>}
              <span className={l.code === "OK" ? "text-texte-doux" : "font-medium text-texte"}>{String(l.code)}</span>
              {l.contenuId !== undefined && <span className="text-xs text-texte-faible">{String(l.contenuId)}</span>}
            </li>
          ))}
        </ul>
      )}
    </ConteneurPage>
  );
}
