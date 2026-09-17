import { describe, it, expect } from "vitest";
import React from "react";
import { KeeperCard } from "../../../src/components/keeper/KeeperCard";
import * as keeperContextModule from "../../../src/context/KeeperContext";
import * as tokenApprovalModule from "../../../src/services/trading/token-approval";

describe("KeeperCard Component Unit Tests", () => {
  it("should define KeeperCard component properly", () => {
    const element = React.createElement(KeeperCard);
    expect(element).toBeDefined();
    expect(element.type).toBe(KeeperCard);
  });

  it("should support KeeperContext hook consumption", () => {
    expect(typeof keeperContextModule.useKeeper).toBe("function");
    expect(typeof keeperContextModule.KeeperProvider).toBe("function");
  });

  it("should export checkAllowance and approveToken for proxy trader allowance integration", () => {
    expect(typeof tokenApprovalModule.checkAllowance).toBe("function");
    expect(typeof tokenApprovalModule.approveToken).toBe("function");
    expect(typeof tokenApprovalModule.verifyAllowanceStatus).toBe("function");
  });
});
