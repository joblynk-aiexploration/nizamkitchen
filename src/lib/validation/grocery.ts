import { z } from "zod";

export const groceryListCreateSchema = z.object({
  name: z.string().min(1).max(200),
  recipes: z.array(z.object({
    recipeId: z.string().cuid(),
    targetServings: z.number().int().min(1).max(200),
    mealSlot: z.string().max(100).optional(),
  })).min(1).max(50),
  notes: z.string().max(2000).optional(),
  householdSize: z.number().int().min(1).max(100).optional(),
});

export const groceryListUpdateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  status: z.enum(["draft", "active", "completed", "archived"]).optional(),
  notes: z.string().max(2000).nullable().optional(),
  householdSize: z.number().int().min(1).max(100).nullable().optional(),
});

export const groceryItemUpdateSchema = z.object({
  isChecked: z.boolean().optional(),
  notes: z.string().max(500).nullable().optional(),
  displayQuantity: z.number().positive().optional(),
  displayUnit: z.string().max(20).optional(),
});

export type GroceryListCreateInput = z.infer<typeof groceryListCreateSchema>;
export type GroceryListUpdateInput = z.infer<typeof groceryListUpdateSchema>;
export type GroceryItemUpdateInput = z.infer<typeof groceryItemUpdateSchema>;
