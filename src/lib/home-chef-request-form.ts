import { normalizePhoneFromForm } from "@/lib/phone";

export const CUSTOM_HOME_CHEF_FOOD_VALUE = "__custom_home_chef_food__";

function formString(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function nullableFormValue(value: string) {
  return value.length > 0 ? value : null;
}

export function homeChefRequestInputFromForm(formData: FormData) {
  const foodChoice = formString(formData, "foodChoice");
  const customFoodTitle = formString(formData, "customFoodTitle");
  const customFoodDescription = formString(formData, "customFoodDescription");
  const selectedFoodName = formString(formData, "selectedFoodName");
  const isCustomFood = foodChoice === CUSTOM_HOME_CHEF_FOOD_VALUE;
  const selectedRecipeId = !isCustomFood && foodChoice ? foodChoice : formString(formData, "recipeId");
  const manuallyEnteredTitle = formString(formData, "title");
  const baseDescription = formString(formData, "description");
  const customDescriptionParts = [
    customFoodTitle ? `Requested food: ${customFoodTitle}` : null,
    customFoodDescription ? `Food details: ${customFoodDescription}` : null,
    baseDescription || null,
  ].filter(Boolean);

  return {
    requestType: isCustomFood ? "custom" : selectedRecipeId ? "recipe" : formData.get("requestType"),
    title: isCustomFood
      ? customFoodTitle
      : selectedFoodName
        ? `Chef for ${selectedFoodName}`
        : manuallyEnteredTitle,
    description: isCustomFood
      ? customDescriptionParts.join("\n\n")
      : nullableFormValue(baseDescription),
    mealPlanId: formData.get("mealPlanId"),
    recipeId: selectedRecipeId || null,
    requestedDate: formData.get("requestedDate"),
    requestedTimeWindow: formData.get("requestedTimeWindow"),
    guestCount: formData.get("guestCount"),
    householdSize: formData.get("householdSize"),
    serviceAddressLine1: formData.get("serviceAddressLine1"),
    serviceAddressLine2: formData.get("serviceAddressLine2"),
    city: formData.get("city"),
    region: formData.get("region"),
    postalCode: formData.get("postalCode"),
    phone: normalizePhoneFromForm(formData),
    preferredLanguage: formData.get("preferredLanguage"),
    genderPreference: formData.get("genderPreference") || "no_preference",
    budgetAmount: formData.get("budgetAmount"),
    budgetCurrency: formData.get("budgetCurrency"),
    notes: formData.get("notes"),
    submit: formData.get("intent") === "submit",
  };
}
