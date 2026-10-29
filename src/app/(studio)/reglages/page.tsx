import type { Metadata } from "next";
import Link from "next/link";
import { Apparition } from "@/components/ui/Apparition";
import { EnTetePage } from "@/components/ui/EnTetePage";
import { Icone, type NomIcone } from "@/components/ui/Icone";
import { Budget } from "@/components/reglages/Budget";
import { CarteSection } from "@/components/reglages/CarteSection";
import { BlocBuffer } from "@/components/reglages/BlocBuffer";
import { InterrupteurAPublier } from "@/components/reglages/InterrupteurAPublier";
import { pageAPublierAllumee } from "@/services/a-publier";
import { Connexions } from "@/components/reglages/Connexions";
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
import { coutsParFournisseurEtMois } from "@/services/C-videos-publication-complements";
import { resumeBudget, tableauCouts } from "@/services/couts";
import { lireBudgetUsine } from "@/services/budget-mensuel";
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
import { lireChaineReglee } from "@/services/chaine-ecriture";
import { InterrupteursEcriture } from "@/components/reglages/InterrupteursEcriture";
import { lireInterrupteursEcriture } from "@/services/interrupteurs-ecriture";
import { ADAPTATIONS_BRANCHEES } from "@/reseaux/branchement-adaptations";
import { PlafondSujet } from "@/components/reglages/PlafondSujet";
import { lirePlafondSujet } from "@/services/plafond-sujet";
import { GardeSujetsReglage } from "@/components/reglages/GardeSujetsReglage";
import { lireGardeSujets } from "@/services/sujets-traites";
import { optionRetiree } from "@/briques/options-payantes";
import { trouverFormat } from "@/formats";
import { SurLeSite } from "@/components/reglages/SurLeSite";
import { lireReglagesSite } from "@/services/site-videos";

export const metadata: Metadata = { title: "Réglages" };
export const dynamic = "force-dynamic";

const SECTIONS: { id: string; libelle: string; icone: NomIcone }[] = [
  { id: "securite", libelle: "Sécurité", icone: "cadenas" },
  { id: "connexions", libelle: "Connexions", icone: "prise" },
  { id: "credits", libelle: "Crédits", icone: "jauge" },
  { id: "budget", libelle: "Budget", icone: "euro" },
  { id: "ecriture", libelle: "Écriture des scripts", icone: "ecrire" },
  { id: "outils", libelle: "Outils", icone: "tendance" },
  { id: "votre-site", libelle: "Votre site", icone: "lien" },
  { id: "sur-le-site", libelle: "Sur le site", icone: "film" },
  // Mêmes noms que les titres des cartes (E2E-1 n° 21).
  { id: "reseaux", libelle: "Mes réseaux", icone: "megaphone" },
  { id: "exemples", libelle: "Exemples", icone: "film" },
  { id: "notifications", libelle: "Notifications", icone: "cloche" },
  { id: "journal", libelle: "Journal", icone: "document" },
  { id: "a-propos", libelle: "À propos", icone: "info" },
];

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

/**
 * RÉGLAGES (B.8 #17) — niveau 2. Sécurité (mot de passe, appareils) · Connexions (Simulation / Relié / À relier,
 * choix du service, clés des services payants) · Crédits (lot du 02/10) · Budget et coûts · Publication (mention IA, réseaux, exemples) ·
 * Notifications · Journal · À propos.
 */
export default async function PageReglages() {
  await exigerSession();
  // Plan facecam v4 (lot D) : « Mon monteur » n'apparaît qu'une fois le format face caméra ouvert (masqué pendant le chantier).
  const avecMonteur = trouverFormat("facecam")?.statut === "actif";
  const sections = avecMonteur ? [...SECTIONS.slice(0, 5), { id: "mon-monteur", libelle: "Mon monteur", icone: "etincelles" as const }, { id: "decor-ia", libelle: "Décor IA", icone: "image" as const }, ...SECTIONS.slice(5)] : SECTIONS;
  const [reglages, connexions, sessions, budget, mois, journal, tableau, veille, credits, cles, site, buffer, double, monteur, budgetUsine, creditClaude] = await Promise.all([
    lireReglages(),
    listerConnexions(),
    listerSessions(),
    resumeBudget(),
    coutsParFournisseurEtMois(3),
    listerJournal(12),
    tableauCouts(),
    bilanVeille(),
    vueCredits(),
    vueCles(),
    lireVueSite(),
    vueBuffer(),
    vueRenduDouble(),
    vueReglagesMonteur(),
    lireBudgetUsine(),
    vueCreditClaude().catch((e) => {
      console.error("[reglages] crédit Claude restant illisible", e);
      return null;
    }),
  ]);
  const decorIa = avecMonteur ? await lireReglageDecorIa() : null;
  const coupees = await optionsPayantesCoupees();
  const lignesSite = await lireReglagesSite();
  const aPublierAllumee = await pageAPublierAllumee();
  const chaine = await lireChaineReglee();
  const plafondSujet = await lirePlafondSujet();
  const gardeSujets = await lireGardeSujets();
  const interrupteursEcriture = await lireInterrupteursEcriture();
  const infos = aPropos();

  return (
    <div className="lg:grid lg:grid-cols-[200px_minmax(0,1fr)] lg:gap-10">
      <div className="lg:col-span-2">
        <EnTetePage titre="Réglages" />
      </div>

      {/* Sommaire : pastilles défilantes sur mobile, colonne collante sur ordinateur */}
      <nav aria-label="Sections des réglages" className="sans-barre -mx-4 mb-6 flex gap-2 overflow-x-auto px-4 lg:sticky lg:top-24 lg:mx-0 lg:mb-0 lg:flex-col lg:self-start lg:px-0">
        {sections.map((s) => (
          <a
            key={s.id}
            href={`#${s.id}`}
            className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full border border-trait bg-surface-1 px-4 text-sm font-semibold text-texte-doux transition-colors hover:border-trait-fort hover:text-texte lg:rounded-xl lg:border-0 lg:bg-transparent lg:px-3 lg:hover:bg-surface-1"
          >
            <Icone nom={s.icone} size={16} />
            {s.libelle}
          </a>
        ))}
      </nav>

      <div className="max-w-3xl space-y-10">
        <Apparition>
          <CarteSection id="securite" icone="cadenas" titre="Sécurité">
            <ChangerMotDePasse enMemoire={infos.enMemoire} />
            <div className="my-4 h-px bg-trait" />
            <p className="mb-1 text-xs font-bold uppercase tracking-wider text-texte-faible">Appareils connectés · {sessions.length}</p>
            <ListeAppareils appareils={sessions.map((s) => ({ id: s.id, appareil: s.appareil, derniereActivite: s.derniereActivite, courante: s.courante, resterConnecte: s.resterConnecte }))} />
          </CarteSection>
        </Apparition>

        {/* Un seul endroit, dans cet ordre : Connexions, puis Crédits, puis Budget (consigne crédits, 02/10). */}
        <Apparition index={1}>
          <CarteSection id="connexions" icone="prise" titre="Connexions">
            <Connexions connexions={connexions.map((c) => ({ type: c.type, etat: c.etat, options: c.options, montageReelPour: c.montageReelPour, jeLis: c.jeLis, calageRelie: c.calageRelie, montageReel: c.montageReel }))} cles={cles} />
            {/* Lot R1 : Buffer sous la carte Publication — lu en base, aucun appel à Buffer à l'affichage. */}
            <div className="my-4 h-px bg-trait" />
            <BlocBuffer vue={buffer} />
            {/* Lot R7e : votre avatar parle dans le studio (éteint par défaut, allumé par Will seulement). */}
            <ReglageDouble initial={double} />
            {/* Lot E2 : import des vidéos depuis le Google Drive de Will (lecture seule). */}
            <div className="my-4 h-px bg-trait" />
            <Link href="/reglages/google-drive" className="flex min-h-11 items-center gap-3 rounded-carte px-1 text-sm font-semibold text-texte hover:text-orange-vif">
              <Icone nom="prise" size={18} className="text-texte-doux" />
              <span className="flex-1">Mon Google Drive</span>
              <Icone nom="chevron-droite" size={16} className="text-texte-faible" />
            </Link>
          </CarteSection>
        </Apparition>

        <Apparition index={2}>
          <CarteSection id="credits" icone="jauge" titre="Crédits">
            <Credits cartes={credits} />
            {creditClaude && <CreditClaude vue={creditClaude} />}
          </CarteSection>
        </Apparition>

        <Apparition index={2}>
          <CarteSection id="budget" icone="euro" titre="Budget">
            <Budget budget={budget.budget} depense={budget.depense} seuil={budget.seuilConfirmation} mois={mois} tableau={tableau} engage={budget.engage} essai={budget.essai} usine={budgetUsine} />
            {/* Vérif V4 : un seul geste pour qu'aucune option payante ne soit proposée ni ne parte. */}
            <div className="my-4 h-px bg-trait" />
            <OptionsPayantes initial={coupees} />
            <div className="my-4 h-px bg-trait" />
            <PlafondSujet key={`${plafondSujet.usd}-${plafondSujet.reglee}-${chaine}`} {...plafondSujet} chaine={chaine} />
          </CarteSection>
        </Apparition>

        {/* Choix de la chaîne qui écrit les prochains scripts (courte ou équipe), coût mesuré affiché. */}
        <Apparition index={2}>
          <CarteSection id="ecriture" icone="ecrire" titre="Écriture des scripts">
            <ChoixChaineEcriture key={chaine} initiale={chaine} />
            <div className="my-4 h-px bg-trait" />
            <GardeSujetsReglage key={gardeSujets} garde={gardeSujets} />
            <div className="my-4 h-px bg-trait" />
            <InterrupteursEcriture key={JSON.stringify(interrupteursEcriture)} etat={interrupteursEcriture} adaptationsBranchees={ADAPTATIONS_BRANCHEES} />
          </CarteSection>
        </Apparition>

        {/* Plan facecam v4 (lot D) : total du mois et plafond (seuls montants du face caméra), « Mes habitudes ». */}
        {avecMonteur && <Apparition index={2}>
          <CarteSection id="mon-monteur" icone="etincelles" titre="Mon monteur">
            <MonMonteur vue={monteur} />
          </CarteSection>
        </Apparition>}
        {/* Plan facecam v4 (lot E1, raccord du lot E) : option « Décor IA », coupée par défaut, sans aucun prix. */}
        {avecMonteur && decorIa && <Apparition index={2}>
          <CarteSection id="decor-ia" icone="image" titre="Décor IA">
            <DecorIa initial={decorIa} retire={optionRetiree("decor-ia")} />
          </CarteSection>
        </Apparition>}

        <Apparition index={3}>
          {/* Veille des outils (lot B2) : bilan des cartes, la page « Veille » pour le détail. */}
          <CarteSection id="outils" icone="tendance" titre="Outils">
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
          </CarteSection>
        </Apparition>

        <Apparition index={3}>
          {/* Source axion-ia.com (03/10) : le site lu chaque jour, ses pages photographiées. */}
          <CarteSection id="votre-site" icone="lien" titre="Votre site">
            <VotreSite vue={site} />
          </CarteSection>
          {/* Vidéos sur le site (lot S1) : un interrupteur par type de vidéo, tous éteints. Autre chose que « Votre site » ci-dessus. */}
          <div className="mt-10">
            <CarteSection id="sur-le-site" icone="film" titre="Sur le site">
              <SurLeSite lignes={lignesSite} />
            </CarteSection>
          </div>
        </Apparition>

        <Apparition index={3}>
          <section id="publication" className="scroll-mt-24 space-y-6">
            <CarteSection id="mention-ia" icone="etincelles" titre="Mention IA">
              <ReglagesMentionIA initiale={reglages.mentionIA} />
            </CarteSection>
            <CarteSection id="reseaux" icone="megaphone" titre="Mes réseaux">
              <ReglagesReseaux initiaux={reglages.reseauxParDefaut} />
              {/* Équipe 7 : la famille de mots-dièse de chaque réseau (TikTok préremplie). */}
              <VosHashtags initiales={reglages.hashtags} />
              <InterrupteurAPublier key={String(aPublierAllumee)} initial={aPublierAllumee} />
            </CarteSection>
            <CarteSection id="exemples" icone="film" titre="Exemples">
              <InterrupteurExemples initial={reglages.afficherExemples} />
            </CarteSection>
          </section>
        </Apparition>

        <Apparition index={4}>
          <CarteSection id="notifications" icone="cloche" titre="Notifications">
            <ReglagesNotifications initiales={reglages.notifications} serveur={reglages.notificationsServeur} />
          </CarteSection>
        </Apparition>

        <Apparition index={5}>
          <CarteSection id="journal" icone="document" titre="Journal">
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
          </CarteSection>
        </Apparition>

        <Apparition index={6}>
          <CarteSection id="a-propos" icone="info" titre="À propos">
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
          </CarteSection>
        </Apparition>
      </div>
    </div>
  );
}
