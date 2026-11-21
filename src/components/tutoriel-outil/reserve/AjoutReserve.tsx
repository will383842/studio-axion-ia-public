"use client";

import { useState } from "react";
import { Bouton } from "@/components/ui/Bouton";
import { CaseACocher } from "@/components/ui/CaseACocher";
import { Onglets } from "@/components/ui/Onglets";
import { ZoneDepot } from "@/components/ui/ZoneDepot";
import { ZoneTexte } from "@/components/ui/ZoneTexte";
import { PHRASE_DEPOT_MAX, PHRASE_DEPOT_MIN } from "@/moteurs/montage-tutoriel-outil/entrees";

type Fin = "aucune" | "prendre-rendez-vous";
type Issue = { statut: "ok"; element: { titre: string } } | { statut: "refuse"; phrase: string; rapport?: { refus: string[] } };
type Retour = { ok: true; donnees: Issue } | { ok: false; message: string };

const SCRIPT_MAX = 8000;
/** Le même libellé que le formulaire du tutoriel, au mot près. */
export const LIBELLE_ATTESTATION = "Je confirme qu'aucune donnée personnelle n'est visible sur les images du dossier";

interface Ligne {
  texte: string;
  refus: string[];
  ok: boolean;
}

/** Ajout à la réserve : un dossier (.zip, plusieurs permis) ou une idée (une phrase). Le script et la fin sont facultatifs. */
export function AjoutReserve({
  ajouterDossier,
  ajouterIdee,
}: {
  ajouterDossier: (d: { fichierId: string; attestationImages: boolean; script?: string; fin?: string }) => Promise<Retour>;
  ajouterIdee: (d: { phrase: string; script?: string; fin?: string }) => Promise<Retour>;
}) {
  const [envoyes, setEnvoyes] = useState<{ fichierId: string; nom: string }[]>([]);
  const [attestation, setAttestation] = useState(false);
  const [phrase, setPhrase] = useState("");
  const [script, setScript] = useState("");
  const [fin, setFin] = useState<Fin>("aucune");
  const [erreurEnvoi, setErreurEnvoi] = useState<string | null>(null);
  const [lignes, setLignes] = useState<Ligne[]>([]);
  const [enCours, setEnCours] = useState(false);

  const scriptOk = script.length <= SCRIPT_MAX;
  const options = { ...(script.trim() ? { script: script.trim() } : {}), fin };

  function noter(nom: string, r: Retour): Ligne {
    if (!r.ok) return { texte: `${nom} : ${r.message}`, refus: [], ok: false };
    if (r.donnees.statut === "ok") return { texte: `« ${r.donnees.element.titre} » est rangé dans la réserve.`, refus: [], ok: true };
    return { texte: `${nom} : ${r.donnees.phrase}`, refus: r.donnees.rapport?.refus ?? [], ok: false };
  }

  async function rangerDossiers() {
    if (enCours || envoyes.length === 0) return;
    setEnCours(true);
    setLignes([]);
    const restes: typeof envoyes = [];
    const sortie: Ligne[] = [];
    try {
      for (const f of envoyes) {
        let l: Ligne;
        try {
          l = noter(f.nom, await ajouterDossier({ fichierId: f.fichierId, attestationImages: attestation, ...options }));
        } catch {
          l = { texte: `${f.nom} : un souci est survenu. Réessayez dans un instant.`, refus: [], ok: false };
        }
        sortie.push(l);
        if (!l.ok) restes.push(f);
      }
    } finally {
      setLignes(sortie);
      setEnvoyes(restes);
      setEnCours(false);
    }
  }

  async function rangerIdee() {
    if (enCours) return;
    setEnCours(true);
    try {
      const l = noter("Votre idée", await ajouterIdee({ phrase: phrase.trim(), ...options }));
      setLignes([l]);
      if (l.ok) setPhrase("");
    } catch {
      setLignes([{ texte: "Un souci est survenu. Réessayez dans un instant.", refus: [], ok: false }]);
    } finally {
      setEnCours(false);
    }
  }

  const phraseOk = phrase.trim().length >= PHRASE_DEPOT_MIN && phrase.trim().length <= PHRASE_DEPOT_MAX;

  const dossier = (
    <div className="space-y-3">
      <ZoneDepot
        libelle="Choisir vos dossiers"
        detail="Un ou plusieurs fichiers .zip : un élément par fichier"
        accepte=".zip,application/zip"
        multiple
        essai={false}
        onFichiers={() => setErreurEnvoi(null)}
        envoi={{
          typeEntite: "entree",
          entiteId: "tutoriel-reserve",
          onEnvoyes: (f) => setEnvoyes((d) => [...d, ...f]),
          onErreur: setErreurEnvoi,
        }}
      />
      {erreurEnvoi && (
        <p role="alert" className="text-sm text-texte">
          {erreurEnvoi}
        </p>
      )}
      {envoyes.length > 0 && (
        <ul className="list-disc pl-5 text-sm text-texte-doux">
          {envoyes.map((f) => (
            <li key={f.fichierId}>{f.nom} : envoyé, prêt à ranger</li>
          ))}
        </ul>
      )}
      <CaseACocher libelle={LIBELLE_ATTESTATION} coche={attestation} onChange={setAttestation} />
    </div>
  );

  const idee = <ZoneTexte libelle="Votre idée (une phrase)" aide={`De ${PHRASE_DEPOT_MIN} à ${PHRASE_DEPOT_MAX} caractères.`} longueurMax={PHRASE_DEPOT_MAX} value={phrase} onChange={(e) => setPhrase(e.target.value)} />;

  return (
    <section aria-labelledby="bloc-ajout-reserve" className="space-y-4">
      <h2 id="bloc-ajout-reserve" className="text-lg font-semibold">
        Ajouter à la réserve
      </h2>
      <Onglets
        libelle="Ce que vous ajoutez"
        valeurParDefaut="dossier"
        onglets={[
          { valeur: "dossier", libelle: "Un dossier (.zip)", contenu: dossier },
          { valeur: "idee", libelle: "Une idée (une phrase)", contenu: idee },
        ]}
      />
      <ZoneTexte libelle="Votre script (facultatif)" aide="Collez-le : il fait foi. Sans script, le studio en écrit un." longueurMax={SCRIPT_MAX} value={script} onChange={(e) => setScript(e.target.value)} />
      <div role="radiogroup" aria-label="Fin de la vidéo" className="flex flex-wrap gap-4">
        <label className="flex min-h-11 items-center gap-2">
          <input type="radio" name="fin-reserve" value="aucune" checked={fin === "aucune"} onChange={() => setFin("aucune")} />
          Fin : aucune
        </label>
        <label className="flex min-h-11 items-center gap-2">
          <input type="radio" name="fin-reserve" value="prendre-rendez-vous" checked={fin === "prendre-rendez-vous"} onChange={() => setFin("prendre-rendez-vous")} />
          Fin : prendre rendez-vous
        </label>
      </div>
      <div className="flex flex-wrap gap-2">
        <Bouton type="button" icone="telecharger" disabled={enCours || envoyes.length === 0 || !scriptOk} onClick={() => void rangerDossiers()}>
          Ranger les dossiers
        </Bouton>
        <Bouton type="button" variante="secondaire" disabled={enCours || !phraseOk || !scriptOk} onClick={() => void rangerIdee()}>
          Ranger l&apos;idée
        </Bouton>
      </div>
      {lignes.length > 0 && (
        <div role="status" className="space-y-1 rounded-carte border border-trait bg-surface-2 p-3.5 text-sm text-texte">
          {lignes.map((l, i) => (
            <div key={i}>
              <p>{l.texte}</p>
              {l.refus.length > 0 && (
                <ul className="list-disc pl-5">
                  {l.refus.map((r) => (
                    <li key={r}>{r}</li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
