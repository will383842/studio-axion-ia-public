"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Bouton } from "@/components/ui/Bouton";
import { CaseACocher } from "@/components/ui/CaseACocher";
import { Champ } from "@/components/ui/Champ";
import { BarreProgression } from "@/components/ui/ProgressionEtapes";
import { SelecteurPastilles } from "@/components/ui/SelecteurPastilles";
import { ZoneDepot } from "@/components/ui/ZoneDepot";
import { ZoneTexte } from "@/components/ui/ZoneTexte";
import { AIDE_MODE_SANS_VOIX, LIBELLE_MODE_AVEC_VOIX, LIBELLE_MODE_SANS_VOIX, MODE_AVEC_VOIX, MODE_SANS_VOIX, type ModeVoixTutoriel } from "@/formats/tutoriel-outil/mode-sans-voix";
import { controlerLongueurScript } from "@/moteurs/montage-tutoriel-outil/diffusion-tutoriel";
import { DUREE_CARTE_FIN_MS } from "@/moteurs/montage-tutoriel-outil/proprietes";
import { analyserFicheTutorielOutil } from "@/domaine/outils-motion/fiches";
import { envoyerFichier } from "@/lib/envoi-multipart";
import { PHRASE_DEPOT_MAX, PHRASE_DEPOT_MIN } from "@/moteurs/montage-tutoriel-outil/entrees";
import { TAILLE_ZIP_MAX } from "@/moteurs/montage-tutoriel-outil/securite-entrees";
import { PauseVitrine, RemarquesFiche } from "./RemarquesFiche";

/** Ce que le formulaire envoie au serveur (même forme que `DemandeDepotTutoriel`, recopiée : pas d'import serveur ici). */
export interface DemandeFormulaireTutoriel {
  mode: "dossier" | "phrase";
  fichierId?: string;
  attestationImages?: boolean;
  phrase?: string;
  fin: "aucune" | "prendre-rendez-vous";
  gabarit?: string;
  ratios: string[];
}
export type IssueFormulaireTutoriel = { statut: "lancee"; videoId: string } | { statut: "refusee"; phrase: string; rapport?: { refus: string[] } };
export type ResultatFormulaireTutoriel = { ok: true; donnees: IssueFormulaireTutoriel } | { ok: false; message: string };

/** Interrupteurs lus côté serveur par la page (seul `true` exact allume). */
export interface InterrupteursFormulaire {
  formulaire: boolean;
  dossier: boolean;
  phrase: boolean;
}

export const PHRASE_AUCUNE_ENTREE_OUVERTE = "Aucune entrée n'est ouverte pour le moment.";
export const PHRASE_RIEN_DEPENSE = "Rien n'est dépensé avant votre accord : vous verrez d'abord le parcours, le script et le devis.";
const PARCOURS: { valeur: string; libelle: string }[] = [
  { valeur: "", libelle: "Choisi par le Studio" },
  { valeur: "G-Journee", libelle: "Une journée avant / après" },
  { valeur: "G-Decision", libelle: "Du chiffre à la décision" },
  { valeur: "G-Reponse", libelle: "Le client écrit à 2 h du matin" },
  { valeur: "G-Flux", libelle: "Une automatisation de bout en bout" },
];
const FORMATS = ["4:5", "9:16", "1:1"] as const;

/**
 * Écran d'entrée « Tutoriel d'outil ». ÉTEINT (aucun interrupteur donné, ou `formulaire` différent de `true`) : la vitrine
 * d'aujourd'hui, mot pour mot. ALLUMÉ : le vrai formulaire (un dossier ou une phrase, la fin, le parcours, les formats).
 */
export function FormulaireTutorielOutil({ interrupteurs, deposer }: { interrupteurs?: InterrupteursFormulaire; deposer?: (demande: DemandeFormulaireTutoriel) => Promise<ResultatFormulaireTutoriel> } = {}) {
  if (interrupteurs?.formulaire === true && deposer) return <FormulaireOuvert interrupteurs={interrupteurs} deposer={deposer} />;
  return <VitrineTutorielOutil />;
}

function FormulaireOuvert({ interrupteurs, deposer }: { interrupteurs: InterrupteursFormulaire; deposer: (demande: DemandeFormulaireTutoriel) => Promise<ResultatFormulaireTutoriel> }) {
  const premier: "dossier" | "phrase" | null = interrupteurs.dossier ? "dossier" : interrupteurs.phrase ? "phrase" : null;
  const [mode, setMode] = useState<"dossier" | "phrase" | null>(premier);
  const [envoye, setEnvoye] = useState<{ fichierId: string; nom: string; taille: number } | null>(null);
  const [progression, setProgression] = useState<number | null>(null);
  const [attestation, setAttestation] = useState(false);
  const [phrase, setPhrase] = useState("");
  const [fin, setFin] = useState<"aucune" | "prendre-rendez-vous">("aucune");
  const [gabarit, setGabarit] = useState("");
  const [ratios, setRatios] = useState<string[]>([...FORMATS]);
  const [message, setMessage] = useState<string | null>(null);
  const [refus, setRefus] = useState<string[]>([]);
  const [enCours, setEnCours] = useState(false);
  const [videoId, setVideoId] = useState<string | null>(null);
  const [cible] = useState(() => `tuto-${Math.random().toString(36).slice(2, 12)}`);

  if (!premier) return <PauseVitrine phrase={PHRASE_AUCUNE_ENTREE_OUVERTE} />;

  async function recevoir(fichiers: File[]) {
    const f = fichiers[0];
    if (!f) return;
    setMessage(null);
    setRefus([]);
    if (f.size > TAILLE_ZIP_MAX) {
      setEnvoye(null);
      setMessage(`Le dossier dépasse ${Math.round(TAILLE_ZIP_MAX / (1024 * 1024))} Mo : réduisez-le puis renvoyez-le.`);
      return;
    }
    setProgression(0);
    try {
      const r = await envoyerFichier(f, { typeEntite: "entree", entiteId: cible }, { onProgression: setProgression });
      setEnvoye({ fichierId: r.fichierId, nom: f.name, taille: f.size });
    } catch {
      setEnvoye(null);
      setMessage("Le dossier n'a pas pu être envoyé. Vérifiez la connexion et réessayez.");
    } finally {
      setProgression(null);
    }
  }

  const pret = mode === "dossier" ? envoye !== null : mode === "phrase" ? phrase.trim().length >= PHRASE_DEPOT_MIN && phrase.trim().length <= PHRASE_DEPOT_MAX : false;
  const formatsOk = ratios.includes("4:5");

  async function envoyer() {
    if (!mode || enCours) return;
    setEnCours(true);
    setMessage(null);
    setRefus([]);
    try {
      const r = await deposer({
        mode,
        ...(mode === "dossier" ? { fichierId: envoye?.fichierId, attestationImages: attestation } : { phrase: phrase.trim() }),
        fin,
        ...(gabarit ? { gabarit } : {}),
        ratios: FORMATS.filter((x) => ratios.includes(x)),
      });
      if (!r.ok) setMessage(r.message);
      else if (r.donnees.statut === "lancee") setVideoId(r.donnees.videoId);
      else {
        setMessage(r.donnees.phrase);
        setRefus(r.donnees.rapport?.refus ?? []);
      }
    } catch {
      setMessage("La demande n'a pas pu partir. Réessayez dans un instant.");
    } finally {
      setEnCours(false);
    }
  }

  if (videoId) {
    return (
      <div className="space-y-3">
        <PauseVitrine phrase="Votre demande est partie. Vous pouvez suivre la préparation de la vidéo." />
        <Link href={`/tutoriel-outil/suivi/${videoId}`} className="flex min-h-11 items-center font-semibold underline underline-offset-4">
          Suivre la préparation
        </Link>
      </div>
    );
  }

  return (
    <form
      className="space-y-6"
      onSubmit={(e) => {
        e.preventDefault();
        void envoyer();
      }}
    >
      <section aria-labelledby="bloc-donnez" className="space-y-3">
        <h2 id="bloc-donnez" className="text-lg font-semibold">
          Ce que vous donnez
        </h2>
        {interrupteurs.dossier && interrupteurs.phrase && (
          <div role="radiogroup" aria-label="Ce que vous donnez" className="flex flex-wrap gap-4">
            <label className="flex min-h-11 items-center gap-2">
              <input type="radio" name="mode" value="dossier" checked={mode === "dossier"} onChange={() => setMode("dossier")} />
              Un dossier (.zip)
            </label>
            <label className="flex min-h-11 items-center gap-2">
              <input type="radio" name="mode" value="phrase" checked={mode === "phrase"} onChange={() => setMode("phrase")} />
              Une phrase
            </label>
          </div>
        )}
        {interrupteurs.dossier && !interrupteurs.phrase && <p className="font-semibold">Un dossier (.zip)</p>}
        {!interrupteurs.dossier && interrupteurs.phrase && <p className="font-semibold">Une phrase</p>}
        {mode === "dossier" && (
          <div className="space-y-3">
            <ZoneDepot libelle="Choisir votre dossier" detail="50 Mo au plus" accepte=".zip,application/zip" multiple={false} onFichiers={(f) => void recevoir(f)} essai={false} />
            {progression !== null && <BarreProgression valeur={progression} libelle="Envoi du dossier" />}
            {envoye && (
              <p className="text-sm text-texte-doux">
                {envoye.nom} · {(envoye.taille / (1024 * 1024)).toFixed(1).replace(".", ",")} Mo
              </p>
            )}
            <CaseACocher libelle="Je confirme qu'aucune donnée personnelle n'est visible sur les images du dossier" coche={attestation} onChange={setAttestation} />
          </div>
        )}
        {mode === "phrase" && <ZoneTexte libelle="Votre phrase" aide={`De ${PHRASE_DEPOT_MIN} à ${PHRASE_DEPOT_MAX} caractères.`} longueurMax={PHRASE_DEPOT_MAX} value={phrase} onChange={(e) => setPhrase(e.target.value)} />}
      </section>

      <section aria-labelledby="bloc-fin" className="space-y-2">
        <h2 id="bloc-fin" className="text-lg font-semibold">
          Fin de la vidéo
        </h2>
        <div role="radiogroup" aria-label="Fin de la vidéo" className="flex flex-wrap gap-4">
          <label className="flex min-h-11 items-center gap-2">
            <input type="radio" name="fin" value="aucune" checked={fin === "aucune"} onChange={() => setFin("aucune")} />
            Aucune
          </label>
          <label className="flex min-h-11 items-center gap-2">
            <input type="radio" name="fin" value="prendre-rendez-vous" checked={fin === "prendre-rendez-vous"} onChange={() => setFin("prendre-rendez-vous")} />
            Prendre rendez-vous
          </label>
        </div>
      </section>

      <section aria-labelledby="bloc-parcours">
        <details>
          <summary id="bloc-parcours" className="flex min-h-11 cursor-pointer items-center text-lg font-semibold">
            Parcours
          </summary>
          <div role="radiogroup" aria-label="Parcours" className="mt-2 flex flex-col gap-1">
            {PARCOURS.map((p) => (
              <label key={p.valeur || "studio"} className="flex min-h-11 items-center gap-2">
                <input type="radio" name="parcours" value={p.valeur} checked={gabarit === p.valeur} onChange={() => setGabarit(p.valeur)} />
                {p.libelle}
              </label>
            ))}
          </div>
        </details>
      </section>

      <section aria-labelledby="bloc-formats" className="space-y-2">
        <h2 id="bloc-formats" className="text-lg font-semibold">
          Formats
        </h2>
        <div className="flex flex-wrap gap-4">
          {FORMATS.map((f) => (
            <label key={f} className="flex min-h-11 items-center gap-2">
              <input type="checkbox" name="formats" value={f} checked={ratios.includes(f)} onChange={(e) => setRatios((r) => (e.target.checked ? [...r, f] : r.filter((x) => x !== f)))} />
              {f}
              {f === "4:5" ? " (principal)" : ""}
            </label>
          ))}
        </div>
        {!formatsOk && <p className="text-sm text-texte-doux">Gardez au moins le format 4:5.</p>}
      </section>

      <p className="text-sm text-texte-doux">{PHRASE_RIEN_DEPENSE}</p>
      {message && (
        <div role="alert" className="space-y-1 rounded-carte border border-trait bg-surface-2 p-3.5 text-sm text-texte">
          <p>{message}</p>
          {refus.length > 0 && (
            <ul className="list-disc pl-5">
              {refus.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          )}
        </div>
      )}
      <Bouton type="submit" icone="baguette" disabled={!pret || !formatsOk || enCours}>
        Préparer la vidéo
      </Bouton>
    </form>
  );
}

/** La vitrine d'aujourd'hui (formulaire éteint) : même texte, même `PauseVitrine`, rien n'est envoyé. */
function VitrineTutorielOutil() {
  const [titre, setTitre] = useState("");
  const [outil, setOutil] = useState("");
  const [scriptColle, setScriptColle] = useState("");
  const [valide, setValide] = useState(false);
  // T-EXT-SV : le mode avec voix reste le défaut ; « sans voix » seulement si l'utilisateur le choisit.
  const [mode, setMode] = useState<ModeVoixTutoriel>(MODE_AVEC_VOIX);
  const analyse = useMemo(() => analyserFicheTutorielOutil({ titre, outil, idee: titre, scriptColle }), [titre, outil, scriptColle]);
  // Sans voix, le rythme vient de la vitesse de lecture du texte ; hors cible = une remarque, jamais un refus ni une coupe.
  const remarquesDuree = useMemo(() => (mode === MODE_SANS_VOIX && scriptColle.trim() ? controlerLongueurScript(scriptColle, DUREE_CARTE_FIN_MS).map((r) => r.message) : []), [mode, scriptColle]);
  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        setValide(true);
      }}
    >
      <Champ libelle="Titre ou idée" value={titre} onChange={(e) => setTitre(e.target.value)} placeholder="Ex. Prendre un rendez-vous avec Calendly" />
      <Champ libelle="Outil montré" value={outil} onChange={(e) => setOutil(e.target.value)} />
      <ZoneTexte libelle="Votre script (facultatif)" aide="Collez-le : il fait foi. Sans script, le studio en écrit un que vous relirez avant de valider." value={scriptColle} onChange={(e) => setScriptColle(e.target.value)} />
      <SelecteurPastilles
        libelle="Son de la vidéo"
        valeur={mode}
        onChange={setMode}
        options={[
          { valeur: MODE_AVEC_VOIX, libelle: LIBELLE_MODE_AVEC_VOIX },
          { valeur: MODE_SANS_VOIX, libelle: LIBELLE_MODE_SANS_VOIX, detail: AIDE_MODE_SANS_VOIX },
        ]}
      />
      <RemarquesFiche remarques={[...analyse.remarques, ...remarquesDuree]} />
      <Bouton type="submit" icone="baguette">
        Préparer le tutoriel
      </Bouton>
      {valide && <PauseVitrine phrase="Le tutoriel d'outil n'est pas encore branché : votre demande est gardée, rien n'a échoué." />}
    </form>
  );
}
