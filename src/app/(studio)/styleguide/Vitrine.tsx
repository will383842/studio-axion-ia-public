"use client";

import { useState, type ReactNode } from "react";
import {
  BarreActionCollee,
  BarreEtapes,
  BarreProgression,
  Bouton,
  BoutonCopier,
  BoutonIcone,
  CalqueZonesReseaux,
  Carrousel,
  Carte,
  CarteElement,
  CarteFormat,
  CartePersonnage,
  CaseACocher,
  Champ,
  Curseur,
  Dialogue,
  EnTeteSection,
  EtatVide,
  FeuilleBas,
  FormeRatio,
  GrosChiffre,
  Icone,
  ICONES,
  Interrupteur,
  JaugeBudget,
  LecteurVideo,
  ListeElements,
  LogoReseau,
  Menu,
  notifier,
  Onglets,
  Pastille,
  PastilleEssai,
  PastilleEtat,
  Portrait,
  ProgressionEtapes,
  SelecteurPastilles,
  Squelette,
  Tuile,
  VignetteVideo,
  ZoneDepot,
  ZoneTexte,
  type NomIcone,
} from "@/components/ui";
import type { EtapeTravail, Ratio } from "@/domaine/types";
import type { VueElement } from "@/services/vues";

const JETONS = ["fond", "surface-1", "surface-2", "surface-3", "trait", "trait-fort", "texte", "texte-doux", "texte-faible", "orange", "orange-vif", "sauge", "ambre", "brique"];
const FONDS: Record<string, string> = {
  fond: "bg-fond",
  "surface-1": "bg-surface-1",
  "surface-2": "bg-surface-2",
  "surface-3": "bg-surface-3",
  trait: "bg-trait",
  "trait-fort": "bg-trait-fort",
  texte: "bg-texte",
  "texte-doux": "bg-texte-doux",
  "texte-faible": "bg-texte-faible",
  orange: "bg-orange",
  "orange-vif": "bg-orange-vif",
  sauge: "bg-sauge",
  ambre: "bg-ambre",
  brique: "bg-brique",
};

const ETAPES_DEMO: EtapeTravail[] = [
  { cle: "voix", nom: "La voix", icone: "micro", dependDe: [], statut: "terminee", progression: 100, sortieFichierIds: [] },
  { cle: "visage", nom: "Le double", icone: "visage", dependDe: ["voix"], statut: "en_cours", progression: 64, sortieFichierIds: [] },
  { cle: "illustrations", nom: "Les illustrations", icone: "images", dependDe: [], statut: "terminee", progression: 100, sortieFichierIds: [] },
  { cle: "montage", nom: "Le montage", icone: "ciseaux", dependDe: ["visage"], statut: "en_attente", progression: 0, sortieFichierIds: [] },
];

function Bloc({ titre, children }: { titre: string; children: ReactNode }) {
  return (
    <section className="border-t border-trait pt-6">
      <EnTeteSection titre={titre} />
      <div className="space-y-4">{children}</div>
    </section>
  );
}

/** Vitrine de tous les composants (/styleguide). */
export function Vitrine({ elements }: { elements: VueElement[] }) {
  const [duree, setDuree] = useState(45);
  const [ratios, setRatios] = useState<Ratio[]>(["9:16"]);
  const [inter, setInter] = useState(true);
  const [coche, setCoche] = useState(false);
  const [intensite, setIntensite] = useState(70);
  const [feuille, setFeuille] = useState(false);
  const [dialogue, setDialogue] = useState(false);
  const [etape, setEtape] = useState(2);
  const [texte, setTexte] = useState("Mon patron peut-il lire mes mails ?");
  const [zones, setZones] = useState(true);

  return (
    <div className="space-y-10">
      <Bloc titre="Couleurs (jetons)">
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-7">
          {JETONS.map((j) => (
            <div key={j} className="space-y-1">
              <div className={`h-14 rounded-xl border border-trait ${FONDS[j]}`} />
              <p className="truncate text-[11px] text-texte-faible">--{j}</p>
            </div>
          ))}
        </div>
        <div className="relative isolate h-28 overflow-hidden rounded-carte border border-trait">
          <div className="absolute inset-0 lueur-forte" />
          <p className="relative p-4 text-sm text-texte-doux">Lueur orange</p>
        </div>
      </Bloc>

      <Bloc titre="Typographie">
        <p className="titre-affiche text-5xl text-texte">
          5 tâches que l&apos;IA <span className="text-orange-vif">peut reprendre</span>
        </p>
        <h1 className="text-4xl text-texte">Titre de page</h1>
        <h2 className="text-xl text-texte">Titre de section</h2>
        <p className="text-texte">Texte courant en Manrope, lisible et sobre.</p>
        <p className="text-sm text-texte-doux">Texte doux pour une ligne d&apos;aide.</p>
      </Bloc>

      <Bloc titre="Boutons">
        <div className="flex flex-wrap gap-2">
          <Bouton icone="plus">Principal</Bouton>
          <Bouton variante="secondaire">Secondaire</Bouton>
          <Bouton variante="contour">Contour</Bouton>
          <Bouton variante="fantome">Fantôme</Bouton>
          <Bouton variante="danger" icone="corbeille">
            Supprimer
          </Bouton>
          <Bouton chargement>Chargement</Bouton>
          <Bouton variante="secondaire" icone="envoyer" essai onClick={() => notifier.essai("rien n'a été envoyé à Buffer")}>
            Envoyer vers Buffer
          </Bouton>
          <Bouton taille="xl" iconeDroite="fleche-droite">
            Très grand
          </Bouton>
        </div>
        <div className="flex gap-2">
          <BoutonIcone icone="loupe" libelle="Rechercher" />
          <BoutonIcone icone="cloche" libelle="Notifications" compteur={3} variante="secondaire" />
          <BoutonIcone icone="plus" libelle="Ajouter" variante="principal" />
          <BoutonCopier texte="Texte copié depuis le studio" />
          <BoutonCopier texte="Lien" compact />
        </div>
      </Bloc>

      <Bloc titre="Pastilles">
        <div className="flex flex-wrap gap-2">
          <Pastille>Neutre</Pastille>
          <Pastille ton="orange">Orange</Pastille>
          <Pastille ton="sauge" icone="coche">
            Sauge
          </Pastille>
          <Pastille ton="ambre">Ambre</Pastille>
          <Pastille ton="brique">Brique</Pastille>
          <PastilleEssai />
          <PastilleEtat type="video" statut="en_fabrication" />
          <PastilleEtat type="video" statut="echec" />
          <PastilleEtat type="editorial" statut="a_relire" />
          <PastilleEtat type="editorial" statut="publiee" />
          <PastilleEtat type="preparation" statut="pret" />
          <LogoReseau reseau="linkedin" />
          <LogoReseau reseau="tiktok" />
          <LogoReseau reseau="youtube" />
        </div>
      </Bloc>

      <Bloc titre="Sélecteurs">
        <SelecteurPastilles libelle="Durée" taille="lg" options={[30, 45, 60, 90].map((s) => ({ valeur: s, libelle: `${s} s` }))} valeur={duree} onChange={setDuree} />
        <SelecteurPastilles
          libelle="Formats d'image"
          multiple
          minimum={1}
          options={(["9:16", "1:1", "16:9"] as Ratio[]).map((r) => ({ valeur: r, libelle: r, visuel: <FormeRatio ratio={r} /> }))}
          valeur={ratios}
          onChange={setRatios}
        />
        <BarreEtapes etapes={["Sujet", "Texte", "Qui", "Style", "Aperçu", "Fabrication"].map((l) => ({ cle: l, libelle: l }))} courante={etape} onAller={setEtape} />
      </Bloc>

      <Bloc titre="Champs">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Champ libelle="Sujet" value={texte} onChange={(e) => setTexte(e.target.value)} aide="Une question qui arrête le pouce." />
          <Champ libelle="Mot de passe" motDePasse icone="cadenas" defaultValue="exemple" />
          <Champ libelle="Avec erreur" erreur="Ce champ est obligatoire." />
          <ZoneTexte libelle="Texte de publication" value={texte} onChange={(e) => setTexte(e.target.value)} longueurMax={100} />
        </div>
        <Interrupteur libelle="Sous-titres animés" detail="Mot par mot" icone="sous-titres" coche={inter} onChange={setInter} />
        <CaseACocher libelle="Mention IA vérifiée" detail="« Réalisé avec l'IA »" coche={coche} onChange={setCoche} />
        <Curseur libelle="Intensité de la LUT" valeur={intensite} onChange={setIntensite} unite="%" />
        <ZoneDepot libelle="Déposer des images" detail="ou touchez pour choisir" onFichiers={(f) => notifier.essai(`${f.length} fichier(s) reçu(s)`)} />
      </Bloc>

      <Bloc titre="Cartes et chiffres">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Carte lueur>
            <GrosChiffre valeur="14" libelle="vidéos ce mois" icone="film" tendance={{ valeur: "+4", positive: true }} />
          </Carte>
          <Carte>
            <JaugeBudget depense={{ centimes: 4250, devise: "EUR" }} budget={{ centimes: 15000, devise: "EUR" }} />
          </Carte>
          <Carte interactive>
            <GrosChiffre valeur="91" libelle="note de qualité" accent />
          </Carte>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Tuile href="/personnages" icone="personnages" libelle="Personnages" compteur={3} />
          <Tuile href="/bibliotheque" icone="bibliotheque" libelle="Bibliothèque" compteur={44} />
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <CarteFormat
            href="/nouvelle/avocat"
            format={{ id: "avocat", nom: "Vidéo type avocat", accroche: "Face caméra, fond noir, très rythmé", icone: "balance", statut: "actif", durees: [30, 45, 60, 90], ratios: ["9:16", "1:1", "16:9"], exemple: { vignette: "/demo/avocat-droits.jpg", video: "/demo/avocat-droits.mp4", ratio: "9:16" } }}
          />
          <CarteFormat compacte format={{ id: "podcast", nom: "Podcast type interview", accroche: "Interview à deux", icone: "micro", statut: "bientot", durees: [600], ratios: ["16:9"], nbVideos: 2 }} />
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <CartePersonnage href="/personnages/p-will" personnage={{ id: "p-will", nom: "Williams", nature: "moi", photo: "/demo/personnages/will.jpg", visagesPrets: 2, voixPrete: true, accordValide: true }} />
          <CartePersonnage href="/personnages/p-sophie" personnage={{ id: "p-sophie", nom: "Sophie Lambert", role: "Avocate", nature: "reel", photo: null, visagesPrets: 0, voixPrete: false, accordValide: false }} />
        </div>
        <div className="flex items-center gap-3">
          <Portrait nom="Williams" photo="/demo/personnages/will.jpg" taille="lg" anneau />
          <Portrait nom="Clara" taille="md" />
          <Portrait nom="Sophie Lambert" taille="sm" />
        </div>
      </Bloc>

      <Bloc titre="Vidéo">
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">
          <VignetteVideo src="/demo/avocat-droits.jpg" titre="Exemple" dureeSec={45} lecture coin={<PastilleEtat type="editorial" statut="validee" />} />
          <VignetteVideo src="/demo/avocat-licenciement.jpg" titre="En cours" progression={62} />
          <VignetteVideo src="/demo/motion-chiffres.jpg" titre="Échec" progression={40} enEchec />
          <div className="relative col-span-2">
            <VignetteVideo src="/demo/podcast-entretien.jpg" titre="16:9" ratio="16:9" dureeSec={600} lecture />
          </div>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <LecteurVideo src="/demo/avocat-droits.mp4" affiche="/demo/avocat-droits.jpg" titre="Démonstration" className="max-h-[480px]" />
          <div>
            <Bouton variante="secondaire" icone="calques" onClick={() => setZones((z) => !z)} className="mb-3">
              Zones des réseaux
            </Bouton>
            <div className="relative mx-auto aspect-[9/16] max-h-[420px] overflow-hidden rounded-carte border border-trait">
              <VignetteVideo src="/demo/avocat-droits.jpg" titre="Calque" className="absolute inset-0 rounded-none border-0" />
              <CalqueZonesReseaux ratio="9:16" visible={zones} deborde />
            </div>
          </div>
        </div>
        <Carrousel libelle="Carrousel">
          {["avocat-droits", "avocat-licenciement", "motion-chiffres", "avocat-droits", "avocat-licenciement"].map((n, i) => (
            <VignetteVideo key={i} src={`/demo/${n}.jpg`} titre={n} dureeSec={45} />
          ))}
        </Carrousel>
      </Bloc>

      <Bloc titre="Progression">
        <BarreProgression valeur={64} />
        <Carte>
          <ProgressionEtapes etapes={ETAPES_DEMO} progression={66} resteSec={9} />
        </Carte>
        <Carte>
          <ProgressionEtapes
            etapes={[{ ...ETAPES_DEMO[1], statut: "echec", erreur: { code: "X", reessayable: true, messagePourWill: "Le double n'a pas abouti. Vous pouvez réessayer cette étape seule." } }]}
            progression={40}
            onReessayer={() => notifier.info("Étape relancée")}
            compacte
          />
        </Carte>
      </Bloc>

      <Bloc titre="Onglets, menus, feuilles">
        <Onglets
          libelle="Démonstration"
          onglets={[
            { valeur: "a", libelle: "Publier", icone: "megaphone", contenu: <p className="text-texte-doux">Contenu A</p> },
            { valeur: "b", libelle: "Plans", icone: "ciseaux", compteur: 9, contenu: <p className="text-texte-doux">Contenu B</p> },
            { valeur: "c", libelle: "Sous-titres", contenu: <p className="text-texte-doux">Contenu C</p> },
          ]}
        />
        <div className="flex flex-wrap gap-2">
          <Bouton variante="secondaire" onClick={() => setFeuille(true)}>
            Ouvrir une feuille
          </Bouton>
          <Bouton variante="secondaire" onClick={() => setDialogue(true)}>
            Ouvrir un dialogue
          </Bouton>
          <Menu
            declencheur={<BoutonIcone icone="menu" libelle="Plus d'actions" variante="secondaire" />}
            elements={[
              { libelle: "Renommer", icone: "ecrire", onSelect: () => undefined },
              { libelle: "Envoyer vers Buffer", icone: "envoyer", essai: true, onSelect: () => undefined },
              { libelle: "Décliner", icone: "repeter", bientot: true, onSelect: () => undefined },
              "separateur",
              { libelle: "Archiver", icone: "archive", danger: true, onSelect: () => undefined },
            ]}
          />
          <Bouton variante="secondaire" onClick={() => notifier.succes("Votre vidéo est prête")}>
            Toast
          </Bouton>
        </div>
        <FeuilleBas
          ouverte={feuille}
          onOuverteChange={setFeuille}
          titre="Partager"
          description="Un lien privé, valable 7 jours."
          pied={
            <Bouton pleineLargeur taille="lg" icone="copier" onClick={() => setFeuille(false)}>
              Copier le lien
            </Bouton>
          }
        >
          <Interrupteur libelle="Autoriser le téléchargement" coche={inter} onChange={setInter} />
        </FeuilleBas>
        <Dialogue
          ouvert={dialogue}
          onOuvertChange={setDialogue}
          titre="Confirmer la fabrication"
          description="Cette vidéo coûtera 24 €."
          pied={
            <>
              <Bouton variante="fantome" onClick={() => setDialogue(false)}>
                Annuler
              </Bouton>
              <Bouton onClick={() => setDialogue(false)}>Fabriquer</Bouton>
            </>
          }
        />
      </Bloc>

      <Bloc titre="Listes de la Bibliothèque">
        <ListeElements elements={elements.slice(0, 8)} onOuvrir={(id) => notifier.info(id)} actionsSelection={[{ libelle: "Supprimer", icone: "corbeille", danger: true, onAction: (ids) => notifier.info(`${ids.length} choisi(s)`) }]} />
        {elements[0] && (
          <div className="w-48">
            <CarteElement element={elements[0]} />
          </div>
        )}
      </Bloc>

      <Bloc titre="États">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Carte>
            <EtatVide compact titre="Aucune vidéo ici" phrase="Votre première vidéo vous attend." action={<Bouton icone="plus">Nouvelle vidéo</Bouton>} />
          </Carte>
          <Carte className="space-y-3">
            <Squelette className="h-6 w-1/2" />
            <Squelette className="h-4 w-3/4" />
            <Squelette className="h-32 w-full" />
          </Carte>
        </div>
      </Bloc>

      <Bloc titre="Icônes">
        <ul className="grid grid-cols-6 gap-2 sm:grid-cols-10">
          {(Object.keys(ICONES) as NomIcone[]).map((n) => (
            <li key={n} className="flex flex-col items-center gap-1 rounded-xl bg-surface-1 p-2" title={n}>
              <Icone nom={n} size={20} className="text-texte" />
              <span className="w-full truncate text-center text-[9px] text-texte-faible">{n}</span>
            </li>
          ))}
        </ul>
      </Bloc>

      <BarreActionCollee secondaire={<Bouton variante="secondaire" icone="telecharger">Télécharger</Bouton>}>
        <Bouton taille="lg" icone="envoyer">
          Action principale collée
        </Bouton>
      </BarreActionCollee>
    </div>
  );
}
