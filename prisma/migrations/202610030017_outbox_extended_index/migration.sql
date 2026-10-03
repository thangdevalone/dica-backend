CREATE INDEX CONCURRENTLY "outbox_events_status_available_created_at_idx"
ON "outbox_events"("status", "available_at", "created_at");
