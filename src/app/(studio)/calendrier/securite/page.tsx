import type { Metadata } from "next";
import { revalidatePath } from "next/cache";
import { ConteneurPage } from "@/components/ui/ConteneurPage";
import { EnTetePage } from "@/components/ui/EnTetePage";
import { exigerSession } from "@/services/auth";
import { definirInterrupteurPublication, lireInterrupteursPublication } from "@/services/publication-editoriale-interrupteurs";

export const metadata: Metadata = { title: "Sécurité des envois" };
export const dynamic = "force-dynamic";

const heureParis = new Intl.DateTimeFormat("fr-FR", { dateStyle: "long", timeStyle: "short", timeZone: "Europe/Paris" });

function quand(iso?: string): string {
  const d = iso ? new Date(iso) : undefined;
  return d && !Number.isNaN(d.getTime()) ? `Dernier changement : ${heureParis.format(d)}.` : "Jamais modifié.";
}

/** Allume ou éteint un interrupteur (session exigée dans le service). N'appelle aucun fournisseur : il écrit seulement le réglage. */
async function changer(formulaire: FormData): Promise<void> {
  "use server";
  await exigerSession();
  await definirInterrupteurPublication(formulaire.get("id"), formulaire.get("allume") === "oui");
  revalidatePath("/calendrier/securite");
}

/** Sécurité des envois : deux interrupteurs en clair, avec l'état, la date et un bouton Allumer / Éteindre. Aucun envoi ici. */
export default async function PageSecuriteEnvois() {
  await exigerSession();
  const etats = await lireInterrupteursPublication();
  return (
    <ConteneurPage largeur="lecture">
      <EnTetePage retour={{ href: "/calendrier", libelle: "Calendrier" }} titre="Sécurité des envois" />
      <ul className="mt-4 space-y-4">
        {etats.map((e) => (
          <li key={e.id} className="rounded-2xl border border-trait p-4">
            <h2 className="text-base font-semibold">
              {e.libelle} : {e.allume ? "allumé" : "éteint"}
            </h2>
            <p className="mt-1 text-sm">{e.phrase}</p>
            <p className="mt-1 text-xs text-texte-doux">{quand(e.modifieLe)}</p>
            <form action={changer} className="mt-3">
              <input type="hidden" name="id" value={e.id} />
              <input type="hidden" name="allume" value={e.allume ? "non" : "oui"} />
              <button type="submit" className="min-h-11 rounded-xl border border-trait px-4 text-sm font-medium">
                {e.allume ? "Éteindre" : "Allumer"}
              </button>
            </form>
          </li>
        ))}
      </ul>
    </ConteneurPage>
  );
}
