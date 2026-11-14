import { ConnectorError } from "@recallfeed/core";
import type { IConnector, SourceType } from "@recallfeed/core";

/** Maps each source type to the connector that handles it (Spec 03). */
export class ConnectorRegistry {
  private readonly connectors = new Map<SourceType, IConnector>();

  /**
   * Registers a connector under its own `type`, replacing any earlier one for that type.
   *
   * @param connector - The connector to register.
   */
  register(connector: IConnector): void {
    this.connectors.set(connector.type, connector);
  }

  /**
   * Looks up the connector for a source type.
   *
   * @param type - The source type.
   * @returns The registered connector.
   * @throws ConnectorError with code `CONNECTOR_NOT_FOUND` if none is registered.
   */
  get(type: SourceType): IConnector {
    const connector = this.connectors.get(type);
    if (connector === undefined) {
      throw new ConnectorError(`No connector registered for type: ${type}`, "CONNECTOR_NOT_FOUND");
    }
    return connector;
  }
}

/** The process-wide registry. `src/index.ts` registers the built-in connectors on import. */
export const connectorRegistry = new ConnectorRegistry();
