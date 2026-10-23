"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState, useTransition } from "react";
import {
  changerLangueVoixAction,
  choisirVoixParDefautAction,
  choisirVoixPourFormatAction,
  ecouterEssaiVoixAction,
  enregistrerVoixAction,
  listerVoixHeygenAction,
  reglerVoixAction,
  relierVoixHeygenAction,
} from "@/app/(studio)/personnages/actions";
import { useEcoute } from "@/components/prononciations/useEcoute";
import { BarreActionCollee, Bouton, Curseur, EtatVide, FeuilleBas, Icone, notifier, PastilleEssai, PastilleEtat, SelecteurPastilles, ZoneDepot } from "@/components/ui";
import type { ReglagesVoix, Voix } from "@/domaine/types";
import { listerFormatsActifs } from "@/formats";
import { cn } from "@/lib/cn";
import { formaterMontant } from "@/lib/montants";
import type { VueFichePersonnage } from "@/services/B-personnages-bibliotheque";
import type { VoixHeygenAffichee } from "@/services/personnages";
import { BlocageAccord } from "./BlocageAccord";
import { Enregistreur, type EnregistrementTermine } from "./Enregistreur";
import { envoyerFichiers } from "@/lib/envoi-multipart";
import { formateurNoms } from "@/lib/intl";
import { dureeMedia, minutesLisibles } from "./outils";

/** « en-US » → « Anglais (États-Unis) » ; « fr-FR » → « Français » (E2E-1 n° 22). */
export function langueLisible(code: string): string {
  if (/^fr(-FR)?$/i.test(code)) return "Français";
  try {
    const nom = formateurNoms("fr", { type: "language" }).of(code);
    if (nom && nom !== code) return nom.charAt(0).toUpperCase() + nom.slice(1);
  } catch {
    /* code inconnu : on le garde */
  }
  return code;
}

/** Minutes conseillées pour une NOUVELLE copie de voix (secours ElevenLabs seulement ; la voix HeyGen se relie). */
const MINUTES_CONSEILLEES = 30;
const LANGUES: { valeur: Voix["langue"]; libelle: string; detail: string }[] = [
  { valeur: "fr-FR", libelle: "Français", detail: "FR" },
  { valeur: "en-US", libelle: "Anglais", detail: "US" },
  { valeur: "es-ES", libelle: "Espagnol", detail: "ES" },
];
const TEXTE_ESSAI = "Bonjour, ici Axion-IA. Voici comment l'IA peut vous faire gagner une heure par jour.";
/** Test d'écoute (lot M0b) : trois phrases difficiles — des sons proches, un montant, un nom propre. */
const PHRASES_TEST = [
  { libelle: "Sons proches", texte: "Un bon PV, puis un pépin : voilà comment tout commence." },
  { libelle: "Montant", texte: "Cette amende de 135 € peut être contestée sous 45 jours." },
  { libelle: "Nom propre", texte: "Williams Jullin, d'Axion-IA, vous explique tout cela simplement." },
];

/**
 * Onglet VOIX : « Relier ma voix HeyGen » (lot M0b — la voix déjà créée chez HeyGen, écoutée puis choisie), voix
 * utilisée, réglages (HeyGen : la vitesse seule), essai et test d'écoute ; en secours, enregistrement dans le
 * navigateur ou dépôt pour une nouvelle copie (30 min conseillées).
 */
export function OngletVoix({ fiche, texteALire, verrouille, onOuvrirAccord }: { fiche: VueFichePersonnage; texteALire: string; verrouille: boolean; onOuvrirAccord: () => void }) {
  const voix = fiche.voix.find((v) => v.id === fiche.personnage.voixParDefautId) ?? fiche.voix.find((v) => v.fournisseur === "heygen") ?? fiche.voix[0] ?? null;
  const moi = fiche.personnage.nature === "moi";
  const [feuille, setFeuille] = useState<"enregistrer" | "deposer" | "relier" | null>(null);
  const reliee = voix?.fournisseur === "heygen";
  const minutes = voix?.minutesEnregistrees ?? 0;
  const pct = Math.min(100, (minutes / MINUTES_CONSEILLEES) * 100);

  return (
    <div className="space-y-5">
      {verrouille && <BlocageAccord nom={fiche.personnage.nom} onOuvrirAccord={onOuvrirAccord} />}

      {/* Voix HeyGen : la voix déjà créée se relie (chemin normal). */}
      {reliee && voix ? (
        <div className="relative isolate overflow-hidden rounded-carte border border-orange/40 bg-surface-1 p-5">
          <div aria-hidden className="absolute inset-0 -z-10 lueur" />
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-texte-doux">Voix reliée</p>
              <p className="mt-1 truncate font-titre text-3xl leading-tight text-texte">{voix.nom}</p>
              <p className="mt-1 text-sm text-texte-faible">
                HeyGen · {voix.typeClone === "instant" ? "copie instantanée" : "copie"} · {voix.langue === "fr-FR" ? "français" : voix.langue}
              </p>
            </div>
            <PastilleEtat type="preparation" statut={voix.statut} />
          </div>
        </div>
      ) : (
        <button
          type="button"
          disabled={verrouille}
          onClick={() => setFeuille("relier")}
          className="group relative isolate flex min-h-20 w-full items-center gap-4 overflow-hidden rounded-carte border border-orange/40 bg-surface-1 p-4 text-left transition-colors hover:border-orange disabled:opacity-50"
        >
          <span aria-hidden className="absolute inset-0 -z-10 lueur opacity-70" />
          <span className="grid size-12 shrink-0 place-items-center rounded-full bg-orange text-sur-orange">
            <Icone nom="lien" size={20} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[17px] font-semibold text-texte">{moi ? "Relier ma voix HeyGen" : "Relier sa voix HeyGen"}</span>
            <span className="block text-sm text-texte-faible">Écoutez, choisissez : c&apos;est prêt.</span>
          </span>
          <Icone nom="chevron-droite" size={18} className="text-orange-vif" />
        </button>
      )}

      {fiche.voix.length > 1 && voix && <ChoixVoix personnageId={fiche.personnage.id} voix={fiche.voix} choisie={voix.id} />}

      {/* Voix par format (02/10) : chaque format peut avoir SA voix, reprise d'office à la création d'une vidéo. */}
      {voix && <VoixParFormat personnageId={fiche.personnage.id} voix={fiche.voix} parFormat={fiche.personnage.voixParFormat ?? {}} habituelle={voix} />}

      {/* Secours (nouvelle copie) : minutes + état. Masqué quand la voix HeyGen est reliée. */}
      {!reliee && (
        <div className="relative isolate overflow-hidden rounded-carte border border-trait bg-surface-1 p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-texte-doux">{voix?.nom ?? "Ou une nouvelle copie"}</p>
              <p className="mt-1 font-titre text-5xl tabular-nums leading-none text-texte">
                {minutes.toLocaleString("fr-FR", { maximumFractionDigits: 1 })}
                <span className="ml-1 text-xl text-texte-faible">min</span>
              </p>
            </div>
            {voix ? <PastilleEtat type="preparation" statut={voix.statut} /> : <span className="text-sm text-texte-faible">Pas encore de voix</span>}
          </div>
          <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-surface-3">
            <motion.div className="h-full rounded-full bg-orange" initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }} />
          </div>
          <p className="mt-2 text-sm text-texte-faible">{minutes >= MINUTES_CONSEILLEES ? "Assez pour une voix très naturelle." : `${MINUTES_CONSEILLEES} min conseillées · 1 min suffit pour un premier essai`}</p>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <Bouton variante="secondaire" icone="micro" disabled={verrouille} onClick={() => setFeuille("enregistrer")}>
              Enregistrer
            </Bouton>
            <Bouton variante="secondaire" icone="telecharger" disabled={verrouille} onClick={() => setFeuille("deposer")}>
              Déposer
            </Bouton>
          </div>
        </div>
      )}

      {voix ? (
        <ReglagesEtEssai key={voix.id} personnageId={fiche.personnage.id} voix={voix} />
      ) : (
        !verrouille && <EtatVide compact icone="micro" titre="Pas encore de voix" phrase="Reliez votre voix HeyGen, ou enregistrez-en une." />
      )}

      <BarreActionCollee>
        {verrouille ? (
          <Bouton taille="lg" icone="bouclier" onClick={onOuvrirAccord}>
            Enregistrer l&apos;accord
          </Bouton>
        ) : reliee ? (
          <Bouton taille="lg" variante="secondaire" icone="lien" onClick={() => setFeuille("relier")}>
            Changer de voix HeyGen
          </Bouton>
        ) : (
          <Bouton taille="lg" icone="lien" onClick={() => setFeuille("relier")}>
            {moi ? "Relier ma voix HeyGen" : "Relier sa voix HeyGen"}
          </Bouton>
        )}
      </BarreActionCollee>

      <FeuilleRelier ouverte={feuille === "relier"} onOuverteChange={(o) => setFeuille(o ? "relier" : null)} personnageId={fiche.personnage.id} />
      <FeuilleEnregistrer
        ouverte={feuille === "enregistrer"}
        onOuverteChange={(o) => setFeuille(o ? "enregistrer" : null)}
        personnageId={fiche.personnage.id}
        texteALire={texteALire}
        minutesDeja={minutes}
        langue={voix?.langue}
        onDeposer={() => setFeuille("deposer")}
      />
      <FeuilleDeposer ouverte={feuille === "deposer"} onOuverteChange={(o) => setFeuille(o ? "deposer" : null)} personnageId={fiche.personnage.id} langue={voix?.langue} />
    </div>
  );
}

/**
 * VOIX PAR FORMAT (lot du 02/10) : « Vidéo type avocat → Voix avocat rapide ». Deux touches : le format, puis la voix.
 * Reprise d'office à la création d'une vidéo de ce format, modifiable ensuite vidéo par vidéo (bloc Voix).
 * Les prononciations suivent la voix (chaque voix garde les siennes).
 */
function VoixParFormat({ personnageId, voix, parFormat, habituelle }: { personnageId: string; voix: Voix[]; parFormat: Record<string, string>; habituelle: Voix }) {
  const formats = listerFormatsActifs().filter((f) => f.personnages.max > 0);
  const pretes = voix.filter((v) => v.statut === "pret");
  const [choix, setChoix] = useState(parFormat);
  const [ouvert, setOuvert] = useState<string | null>(null);
  const [enCours, demarrer] = useTransition();
  if (!formats.length || !pretes.length) return null;
  const format = formats.find((f) => f.id === ouvert);

  function choisir(formatId: string, voixId: string | null) {
    const avant = choix;
    const suite = { ...choix };
    if (voixId) suite[formatId] = voixId;
    else delete suite[formatId];
    setChoix(suite);
    setOuvert(null);
    demarrer(async () => {
      const r = await choisirVoixPourFormatAction(personnageId, formatId, voixId);
      if (!r.ok) {
        setChoix(avant);
        notifier.erreur(r.message);
        return;
      }
      notifier.succes(voixId ? `${pretes.find((v) => v.id === voixId)?.nom ?? "Voix"} pour ${formats.find((f) => f.id === formatId)?.nom ?? "ce format"}` : "Voix habituelle reprise");
    });
  }

  return (
    <section aria-labelledby="voix-par-format" className="rounded-carte border border-trait bg-surface-1 p-4">
      <h3 id="voix-par-format" className="mb-1 text-sm font-semibold text-texte-doux">
        Par format
      </h3>
      <ul className="-mx-2">
        {formats.map((f) => {
          const v = pretes.find((x) => x.id === choix[f.id]);
          return (
            <li key={f.id}>
              <button type="button" onClick={() => setOuvert(f.id)} disabled={enCours} className="flex min-h-14 w-full items-center gap-3 rounded-2xl px-2 text-left transition-colors hover:bg-surface-2">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-surface-2 text-orange-vif">
                  <Icone nom={f.icone} size={18} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-semibold text-texte">{f.nom}</span>
                  <span className={cn("block truncate text-sm", v ? "text-texte" : "text-texte-faible")}>{v ? v.nom : `Habituelle · ${habituelle.nom}`}</span>
                </span>
                <Icone nom="chevron-droite" size={18} className="shrink-0 text-texte-faible" />
              </button>
            </li>
          );
        })}
      </ul>
      <FeuilleBas ouverte={!!format} onOuverteChange={(o) => !o && setOuvert(null)} titre={format?.nom ?? ""} description="Choisie d'office pour ce format.">
        {format && (
          <ul role="radiogroup" aria-label={`Voix pour ${format.nom}`} className="space-y-2 pb-2">
            {[{ id: null as string | null, nom: "Voix habituelle", detail: habituelle.nom }, ...pretes.map((v) => ({ id: v.id as string | null, nom: v.nom, detail: v.fournisseur === "heygen" ? "HeyGen" : v.fournisseur === "simulation" ? "essai" : v.fournisseur }))].map((o) => {
              const actif = (choix[format.id] ?? null) === o.id;
              return (
                <li key={o.id ?? "habituelle"}>
                  <button
                    type="button"
                    role="radio"
                    aria-checked={actif}
                    onClick={() => choisir(format.id, o.id)}
                    className={cn("flex min-h-14 w-full items-center gap-3 rounded-carte border p-3 text-left transition-colors", actif ? "border-orange bg-surface-2" : "border-trait bg-surface-1 hover:border-trait-fort")}
                  >
                    <span className={cn("grid size-10 shrink-0 place-items-center rounded-full", actif ? "bg-orange text-sur-orange" : "bg-orange-doux text-orange-vif")}>
                      <Icone nom={actif ? "coche" : "micro"} size={17} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[15px] font-semibold text-texte">{o.nom}</span>
                      <span className="block truncate text-xs text-texte-faible">{o.detail}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </FeuilleBas>
    </section>
  );
}

/** Plusieurs voix : celle que la fabrication utilise (les autres restent, rien n'est effacé). */
function ChoixVoix({ personnageId, voix, choisie }: { personnageId: string; voix: Voix[]; choisie: string }) {
  const [valeur, setValeur] = useState(choisie);
  const [, demarrer] = useTransition();
  return (
    <section className="rounded-carte border border-trait bg-surface-1 p-4">
      <SelecteurPastilles
        libelle="Voix utilisée"
        options={voix.map((v) => ({ valeur: v.id, libelle: v.nom, detail: v.fournisseur === "heygen" ? "HeyGen" : v.fournisseur === "simulation" ? "essai" : v.fournisseur }))}
        valeur={valeur}
        onChange={(id) => {
          const avant = valeur;
          setValeur(id);
          demarrer(async () => {
            const r = await choisirVoixParDefautAction(personnageId, id);
            if (!r.ok) {
              setValeur(avant);
              notifier.erreur(r.message);
            }
          });
        }}
      />
    </section>
  );
}

/** « Relier ma voix HeyGen » : les voix du compte HeyGen, ▶ pour écouter (par le studio), un toucher pour choisir. */
function FeuilleRelier({ ouverte, onOuverteChange, personnageId }: { ouverte: boolean; onOuverteChange: (v: boolean) => void; personnageId: string }) {
  const [etat, setEtat] = useState<{ voix: VoixHeygenAffichee[]; simulee: boolean } | null>(null);
  const [erreur, setErreur] = useState("");
  const [choixEnCours, setChoixEnCours] = useState<string | null>(null);
  const [, demarrer] = useTransition();
  const ecoute = useEcoute();
  const { arreter } = ecoute;

  useEffect(() => {
    if (!ouverte) return void arreter();
    let annule = false;
    void listerVoixHeygenAction(personnageId).then((r) => {
      if (annule) return;
      if (!r.ok) return setErreur(r.message);
      setErreur("");
      setEtat(r.donnees);
    });
    return () => {
      annule = true;
    };
  }, [ouverte, personnageId, arreter]);

  function relier(v: VoixHeygenAffichee) {
    setChoixEnCours(v.idExterne);
    demarrer(async () => {
      const r = await relierVoixHeygenAction(personnageId, v.idExterne);
      setChoixEnCours(null);
      if (!r.ok) return void notifier.erreur(r.message);
      if (etat?.simulee) notifier.essai("voix d'essai reliée, rien n'a été envoyé à HeyGen");
      else notifier.succes("Voix reliée", "Vos prochaines vidéos parleront avec elle.");
      onOuverteChange(false);
    });
  }

  return (
    <FeuilleBas ouverte={ouverte} onOuverteChange={onOuverteChange} titre="Relier ma voix HeyGen" description="Les voix de votre compte HeyGen">
      {etat?.simulee && (
        <p className="mb-3 flex items-center gap-2 text-sm text-texte-faible">
          <PastilleEssai /> HeyGen n&apos;est pas encore relié : voix d&apos;essai.
        </p>
      )}
      {erreur ? (
        <EtatVide compact icone="attention" titre="HeyGen ne répond pas" phrase={erreur} />
      ) : !etat ? (
        <div className="grid gap-2" aria-busy="true">
          {[0, 1].map((i) => (
            <div key={i} className="h-16 animate-pulse rounded-carte bg-surface-2" />
          ))}
        </div>
      ) : !etat.voix.length ? (
        <EtatVide compact icone="micro" titre="Aucune voix dans HeyGen" phrase="Créez votre copie de voix dans HeyGen, puis revenez ici." />
      ) : (
        <ul className="grid grid-cols-[minmax(0,1fr)] gap-2">
          {etat.voix.map((v) => {
            const cle = `apercu|${v.idExterne}`;
            return (
              <li key={v.idExterne} className={cn("flex min-h-16 min-w-0 items-center gap-3 rounded-carte border bg-surface-1 p-2 pr-3", v.relieeA ? "border-sauge/40" : "border-trait", !v.utilisable && "opacity-60")}>
                <button
                  type="button"
                  aria-label={`Écouter ${v.nom}`}
                  disabled={!v.apercu}
                  onClick={() => ecoute.jouerAdresse(cle, v.apercu)}
                  className="grid size-11 shrink-0 place-items-center rounded-full bg-orange-doux text-orange-vif disabled:opacity-40"
                >
                  <Icone nom={ecoute.joue === cle ? "volume" : "lecture"} size={17} />
                </button>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-semibold text-texte">{v.nom}</span>
                  <span className="block truncate text-xs text-texte-faible">
                    {langueLisible(v.langue)} · {v.utilisable ? "copie instantanée" : "ne peut pas lire vos textes"}
                  </span>
                </span>
                {v.relieeA ? (
                  <span className="flex items-center gap-1 text-sm font-semibold text-sauge">
                    <Icone nom="coche" size={15} />
                    Reliée
                  </span>
                ) : (
                  <Bouton variante="contour" disabled={!v.utilisable} chargement={choixEnCours === v.idExterne} onClick={() => relier(v)}>
                    Choisir
                  </Bouton>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </FeuilleBas>
  );
}

function FeuilleEnregistrer({
  ouverte,
  onOuverteChange,
  personnageId,
  texteALire,
  minutesDeja,
  langue,
  onDeposer,
}: {
  ouverte: boolean;
  onOuverteChange: (v: boolean) => void;
  personnageId: string;
  texteALire: string;
  minutesDeja: number;
  langue?: Voix["langue"];
  onDeposer: () => void;
}) {
  const [resultat, setResultat] = useState<EnregistrementTermine | null>(null);
  const [cle, setCle] = useState(0);
  const [enCours, demarrer] = useTransition();

  function garder() {
    if (!resultat) return;
    demarrer(async () => {
      const ext = resultat.mime.includes("mp4") ? "m4a" : resultat.mime.includes("ogg") ? "ogg" : "webm";
      const fichier = new File([resultat.blob], `enregistrement-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-")}.${ext}`, { type: resultat.mime });
      const e = await envoyerFichiers([fichier], { typeEntite: "voix", entiteId: personnageId });
      if (!e.ok) return void notifier.erreur(e.message);
      const r = await enregistrerVoixAction(personnageId, { fichiers: [{ fichierId: e.fichierIds[0] }], minutes: resultat.dureeSec / 60, langue });
      if (!r.ok) return void notifier.erreur(r.message);
      if (e.simulation) notifier.essai(`enregistrement ajouté (${minutesLisibles(resultat.dureeSec / 60)}), rien n'a été envoyé`);
      else notifier.succes(`Enregistrement ajouté (${minutesLisibles(resultat.dureeSec / 60)})`);
      setResultat(null);
      setCle((c) => c + 1);
      onOuverteChange(false);
    });
  }

  return (
    <FeuilleBas
      ouverte={ouverte}
      onOuverteChange={(o) => {
        onOuverteChange(o);
        if (!o) {
          setResultat(null);
          setCle((c) => c + 1);
        }
      }}
      titre="Enregistrer la voix"
      pleinEcran
      pied={
        <Bouton taille="lg" pleineLargeur icone="coche" essai chargement={enCours} disabled={!resultat || resultat.dureeSec < 3} onClick={garder}>
          Garder cet enregistrement
        </Bouton>
      }
    >
      {ouverte && <Enregistreur key={cle} texteALire={texteALire} minutesDeja={minutesDeja} minutesConseillees={MINUTES_CONSEILLEES} onTermine={setResultat} onAnnule={onDeposer} />}
    </FeuilleBas>
  );
}

function FeuilleDeposer({ ouverte, onOuverteChange, personnageId, langue }: { ouverte: boolean; onOuverteChange: (v: boolean) => void; personnageId: string; langue?: Voix["langue"] }) {
  const [fichiers, setFichiers] = useState<{ f: File; sec: number }[]>([]);
  const [enCours, demarrer] = useTransition();
  const total = fichiers.reduce((s, x) => s + x.sec, 0) / 60;

  async function ajouter(liste: File[]) {
    const avecDuree = await Promise.all(liste.map(async (f) => ({ f, sec: (await dureeMedia(f)) || 60 })));
    setFichiers((x) => [...x, ...avecDuree].slice(0, 20));
  }

  function envoyer() {
    demarrer(async () => {
      const e = await envoyerFichiers(fichiers.map((x) => x.f), { typeEntite: "voix", entiteId: personnageId });
      if (!e.ok) return void notifier.erreur(e.message);
      const r = await enregistrerVoixAction(personnageId, { fichiers: e.fichierIds.map((fichierId) => ({ fichierId })), minutes: total, langue });
      if (!r.ok) return void notifier.erreur(r.message);
      const libelle = `${fichiers.length > 1 ? "enregistrements ajoutés" : "enregistrement ajouté"} (${minutesLisibles(total)})`;
      if (e.simulation) notifier.essai(`${libelle}, rien n'a été envoyé`);
      else notifier.succes(libelle.charAt(0).toUpperCase() + libelle.slice(1));
      setFichiers([]);
      onOuverteChange(false);
    });
  }

  return (
    <FeuilleBas
      ouverte={ouverte}
      onOuverteChange={onOuverteChange}
      titre="Déposer des enregistrements"
      description="Voix seule, sans musique."
      pied={
        <Bouton taille="lg" pleineLargeur icone="coche" essai chargement={enCours} disabled={!fichiers.length} onClick={envoyer}>
          {fichiers.length ? `Ajouter ${minutesLisibles(total)}` : "Ajouter"}
        </Bouton>
      }
    >
      <div className="grid gap-3">
        <ZoneDepot libelle="Choisir des fichiers audio" detail="MP3, WAV, M4A" accepte="audio/*" icone="micro" onFichiers={(f) => void ajouter(f)} />
        {fichiers.map((x, i) => (
          <div key={`${x.f.name}-${i}`} className="flex min-h-12 items-center gap-3 rounded-champ bg-surface-2 px-3">
            <Icone nom="son" size={18} className="text-orange-vif" />
            <span className="min-w-0 flex-1 truncate text-sm text-texte">{x.f.name}</span>
            <span className="text-xs tabular-nums text-texte-faible">{minutesLisibles(x.sec / 60)}</span>
            <button type="button" aria-label={`Retirer ${x.f.name}`} onClick={() => setFichiers((l) => l.filter((_, j) => j !== i))} className="-mr-2 grid size-11 place-items-center rounded-full text-texte-faible hover:text-texte">
              <Icone nom="fermer" size={16} />
            </button>
          </div>
        ))}
      </div>
    </FeuilleBas>
  );
}

function ReglagesEtEssai({ personnageId, voix }: { personnageId: string; voix: Voix }) {
  const heygen = voix.fournisseur === "heygen";
  const [reglages, setReglages] = useState<ReglagesVoix>(voix.reglages);
  const [langue, setLangue] = useState(voix.langue);
  const [texte, setTexte] = useState(TEXTE_ESSAI);
  const [audio, setAudio] = useState<string | null>(null);
  const [cout, setCout] = useState<{ texte: string; simulee: boolean } | null>(null);
  const [joue, setJoue] = useState(false);
  const [enSauvegarde, sauver] = useTransition();
  const [enEssai, essayer] = useTransition();
  const ref = useRef<HTMLAudioElement>(null);
  const modifie = reglages.vitesse !== voix.reglages.vitesse || reglages.stabilite !== voix.reglages.stabilite || reglages.emotion !== voix.reglages.emotion;

  useEffect(() => {
    if (audio && ref.current) void ref.current.play().catch(() => setJoue(false));
  }, [audio]);

  function enregistrerReglages() {
    sauver(async () => {
      const r = await reglerVoixAction(personnageId, voix.id, reglages);
      if (!r.ok) return void notifier.erreur(r.message);
      notifier.succes("Réglages enregistrés");
    });
  }

  function changerLangue(l: Voix["langue"]) {
    const avant = langue;
    setLangue(l);
    sauver(async () => {
      const r = await changerLangueVoixAction(personnageId, voix.id, l);
      if (!r.ok) {
        setLangue(avant);
        notifier.erreur(r.message);
      }
    });
  }

  function ecouter() {
    essayer(async () => {
      const r = await ecouterEssaiVoixAction(voix.id, texte);
      if (!r.ok) return void notifier.erreur(r.message);
      setAudio(`${r.donnees.url}${r.donnees.url.includes("?") ? "&" : "?"}t=${Date.now()}`);
      setCout({ texte: r.donnees.simulee ? "" : formaterMontant(r.donnees.cout), simulee: r.donnees.simulee });
      if (r.donnees.simulee) notifier.essai("voix de démonstration, aucune voix réelle n'a été créée");
    });
  }

  return (
    <>
      <section className="rounded-carte border border-trait bg-surface-1 p-5">
        <SelecteurPastilles libelle="Langue" options={LANGUES.map((l) => ({ valeur: l.valeur, libelle: l.libelle, detail: l.detail }))} valeur={langue} onChange={changerLangue} />
        <div className="mt-5 grid gap-2">
          {/* HeyGen n'accepte que la vitesse (80 à 115 % : au-delà la voix s'abîme) ; stabilité et émotion = secours ElevenLabs. */}
          <Curseur
            libelle="Vitesse"
            valeur={Math.round(reglages.vitesse * 100)}
            min={heygen ? 80 : 50}
            max={heygen ? 115 : 150}
            pas={5}
            unite=" %"
            onChange={(v) => setReglages((r) => ({ ...r, vitesse: v / 100 }))}
          />
          {!heygen && (
            <>
              <Curseur libelle="Stabilité" valeur={reglages.stabilite} onChange={(v) => setReglages((r) => ({ ...r, stabilite: v }))} />
              <Curseur libelle="Émotion" valeur={reglages.emotion} onChange={(v) => setReglages((r) => ({ ...r, emotion: v }))} />
            </>
          )}
        </div>
        <AnimatePresence>
          {modifie && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
              <div className="mt-3 flex gap-2">
                <Bouton variante="fantome" onClick={() => setReglages(voix.reglages)}>
                  Annuler
                </Bouton>
                <Bouton variante="contour" icone="coche" chargement={enSauvegarde} className="flex-1" onClick={enregistrerReglages}>
                  Enregistrer les réglages
                </Bouton>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </section>

      <section className="rounded-carte border border-trait bg-surface-1 p-5">
        <label htmlFor="texte-essai-voix" className="mb-2 block text-sm font-semibold text-texte-doux">
          Phrase d&apos;essai
        </label>
        {/* Test d'écoute : trois phrases difficiles en un toucher. */}
        <div className="sans-barre -mx-5 mb-2 flex gap-2 overflow-x-auto px-5">
          {PHRASES_TEST.map((p) => (
            <button
              key={p.libelle}
              type="button"
              onClick={() => setTexte(p.texte)}
              className={cn(
                "inline-flex min-h-11 shrink-0 items-center rounded-full border px-3.5 text-sm font-semibold transition-colors",
                texte === p.texte ? "border-orange bg-orange-doux text-orange-vif" : "border-trait bg-surface-2 text-texte-doux",
              )}
            >
              {p.libelle}
            </button>
          ))}
        </div>
        <textarea
          id="texte-essai-voix"
          value={texte}
          onChange={(e) => setTexte(e.target.value)}
          maxLength={300}
          rows={2}
          className="w-full resize-none rounded-champ border border-trait bg-surface-2 p-3 text-[15px] text-texte outline-none focus:border-orange"
        />
        {/* Mobile : l'onde passe sous le bouton. Barres de largeur fixe, coupées si la place manque (jamais hors de la carte). */}
        <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center">
          <Bouton
            variante="secondaire"
            icone={joue ? "son" : "casque"}
            essai={!heygen}
            chargement={enEssai}
            disabled={voix.statut !== "pret" || !texte.trim()}
            onClick={ecouter}
            className="shrink-0 self-start whitespace-nowrap sm:self-auto"
          >
            Écouter un essai
          </Bouton>
          <div className="flex h-8 min-w-0 shrink-0 items-center gap-0.5 overflow-hidden sm:flex-1" aria-hidden>
            {Array.from({ length: 28 }, (_, i) => (
              <span
                key={i}
                className={cn("w-1 shrink-0 rounded-full", joue ? "animate-pulse bg-orange-vif" : "bg-surface-3")}
                style={{ height: `${Math.round(20 + Math.abs(Math.sin(i * 1.7)) * 80)}%`, animationDelay: `${(i % 7) * 90}ms` }}
              />
            ))}
          </div>
        </div>
        {cout && (
          <p className="mt-2 flex items-center gap-2 text-xs text-texte-faible">
            {cout.simulee ? (
              <>
                <PastilleEssai /> son de démonstration
              </>
            ) : (
              <>
                <Icone nom="euro" size={12} />
                {cout.texte} · {voix.nom}
              </>
            )}
          </p>
        )}
        {audio && <audio ref={ref} src={audio} onPlay={() => setJoue(true)} onEnded={() => setJoue(false)} onPause={() => setJoue(false)} className="hidden" />}
      </section>
    </>
  );
}
