import Link from "next/link";
import { CarteBrouillon } from "@/components/creation/CarteBrouillon";
import { Apparition } from "@/components/ui/Apparition";
import { Carrousel } from "@/components/ui/Carrousel";
import { EnTetePage, EnTeteSection } from "@/components/ui/EnTetePage";
import { Bouton } from "@/components/ui/Bouton";
import { EtatVide } from "@/components/ui/EtatVide";
import { Icone, type NomIcone } from "@/components/ui/Icone";
import { CarteVideo } from "@/components/videos/CarteVideo";
import { cn } from "@/lib/cn";
import { dateLongue } from "@/lib/dates";
import { resumeAccueil } from "@/services/accueil";
import { resumeCreditsAccueil } from "@/services/credits";
import { vueCreditClaude } from "@/services/credit-claude";
import { BandeauCredits } from "./_accueil/BandeauCredits";
import { CarteCredits } from "./_accueil/CarteCredits";
import { CarteCreditClaude } from "./_accueil/CarteCreditClaude";
import { EnCours } from "./_accueil/EnCours";
import { NoterIdee } from "./_accueil/NoterIdee";
import { compterMesuresASaisir } from "@/services/mesures";
import { exigerSession } from "@/services/auth";
import { RappelsEnvoi } from "@/components/facecam/RappelsEnvoi";
import { versionsFacecamAEnvoyer } from "@/services/envoi-facecam";
import { formateurDate } from "@/lib/intl";

export const dynamic = "force-dynamic";

function salutation(): string {
  const h = Number(formateurDate("fr-FR", { hour: "numeric", hour12: false, timeZone: "Europe/Paris" }).format(new Date()));
  return h >= 18 || h < 5 ? "Bonsoir Williams" : "Bonjour Williams";
}

/**
 * ACCUEIL (B.8 #2 + AV2.4-3) — niveau de finition 1.
 * Refonte R4 (maquette M1, décision de Williams du 12/11) : trois blocs, « À faire maintenant », « En cours », « Dernières vidéos ». « Écrire » et « Votre studio » ne sont plus des blocs : leurs alertes passent dans « À faire maintenant ».
 */
export default async function PageAccueil() {
  await exigerSession();
  const [r, credits, mesuresASaisir, facecamAEnvoyer, creditClaude] = await Promise.all([resumeAccueil(), resumeCreditsAccueil(), compterMesuresASaisir(), versionsFacecamAEnvoyer(), vueCreditClaude().catch((e) => {
      console.error("[accueil] crédit Claude restant illisible", e);
      return null;
    })]);
  const aujourdhui: { libelle: string; nombre: number; icone: NomIcone; href: string }[] = [
    // « Vidéos » : les tuiles d'Écrire comptent des SCRIPTS sous les mêmes mots (E2E-1 n° 8).
    { libelle: "Vidéos à relire", nombre: r.aujourdhui.nbARelire, icone: "oeil", href: "/videos?etape=a_relire" },
    { libelle: "Vidéos à programmer", nombre: r.aujourdhui.nbAProgrammer, icone: "calendrier", href: "/calendrier" },
    { libelle: "Publiées aujourd'hui", nombre: r.aujourdhui.publicationsDuJour.length, icone: "megaphone", href: "/calendrier" },
  ];
  // Ce qui manque pour une vraie vidéo (avant : le bloc « Votre studio »). 12/11 : « LUT » devient « Rendu des couleurs ».
  const manques = [
    { libelle: "Visage", ok: r.pret.visage, href: "/personnages" },
    { libelle: "Voix", ok: r.pret.voix, href: "/personnages" },
    { libelle: "Rendu des couleurs", ok: r.pret.lut, href: "/bibliotheque/lut" },
    { libelle: "Logo", ok: r.pret.logo, href: "/bibliotheque/logo" },
  ].filter((p) => !p.ok);
  const nbAttente = r.alertes.length + facecamAEnvoyer.length + (mesuresASaisir > 0 ? 1 : 0) + (manques.length > 0 ? 1 : 0);
  const nbFab = r.enCours.length;
  const fab = nbFab === 1 ? "une vidéo est en fabrication" : `${nbFab} vidéos sont en fabrication`;
  const phrase =
    nbAttente > 0
      ? `${nbAttente === 1 ? "Une chose vous attend" : `${nbAttente} choses vous attendent`}${nbFab > 0 ? ` et ${fab}` : ""}.`
      : nbFab > 0
        ? `Rien ne vous attend, ${fab}.`
        : "Rien ne vous attend. C'est le bon moment pour lancer une vidéo.";

  return (
    <div>
      <EnTetePage
        surTitre={<span className="capitalize">{dateLongue(new Date().toISOString())}</span>}
        titre={salutation()}
        sousTitre={phrase}
        actions={
          <>
            <NoterIdee />
            <Bouton variante="secondaire" icone="calendrier" asChild>
              <Link href="/calendrier">Voir le calendrier</Link>
            </Bouton>
          </>
        }
      />

      <div className="space-y-10">
        <section aria-labelledby="titre-a-faire">
          <h2 id="titre-a-faire" className="mb-3 text-lg text-texte">
            À faire maintenant
          </h2>
          <div className="space-y-4">
            <BandeauCredits cartes={credits.cartes} />

            {/* Plan facecam v4 (lot D) : envoi en pause et vidéos face caméra à envoyer (rien sinon). */}
            <RappelsEnvoi aEnvoyer={facecamAEnvoyer} />

            <ul className="space-y-2">
              {r.alertes.map((a) => (
                <li key={a.id}>
                  <LigneAction href={a.lien} ton={a.ton} message={a.message} />
                </li>
              ))}
              {mesuresASaisir > 0 && (
                <li>
                  <LigneAction href="/mesures" message={mesuresASaisir === 1 ? "1 mesure à saisir" : `${mesuresASaisir} mesures à saisir`} />
                </li>
              )}
              {manques.length > 0 && (
                <li>
                  <LigneAction href={manques[0].href} message={`Il manque pour une vraie vidéo : ${manques.map((m) => m.libelle.toLowerCase()).join(", ")}`} />
                </li>
              )}
            </ul>

            <Aujourdhui elements={aujourdhui} />

            {/* Crédit Claude restant et soldes des services reliés : affichage seulement ; l'Accueil ne casse jamais s'ils manquent. */}
            {creditClaude && <CarteCreditClaude vue={creditClaude} />}
            <CarteCredits cartes={credits.cartes} brouillonsPrets={credits.brouillonsPrets} />
          </div>
        </section>

        <section aria-label="En cours">
          {nbFab > 0 ? (
            // Le titre et son compteur vivent DANS la liste en direct : ils suivent les fabrications (E2E-1 n° 26).
            <EnCours initial={r.enCours} />
          ) : (
            <>
              <EnTeteSection titre="En cours" />
              <p className="text-[15px] text-texte-doux">Aucune vidéo en fabrication. Dès que vous en lancez une, vous suivez son avancement ici.</p>
            </>
          )}
        </section>

        <section aria-label="Dernières vidéos">
          <div className="space-y-6">
            {r.brouillons.length > 0 && (
              <div>
                <EnTeteSection niveau={3} titre="Brouillons" compteur={r.brouillons.length} lien={{ href: "/videos?vue=brouillons" }} />
                <Carrousel libelle="Brouillons" largeurElement="w-[46%] sm:w-52">
                  {r.brouillons.map((v) => (
                    <CarteBrouillon key={v.id} video={v} />
                  ))}
                </Carrousel>
              </div>
            )}

            <div>
              <EnTeteSection titre="Dernières vidéos" lien={r.dernieres.length ? { href: "/videos", libelle: "Voir toutes les vidéos" } : undefined} />
              {r.dernieres.length ? (
                <Carrousel libelle="Dernières vidéos" largeurElement="w-[44%] sm:w-48">
                  {r.dernieres.map((v, i) => (
                    <CarteVideo key={v.id} video={v} ratioForce="9:16" prioritaire={i < 2} />
                  ))}
                </Carrousel>
              ) : (
                <EtatVide compact icone="film" titre="Aucune vidéo pour l'instant" phrase="La première est à cinq touches d'ici." />
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

/** Une ligne d'action de « À faire maintenant » : la phrase dit quoi faire, la couleur ne fait que l'appuyer. */
function LigneAction({ href, message, ton }: { href: string; message: string; ton?: "brique" | "ambre" }) {
  return (
    <Apparition>
      <Link
        href={href}
        className={cn(
          "flex min-h-12 items-center gap-3 rounded-2xl border px-4 text-sm font-semibold transition-colors",
          ton === "brique" && "border-brique/30 bg-brique-doux text-brique hover:border-brique/60",
          ton === "ambre" && "border-ambre/30 bg-ambre-doux text-ambre hover:border-ambre/60",
          !ton && "border-trait bg-surface-1 text-texte hover:border-trait-fort",
        )}
      >
        <Icone nom="attention" size={18} className="shrink-0" />
        <span className="flex-1">{message}</span>
        <Icone nom="chevron-droite" size={16} className="shrink-0" />
      </Link>
    </Apparition>
  );
}

function Aujourdhui({ elements }: { elements: { libelle: string; nombre: number; icone: NomIcone; href: string }[] }) {
  return (
    <>
      <EnTeteSection niveau={3} titre="Aujourd'hui" />
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        {elements.map((a) => (
          <Link
            key={a.libelle}
            href={a.href}
            className={cn(
              "group flex min-h-24 flex-col gap-2 rounded-carte border bg-surface-1 p-3 transition-colors hover:border-trait-fort",
              a.nombre ? "border-trait" : "border-trait/60",
            )}
          >
            <Icone nom={a.icone} size={18} className="text-texte-faible" />
            <span className={cn("font-titre text-4xl tabular-nums leading-none", a.nombre ? "text-texte" : "text-texte-faible")}>{a.nombre}</span>
            <span className="text-xs font-semibold leading-tight text-texte-doux">{a.libelle}</span>
          </Link>
        ))}
      </div>
    </>
  );
}
