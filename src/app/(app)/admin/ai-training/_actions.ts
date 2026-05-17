"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requirePlatformRole } from "@/lib/auth/session";
import { getActionErrorMessage, rethrowIfRedirectError } from "@/lib/server-action-errors";
import {
  addVerifiedExamplesToDataset,
  createTrainingDataset,
  createTrainingRun,
  updateTrainingDataset,
  updateTrainingExample,
} from "@/server/ai-training";

async function requireAiTrainingAdmin() {
  return requirePlatformRole(["platform_owner", "platform_admin"]);
}

export async function updateTrainingExampleAction(formData: FormData) {
  const exampleId = String(formData.get("exampleId"));
  try {
    const session = await requireAiTrainingAdmin();
    await updateTrainingExample({
      exampleId,
      actorUserId: session.user.id,
      input: {
        notes: formData.get("notes"),
        qualityScore: formData.get("qualityScore"),
        status: formData.get("status") || undefined,
      },
    });
    revalidatePath("/admin/ai-training/examples");
    revalidatePath(`/admin/ai-training/examples/${exampleId}`);
    redirect(`/admin/ai-training/examples/${exampleId}?message=Training example updated.`);
  } catch (error) {
    rethrowIfRedirectError(error);
    redirect(`/admin/ai-training/examples/${exampleId}?message=${encodeURIComponent(getActionErrorMessage(error, "Unable to update training example."))}`);
  }
}

export async function createTrainingDatasetAction(formData: FormData) {
  try {
    const session = await requireAiTrainingAdmin();
    const dataset = await createTrainingDataset({
      actorUserId: session.user.id,
      input: {
        name: formData.get("name"),
        description: formData.get("description"),
        taskType: formData.get("taskType"),
      },
    });
    revalidatePath("/admin/ai-training/datasets");
    redirect(`/admin/ai-training/datasets/${dataset.id}?message=Dataset created.`);
  } catch (error) {
    rethrowIfRedirectError(error);
    redirect(`/admin/ai-training/datasets?message=${encodeURIComponent(getActionErrorMessage(error, "Unable to create dataset."))}`);
  }
}

export async function addVerifiedExamplesAction(formData: FormData) {
  const datasetId = String(formData.get("datasetId"));
  try {
    const session = await requireAiTrainingAdmin();
    await addVerifiedExamplesToDataset({ datasetId, actorUserId: session.user.id });
    revalidatePath(`/admin/ai-training/datasets/${datasetId}`);
    redirect(`/admin/ai-training/datasets/${datasetId}?message=Verified examples added.`);
  } catch (error) {
    rethrowIfRedirectError(error);
    redirect(`/admin/ai-training/datasets/${datasetId}?message=${encodeURIComponent(getActionErrorMessage(error, "Unable to add examples."))}`);
  }
}

export async function updateTrainingDatasetAction(formData: FormData) {
  const datasetId = String(formData.get("datasetId"));
  try {
    const session = await requireAiTrainingAdmin();
    await updateTrainingDataset({
      datasetId,
      actorUserId: session.user.id,
      input: {
        name: formData.get("name") || undefined,
        description: formData.get("description"),
        status: formData.get("status") || undefined,
      },
    });
    revalidatePath(`/admin/ai-training/datasets/${datasetId}`);
    redirect(`/admin/ai-training/datasets/${datasetId}?message=Dataset updated.`);
  } catch (error) {
    rethrowIfRedirectError(error);
    redirect(`/admin/ai-training/datasets/${datasetId}?message=${encodeURIComponent(getActionErrorMessage(error, "Unable to update dataset."))}`);
  }
}

export async function createTrainingRunAction(formData: FormData) {
  try {
    const session = await requireAiTrainingAdmin();
    await createTrainingRun({
      actorUserId: session.user.id,
      input: {
        datasetId: formData.get("datasetId"),
        modelType: formData.get("modelType"),
        baseModel: formData.get("baseModel"),
        outputModelPath: formData.get("outputModelPath"),
        trainingConfigJson: formData.get("trainingConfigJson"),
      },
    });
    revalidatePath("/admin/ai-training/runs");
    redirect("/admin/ai-training/runs?message=Placeholder training run created.");
  } catch (error) {
    rethrowIfRedirectError(error);
    redirect(`/admin/ai-training/runs?message=${encodeURIComponent(getActionErrorMessage(error, "Unable to create training run."))}`);
  }
}
