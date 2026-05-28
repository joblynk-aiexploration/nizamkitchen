# Event-Driven Readiness

NizamKitchen already emits operational records through audit logs, notifications, email logs, payment/webhook records, and system alerts. These are useful but are not yet a formal event bus.

## Recommended Domain Events

- `user.registered`
- `user.oauth_linked`
- `home_chef_request.submitted`
- `home_chef_request.assigned`
- `home_chef_request.status_changed`
- `food_order.submitted`
- `food_order.status_changed`
- `payment.checkout_started`
- `payment.succeeded`
- `payment.failed`
- `refund.requested`
- `refund.processed`
- `invoice.issued`
- `verification.status_changed`
- `support.ticket_created`
- `support.reply_created`
- `email.delivery_failed`
- `storage.configuration_failed`

## Outbox Recommendation

Before high-volume production use, add an `EventOutbox` table with:

- event id
- aggregate type/id
- event type
- payload JSON
- idempotency key
- status
- attempts
- next retry time
- created/processed timestamps

The outbox should be written in the same transaction as the domain change. A worker can later deliver events to email, notifications, webhooks, analytics, or external queues.

## Idempotency Rules

- Payment webhooks must dedupe by provider event id.
- Email sends should dedupe by template, recipient, entity id, and event type.
- Refunds must dedupe by payment order and provider refund id.
- Storage maintenance jobs must be safe to rerun.
- Marketplace status transitions must reject invalid duplicate transitions.

## Future Infrastructure

Kafka, Temporal, or a managed queue can be introduced later. They should not replace the transactional outbox; they should consume from it.

