const fs = require("fs");
const path = require("path");

// Specify the path to your sdk.gen.ts file
const filePath = path.join(__dirname, "src/client/sdk.gen.ts");

// Read the file content
fs.readFile(filePath, "utf8", (err, data) => {
  if (err) {
    return console.error(`Error reading the file: ${err}`);
  }

  // Replace all occurrences of from './types.gen' with from './types.gen.js'
  const result = data.replace(
    /from\s+'\.\/types\.gen'/g,
    "from './types.gen.js'"
  );

  // Write the updated content back to the file
  fs.writeFile(filePath, result, "utf8", (err) => {
    if (err) return console.error(`Error writing the file: ${err}`);
    console.log("Import paths updated successfully.");
  });
});

// Copy open-api.yaml to backup folder with timestamp
const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
const backupPath = path.join(__dirname, "backup", `open-api_${timestamp}.yaml`);

fs.copyFile(path.join(__dirname, "open-api.yaml"), backupPath, (err) => {
  if (err) {
    return console.error(`Error copying open-api.yaml to backup: ${err}`);
  }
  console.log(`Successfully backed up open-api.yaml to ${backupPath}`);
});
