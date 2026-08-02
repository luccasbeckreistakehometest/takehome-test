import { z } from "zod";
import { GENERATION_TYPES } from "./types";

export const clientSchema = z.object({
  name: z.string().trim().min(1, "Nome é obrigatório"),
  industry: z.string().trim().default(""),
  description: z.string().trim().default(""),
  audience: z.string().trim().default(""),
  tone: z.string().trim().default(""),
  goals: z.string().trim().default(""),
  budget: z.string().trim().default(""),
  channels: z.array(z.string()).default([]),
  differentials: z.string().trim().default(""),
  competitors: z.string().trim().default(""),
  brandColors: z.string().trim().default(""),
  website: z.string().trim().default(""),
  instagram: z.string().trim().default(""),
  notes: z.string().trim().default(""),
  capabilities: z.string().trim().default(""),
  language: z.enum(["pt-BR", "en"]).default("pt-BR"),
  source: z.enum(["agency", "self"]).default("agency"),
  country: z.string().trim().min(1).default("Brasil"),
  selfServe: z.boolean().default(false),
});

export const generateSchema = z.object({
  clientId: z.string().min(1),
  type: z.enum(GENERATION_TYPES),
  params: z.record(z.string(), z.unknown()).default({}),
});

export const professionalSchema = z.object({
  name: z.string().trim().min(1, "Nome é obrigatório"),
  role: z.enum(["fotografo", "designer"]),
  email: z.string().trim().default(""),
  phone: z.string().trim().default(""),
  location: z.string().trim().min(1, "Localização é obrigatória"),
  skills: z.array(z.string()).default([]),
  specialties: z.string().trim().default(""),
  marketFocus: z.string().trim().default(""),
  bio: z.string().trim().default(""),
  portfolio: z
    .array(z.object({ title: z.string().trim(), url: z.string().trim() }))
    .default([]),
  priceRange: z.string().trim().default(""),
  availability: z.string().trim().default(""),
});

export const projectSchema = z.object({
  clientId: z.string().min(1),
  title: z.string().trim().min(1, "Título é obrigatório"),
  brief: z.string().trim().default(""),
  skillsNeeded: z.array(z.string()).default([]),
  location: z.string().trim().default(""),
  budget: z.string().trim().default(""),
  deadline: z.string().trim().default(""),
  mode: z.enum(["marketplace", "internal"]).default("marketplace"),
});

export const projectPatchSchema = z.object({
  professionalId: z.string().nullable().optional(),
  status: z
    .enum(["open", "matched", "in_progress", "in_review", "client_approval", "approved", "paid"])
    .optional(),
  escrow: z.enum(["none", "held", "released"]).optional(),
  title: z.string().trim().min(1).optional(),
  brief: z.string().trim().optional(),
  budget: z.string().trim().optional(),
  deadline: z.string().trim().optional(),
});
