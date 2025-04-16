/// <reference types="cypress" />
import type { SchoolLookupRow } from '../types/school';

declare namespace Cypress {
  interface Chainable {
    task(
      taskName: 'readExcelFile'
    ): Chainable<SchoolLookupRow[]>;

    task(
      taskName: 'writeExcelFile',
      data: SchoolLookupRow
    ): Chainable<void>;
  }
}
