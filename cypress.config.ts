import * as xlsx from "xlsx";
import * as fs from "fs";
import * as path from "path";
import { defineConfig } from "cypress";

export default defineConfig({
  e2e: {
    redirectionLimit: 200,
    setupNodeEvents(on, config) {
      on("task", {
        // Task to read data from Excel file
        readExcelFile() {
          const filePath = path.join(
            __dirname,
            "cypress/fixtures",
            "schools-to-lookup.xlsx"
          );
          console.log("Reading from:", filePath);

          if (!fs.existsSync(filePath)) {
            console.log("File not found, returning empty data");
            return [];
          }

          const workbook = xlsx.readFile(filePath);
          const sheetName = "Sheet1"; // Sheet1 is where input data lives
          const worksheet = workbook.Sheets[sheetName];

          if (!worksheet) {
            console.log(`Sheet "${sheetName}" not found, returning empty data`);
            return [];
          }

          return xlsx.utils.sheet_to_json(worksheet);
        },

        // Task to write data to Excel file
        writeExcelFile(rows: { [key: string]: any }[]) {
          const filePath = path.join(
            __dirname,
            "cypress/fixtures",
            "schools-to-lookup.xlsx"
          );
          console.log("Writing to:", filePath);

          // Clean up 'Local authority' values
          const cleanedRows = rows.map((row) => {
            if (row["Local authority"]) {
              row["Local authority"] = row["Local authority"]
                .replace(/\s*\(.*?\)/, "") // Remove anything in parentheses
                .replace(/\s+/g, " ") // Collapse any weird spacing
                .trim(); // Trim ends
            }
            return row;
          });

          const headers = [
            "School",
            "Schoolname",
            "URN",
            "Previous URN",
            "Region",
            "Local authority",
            "School phase",
            "Religious character",
            "Diocese",
            "Number on roll (NOR)",
            "Date of last inspection",
            "Quality of education",
            "Behaviour and attitudes",
            "Personal development",
            "Leadership and management",
          ];

          let workbook;
          if (fs.existsSync(filePath)) {
            workbook = xlsx.readFile(filePath);
          } else {
            workbook = xlsx.utils.book_new();
          }

          const sheetName = "UpdatedData";
          const updatedSheet = xlsx.utils.json_to_sheet(cleanedRows, {
            header: headers,
          });

          workbook.Sheets[sheetName] = updatedSheet;

          const existingIndex = workbook.SheetNames.indexOf(sheetName);
          if (existingIndex > -1) {
            workbook.SheetNames.splice(existingIndex, 1);
          }
          workbook.SheetNames.unshift(sheetName);

          xlsx.writeFile(workbook, filePath);
          console.log("✅ Successfully wrote cleaned UpdatedData sheet.");
          return null;
        },
      }); // <- ✅ CLOSES on('task', {...})
    },
  },
});
