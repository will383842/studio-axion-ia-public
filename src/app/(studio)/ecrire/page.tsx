import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { OngletIdees } from "@/components/ecrire/OngletIdees";
import { BandeauSeries } from "@/components/ecrire/BandeauSeries";
import { listerSeries } from "@/services/series";
import { codesParFormat, formatsClassables, formatsEcrivables, versSujetListe } from "@/components/generateur/donnees";
import { BoutonPlusDeFiltres, ListeSujets } from "@/components/generateur/ListeSujets";
import { OngletMatieres } from "@/components/matieres/OngletMatieres";
import { claudeBranche } from "@/services/generation-claude";
import { MaVoix } from "@/components/voix/MaVoix";
import { TYPES_MATIERE } from "@/domaine/matieres";
import type { TypeMatiere } from "@/domaine/types";
import { lireContexte, lireInterdits, proposerExpressions } from "@/services/contexte-axion";
import { lireJauge, lireRappelHebdo, listerMatieres } from "@/services/matieres";
import { listerPreuves } from "@/services/preuves";
import { fileAValider, lireFicheStyle, listerReglesDatees, listerTextesWill, listerTournures } from "@/services/voix";
import { BarreActionCollee } from "@/components/ui/BarreActionCollee";
import { Bouton } from "@/components/ui/Bouton";
import { EnTetePage } from "@/components/ui/EnTetePage";
import { ConteneurPage } from "@/components/ui/ConteneurPage";
import { PanneauFiltres } from "@/components/ui/PanneauFiltres";
import { Section } from "@/components/ui/Section";
import { FiltresCiblage } from "@/components/ciblage/FiltresCiblage";
import { compterAnciens, estDoublonPossible, filtrerParCiblage, filtrerSujetsParType, lireFiltreCiblage } from "@/domaine/ciblage/listes";
import { EtatVide } from "@/components/ui/EtatVide";
import { Onglets } from "@/components/ui/Onglets";
import { listerSujets, valeursFiltresGenerateur } from "@/services/generateur";
import { listerIdees } from "@/services/idees";
import { listerScripts } from "@/services/scripts";
import { exigerSession } from "@/services/auth";
import { usineActive } from "@/services/usine-porte";
import { suiviSerie } from "@/services/serie-ecriture";

export const metadata: Metadata = { title: "Écrire" };
export const dynamic = "force-dynamic";

const ONGLETS = ["scripts", "idees", "matieres", "voix"] as const;

/**
 * ÉCRIRE (plan v5 B.6.1, lot G1b) : Scripts (défaut) · Idées · Matières · Ma voix.
 * Anciennes adresses : `?onglet=facon` et `?onglet=references` → /ecrire/voix ; `?onglet=preuves` → Matières, type preuves.
 * Matières et Ma voix : composants du lot G2 (`?type=`, `?ajout=`, `?rubrique=` sont transmis).
 * Les filtres de Scripts vivent dans l'adresse (`?reseau=tiktok&format=avocat&etat=a-relire`).
 */
export default async function PageEcrire({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await exigerSession();
  const sp = await searchParams;
  if (sp.onglet === "facon") redirect("/ecrire/voix?rubrique=facon");
  if (sp.onglet === "references") redirect("/ecrire/voix?rubrique=textes");
  if (sp.onglet === "preuves") redirect("/ecrire?onglet=matieres&type=preuves");
  const actif = ONGLETS.includes(sp.onglet as (typeof ONGLETS)[number]) ? sp.onglet : "scripts";

  // Le contexte d'abord (Ma voix, lot G2) : sur une base sans la migration du générateur, il la joue avant les lectures.
  const contexte = await lireContexte();
  const [vues, idees, scripts, valeurs, matieres, preuves, jauge, rappel, fiche, textes, expressions, avisVues, interdits, tournures, regles, file] = await Promise.all([
    listerSujets(),
    listerIdees(),
    listerScripts({ reference: false }),
    valeursFiltresGenerateur(),
    listerMatieres(),
    listerPreuves(),
    lireJauge(),
    lireRappelHebdo(),
    lireFicheStyle(),
    listerTextesWill(),
    proposerExpressions(),
    listerMatieres({ type: "avis-will", avecRetirees: false }),
    lireInterdits(),
    listerTournures(),
    listerReglesDatees(),
    fileAValider(),
  ]);
  // Équipe 7 : séries reconnaissables (bandeau au-dessus des sujets).
  const series = await listerSeries();
  const filtreMatieres = sp.type === "preuves" || TYPES_MATIERE.includes(sp.type as TypeMatiere) ? (sp.type as TypeMatiere | "preuves") : "tout";
  const ajoutMatiere = sp.ajout === "matiere" || sp.ajout === "vrac" || sp.ajout === "preuve" ? sp.ajout : undefined;
  const filtreCiblage = lireFiltreCiblage(sp);
  // Le filtre par type trie aussi la liste principale des sujets (les compteurs de formats restent calculés sur ce qui est affiché).
  const sujets = filtrerSujetsParType(vues, filtreCiblage).map(versSujetListe);
  const formats = formatsClassables();
  const nombres = Object.fromEntries(formats.map((f) => [f.id, sujets.filter((s) => s.grille.some((l) => l.formatId === f.id)).length]));
  // Ciblage (lot H) : anciens masqués par défaut, filtre par type ; les doublons sont signalés, jamais supprimés.
  const sansSujetTous = scripts.filter((s) => !s.scriptMaitreId);
  const sansSujetVus = filtrerParCiblage(sansSujetTous, filtreCiblage);
  const idsScripts = new Set(scripts.map((s) => s.id));
  const sansSujet = sansSujetVus.map((s) => ({ id: s.id, titre: s.sujet, doublon: estDoublonPossible(s, idsScripts) }));
  const ciblageActif = !!filtreCiblage.type || filtreCiblage.anciens;

  return (
    <ConteneurPage largeur="lecture">
      <EnTetePage
        titre="Écrire"
        sousTitre="Vos sujets, idées et matières, avant le tournage."
        actions={
          <>
            <Bouton asChild variante="secondaire" icone="camera">
              <Link href="/ecrire/tournage">Tournage</Link>
            </Bouton>
            <Bouton asChild icone="plus" className="max-lg:hidden">
              <Link href="/ecrire/atelier">Nouveau sujet</Link>
            </Bouton>
          </>
        }
      />
      <Onglets
        libelle="Écrire"
        parametreUrl="onglet"
        valeurParDefaut={actif}
        onglets={[
          {
            valeur: "scripts",
            libelle: "Scripts",
            icone: "document",
            contenu: (
              <Suspense>
                <BandeauSeries series={series} active={sp.serie} />
                <div className="mb-6 flex flex-wrap items-start gap-2">
                  {(sansSujetTous.length > 0 || vues.length > 0) && (
                    <PanneauFiltres nombre={(filtreCiblage.type ? 1 : 0) + (filtreCiblage.anciens ? 1 : 0)} className="min-w-0 flex-1 basis-full sm:basis-auto">
                      <FiltresCiblage disposition="panneau" base="/ecrire" params={sp} filtre={filtreCiblage} nbAnciens={compterAnciens(sansSujetTous)} />
                    </PanneauFiltres>
                  )}
                  <BoutonPlusDeFiltres />
                </div>
                <Section id="sujets" titre="Vos sujets" sansCarte>
                  <ListeSujets
                    sujets={sujets}
                    formats={formats}
                    nombres={nombres}
                    codes={codesParFormat()}
                    piliers={valeurs.piliers}
                    series={valeurs.series}
                    sansSujet={sansSujet}
                  />
                </Section>
                {sansSujet.length === 0 && sansSujetTous.length > 0 && ciblageActif && <EtatVide compact icone="document" titre="Aucun script ici" phrase="Changez de type ou affichez les anciens." />}
              </Suspense>
            ),
          },
          { valeur: "idees", libelle: "Idées", icone: "idee", compteur: idees.length || undefined, contenu: <OngletIdees idees={idees} formats={formatsEcrivables()} suivi={await suiviSerie()} usine={usineActive()} /> },
          {
            valeur: "matieres",
            libelle: "Matières",
            icone: "micro",
            contenu: <OngletMatieres vues={matieres} preuves={preuves} jauge={jauge} rappelHebdo={rappel.actif} filtreInitial={filtreMatieres} ajoutInitial={ajoutMatiere} rangementEssai={!(await claudeBranche())} />,
          },
          {
            valeur: "voix",
            libelle: "Ma voix",
            icone: "citation",
            contenu: (
              <MaVoix
                d={{ fiche, textes, expressions, avis: avisVues.filter((v) => v.etat.disponible).map((v) => v.matiere), contexte, interdits, tournures, regles, file }}
                ouverteInitiale={sp.rubrique}
              />
            ),
          },
        ]}
      />
      <BarreActionCollee className="lg:hidden">
        <Bouton asChild taille="lg" icone="plus">
          <Link href="/ecrire/atelier">Nouveau sujet</Link>
        </Bouton>
      </BarreActionCollee>
    </ConteneurPage>
  );
}
