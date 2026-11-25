import "server-only";
import { randomUUID } from "node:crypto";
import { getFactoryDatabasePool } from "../auth/access-repository.ts";
import { deliverToHub } from "./auth.ts";

type Envelope = { event_id: string; aggregate_type: string; hub_order_id: string };
type Claim = { id: string; attempts: number; envelope: Envelope };

export async function flushHubOutbox(send = deliverToHub) {
  let delivered = 0;
  if (process.env.CENTRAL_HUB_EVENT_DELIVERY_ENABLED !== "true") return { delivered };
  const db = getFactoryDatabasePool();
  await db.query(`UPDATE foliar_fertilizer.hub_events SET state='FAILED',lease_token=NULL,lease_until=NULL
    WHERE state='SENDING' AND lease_until<now() AND attempts>=10`);
  for (let index = 0; index < 20; index++) {
    const lease = randomUUID();
    const { rows: [claim] } = await db.query<Claim>(`WITH candidate AS (
      SELECT e.id FROM foliar_fertilizer.hub_events e
      WHERE e.state IN ('PENDING','SENDING') AND e.available_at<=now() AND e.attempts<10
        AND (e.lease_until IS NULL OR e.lease_until<now())
        AND NOT EXISTS (SELECT 1 FROM foliar_fertilizer.hub_events earlier
          WHERE earlier.order_id=e.order_id AND earlier.sequence<e.sequence AND earlier.state<>'DELIVERED')
      ORDER BY e.available_at,e.id FOR UPDATE OF e SKIP LOCKED LIMIT 1
    ) UPDATE foliar_fertilizer.hub_events e SET state='SENDING',attempts=e.attempts+1,lease_token=$1,
      lease_until=now()+interval '60 seconds' FROM candidate WHERE e.id=candidate.id
    RETURNING e.id,e.attempts,e.envelope`, [lease]);
    if (!claim) break;
    let status: number | null = null;
    let ok = false;
    let retry = true;
    try {
      const response = await send(claim.envelope);
      status = response.status;
      retry = status >= 500 || [408, 409, 429].includes(status);
      if (response.ok) {
        const raw = await response.text();
        const data = raw.length <= 32768 ? JSON.parse(raw).data : null;
        ok = data?.eventId === claim.id && ["APPLIED", "IDEMPOTENT_REPLAY"].includes(data.status) &&
          (claim.envelope.aggregate_type !== "FACTORY_ORDER" || data.factoryOrderId === claim.envelope.hub_order_id);
        retry = !ok;
      }
    } catch { retry = true; }
    const state = ok ? "DELIVERED" : retry && claim.attempts < 10 ? "PENDING" : "FAILED";
    const updated = await db.query(`UPDATE foliar_fertilizer.hub_events SET state=$3,last_status=$4,
      lease_token=NULL,lease_until=NULL,available_at=now()+($5 * interval '1 second')
      WHERE id=$1 AND lease_token=$2 AND lease_until>now()`,
    [claim.id, lease, state, status, Math.min(3600, 5 * 2 ** claim.attempts)]);
    if (ok && updated.rowCount === 1) delivered++;
  }
  return { delivered };
}
