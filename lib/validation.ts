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
});

export const generateSchema = z.object({
  clientId: z.string().min(1),
  type: z.enum(GENERATION_TYPES),
  params: z.record(z.string(), z.unknown()).default({}),
});
