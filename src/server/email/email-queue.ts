import type { SendEmailInput } from "./email-types";
import { sendTemplateEmail } from "./email-service";

export async function queueEmail(input: SendEmailInput) {
  // The current implementation sends immediately and records the delivery log.
  // This wrapper keeps call sites stable when a durable queue is added later.
  return sendTemplateEmail(input);
}

export async function queueEmailBatch(inputs: SendEmailInput[]) {
  const results = [];
  for (const input of inputs) {
    results.push(await queueEmail(input));
  }
  return results;
}
