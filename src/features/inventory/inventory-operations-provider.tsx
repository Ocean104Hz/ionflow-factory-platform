"use client";

import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { inventoryLedger } from "@/src/lib/mock-data/inventory-ledger";
import { ledgerContext } from "./inventory-ledger-data";
import {
  replayLedger,
  type LedgerReplay,
  type StockLedgerEvent,
} from "./inventory-ledger-domain";
import {
  createStockSession,
  type OperationResult,
  type StockCommand,
} from "./inventory-operations-domain";

type InventorySession = {
  events: readonly StockLedgerEvent[];
  inventoryProjection: LedgerReplay;
  commit: (command: StockCommand) => OperationResult;
};
const InventoryOperationsContext = createContext<InventorySession | null>(null);

export function InventoryOperationsProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [session] = useState(() =>
    createStockSession(inventoryLedger, ledgerContext),
  );
  const [events, setEvents] = useState(session.getEvents);
  const inventoryProjection = useMemo(
    () => replayLedger(events, ledgerContext),
    [events],
  );
  return (
    <InventoryOperationsContext.Provider
      value={{
        events,
        inventoryProjection,
        commit(command) {
          const result = session.commit(command);
          if (result.ok) setEvents(result.events);
          return result;
        },
      }}
    >
      {children}
    </InventoryOperationsContext.Provider>
  );
}
export function useInventoryOperations() {
  const value = useContext(InventoryOperationsContext);
  if (!value) throw new Error("InventoryOperationsProvider is required");
  return value;
}
