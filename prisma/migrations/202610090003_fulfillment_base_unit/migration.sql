-- Fulfillment quantities and prices use base units. Request snapshots keep the
-- original requested unit; only correct the copied unit on fulfillment lines.
UPDATE "fulfillment_lines" AS line
SET "unit_code_snapshot" = unit."code", "version" = line."version" + 1
FROM "ingredients" AS ingredient, "units" AS unit
WHERE line."ingredient_id" = ingredient."id"
  AND ingredient."base_unit_id" = unit."id"
  AND line."request_line_id" IS NOT NULL
  AND line."unit_code_snapshot" <> unit."code";
