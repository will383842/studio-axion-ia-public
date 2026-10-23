"use client";

import { AnimatePresence, motion } from "motion/react";
import Image from "next/image";
import { useState, useTransition } from "react";
import {
  ajouterVisageAction,
  choisirVisageParDefautAction,
  choisirVisagePourFormatAction,
  preparerVisageAction,
  retirerDoubleHeygenAction,
  testerVisageAction,
} from "@/app/(studio)/personnages/actions";
import { ChoixDoubleHeygen } from "./ChoixDoubleHeygen";
import {
  BarreActionCollee,
  Bouton,
  Champ,
  EnTeteSection,
  EtatVide,
  FeuilleBas,
  Icone,
  LecteurVideo,
  notifier,
  Pastille,
  PastilleEtat,
  SelecteurPastilles,
  ZoneDepot,
  type NomIcone,
} from "@/components/ui";
import { visageParDefaut } from "@/domaine/distribution";
import type { AngleVisage } from "@/domaine/types";
import { listerFormatsActifs } from "@/formats";
import { cn } from "@/lib/cn";
import type { VueFichePersonnage } from "@/services/B-personnages-bibliotheque";
import { AnneauQualite } from "./AnneauQualite";
import { BlocageAccord } from "./BlocageAccord";
import { GuideTournage } from "./GuideTournage";
import { envoyerFichiers } from "@/lib/envoi-multipart";
import { tailleLisible } from "./outils";

type VueVisage = VueFichePersonnage["visages"][number];

const ANGLES: { valeur: AngleVisage; libelle: string; icone: NomIcone }[] = [
  { valeur: "face", libelle: "Face", icone: "visage" },
  { valeur: "trois-quarts", libelle: "Trois quarts", icone: "personne" },
  { valeur: "profil", libelle: "Profil", icone: "personne" },
];
const LIBELLE_ANGLE = Object.fromEntries(ANGLES.map((a) => [a.valeur, a.libelle])) as Record<AngleVisage, string>;

const TENUES = ["Chemise noire", "Veste sombre", "Pull clair", "T-shirt"];
const DECORS = ["Fond noir", "Bureau", "Studio", "Extérieur"];

/** Onglet VISAGES de la fiche personnage. */
export function OngletVisages({ fiche, verrouille, onOuvrirAccord }: { fiche: VueFichePersonnage; verrouille: boolean; onOuvrirAccord: () => void }) {
  const [ajout, setAjout] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const visages = fiche.visages;
  const prets = visages.filter((v) => v.statut === "pret");
  const notes = prets.map((v) => v.qualite?.note).filter((n): n is number => typeof n === "number");
  const moyenne = notes.length ? Math.round(notes.reduce((a, b) => a + b, 0) / notes.length) : null;
  const detail = visages.find((v) => v.id === detailId) ?? null;
  // Correcteur 4 : le visage habituel (celui que prend une vidéo quand son format n'a pas d'avatar à lui).
  const habituel = visageParDefaut(visages, fiche.personnage.visageParDefautId);
  // Un personnage inventé n'est pas filmé : son visage et sa voix se créent (E2E-1 n° 18).
  const invente = fiche.personnage.nature === "invente";

  return (
    <div className="space-y-6">
      {verrouille && <BlocageAccord nom={fiche.personnage.nom} onOuvrirAccord={onOuvrirAccord} />}

      {visages.length > 0 && (
        <div className="flex items-center gap-4 rounded-carte border border-trait bg-surface-1 p-4">
          {moyenne !== null ? <AnneauQualite note={moyenne} taille={64} /> : <span className="grid size-16 place-items-center rounded-full bg-surface-2 text-texte-faible"><Icone nom="sablier" size={22} /></span>}
          <div className="min-w-0 flex-1">
            <p className="font-titre text-2xl tabular-nums text-texte">
              {prets.length}
              <span className="text-texte-faible">/{visages.length}</span>
            </p>
            <p className="text-sm text-texte-doux">{prets.length > 1 ? "visages prêts" : "visage prêt"}</p>
          </div>
          <div className="flex flex-col items-end gap-1.5">
            {ANGLES.map((a) => {
              const ok = prets.some((v) => v.angle === a.valeur);
              return (
                <Pastille key={a.valeur} ton={ok ? "sauge" : "neutre"} icone={ok ? "coche" : undefined}>
                  {a.libelle}
                </Pastille>
              );
            })}
          </div>
        </div>
      )}

      {visages.length ? (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {visages.map((v, i) => (
            <motion.li key={v.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
              <CarteVisage visage={v} habituel={v.id === habituel?.id} onOuvrir={() => setDetailId(v.id)} />
            </motion.li>
          ))}
        </ul>
      ) : (
        <EtatVide compact icone="visage" titre="Aucun visage" phrase={invente ? "Son visage se crée, rien à filmer." : "Votre double se crée dans l'application HeyGen, puis se relie ici."} />
      )}

      {habituel && (
        <VisageParFormat
          key={JSON.stringify(fiche.personnage.visageParFormat ?? {})}
          personnageId={fiche.personnage.id}
          visages={prets}
          parFormat={fiche.personnage.visageParFormat ?? {}}
          habituel={habituel}
        />
      )}

      {/* Lot R7 : le double est créé et essayé dans l'application HeyGen, puis choisi ici. */}
      {!invente && (
        <section className="grid gap-3">
          <EnTeteSection titre="Votre double HeyGen" />
          <p className="text-sm text-texte-doux">Créez votre avatar dans l&apos;application HeyGen, puis reliez-le ici : un pour l&apos;angle principal (trois quarts) et, si vous voulez, un second presque de face. Il parle avec votre voix HeyGen : dans le studio quand c&apos;est allumé (Réglages, Connexions, Double), sinon dans l&apos;application HeyGen, et la vidéo se rattache à sa version (Sujets, « Ma vidéo HeyGen »).</p>
          <ChoixDoubleHeygen personnageId={fiche.personnage.id} verrouille={verrouille} />
        </section>
      )}

      <section>
        <EnTeteSection titre={invente ? "Créer ce personnage" : "Bien filmer"} />
        <GuideTournage variante={invente ? "invente" : "avocat"} />
      </section>

      <BarreActionCollee>
        {verrouille ? (
          <Bouton taille="lg" icone="bouclier" onClick={onOuvrirAccord}>
            Enregistrer l&apos;accord
          </Bouton>
        ) : (
          <Bouton taille="lg" icone="plus" onClick={() => setAjout(true)}>
            Ajouter un visage
          </Bouton>
        )}
      </BarreActionCollee>

      <FeuilleAjoutVisage personnageId={fiche.personnage.id} ouverte={ajout} onOuverteChange={setAjout} />
      <FeuilleDetailVisage personnageId={fiche.personnage.id} visage={detail} habituel={!!detail && detail.id === habituel?.id} verrouille={verrouille} onFermer={() => setDetailId(null)} />
    </div>
  );
}

function CarteVisage({ visage: v, habituel, onOuvrir }: { visage: VueVisage; habituel: boolean; onOuvrir: () => void }) {
  return (
    <button
      type="button"
      onClick={onOuvrir}
      className="group relative block w-full overflow-hidden rounded-carte border border-trait bg-surface-1 text-left transition-[border-color,transform] duration-200 hover:-translate-y-0.5 hover:border-trait-fort"
    >
      <div className="relative aspect-[4/5] bg-surface-2">
        {v.vignette ? (
          <Image src={v.vignette} alt="" fill sizes="(max-width: 640px) 50vw, 260px" className={cn("object-cover transition-transform duration-500 group-hover:scale-[1.04]", v.statut !== "pret" && "opacity-50 grayscale")} />
        ) : (
          <div className="absolute inset-0 grid place-items-center lueur">
            <Icone nom="visage" size={32} className="text-texte-faible" />
          </div>
        )}
        <div className="absolute inset-x-0 bottom-0 h-1/2 bg-linear-to-t from-fond/90 to-transparent" />
        <span className="absolute left-2 top-2">
          <PastilleEtat type="preparation" statut={v.statut} />
        </span>
        {habituel && (
          <span className="absolute right-2 top-2 grid size-7 place-items-center rounded-full bg-orange text-sur-orange shadow-orange" title="Visage par défaut">
            <Icone nom="etoile" size={14} />
          </span>
        )}
        {v.qualite && v.statut === "pret" && <AnneauQualite note={v.qualite.note} taille={40} className="absolute bottom-2 right-2 rounded-full bg-fond/70" />}
        <span className="absolute bottom-2 left-2 flex gap-1">
          <Pastille ton="neutre">{LIBELLE_ANGLE[v.angle]}</Pastille>
          {/* Lot B1 : un look fabriqué dans un décor (gestes non appris), à vérifier sur capture. */}
          {v.origine === "genere" && <Pastille ton="ambre">Généré</Pastille>}
        </span>
      </div>
      <div className="p-3">
        <p className="truncate text-sm font-semibold text-texte">{v.nom}</p>
        <p className="truncate text-xs text-texte-faible">{[v.tenue, v.fondTournage].filter(Boolean).join(" · ")}</p>
      </div>
    </button>
  );
}

function FeuilleAjoutVisage({ personnageId, ouverte, onOuverteChange }: { personnageId: string; ouverte: boolean; onOuverteChange: (v: boolean) => void }) {
  const [angle, setAngle] = useState<AngleVisage>("face");
  const [tenue, setTenue] = useState("");
  const [decor, setDecor] = useState("");
  const [fichiers, setFichiers] = useState<File[]>([]);
  const [enCours, demarrer] = useTransition();

  function creer() {
    if (!fichiers.length) return void notifier.erreur("Déposez au moins une vidéo.");
    demarrer(async () => {
      const e = await envoyerFichiers(fichiers, { typeEntite: "visage", entiteId: personnageId });
      if (!e.ok) return void notifier.erreur(e.message);
      const r = await ajouterVisageAction(personnageId, { nom: "", angle, tenue, decor, fichiers: e.fichierIds.map((fichierId) => ({ fichierId })) });
      if (!r.ok) return void notifier.erreur(r.message);
      if (e.simulation) notifier.essai("le double est préparé, rien n'a été envoyé");
      else notifier.succes("Vidéos envoyées");
      setFichiers([]);
      setTenue("");
      setDecor("");
      onOuverteChange(false);
    });
  }

  return (
    <FeuilleBas
      ouverte={ouverte}
      onOuverteChange={onOuverteChange}
      titre="Nouveau visage"
      description="Un angle, une tenue, un décor."
      pied={
        <Bouton taille="lg" pleineLargeur icone="baguette" essai chargement={enCours} disabled={!fichiers.length} onClick={creer}>
          Créer le double
        </Bouton>
      }
    >
      <div className="grid gap-5">
        <SelecteurPastilles libelle="Angle" options={ANGLES.map((a) => ({ valeur: a.valeur, libelle: a.libelle, icone: a.icone }))} valeur={angle} onChange={setAngle} />
        <div>
          <Champ libelle="Tenue" value={tenue} onChange={(e) => setTenue(e.target.value)} placeholder="Chemise noire" maxLength={60} />
          <Suggestions valeurs={TENUES} onChoisir={setTenue} actif={tenue} />
        </div>
        <div>
          <Champ libelle="Décor" value={decor} onChange={(e) => setDecor(e.target.value)} placeholder="Fond noir" maxLength={60} />
          <Suggestions valeurs={DECORS} onChoisir={setDecor} actif={decor} />
        </div>
        <ZoneDepot libelle="Déposer mes vidéos" detail="2 min, face à la lumière" accepte="video/*" icone="camera" onFichiers={(f) => setFichiers((x) => [...x, ...f].slice(0, 10))} />
        <AnimatePresence initial={false}>
          {fichiers.map((f, i) => (
            <motion.div key={`${f.name}-${i}`} initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="-mt-3 flex min-h-12 items-center gap-3 rounded-champ bg-surface-2 px-3">
              <Icone nom="film" size={18} className="text-orange-vif" />
              <span className="min-w-0 flex-1 truncate text-sm text-texte">{f.name}</span>
              <span className="text-xs text-texte-faible">{tailleLisible(f.size)}</span>
              <button type="button" aria-label={`Retirer ${f.name}`} onClick={() => setFichiers((x) => x.filter((_, j) => j !== i))} className="-mr-2 grid size-11 place-items-center rounded-full text-texte-faible hover:text-texte">
                <Icone nom="fermer" size={16} />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </FeuilleBas>
  );
}

function Suggestions({ valeurs, onChoisir, actif }: { valeurs: string[]; onChoisir: (v: string) => void; actif: string }) {
  return (
    <div className="sans-barre -mx-5 mt-2 flex gap-2 overflow-x-auto px-5">
      {valeurs.map((v) => (
        <button
          key={v}
          type="button"
          onClick={() => onChoisir(v)}
          className={cn("min-h-11 shrink-0 rounded-full border px-3 text-sm font-semibold transition-colors", actif === v ? "border-orange bg-orange-doux text-orange-vif" : "border-trait text-texte-doux hover:text-texte")}
        >
          {v}
        </button>
      ))}
    </div>
  );
}

function FeuilleDetailVisage({ personnageId, visage, habituel, verrouille, onFermer }: { personnageId: string; visage: VueVisage | null; habituel: boolean; verrouille: boolean; onFermer: () => void }) {
  const [texte, setTexte] = useState("Bonjour, je suis votre double. On commence ?");
  const [essaiUrl, setEssaiUrl] = useState<string | null>(null);
  const [enTest, demarrerTest] = useTransition();
  const [enPreparation, demarrerPreparation] = useTransition();
  // Garde le dernier visage affiché pendant l'animation de fermeture.
  const [dernier, setDernier] = useState(visage);
  if (visage && visage !== dernier) setDernier(visage);
  const v = visage ?? dernier;

  function tester() {
    if (!v) return;
    demarrerTest(async () => {
      const r = await testerVisageAction(v.id, texte);
      if (!r.ok) return void notifier.erreur(r.message);
      setEssaiUrl(r.donnees.url);
      notifier.essai("vidéo de démonstration, aucun double réel n'a parlé");
    });
  }

  function preparer() {
    if (!v) return;
    demarrerPreparation(async () => {
      const r = await preparerVisageAction(personnageId, v.id);
      if (!r.ok) return void notifier.erreur(r.message);
      notifier.essai("le double est préparé, rien n'a été envoyé");
    });
  }

  const pret = v?.statut === "pret";
  // Lot R7 : un double choisi dans HeyGen s'essaie dans HeyGen ; ici, on peut seulement ne plus l'utiliser.
  const heygen = v?.fournisseur === "heygen";

  // Correcteur 4 : « Visage par défaut » (gardé affiché pendant l'envoi, annulé si le serveur refuse).
  const [parDefaut, setParDefaut] = useState<string | null>(null);
  const estHabituel = habituel || (!!v && parDefaut === v.id);
  function choisirParDefaut() {
    if (!v) return;
    setParDefaut(v.id);
    demarrerPreparation(async () => {
      const r = await choisirVisageParDefautAction(personnageId, v.id);
      if (!r.ok) {
        setParDefaut(null);
        return void notifier.erreur(r.message);
      }
      notifier.succes("Visage par défaut", v.nom);
    });
  }

  function retirer() {
    if (!v) return;
    demarrerPreparation(async () => {
      const r = await retirerDoubleHeygenAction(personnageId, v.id);
      if (!r.ok) return void notifier.erreur(r.message);
      notifier.succes("Ce double n'est plus utilisé", "Il reste dans votre compte HeyGen.");
      onFermer();
    });
  }
  return (
    <FeuilleBas
      ouverte={!!visage}
      onOuverteChange={(o) => {
        if (!o) {
          onFermer();
          setEssaiUrl(null);
        }
      }}
      titre={v?.nom ?? "Visage"}
      pied={
        v &&
        (heygen ? (
          pret && (
            <Bouton taille="lg" pleineLargeur variante="secondaire" icone="fermer" chargement={enPreparation} onClick={retirer}>
              Ne plus utiliser ce double
            </Bouton>
          )
        ) : pret ? (
          <Bouton taille="lg" pleineLargeur icone="lecture" essai chargement={enTest} onClick={tester}>
            Tester mon double
          </Bouton>
        ) : (
          <Bouton taille="lg" pleineLargeur icone="baguette" essai chargement={enPreparation} disabled={verrouille || v.statut === "en_preparation"} onClick={preparer}>
            {v.statut === "echec" ? "Refaire le double" : "Préparer le double"}
          </Bouton>
        ))
      }
    >
      {v && (
        <div className="grid gap-5">
          <AnimatePresence mode="wait">
            {essaiUrl ? (
              <motion.div key="essai" initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }}>
                <LecteurVideo src={essaiUrl} titre={`Essai de ${v.nom}`} ratio="9:16" autoLecture className="h-[46dvh]" />
              </motion.div>
            ) : (
              <motion.div key="photo" className="relative mx-auto aspect-[4/5] w-full max-w-60 overflow-hidden rounded-carte bg-surface-2">
                {v.vignette && <Image src={v.vignette} alt="" fill sizes="240px" className="object-cover" />}
                <span className="absolute left-2 top-2">
                  <PastilleEtat type="preparation" statut={v.statut} />
                </span>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="flex flex-wrap justify-center gap-1.5">
            <Pastille ton="neutre" icone="visage" taille="md">
              {LIBELLE_ANGLE[v.angle]}
            </Pastille>
            {v.tenue && <Pastille taille="md">{v.tenue}</Pastille>}
            {v.fondTournage && <Pastille taille="md">{v.fondTournage}</Pastille>}
            {v.origine === "genere" && (
              <Pastille taille="md" ton="ambre">
                Généré dans le décor
              </Pastille>
            )}
          </div>

          {pret &&
            (estHabituel ? (
              <p className="flex min-h-11 items-center justify-center gap-2 text-sm font-semibold text-orange-vif">
                <Icone nom="etoile" size={16} />
                Visage par défaut
              </p>
            ) : (
              <Bouton variante="contour" icone="etoile" className="mx-auto" disabled={verrouille || enPreparation} onClick={choisirParDefaut}>
                Visage par défaut
              </Bouton>
            ))}

          {v.qualite ? (
            <div className="rounded-carte border border-trait bg-surface-2 p-4">
              <div className="flex items-center gap-4">
                <AnneauQualite note={v.qualite.note} taille={72} />
                <div>
                  <p className="font-semibold text-texte">Qualité du double</p>
                  <p className="text-sm text-texte-faible">sur 100</p>
                </div>
              </div>
              {v.qualite.conseils.length > 0 && (
                <ul className="mt-4 grid gap-2">
                  {v.qualite.conseils.map((c) => (
                    <li key={c} className="flex items-start gap-2.5 text-sm text-texte-doux">
                      <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-orange-doux text-orange-vif">
                        <Icone nom="idee" size={13} />
                      </span>
                      {c}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : (
            <p className="text-center text-sm text-texte-faible">{verrouille ? "Accord nécessaire avant la préparation." : "La note arrive après la préparation."}</p>
          )}

          {heygen && <p className="text-center text-sm text-texte-faible">Double créé dans HeyGen : essayez-le dans l&apos;application HeyGen.</p>}

          {pret && !heygen && <Champ libelle="Phrase d'essai" value={texte} onChange={(e) => setTexte(e.target.value)} maxLength={200} />}
        </div>
      )}
    </FeuilleBas>
  );
}

/**
 * Correcteur 4 — AVATAR PAR FORMAT (copie de « Par format » de l'onglet Voix) : « Vidéo type avocat → avatar en
 * costume ». Deux touches : le format, puis le visage. Repris d'office à la création d'une vidéo de ce format,
 * modifiable ensuite vidéo par vidéo (bloc Plateau). Le second angle suit : même tenue, même avatar.
 */
function VisageParFormat({ personnageId, visages, parFormat, habituel }: { personnageId: string; visages: VueVisage[]; parFormat: Record<string, string>; habituel: VueVisage }) {
  const formats = listerFormatsActifs().filter((f) => f.personnages.max > 0);
  const [choix, setChoix] = useState(parFormat);
  const [ouvert, setOuvert] = useState<string | null>(null);
  const [enCours, demarrer] = useTransition();
  if (!formats.length || visages.length < 2) return null;
  const format = formats.find((f) => f.id === ouvert);

  function choisir(formatId: string, visageId: string | null) {
    const avant = choix;
    const suite = { ...choix };
    if (visageId) suite[formatId] = visageId;
    else delete suite[formatId];
    setChoix(suite);
    setOuvert(null);
    demarrer(async () => {
      const r = await choisirVisagePourFormatAction(personnageId, formatId, visageId);
      if (!r.ok) {
        setChoix(avant);
        notifier.erreur(r.message);
        return;
      }
      notifier.succes(visageId ? `${visages.find((v) => v.id === visageId)?.nom ?? "Visage"} pour ${formats.find((f) => f.id === formatId)?.nom ?? "ce format"}` : "Visage habituel repris");
    });
  }

  return (
    <section aria-labelledby="visage-par-format" className="rounded-carte border border-trait bg-surface-1 p-4">
      <h3 id="visage-par-format" className="mb-1 text-sm font-semibold text-texte-doux">
        Par format
      </h3>
      <ul className="-mx-2">
        {formats.map((f) => {
          const v = visages.find((x) => x.id === choix[f.id]);
          const montre = v ?? habituel;
          return (
            <li key={f.id}>
              <button type="button" onClick={() => setOuvert(f.id)} disabled={enCours} className="flex min-h-14 w-full items-center gap-3 rounded-2xl px-2 text-left transition-colors hover:bg-surface-2">
                <Vignette visage={montre} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-semibold text-texte">{f.nom}</span>
                  <span className={cn("block truncate text-sm", v ? "text-texte" : "text-texte-faible")}>{v ? v.nom : `Habituel · ${habituel.nom}`}</span>
                </span>
                <Icone nom="chevron-droite" size={18} className="shrink-0 text-texte-faible" />
              </button>
            </li>
          );
        })}
      </ul>
      <FeuilleBas ouverte={!!format} onOuverteChange={(o) => !o && setOuvert(null)} titre={format?.nom ?? ""} description="Choisi d'office pour ce format.">
        {format && (
          <ul role="radiogroup" aria-label={`Visage pour ${format.nom}`} className="grid grid-cols-2 gap-3 pb-2 sm:grid-cols-3">
            {[{ id: null as string | null, visage: habituel, nom: "Habituel", detail: habituel.nom }, ...visages.map((v) => ({ id: v.id as string | null, visage: v, nom: v.nom, detail: [LIBELLE_ANGLE[v.angle], v.tenue].filter(Boolean).join(" · ") }))].map((o) => {
              const actif = (choix[format.id] ?? null) === o.id;
              return (
                <li key={o.id ?? "habituel"}>
                  <button
                    type="button"
                    role="radio"
                    aria-checked={actif}
                    onClick={() => choisir(format.id, o.id)}
                    className={cn("group relative block w-full overflow-hidden rounded-carte border text-left transition-[border-color,box-shadow]", actif ? "border-orange shadow-orange" : "border-trait hover:border-trait-fort")}
                  >
                    <span className="relative block aspect-[4/5] bg-surface-2">
                      {o.visage.vignette ? (
                        <Image src={o.visage.vignette} alt="" fill sizes="(max-width: 640px) 50vw, 200px" className={cn("object-cover transition-transform duration-500 group-hover:scale-[1.04]", o.id === null && "opacity-60")} />
                      ) : (
                        <span className="absolute inset-0 grid place-items-center lueur">
                          <Icone nom="visage" size={28} className="text-texte-faible" />
                        </span>
                      )}
                      <span className="absolute inset-x-0 bottom-0 h-1/2 bg-linear-to-t from-fond/90 to-transparent" />
                      {actif && (
                        <span className="absolute right-2 top-2 grid size-7 place-items-center rounded-full bg-orange text-sur-orange">
                          <Icone nom="coche" size={15} />
                        </span>
                      )}
                    </span>
                    <span className="block p-2.5">
                      <span className="block truncate text-sm font-semibold text-texte">{o.nom}</span>
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

/** Petite vignette ronde d'un visage (ligne « Par format »). */
function Vignette({ visage }: { visage: VueVisage }) {
  return (
    <span className="relative size-10 shrink-0 overflow-hidden rounded-xl bg-surface-2">
      {visage.vignette ? <Image src={visage.vignette} alt="" fill sizes="40px" className="object-cover" /> : <Icone nom="visage" size={18} className="absolute inset-0 m-auto text-orange-vif" />}
    </span>
  );
}
