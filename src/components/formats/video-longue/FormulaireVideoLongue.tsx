"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { GabaritCreation } from "@/components/creation/GabaritCreation";
import { PauseVitrine } from "@/components/formats/vitrines/RemarquesFiche";
import { Bouton } from "@/components/ui/Bouton";
import { CaseACocher } from "@/components/ui/CaseACocher";
import { Champ } from "@/components/ui/Champ";
import { SelecteurPastilles } from "@/components/ui/SelecteurPastilles";
import { ZoneTexte } from "@/components/ui/ZoneTexte";
import { modeleDescription } from "@/briques/geo";
import { AvantDeLancer } from "./AvantDeLancer";
import { KitGeo } from "./KitGeo";
import { chapitresDuScript, chapitresMinutes, decouperEnPhrases, dureeTotaleSec, PlanChapitres, planDepuisValide, type ChapitrePlan } from "./PlanChapitres";
import { TexteParChapitre, type ChapitreAvecVersions, type ChapitreValide } from "./TexteParChapitre";

const ETAPES = [
  { cle: "sujet", libelle: "Votre sujet" },
  { cle: "chapitres", libelle: "Les chapitres" },
  { cle: "texte", libelle: "Le texte" },
  { cle: "lancer", libelle: "Lancer" },
];

const PHRASE_ECRITURE_NON_RELIEE = "L'écriture des chapitres n'est pas encore reliée : votre sujet est gardé, rien n'a échoué et rien n'est payé.";
const PHRASE_ENREGISTREMENT_NON_RELIE = "L'enregistrement n'est pas encore relié : rien n'a échoué et rien n'est payé.";
const PHRASE_LANCEMENT_NON_RELIEE = "La fabrication de la vidéo longue n'est pas encore reliée : votre accord n'a déclenché aucune dépense et rien n'a échoué.";

/**
 * Générateur « Vidéo longue » (écrans 1 à 4, vitrine). Aucune dépense, aucun appel à Claude : tant que la fabrication
 * n'est pas reliée (VL-07), chaque geste qui voudrait écrire ou fabriquer répond par une pause claire.
 * Le plan vient du script collé par l'utilisateur ; sans script, rien n'est inventé.
 */
export function FormulaireVideoLongue({ actif, depensesCoupees }: { actif: boolean; depensesCoupees: boolean }) {
  const [etape, setEtape] = useState(0);
  const [question, setQuestion] = useState("");
  const [pourQui, setPourQui] = useState("");
  const [messageCle, setMessageCle] = useState("");
  const [script, setScript] = useState("");
  const [cible, setCible] = useState<number>(6);
  const [fin, setFin] = useState<"aucune" | "rdv">("aucune");
  const [sansVoix, setSansVoix] = useState(false);
  const [courts, setCourts] = useState(false);
  const [pageSite, setPageSite] = useState(false);
  const [chapitres, setChapitres] = useState<ChapitrePlan[]>([]);
  const [valide, setValide] = useState<ChapitreValide[] | null>(null);
  const [pause, setPause] = useState<string | null>(null);

  const versions = useMemo<ChapitreAvecVersions[]>(
    () => chapitres.map((c) => ({ id: c.id, titre: c.titre, versions: [{ cle: "colle", phrases: decouperEnPhrases(c.texte) }] })),
    [chapitres],
  );
  const texteComplet = valide ? valide.map((c) => c.phrases.join(" ")).filter((t) => t.trim() !== "").join("\n\n") : "";
  // Écrans 4 et 6 : calculés sur le texte VALIDÉ (une fois posé), pas sur le plan proposé.
  const planFinal = useMemo(() => (valide ? planDepuisValide(valide, chapitres) : chapitres), [valide, chapitres]);
  const chapitresWeb = useMemo(() => chapitresMinutes(planFinal), [planFinal]);
  const dureeSec = dureeTotaleSec(planFinal);

  function proposer() {
    const propose = chapitresDuScript(script);
    if (propose.length === 0) {
      setPause(PHRASE_ECRITURE_NON_RELIEE);
      return;
    }
    setChapitres(propose);
    setValide(null);
    setPause(null);
    setEtape(1);
  }
  const aller = (i: number) => {
    setPause(null);
    setEtape(i);
  };

  return (
    <GabaritCreation
      largeur="large"
      entete={{ titre: "Vidéo longue", sousTitre: "Une vidéo de 4 à 12 minutes, en format large pour YouTube, qui répond clairement à une question." }}
      etapes={{ etapes: ETAPES, courante: etape, onAller: (i) => i < etape && aller(i) }}
    >
      <div className="space-y-5">
        {!actif && (
          <div role="status" className="flex flex-wrap items-center gap-3 rounded-carte border border-trait bg-surface-2 p-3.5 text-sm text-texte">
            <span>La vidéo longue est éteinte : rien ne sera écrit ni fabriqué.</span>
            <Link href="/reglages" className="font-semibold text-accent underline">
              Ouvrir les réglages
            </Link>
          </div>
        )}
        {etape === 0 && (
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              proposer();
            }}
          >
            <Champ libelle="La question à laquelle la vidéo répond" value={question} onChange={(e) => setQuestion(e.target.value)} />
            <Champ libelle="Pour qui ?" value={pourQui} onChange={(e) => setPourQui(e.target.value)} />
            <ZoneTexte libelle="Ce que vous voulez dire (facultatif)" value={messageCle} onChange={(e) => setMessageCle(e.target.value)} />
            <ZoneTexte libelle="Votre script complet (facultatif) : il fait foi, le Studio ne change aucun mot" value={script} onChange={(e) => setScript(e.target.value)} />
            <SelecteurPastilles
              libelle="Durée visée"
              options={[4, 6, 8, 10].map((m) => ({ valeur: m, libelle: `${m} min` }))}
              valeur={cible}
              onChange={setCible}
            />
            <p className="-mt-2 text-sm text-texte-doux">C&apos;est une cible, pas une limite.</p>
            <SelecteurPastilles
              libelle="Son"
              options={[
                { valeur: "avec", libelle: "Avec la voix de mon double" },
                { valeur: "sans", libelle: "Sans voix (sous-titres et texte à l'écran)" },
              ]}
              valeur={sansVoix ? "sans" : "avec"}
              onChange={(v) => setSansVoix(v === "sans")}
            />
            {sansVoix ? (
              <p className="text-sm text-texte-doux">Silence total, sans musique : chaque scène reste le temps de lire le texte.</p>
            ) : (
              <p className="text-sm font-semibold text-texte">Voix : votre double.</p>
            )}
            <SelecteurPastilles
              libelle="Fin"
              options={[
                { valeur: "aucune", libelle: "Aucune" },
                { valeur: "rdv", libelle: "Prendre rendez-vous" },
              ]}
              valeur={fin}
              onChange={setFin}
            />
            <CaseACocher libelle="Préparer aussi des vidéos courtes tirées de cette vidéo" coche={courts} onChange={setCourts} />
            <CaseACocher libelle="Préparer aussi la page pour mon site" coche={pageSite} onChange={setPageSite} />
            <div className="flex flex-wrap gap-3">
              <Bouton type="submit" icone="baguette" disabled={!actif}>
                Proposer les chapitres
              </Bouton>
              <Bouton type="button" variante="secondaire" onClick={() => setPause(PHRASE_ENREGISTREMENT_NON_RELIE)}>
                Enregistrer pour plus tard
              </Bouton>
            </div>
            {pause && <PauseVitrine phrase={pause} />}
          </form>
        )}
        {etape === 1 && <PlanChapitres chapitres={chapitres} onChange={setChapitres} onSuivant={() => aller(2)} onRetour={() => aller(0)} />}
        {etape === 2 && (
          <>
            <TexteParChapitre
              chapitres={versions}
              onValiderTout={(texte) => {
                setValide(texte);
                aller(3);
              }}
              onEnregistrer={() => setPause(PHRASE_ENREGISTREMENT_NON_RELIE)}
              onRetour={() => aller(1)}
            />
            {pause && <PauseVitrine phrase={pause} />}
          </>
        )}
        {etape === 3 && (
          <>
            <AvantDeLancer
              dureeSec={dureeSec}
              chapitres={planFinal.length}
              courts={courts ? planFinal.length : 0}
              sansVoix={sansVoix}
              peutLancer={actif && !depensesCoupees}
              onLancer={() => setPause(PHRASE_LANCEMENT_NON_RELIEE)}
              onRetour={() => aller(2)}
            />
            {pause && <PauseVitrine phrase={pause} />}
            {valide && (
              <KitGeo
                titre={question}
                description={modeleDescription({ chapitres: chapitresWeb })}
                chapitres={chapitresWeb}
                texteComplet={texteComplet}
                courts={courts ? planFinal.map((c, i) => ({ id: c.id, titre: c.titre.trim() || `Chapitre ${i + 1}` })) : undefined}
              />
            )}
          </>
        )}
      </div>
    </GabaritCreation>
  );
}
