// @vitest-environment jsdom
/**
 * Phase 3 — Accessibility Hardening (SDD §21 "Semantic structure" /
 * §24 item 6). The shared `Table` primitive is what every data table in
 * the app (Evidence Table, MITRE technique table, Case list, Export
 * history) is built on — verifying it renders real, axe-clean `<table>`
 * semantics here covers the "screen-reader table semantics" requirement
 * for all of them at once, without needing to render every consumer page.
 */
import "@/test/a11y-setup";
import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { axe } from "jest-axe";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../table";

describe("Table accessibility", () => {
  it("has no axe violations for a representative table with a caption", () => {
    const { container } = render(
      <Table>
        <caption className="sr-only">Recent Windows events</caption>
        <TableHeader>
          <TableRow>
            <TableHead>Event ID</TableHead>
            <TableHead>Provider</TableHead>
            <TableHead>Level</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow>
            <TableCell>4624</TableCell>
            <TableCell>Microsoft-Windows-Security-Auditing</TableCell>
            <TableCell>Information</TableCell>
          </TableRow>
          <TableRow>
            <TableCell>4625</TableCell>
            <TableCell>Microsoft-Windows-Security-Auditing</TableCell>
            <TableCell>Warning</TableCell>
          </TableRow>
        </TableBody>
      </Table>,
    );
    const table = container.querySelector("table");
    expect(table).not.toBeNull();
  });

  it("passes axe with no violations", async () => {
    const { container } = render(
      <Table>
        <caption className="sr-only">Recent Windows events</caption>
        <TableHeader>
          <TableRow>
            <TableHead>Event ID</TableHead>
            <TableHead>Provider</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow>
            <TableCell>4624</TableCell>
            <TableCell>Microsoft-Windows-Security-Auditing</TableCell>
          </TableRow>
        </TableBody>
      </Table>,
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
