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

      // CLICK IN SEARCHFIELD AND SCHOOL FROM "School" COL IN "sheet1" WORKSHEET IS POPULATED
      cy.get("#searchtype-name").click();
      cy.get('#TextSearchModel_Text').clear().type(row.School);

      // UNCOMMENT LINE BELOW IF YOU'D RATHER ENTER SCHOOLS BY NAME UNDER THE "School" COLUMN IN "schools-to-lookup.xlsx"
      //cy.get('#awesomplete_list_1_item_0').click();

      cy.get('#name-search-submit').click();

      // Links tab
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

// Location Tab
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

      // Main Details
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

// SOfsted Report
cy.get('body').then(($body) => {
  const link = $body.find('a:contains("Ofsted report (opens in new tab)")');
  // OK - SO OFSTED LINK EXISTS ON DETAILS TAB - GREAT!
  if (link.length > 0) {
    const href = link.attr('href');
    // OK - SO OFSTED LINK HREF ATTR EXISTS IN LINK - GREAT!
    if (href) {
      const secureHref = href.replace(/^http:/, 'https:');
      // SWITCHINE DOMAINS HERE SO NEED CY.ORIGIN - EXTRA YUCKY AAS SWITCHING FROM HTTPS TO HTTP
      cy.origin('https://reports.ofsted.gov.uk', { args: { secureHref } }, ({ secureHref }) => {
        const ofstedData: Record<string, string> = {};

        cy.visit(secureHref, { failOnStatusCode: false }).then(() => {
          cy.document().then((doc) => {
            // OK - IF WE GET THAT 503 UNAVAILABLE ERROR LOG OFSTED DATA AS UNAVAILABLE AND SKIP TO NEXT RECORD
            if (doc.body.innerText.includes('Service Unavailable')) {
              cy.log('OFSTED page returned 503, skipping...');
              ofstedData['Date of last inspection'] = 'Unavailable';
              ofstedData['Quality of education'] = 'Unavailable';
              ofstedData['Behaviour and attitudes'] = 'Unavailable';
              ofstedData['Personal development'] = 'Unavailable';
              ofstedData['Leadership and management'] = 'Unavailable';
            } else {
              // OK PHEW NO 503 ERROR - LET'S SCAN THE PAGE
              cy.get('body').then(($ofstedBody) => {
                //OK - WE HAVE PAIRED TIME TAGS INDICATING LAST OFSTED INSPECTION DATE ON THE PAGE LET'S GRAB IT
                if ($ofstedBody.find('time').length) {
                  cy.get('time').first().then(($t) => {
                    ofstedData['Date of last inspection'] = $t.text().trim();
                  });
                  // OK - NO PAIRED TIME TAGS INDICATING THERE'S NO LAST INSPECTION DATE ON THE PAGE SO SET TO UNKNOWN
                } else {
                  ofstedData['Date of last inspection'] = "Unknown";
                  cy.log("No OFSTED date data exists");
                }
              });

              cy.get('body').then(($ofstedBody) => {
                // OK - SO .SUBJUDGEMENTS PARTIAL-CONTAINER EXISTS - GREAT! LET'S GET THE VALS
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
                  // OK - SO .SUBJUDGEMENTS PARTIAL-CONTAINER DOESN'T EXISTS - OH WELL - SET THEM TO "UNKNOWN"
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
      //OK - SO NO OFSTED HREF ATTR FOUND ON DETAILS TAB - OH WELL GUESS WE'D BETTER SET OFSTED VALS INC LAST INSPECTION DATE TO UNKNOWN
    } else {
      row['Date of last inspection'] = 'Unknown';
      row['Quality of education'] = 'Unknown';
      row['Behaviour and attitudes'] = 'Unknown';
      row['Personal development'] = 'Unknown';
      row['Leadership and management'] = 'Unknown';
      enrichedData.push(row);
      cy.wait(1500); // Pause before next school to stop WAF bombing my script out
    }
    // OK - SO NO OFSTED LINK AT ALL ON DETAILS TAB - OH WELL
  } else {
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

  // AFTER BLOCK SHOULD GET TRIGGERED ON ORGANIC TEST PASS OR ORGANIC TEST FAIL - IF THE TEST IS STOPPED IN THE TEST-RUNNER OR STOPPED WITH CTRL + Z OR CTRL + C ON THE COMMAND-LINE THIS BLOCK WILL NOT BE TRIGGERED
  after(() => {
    console.log('Enriched Data:', enrichedData); // Optional debug
    cy.task('writeExcelFile', enrichedData);
  });
});
