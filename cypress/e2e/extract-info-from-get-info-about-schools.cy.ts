/// <reference types="cypress" />

interface SchoolLookupRow {
  School: string;
  [key: string]: any;
}

describe('Enrich school data from GIAS site', () => {
  const enrichedData: SchoolLookupRow[] = [];

  before(() => {
    cy.task<SchoolLookupRow[]>('readExcelFile').then((rows) => {
      Cypress.env('schoolList', rows);
    });
  });

  it('Should search and extract school data from GIAS and Ofsted', () => {
    const schoolList: SchoolLookupRow[] = Cypress.env('schoolList');

    Cypress._.each(schoolList, (row) => {
      cy.visit('https://get-information-schools.service.gov.uk/', { failOnStatusCode: false });

      cy.contains("Search for establishments").click();
      cy.get("#searchtype-name").click();
      cy.get('#TextSearchModel_Text').clear().type(row.School);
      //cy.get('#awesomplete_list_1_item_0').click();
      cy.get('#name-search-submit').click();

      // Step 3: Links tab
      cy.contains('a', 'Links').click();
      cy.get('#urn-value').then(($urn) => {
        row.URN = $urn.text().trim();
      });
      cy.get('#establishment-name').then(($schoolname) => {
        row.Schoolname = $schoolname.text().trim();
      });

      cy.document().then((doc) => {
        const prevUrn = doc.querySelector('td[data-label="URN"]');
        row['Previous URN'] = prevUrn?.textContent?.trim() || 'Not applicable';
      });

// Step 4: Location
cy.get('.gias-tabs', { timeout: 10000 }).then(($el) => {
  if ($el.find('a').text().includes('Location')) { // Check if 'Location' exists in the tab
    // Element exists, click it
    cy.contains('Location').click();
    cy.get('#gor-value').then(($region) => {
      row.Region = $region.text().trim();
    });
  } else {
    // Element doesn't exist, log and continue
    cy.log('Location tab not found, skipping...');
  }
});

      // Step 5: Main Details
      cy.contains('a', 'Details').click();
      cy.get('.govuk-summary-list').first().within(() => {
        cy.contains('Local authority').next().then(($el) => {
          row['Local authority'] = $el.text().trim();
        });
        cy.contains('Phase of education').next().then(($el) => {
          row['School phase'] = $el.text().trim();
        });

        const labelsToCheck = [
          { label: 'Religious character', key: 'Religious character' },
          { label: 'Diocese', key: 'Diocese' },
          { label: 'Number of pupils', key: 'Number on roll (NOR)' }
        ];

        labelsToCheck.forEach(({ label, key }) => {
          const $label = Cypress.$(`dt:contains("${label}")`);
          if ($label.length) {
            cy.wrap($label).next().then(($el) => {
              row[key] = $el.text().trim();
            });
          } else {
            row[key] = 'Not specified';
          }
        });
      });

// Step 6: Ofsted Report
cy.get('body').then(($body) => {
  const link = $body.find('a:contains("Ofsted report (opens in new tab)")');
  if (link.length > 0) {
    const href = link.attr('href');
    if (href) {
      const secureHref = href.replace(/^http:/, 'https:');
      cy.origin('https://reports.ofsted.gov.uk', { args: { secureHref } }, ({ secureHref }) => {
        const ofstedData: Record<string, string> = {};

        cy.visit(secureHref, { failOnStatusCode: false }).then(() => {
          cy.document().then((doc) => {
            if (doc.body.innerText.includes('Service Unavailable')) {
              cy.log('OFSTED page returned 503, skipping...');
              ofstedData['Date of last inspection'] = 'Unavailable';
              ofstedData['Quality of education'] = 'Unavailable';
              ofstedData['Behaviour and attitudes'] = 'Unavailable';
              ofstedData['Personal development'] = 'Unavailable';
              ofstedData['Leadership and management'] = 'Unavailable';
            } else {
              cy.get('body').then(($ofstedBody) => {
                if ($ofstedBody.find('time').length) {
                  cy.get('time').first().then(($t) => {
                    ofstedData['Date of last inspection'] = $t.text().trim();
                  });
                } else {
                  ofstedData['Date of last inspection'] = "Unknown";
                  cy.log("No OFSTED date data exists");
                }
              });

              cy.get('body').then(($ofstedBody) => {
                if ($ofstedBody.find('.subjudgements__rates').length) {
                  cy.get('.subjudgements__rates').within(() => {
                    cy.contains('Quality of education').next().then(($q) => {
                      ofstedData['Quality of education'] = $q.text().trim() || 'Unknown';
                    });
                    cy.contains('Behaviour and attitudes').next().then(($b) => {
                      ofstedData['Behaviour and attitudes'] = $b.text().trim() || 'Unknown';
                    });
                    cy.contains('Personal development').next().then(($p) => {
                      ofstedData['Personal development'] = $p.text().trim() || 'Unknown';
                    });
                    cy.contains('Leadership and management').next().then(($l) => {
                      ofstedData['Leadership and management'] = $l.text().trim() || 'Unknown';
                    });
                  });
                } else {
                  ofstedData['Quality of education'] = 'Unknown';
                  ofstedData['Behaviour and attitudes'] = 'Unknown';
                  ofstedData['Personal development'] = 'Unknown';
                  ofstedData['Leadership and management'] = 'Unknown';
                }
              });
            }
          });

          cy.wait(500).then(() => {
            cy.wrap(ofstedData);
          });
        });
      }).then((ofstedInfo) => {
        Object.assign(row, ofstedInfo);
        enrichedData.push(row);
        cy.wait(1500); // Pause before next school to stop WAF bombing my script out
      });
    } else {
      // No href attribute found
      row['Date of last inspection'] = 'Unknown';
      row['Quality of education'] = 'Unknown';
      row['Behaviour and attitudes'] = 'Unknown';
      row['Personal development'] = 'Unknown';
      row['Leadership and management'] = 'Unknown';
      enrichedData.push(row);
      cy.wait(1500); // Pause before next school to stop WAF bombing my script out
    }
  } else {
    // No Ofsted link at all
    row['Date of last inspection'] = 'Unknown';
    row['Quality of education'] = 'Unknown';
    row['Behaviour and attitudes'] = 'Unknown';
    row['Personal development'] = 'Unknown';
    row['Leadership and management'] = 'Unknown';
    enrichedData.push(row);
    cy.wait(1500); // Pause before next school to stop WAF bombing my script out
  }
});


    });
  });

  after(() => {
    console.log('Enriched Data:', enrichedData); // Optional debug
    cy.task('writeExcelFile', enrichedData);
  });
});
