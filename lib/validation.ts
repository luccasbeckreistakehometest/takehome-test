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
  language: z.enum(["pt-BR", "en"]).default("pt-BR"),
  source: z.enum(["agency", "self"]).default("agency"),
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
});

export const projectSchema = z.object({
  clientId: z.string().min(1),
  title: z.string().trim().min(1, "Título é obrigatório"),
  brief: z.string().trim().default(""),
  skillsNeeded: z.array(z.string()).default([]),
  location: z.string().trim().default(""),
  budget: z.string().trim().default(""),
  deadline: z.string().trim().default(""),
});

export const projectPatchSchema = z.object({
  professionalId: z.string().nullable().optional(),
  status: z
    .enum(["open", "matched", "in_progress", "in_review", "approved", "paid"])
    .optional(),
  escrow: z.enum(["none", "held", "released"]).optional(),
});
