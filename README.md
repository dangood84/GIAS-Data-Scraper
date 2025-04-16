# GIAS-Data-Scraper

## Welcome

Welcome to **Dan Good's** public GIAS-Data-Scraper repository. The GIAS-Data-Scraper scrapes data from the GIAS and OFSTED websites using Cypress to read school URNs input from a "School" column in the datasheet "Sheet1" and records are output from Cypress to another datasheet called "UpdatedData" within the same "schools-to-lookup.xlsx" Excel spreadsheet located within the cypress/fixtures folder.

## Compatibility

- This script should run on any Windows PC or Apple Mac that can support Cypress version 13 using a suitable browser, version of node and npm and has Microsoft Excel installed.


## Limitations

- The more rows of data in the "sheet1" datasheet the slower the script will become over time.  I have run the script with 191-odd schools at once I needed to check against the Manage School Improvement database but the iterations were certainly a lot slower in the second-half of the Excel data/script-at-runtime.


## Purpose

This repository serves as a resource for learning and implementing data-scraping/data-driven automation techniques using Cypress and excel and possibly a useful utility for scraping data from a small selection of schools. Feel free to explore, modify, and contribute!

## Version History

- Version 2.3 - (Current) - Introduced (quick-and-dirty) waiting at the end of each iteration so that the WAF isn't triggered
- Version 2.2 - Allow to search by URN instead of school name to ensure better accuracy/integrity
- Version 2.1 - Validated against schools that had no "Last OFSTED inspection dates" present
- Version 2.0 - Refined and trimmed page selectors and created default Excel headers in "UpdatedData" output worksheet
- Version 1.9 - Validated for schools that had no OFSTED sub-judgements listed
- Version 1.8 - Validated for Cypress cross-origin 503 errors
- Version 1.7 - Validated for GIAS pages with missing "Location" tab and "Region" data and Increased Redirection Limit in cypress.config.ts so script doesn't bomb-out prematurely
- Version 1.6 - Validated for GIAS pages with missing OFSTED links within the "Details" tab
- Versiom 1.5 - Validate against "Unknown" subjudgements on OFSTED site
- Version 1.4 - Validate for no "Religious character" field in "Details" tab
- Version 1.3 - Validate for no "Previous URN" within the Links tab
- Version 1.2 - Changed WriteExcel() function in cypress.config.ts to overwrite output data instead of appending it in "UpdatedData" worksheet
- Version 1.1 - Fixed locators to extract URNs and Previous URNs properly
- Version 1.0 - 

