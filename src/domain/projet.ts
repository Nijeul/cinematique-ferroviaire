import { z } from 'zod'
import { COUCHES, ETAT_INITIAL_DEFAUT, FLUX_QUOI, NOMS_VERBES, VERBES } from './etats.ts'

// Schéma Zod du format .cinef (FORMAT.md). Les objets sont stricts : un champ
// inconnu est signalé, car le fichier s'édite à la main jusqu'au lot 12.

const Id = z.string().min(1)
const Point = z.tuple([z.number(), z.number()])

export const MetaSchema = z
  .object({
    chantier: z.string().min(1),
    document: z.string().optional(),
    emetteur: z.string().optional(),
    indice: z.string().optional(),
    date: z.string().optional(),
    etabliPar: z.string().optional(),
    validePar: z.string().optional(),
    approuvePar: z.string().optional(),
  })
  .strict()

export const TempsSchema = z
  .object({
    t0: z.iso.datetime({ local: true }),
    libelleT0: z.string().optional(),
    dureeMinutes: z.number().positive(),
    libelleFin: z.string().optional(),
    pasCreneau: z.number().positive().default(30),
  })
  .strict()

export const OrthophotoSchema = z
  .object({
    image: z.string().min(1),
    ancrages: z
      .array(z.object({ pixel: Point, monde: Point }).strict())
      .length(2, { error: 'deux points d’ancrage sont nécessaires pour caler l’image' }),
  })
  .strict()

export const VoieSchema = z
  .object({
    id: Id,
    nom: z.string().min(1),
    polyligne: z.array(Point).min(2, { error: 'une polyligne demande au moins deux points' }),
    pkOrigine: z.number().optional(),
  })
  .strict()

export const AppareilSchema = z
  .object({
    id: Id,
    nom: z.string().min(1),
    type: z.literal('branchement_simple'),
    tangente: z.number().positive().optional(),
    voieDirecte: Id,
    voiedeviee: Id,
    pkPointe: z.number(),
    orientation: z.enum(['pointe', 'talon']),
    panneaux: z.array(z.string().min(1)).min(1),
  })
  .strict()

export const EtatZoneSchema = z
  .object({
    plateforme: z.enum(COUCHES.plateforme),
    sousCouche: z.enum(COUCHES.sousCouche),
    ballast: z.enum(COUCHES.ballast),
    traverses: z.enum(COUCHES.traverses),
    rails: z.enum(COUCHES.rails),
    geometrie: z.enum(COUCHES.geometrie),
  })
  .strict()

export const ZoneSchema = z
  .object({
    id: Id,
    nom: z.string().min(1),
    voie: Id,
    pkDebut: z.number(),
    pkFin: z.number(),
    longueur: z.number().positive(),
    etatInitial: EtatZoneSchema.default(ETAT_INITIAL_DEFAUT),
  })
  .strict()

export const LieuSchema = z
  .object({
    id: Id,
    nom: z.string().min(1),
    type: z.enum(['base_arriere', 'stockage', 'acces', 'zone_speciale', 'ouvrage']),
    contour: z.array(Point).min(3, { error: 'un contour demande au moins trois points' }),
  })
  .strict()

export const RessourceSchema = z
  .object({
    id: Id,
    numero: z.number().int().positive().optional(),
    nom: z.string().min(1),
    type: z.enum(['pelle_rr', 'train_travaux', 'portique']),
    modeInitial: z.enum(['route', 'rail']).optional(),
    lieuInitial: Id,
    longueur: z.number().positive().optional(),
    capacite: z
      .object({ quoi: z.enum(FLUX_QUOI), valeur: z.number().positive(), unite: z.string().min(1) })
      .strict()
      .optional(),
    couleur: z
      .string()
      .regex(/^[0-9A-Fa-f]{6}$/, { error: 'couleur attendue en hexadécimal sur 6 caractères, sans #' })
      .optional(),
  })
  .strict()

const SensSchema = z.enum(['pk_croissant', 'pk_decroissant'])

export const EffetSchema = z
  .object({
    verbe: z.enum(NOMS_VERBES),
    vers: z.string().optional(),
    objet: z.string().optional(),
    decoupage: z.array(z.string().min(1)).min(1).optional(),
    voie: Id.optional(),
    pkArrivee: z.number().optional(),
    sens: SensSchema.optional(),
  })
  .strict()
  .superRefine((effet, ctx) => {
    const admis = VERBES[effet.verbe].vers
    if (effet.vers !== undefined) {
      if (admis.length === 0) {
        ctx.addIssue({
          code: 'custom',
          message: `le verbe « ${effet.verbe} » n'accepte pas de champ « vers »`,
          path: ['vers'],
        })
      } else if (!admis.includes(effet.vers)) {
        ctx.addIssue({
          code: 'custom',
          message: `« ${effet.vers} » n'est pas une valeur admise pour « ${effet.verbe} » (valeurs possibles : ${admis.join(', ')})`,
          path: ['vers'],
        })
      }
    }
  })

export const FluxSchema = z
  .object({
    quoi: z.enum(FLUX_QUOI),
    ref: z.string().optional(),
    de: Id,
    vers: Id,
    quantite: z.number().positive().optional(),
    porteur: Id.optional(),
  })
  .strict()

export const OperationSchema = z
  .object({
    id: Id,
    numero: z.number().int().positive(),
    libelle: z.string().min(1),
    tDebut: z.number().min(0),
    tFin: z.number().min(0),
    ressources: z.array(Id).default([]),
    cibles: z.array(Id).default([]),
    effets: z.array(EffetSchema).min(1, { error: 'une opération doit avoir au moins un effet' }),
    sens: SensSchema.optional(),
    flux: z.array(FluxSchema).default([]),
    optionnelle: z.boolean().optional(),
    commentaire: z.string().optional(),
  })
  .strict()
  .superRefine((op, ctx) => {
    if (op.tFin <= op.tDebut) {
      ctx.addIssue({
        code: 'custom',
        message: `tFin (${op.tFin}) doit être strictement après tDebut (${op.tDebut})`,
        path: ['tFin'],
      })
    }
  })

export const VueSchema = z
  .object({
    id: Id,
    type: z.enum(['orthographique_inclinee', 'cadree', 'suivi']),
    cible: z.string().optional(),
    angle: z.number().optional(),
    zone: z.tuple([z.number(), z.number(), z.number(), z.number()]).optional(),
    ressource: Id.optional(),
    recul: z.number().positive().optional(),
  })
  .strict()

export const AffichageSchema = z
  .object({
    palette: z.record(z.string(), z.string()).optional(),
    legende: z.boolean().optional(),
  })
  .strict()

export const SiteSchema = z
  .object({
    orthophoto: OrthophotoSchema.optional(),
    voies: z.array(VoieSchema).min(1, { error: 'le site doit compter au moins une voie' }),
    appareils: z.array(AppareilSchema).default([]),
    zones: z.array(ZoneSchema).default([]),
    lieux: z.array(LieuSchema).default([]),
  })
  .strict()

export const ProjetSchema = z
  .object({
    meta: MetaSchema,
    temps: TempsSchema,
    site: SiteSchema,
    ressources: z.array(RessourceSchema).default([]),
    stocks: z
      .record(Id, z.array(z.object({ quoi: z.enum(FLUX_QUOI), quantite: z.number().min(0) }).strict()))
      .default({}),
    operations: z.array(OperationSchema).default([]),
    vues: z.array(VueSchema).default([]),
    affichage: AffichageSchema.optional(),
  })
  .strict()

export type Meta = z.infer<typeof MetaSchema>
export type Temps = z.infer<typeof TempsSchema>
export type Voie = z.infer<typeof VoieSchema>
export type Appareil = z.infer<typeof AppareilSchema>
export type Zone = z.infer<typeof ZoneSchema>
export type Lieu = z.infer<typeof LieuSchema>
export type Ressource = z.infer<typeof RessourceSchema>
export type Effet = z.infer<typeof EffetSchema>
export type Flux = z.infer<typeof FluxSchema>
export type Operation = z.infer<typeof OperationSchema>
export type Vue = z.infer<typeof VueSchema>
export type Site = z.infer<typeof SiteSchema>
export type Projet = z.infer<typeof ProjetSchema>
