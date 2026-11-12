import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { Apparition } from "@/components/ui/Apparition";
import { EnTetePage } from "@/components/ui/EnTetePage";
import { Icone, type NomIcone } from "@/components/ui/Icone";
import { CartePliante } from "@/components/reglages/CartePliante";
import { RefaireToutesLesVignettes } from "@/components/videos/RefaireToutesLesVignettes";
import { NettoyerNonTerminees } from "@/components/videos/NettoyerNonTerminees";
import { BlocBuffer } from "@/components/reglages/BlocBuffer";
import { InterrupteurAPublier } from "@/components/reglages/InterrupteurAPublier";
import { pageAPublierAllumee } from "@/services/a-publier";
import { Connexions } from "@/components/reglages/Connexions";
import { ConnexionsZernioReglages } from "@/components/reglages/ConnexionsZernioReglages";
import { lireParametre } from "@/services/_commun";
import { TAUX_USD_EUR_PAR_DEFAUT } from "@/lib/montants";
import { tauxValide } from "@/components/reglages/montants-euros";
import { Credits } from "@/components/reglages/Credits";
import { CreditClaude } from "@/components/reglages/CreditClaude";
import { vueCreditClaude } from "@/services/credit-claude";
import { ReglageDouble } from "@/components/reglages/Double";
import { vueRenduDouble } from "@/services/rendu-double";
import { InterrupteurExemples, ReglagesMentionIA, ReglagesNotifications, ReglagesReseaux } from "@/components/reglages/Preferences";
import { VosHashtags } from "@/components/reglages/VosHashtags";
import { ChangerMotDePasse, ListeAppareils } from "@/components/reglages/Securite";
import { ilYA } from "@/lib/dates";
import { listerSessions } from "@/services/auth";
import { vueBuffer } from "@/services/buffer";
import { vueCles, vueCredits } from "@/services/credits";
import { aPropos, listerConnexions, listerJournal, lireReglages } from "@/services/reglages";
import { exigerSession } from "@/services/auth";
import { bilanVeille } from "@/services/veille";
import { lireVueSite } from "@/services/source-axion";
import { VotreSite } from "@/components/reglages/VotreSite";
import { compteEtatVeille, ETATS_VEILLE } from "@/domaine/libelles";
import { Pastille } from "@/components/ui/Pastille";
import { MonMonteur } from "@/components/facecam/MonMonteur";
import { vueReglagesMonteur } from "@/services/monteur-facecam";
import { DecorIa } from "@/components/reglages/DecorIa";
import { lireReglageDecorIa } from "@/services/decor-ia";
import { OptionsPayantes } from "@/components/reglages/OptionsPayantes";
import { optionsPayantesCoupees } from "@/services/options-payantes";
import { ChoixChaineEcriture } from "@/components/reglages/ChoixChaineEcriture";
import { etatProduction } from "@/services/etat-production";
import { lireChaineReglee } from "@/services/chaine-ecriture";
import { InterrupteursEcriture } from "@/components/reglages/InterrupteursEcriture";
import { lireInterrupteursEcriture } from "@/services/interrupteurs-ecriture";
import { ADAPTATIONS_BRANCHEES } from "@/reseaux/branchement-adaptations";
import { GardeSujetsReglage } from "@/components/reglages/GardeSujetsReglage";
import { lireGardeSujets } from "@/services/sujets-traites";
import { optionRetiree } from "@/briques/options-payantes";
import { trouverFormat } from "@/formats";
import { SurLeSite } from "@/components/reglages/SurLeSite";
import { lireReglagesSite } from "@/services/site-videos";
import { RUBRIQUES } from "./rubriques";

export const metadata: Metadata = { title: "Réglages" };
export const dynamic = "force-dynamic";

const ICONES_JOURNAL: Record<string, NomIcone> = {
  connexion: "cle",
  securite: "cadenas",
  session: "appareils",
  fabrication: "film",
  retouche: "ciseaux",
  publication: "envoyer",
  partage: "lien",
  budget: "euro",
  credits: "jauge",
  modele: "modele",
  video: "video",
  format: "cloche",
  site: "lien",
};

/** Une rubrique de la page : son titre (depuis `rubriques.ts`) puis ses cartes. */
function Rubrique({ id, children }: { id: string; children: ReactNode }) {
  const r = RUBRIQUES.find((x) => x.id === id)!;
  return (
    <section id={r.id} aria-labelledby={`${r.id}-rubrique`} className="scroll-mt-28 space-y-6">
      <h2 id={`${r.id}-rubrique`} className="border-b border-trait pb-2 text-xl text-texte">
        {r.libelle}
      </h2>
      {children}
    </section>
  );
}

/**
 * RÉGLAGES — cinq rubriques dans l'ordre d'usage (Williams, 08/11) : Votre compte · Vidéos et voix · Publication ·
 * Services reliés · Avancé (replié). Une rangée de liens en haut mène à chaque rubrique. Aucun identifiant, clé de
 * réglage ni comportement n'a changé : seuls le rangement et les libellés visibles.
 */
export default async function PageReglages() {
  await exigerSession();
  // Plan facecam v4 (lot D) : « Mes habitudes de montage » n'apparaît qu'une fois le format face caméra ouvert.
  const avecMonteur = trouverFormat("facecam")?.statut === "actif";
  const [reglages, connexions, sessions, journal, veille, credits, cles, site, buffer, double, monteur, creditClaude] = await Promise.all([
    lireReglages(),
    listerConnexions(),
    listerSessions(),
    listerJournal(12),
    bilanVeille(),
    vueCredits(),
    vueCles(),
    lireVueSite(),
    vueBuffer(),
    vueRenduDouble(),
    vueReglagesMonteur(),
    vueCreditClaude().catch((e) => {
      console.error("[reglages] crédit Claude restant illisible", e);
      return null;
    }),
  ]);
  const production = await etatProduction(process.env, (id) => lireParametre<unknown>(id, undefined));
  const decorIa = avecMonteur ? await lireReglageDecorIa() : null;
  const coupees = await optionsPayantesCoupees();
  const lignesSite = await lireReglagesSite();
  const aPublierAllumee = await pageAPublierAllumee();
  const chaine = await lireChaineReglee();
  const gardeSujets = await lireGardeSujets();
  const interrupteursEcriture = await lireInterrupteursEcriture();
  const infos = aPropos();
  const tauxUsdEur = tauxValide(await lireParametre<number>("taux.usdEur", TAUX_USD_EUR_PAR_DEFAUT));

  return (
    <div>
      <EnTetePage titre="Réglages" sousTitre="Votre compte, vos vidéos, vos services reliés." />

      {/* Rangée de liens vers les rubriques : défilante sur mobile, collante sur ordinateur */}
      <nav aria-label="Rubriques des réglages" className="sans-barre -mx-4 mb-8 flex gap-2 overflow-x-auto bg-fond px-4 py-2 lg:sticky lg:top-16 lg:z-10 lg:mx-0 lg:px-0">
        {RUBRIQUES.map((r) => (
          <a
            key={r.id}
            href={`#${r.id}`}
            className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full border border-trait bg-surface-1 px-4 text-sm font-semibold text-texte-doux transition-colors hover:border-trait-fort hover:text-texte"
          >
            <Icone nom={r.icone} size={16} className="text-texte-faible" />
            {r.libelle}
          </a>
        ))}
      </nav>

      <div className="max-w-3xl space-y-14">
        <Rubrique id="compte">
          <Apparition>
            <CartePliante id="securite" icone="cadenas" titre="Sécurité" resume="Mot de passe et appareils connectés" ouverte>
              <ChangerMotDePasse enMemoire={infos.enMemoire} />
              <div className="my-4 h-px bg-trait" />
              <h3 className="mb-1 text-[15px] font-semibold text-texte">Appareils connectés · {sessions.length}</h3>
              <ListeAppareils
                appareils={sessions.map((s) => ({
                  id: s.id,
                  appareil: s.appareil,
                  derniereActivite: s.derniereActivite,
                  courante: s.courante,
                  resterConnecte: s.resterConnecte,
                }))}
              />
            </CartePliante>
          </Apparition>
          <Apparition index={1}>
            <CartePliante id="notifications" icone="cloche" titre="Notifications" resume="Ce qui vous prévient, par la cloche" ouverte>
              <ReglagesNotifications initiales={reglages.notifications} serveur={reglages.notificationsServeur} />
            </CartePliante>
          </Apparition>
        </Rubrique>

        <Rubrique id="videos">
          {/* Lot R7e : votre avatar parle dans le studio (éteint par défaut, allumé par Will seulement). */}
          <Apparition>
            <CartePliante id="avatar" icone="video" titre="Votre avatar" resume="Votre avatar parle dans le studio" ouverte>
              <ReglageDouble initial={double} />
            </CartePliante>
          </Apparition>
          {/* Plan facecam v4 (lot D) : total du mois et plafond, « Mes habitudes ». */}
          {avecMonteur && (
            <Apparition index={1}>
              <CartePliante id="mon-monteur" icone="etincelles" titre="Mes habitudes de montage" resume="Les habitudes appliquées aux prochaines vidéos">
                <MonMonteur vue={monteur} />
              </CartePliante>
            </Apparition>
          )}
          {/* Plan facecam v4 (lot E1) : l'option « décor » (même clé de réglage), coupée par défaut, sans aucun prix. */}
          {avecMonteur && decorIa && (
            <Apparition index={2}>
              <CartePliante id="decor-ia" icone="image" titre="Décor des vidéos" resume="Décor des vidéos, coupé tant que vous ne l'allumez pas">
                <DecorIa initial={decorIa} retire={optionRetiree("decor-ia")} />
              </CartePliante>
            </Apparition>
          )}
          <Apparition index={3}>
            <CartePliante id="carrousels" icone="images" titre="Carrousels et infographies" resume="Allumez un générateur seulement quand vous voulez l'utiliser.">
              <Link href="/reglages/carrousels" className="flex min-h-11 items-center gap-3 rounded-carte px-1 text-sm font-semibold text-texte hover:underline">
                <span className="flex-1">
                  Ouvrir les réglages des carrousels
                  <span className="block text-sm font-normal text-texte-doux">Un interrupteur par générateur, tous éteints par défaut.</span>
                </span>
                <Icone nom="chevron-droite" size={16} className="text-texte-faible" />
              </Link>
            </CartePliante>
          </Apparition>
        </Rubrique>

        <Rubrique id="publication">
          <Apparition>
            <CartePliante id="reseaux" icone="megaphone" titre="Mes réseaux" resume="Les réseaux proposés par défaut, les mots-dièse" ouverte>
              <ReglagesReseaux initiaux={reglages.reseauxParDefaut} />
              {/* Équipe 7 : la famille de mots-dièse de chaque réseau (TikTok préremplie). */}
              <VosHashtags initiales={reglages.hashtags} />
              <InterrupteurAPublier key={String(aPublierAllumee)} initial={aPublierAllumee} />
            </CartePliante>
          </Apparition>
          <Apparition index={1}>
            <CartePliante id="mention-ia" icone="etincelles" titre="Mention IA" resume="Mention facultative sur vos contenus">
              <ReglagesMentionIA initiale={reglages.mentionIA} />
            </CartePliante>
          </Apparition>
          {/* NAV D1 : écran des comptes de publication (routage, « Tout arrêter »), lu en base ; session exigée par chaque action. */}
          <Apparition index={2}>
            <CartePliante id="comptes-publication" icone="prise" titre="Vos comptes de publication" resume="Les comptes par lesquels vos contenus partent" ouverte>
              {/* Ancre de « Voir la migration » (BlocZernio) : la page Migration n'est plus dans la navigation. */}
              <span id="migration" className="block scroll-mt-24" />
              <ConnexionsZernioReglages />
            </CartePliante>
          </Apparition>
          {/* Cadence : la page garde son contenu, la carte y mène. */}
          <Apparition index={3}>
            <CartePliante id="cadence" icone="horloge" titre="Cadence de publication" resume="Le calendrier vous prévient, il ne bloque jamais.">
              <Link href="/reglages/cadence" className="flex min-h-11 items-center gap-3 rounded-carte px-1 text-sm font-semibold text-texte hover:underline">
                <span className="flex-1">
                  Régler les heures et le nombre de publications par jour
                  <span className="block text-sm font-normal text-texte-doux">Heures proposées, publications par jour, écart entre deux.</span>
                </span>
                <Icone nom="chevron-droite" size={16} className="text-texte-faible" />
              </Link>
            </CartePliante>
          </Apparition>
          {/* Lot R1 : envoi programmé, lu en base, aucun appel au service à l'affichage. */}
          <Apparition index={3}>
            <CartePliante id="envoi-programme" icone="envoyer" titre="Envoi programmé" resume="Comment les vidéos partent">
              <BlocBuffer vue={buffer} />
            </CartePliante>
          </Apparition>
          {/* Vidéos sur le site (lot S1) : un interrupteur par type de vidéo, tous éteints. */}
          <Apparition index={4}>
            <CartePliante id="sur-le-site" icone="film" titre="Sur le site" resume="Les types de vidéo qui peuvent aller sur votre site">
              <SurLeSite lignes={lignesSite} />
            </CartePliante>
          </Apparition>
        </Rubrique>

        <Rubrique id="services">
          {/* Un seul endroit, dans cet ordre : Connexions, puis Crédits (consigne crédits, 02/10). */}
          <Apparition>
            <CartePliante id="connexions" icone="prise" titre="Connexions" resume="Les services reliés et leur état" ouverte>
              <Connexions
                connexions={connexions.map((c) => ({
                  type: c.type,
                  etat: c.etat,
                  options: c.options,
                  montageReelPour: c.montageReelPour,
                  jeLis: c.jeLis,
                  calageRelie: c.calageRelie,
                  montageReel: c.montageReel,
                }))}
                cles={cles}
              />
            </CartePliante>
          </Apparition>
          <Apparition index={1}>
            <CartePliante id="credits" icone="jauge" titre="Crédits" resume="Ce qu'il reste chez chaque service" ouverte>
              <Credits cartes={credits} tauxUsdEur={tauxUsdEur} />
              {creditClaude && (
                <div id="credits-claude" className="scroll-mt-24">
                  <CreditClaude vue={creditClaude} tauxUsdEur={tauxUsdEur} />
                </div>
              )}
            </CartePliante>
          </Apparition>
          <Apparition index={2}>
            <CartePliante id="options-payantes" icone="curseurs" titre="Options supplémentaires" resume="Un geste pour couper les options supplémentaires">
              {/* Vérif V4 : un seul geste pour qu'aucune option supplémentaire ne soit proposée ni ne parte. */}
              <OptionsPayantes initial={coupees} />
            </CartePliante>
          </Apparition>
          {/* Lot E2 : import des vidéos depuis le Google Drive de Will (lecture seule). */}
          <Apparition index={3}>
            <CartePliante id="google-drive" icone="prise" titre="Importer depuis Google Drive" resume="Importer une vidéo depuis votre Drive">
              <Link href="/reglages/google-drive" className="flex min-h-11 items-center gap-3 rounded-carte px-1 text-sm font-semibold text-texte hover:text-orange-vif">
                <Icone nom="prise" size={18} className="text-texte-doux" />
                <span className="flex-1">Choisir une vidéo dans votre Drive</span>
                <Icone nom="chevron-droite" size={16} className="text-texte-faible" />
              </Link>
            </CartePliante>
          </Apparition>
          {/* Source axion-ia.com (03/10) : le site lu chaque jour, ses pages photographiées. */}
          <Apparition index={4}>
            <CartePliante id="votre-site" icone="lien" titre="Votre site" resume="Lu chaque jour">
              <VotreSite vue={site} />
            </CartePliante>
          </Apparition>
          {/* Reste en ligne à part (décision de Williams, 12/11) : ce n'est pas un réglage de plus. */}
          <Link href="/reglages/base-connaissances" className="flex min-h-14 items-center gap-3 rounded-carte border border-trait bg-surface-1 px-4 py-3 text-texte shadow-carte hover:border-trait-fort">
            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-surface-2 text-texte-faible">
              <Icone nom="livre" size={18} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-lg">Base de connaissances</span>
              <span className="block text-sm text-texte-doux">Les fiches que le Studio consulte pour écrire</span>
            </span>
            <Icone nom="chevron-droite" size={16} className="text-texte-faible" />
          </Link>
        </Rubrique>

        {/* Avancé : rare ou technique, tout est replié (maquette M6) : les cartes se déplient une à une. */}
        <section id="avance" aria-labelledby="avance-rubrique" className="scroll-mt-28 space-y-6">
          <div>
            <h2 id="avance-rubrique" className="border-b border-trait pb-2 text-xl text-texte">
              {RUBRIQUES.find((r) => r.id === "avance")!.libelle}
            </h2>
            <p className="mt-2 text-sm text-texte-doux">Rarement utile. Tout est replié : ouvrez seulement ce dont vous avez besoin.</p>
          </div>
          <div className="space-y-4">
            <CartePliante id="controle-production" icone="valide" titre="Contrôle de production" resume="Lecture seule : les clés posées et les interrupteurs de production">
              <section aria-label="Contrôle de production" className="mt-4 text-sm">
                <h3 className="font-medium">Contrôle de production (lecture seule)</h3>
                <ul className="mt-2 space-y-1">
                  {production.cles.map((c) => (
                    <li key={c.variable}>
                      {c.libelle} : {c.posee ? "clé posée" : "clé absente"}
                    </li>
                  ))}
                  {production.interrupteurs.map((i) => (
                    <li key={i.cle}>
                      {i.libelle} : {i.allume ? "allumé" : "éteint"}
                    </li>
                  ))}
                </ul>
              </section>
            </CartePliante>
            <CartePliante id="ecriture" icone="ecrire" titre="Écriture des scripts" resume="Chaîne d'écriture, sujets déjà traités">
              <ChoixChaineEcriture key={chaine} initiale={chaine} tauxUsdEur={tauxUsdEur} />
              <div className="my-4 h-px bg-trait" />
              <GardeSujetsReglage key={gardeSujets} garde={gardeSujets} />
              <div className="my-4 h-px bg-trait" />
              <InterrupteursEcriture key={JSON.stringify(interrupteursEcriture)} etat={interrupteursEcriture} adaptationsBranchees={ADAPTATIONS_BRANCHEES} />
            </CartePliante>
            <CartePliante id="exemples" icone="film" titre="Contenus d'exemple" resume="Masqués, jamais supprimés">
              <InterrupteurExemples initial={reglages.afficherExemples} />
            </CartePliante>
            <CartePliante id="journal" icone="document" titre="Journal" resume="Les 12 dernières actions sur votre compte">
              {journal.length ? (
                <ol className="-my-1 divide-y divide-trait">
                  {journal.map((e) => (
                    <li key={e.id} className="flex min-h-12 items-center gap-3 py-2">
                      <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-surface-2 text-texte-faible">
                        <Icone nom={ICONES_JOURNAL[e.type] ?? "info"} size={15} />
                      </span>
                      <span className="min-w-0 flex-1 text-sm text-texte">{e.message}</span>
                      <span className="shrink-0 text-xs text-texte-faible">{ilYA(e.date)}</span>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="text-sm text-texte-faible">Rien pour l&apos;instant.</p>
              )}
            </CartePliante>
            <CartePliante id="a-propos" icone="info" titre="À propos" resume="Application, version, données">
              <dl className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <dt className="text-xs text-texte-faible">Application</dt>
                  <dd className="font-semibold text-texte">{infos.application}</dd>
                </div>
                <div>
                  <dt className="text-xs text-texte-faible">Version</dt>
                  <dd className="font-semibold tabular-nums text-texte">{infos.version}</dd>
                </div>
                <div>
                  <dt className="text-xs text-texte-faible">Données</dt>
                  <dd className="font-semibold text-texte">{infos.donnees}</dd>
                </div>
                <div>
                  <dt className="text-xs text-texte-faible">Exemples</dt>
                  <dd className="font-semibold text-texte">{reglages.afficherExemples ? "Affichés" : "Masqués"}</dd>
                </div>
              </dl>
            </CartePliante>
            {/* Veille des outils (lot B2) : bilan des cartes, la page « Veille » pour le détail. */}
            <Apparition>
              <CartePliante id="outils" icone="tendance" titre="Veille des outils" resume="Les nouveautés de vos outils. Rien ne change sans vous.">
                <div className="flex flex-wrap items-center gap-2">
                  {(["attention", "nouveaute", "a-jour", "injoignable"] as const).map((e) =>
                    veille[e] ? (
                      <Pastille key={e} ton={ETATS_VEILLE[e].tonalite} icone={ETATS_VEILLE[e].icone} taille="md">
                        {compteEtatVeille(e, veille[e])}
                      </Pastille>
                    ) : null,
                  )}
                </div>
                <Link href="/veille" className="mt-3 inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-orange-vif hover:underline">
                  {veille.ouvertes ? `${veille.ouvertes} nouveauté${veille.ouvertes > 1 ? "s" : ""} à regarder` : "Ouvrir la veille"}
                  <Icone nom="chevron-droite" size={16} />
                </Link>
              </CartePliante>
            </Apparition>
            <CartePliante id="aide-chat" icone="idee" titre="Aide du chat" resume="Ce que vous pouvez demander, en mots simples">
              <Link href="/aide-chat" className="flex min-h-11 items-center gap-3 rounded-carte px-1 text-sm font-semibold text-texte hover:underline">
                <span className="flex-1">
                  Ouvrir l'aide du chat de retouche
                  <span className="block text-sm font-normal text-texte-doux">La liste des demandes que le chat comprend, avec des exemples.</span>
                </span>
                <Icone nom="chevron-droite" size={16} className="text-texte-faible" />
              </Link>
            </CartePliante>
            <CartePliante id="entretien" icone="film" titre="Entretien des vidéos" resume="Les deux boutons d'entretien de « Mes vidéos », ici aussi">
              <div className="flex flex-wrap items-start gap-3">
                <RefaireToutesLesVignettes />
                <NettoyerNonTerminees />
              </div>
            </CartePliante>
          </div>
        </section>
      </div>
    </div>
  );
}
