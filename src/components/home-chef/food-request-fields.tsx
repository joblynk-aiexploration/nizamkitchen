"use client";

import { useMemo, useState } from "react";
import { CUSTOM_HOME_CHEF_FOOD_VALUE } from "@/lib/home-chef-request-form";
import { SelectInput } from "@/components/ui/select-input";
import { TextArea } from "@/components/ui/text-area";
import { TextInput } from "@/components/ui/text-input";

type RecipeOption = {
  id: string;
  name: string;
};

export function FoodRequestFields({
  recipes,
  defaultRecipeId,
}: {
  recipes: RecipeOption[];
  defaultRecipeId?: string | null;
}) {
  const defaultChoice = defaultRecipeId && recipes.some((recipe) => recipe.id === defaultRecipeId)
    ? defaultRecipeId
    : recipes[0]?.id ?? CUSTOM_HOME_CHEF_FOOD_VALUE;
  const [foodChoice, setFoodChoice] = useState(defaultChoice);
  const [customFoodTitle, setCustomFoodTitle] = useState("");
  const selectedRecipe = useMemo(
    () => recipes.find((recipe) => recipe.id === foodChoice) ?? null,
    [foodChoice, recipes],
  );
  const isCustomFood = foodChoice === CUSTOM_HOME_CHEF_FOOD_VALUE;

  return (
    <div className="space-y-4 md:col-span-2">
      <input type="hidden" name="recipeId" value={selectedRecipe?.id ?? ""} />
      <input type="hidden" name="selectedFoodName" value={selectedRecipe?.name ?? ""} />
      <input type="hidden" name="requestType" value={isCustomFood ? "custom" : "recipe"} />
      <input
        type="hidden"
        name="title"
        value={isCustomFood ? customFoodTitle : selectedRecipe ? `Chef for ${selectedRecipe.name}` : ""}
      />

      <SelectInput
        label="What food do you want the chef to cook?"
        name="foodChoice"
        value={foodChoice}
        onChange={(event) => setFoodChoice(event.target.value)}
        options={[
          ...recipes.map((recipe) => ({ value: recipe.id, label: recipe.name })),
          { value: CUSTOM_HOME_CHEF_FOOD_VALUE, label: "Not here - describe another food" },
        ]}
        hint="Choose from the recipe library, or pick Not here if you want something else."
        required
      />

      {isCustomFood ? (
        <div className="grid gap-4 md:grid-cols-2">
          <TextInput
            label="Food title"
            name="customFoodTitle"
            placeholder="Example: Chicken 65, mandi, or family-style thali"
            value={customFoodTitle}
            onChange={(event) => setCustomFoodTitle(event.target.value)}
            required
          />
          <TextArea
            label="What is this food?"
            name="customFoodDescription"
            placeholder="Describe the dish, cuisine, spice level, dietary needs, or anything the chef should know."
            className="md:col-span-2"
            required
          />
        </div>
      ) : null}
    </div>
  );
}
