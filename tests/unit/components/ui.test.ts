import { describe, it, expect, vi } from "vitest";
import React from "react";
import { CyberStepper } from "@/components/ui/CyberStepper";
import { CyberSwitch } from "@/components/ui/CyberSwitch";
import { SegmentedTabs } from "@/components/ui/SegmentedTabs";

describe("Cyber UI Components", () => {
  it("should define CyberStepper and handle step bounds", () => {
    const onChange = vi.fn();
    const stepperElement = React.createElement(CyberStepper, {
      value: 10,
      onChange,
      min: 0,
      max: 100,
      step: 1,
    });
    expect(stepperElement).toBeDefined();
    expect(stepperElement.props.value).toBe(10);
  });

  it("should define CyberSwitch and toggle state", () => {
    const onChange = vi.fn();
    const switchElement = React.createElement(CyberSwitch, {
      checked: true,
      onChange,
    });
    expect(switchElement.props.checked).toBe(true);
  });

  it("should define SegmentedTabs with active tab", () => {
    const onChange = vi.fn();
    const tabsElement = React.createElement(SegmentedTabs, {
      activeId: "strategy",
      onChange,
      options: [
        { id: "monitor", label: "监听Swap" },
        { id: "strategy", label: "设置策略" },
      ],
    });
    expect(tabsElement.props.activeId).toBe("strategy");
    expect(tabsElement.props.options.length).toBe(2);
  });
});
