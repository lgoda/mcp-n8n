import { z } from "zod";

export const idSchema = z.string().min(1);

export const paginationLimitSchema = z.number().int().min(1).max(250);
