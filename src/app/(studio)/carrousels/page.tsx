import type { Metadata } from "next";
import Link from "next/link";
import { after } from "next/server";
import { Bouton } from "@/components/ui/Bouton";
import { EnTetePage } from "@/components/ui/EnTetePage";
import { BandeauGenerateurEteint } from "@/components/visuels/BandeauGenerateurEteint";
import { CarteCarrousel } from "@/components/visuels/CarteCarrousel";
import { ListeCarrousels } from "@/components/visuels/ListeCarrousels";
import { OngletsCarrousels, type VueOnglet } from "@/components/visuels/OngletsCarrousels";
import { exigerSession } from "@/services/auth";
import { generateurAllume } from "@/visuels/interrupteur";
import { purgerCorbeilleVisuels } from "@/visuels/services/corbeille";
import { dependancesCarrousels, phraseDuCode } from "@/visuels/services/production";
import { listerCarrousels } from "@/visuels/services/vues";
import { restaurerDepuisListeAction } from "./actions";

export const metadata: Metadata = { title: "Carrousels" };
export const dynamic = "force-dynamic";

const VUES: readonly VueOnglet[] = ["tous", "a_valider", "valides", "corbeille"];

/** Carrousels : la liste par onglets (Tous · À valider · Validés · Corbeille). */
export default async function PageCarrousels({ searchParams }: { searchParams: Promise<{ vue?: string; erreur?: string }> }) {
  await exigerSession();
  const sp = await searchParams;
  const vue: VueOnglet = VUES.find((v) => v === sp.vue) ?? "tous";
  const deps = dependancesCarrousels();
  const [carrousels, allume] = await Promise.all([listerCarrousels(vue, deps), generateurAllume("carrousels")]);
  // Purge opportuniste des documents échus, après la réponse (au plus une fois par heure).
  after(async () => {
    try {
      await purgerCorbeilleVisuels(Date.parse(deps.maintenant()), deps);
    } catch {
      // La prochaine visite réessaiera.
    }
  });
  const erreur = phraseDuCode(sp.erreur);
  return (
    <div className="mx-auto w-full max-w-2xl">
      <EnTetePage
        titre="Carrousels"
        sousTitre="Des carrousels à relire et à valider avant de les publier."
        actions={
          <Bouton asChild icone="plus">
            <Link href="/carrousels/nouveau">Nouveau carrousel</Link>
          </Bouton>
        }
      />
      {!allume && <BandeauGenerateurEteint />}
      {erreur && (
        <p role="alert" className="mb-4 text-sm text-brique">
          {erreur}
        </p>
      )}
      <OngletsCarrousels actif={vue} />
      <div className="mt-5">
        {vue === "corbeille" ? (
          carrousels.length === 0 ? (
            <ListeCarrousels carrousels={[]} phraseVide="La corbeille est vide. Un carrousel y reste 30 jours, restaurable." />
          ) : (
            <ul className="flex flex-col gap-3">
              {carrousels.map((c) => (
                <li key={c.id} className="flex flex-col gap-2">
                  <CarteCarrousel carrousel={c} />
                  <form action={restaurerDepuisListeAction}>
                    <input type="hidden" name="id" value={c.id} />
                    <Bouton type="submit" variante="secondaire" icone="archive">
                      Restaurer
                    </Bouton>
                  </form>
                </li>
              ))}
            </ul>
          )
        ) : (
          <ListeCarrousels carrousels={carrousels} />
        )}
      </div>
    </div>
  );
}
