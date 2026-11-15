import { ConnectorError } from "@recallfeed/core";
import type { ConnectorValidationResult, IConnector } from "@recallfeed/core";
import { describe, expect, it } from "vitest";
import { ConnectorRegistry, MarkdownConnector, connectorRegistry } from "../index";

const stub = (type: IConnector["type"]): IConnector => ({
  type,
  validate: (): Promise<ConnectorValidationResult> => Promise.resolve({ valid: true, description: "stub" }),
  import: () => Promise.resolve([]),
});

describe("connectorRegistry (as exported by the package)", () => {
  it("has the Markdown connector registered on import", () => {
    const connector = connectorRegistry.get("markdown");

    expect(connector).toBeInstanceOf(MarkdownConnector);
    expect(connector.type).toBe("markdown");
  });

  it("throws CONNECTOR_NOT_FOUND for Notion, which is deferred to Gate 4", () => {
    try {
      connectorRegistry.get("notion");
      expect.unreachable("expected get() to throw");
    } catch (error) {
      expect(error).toBeInstanceOf(ConnectorError);
      expect((error as ConnectorError).code).toBe("CONNECTOR_NOT_FOUND");
      expect((error as ConnectorError).message).toContain("notion");
    }
  });

  it("the Markdown connector validates without any external dependency", async () => {
    const result = await connectorRegistry.get("markdown").validate({}, {});

    expect(result).toEqual({ valid: true, description: "Markdown connector ready" });
  });
});

describe("ConnectorRegistry", () => {
  it("starts empty and registers by the connector's own type", () => {
    const registry = new ConnectorRegistry();
    expect(() => registry.get("markdown")).toThrow(ConnectorError);

    const connector = stub("markdown");
    registry.register(connector);

    expect(registry.get("markdown")).toBe(connector);
  });

  it("registering a type again replaces the earlier connector", () => {
    const registry = new ConnectorRegistry();
    registry.register(stub("notion"));
    const replacement = stub("notion");
    registry.register(replacement);

    expect(registry.get("notion")).toBe(replacement);
  });

  it("instances are independent of the shared registry", () => {
    const registry = new ConnectorRegistry();

    expect(() => registry.get("markdown")).toThrow(ConnectorError);
    expect(connectorRegistry.get("markdown")).toBeInstanceOf(MarkdownConnector);
  });
});
