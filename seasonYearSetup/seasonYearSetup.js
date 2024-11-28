// Required modules
const FranchiseUtils = require('../Utils/FranchiseUtils');
const prompt = require('prompt-sync')();
const validGameYears = [
    FranchiseUtils.YEARS.M24,
    FranchiseUtils.YEARS.M25
];

console.log("This program will set the current season year.");

// Super Bowl dictionary: maps each year to the Super Bowl number
const superBowlMap = {};
for (let year = 1966, superBowl = 1; year <= 2024; year++, superBowl++) {
  superBowlMap[year] = superBowl;
}

// Set up franchise file
const franchise = FranchiseUtils.init(validGameYears);
const tables = FranchiseUtils.getTablesObject(franchise);

async function promptForYear() {
  let year;
  while (true) {
    // Prompt user for the year
    const inputYear = prompt("Enter the year you'd like to set your franchise to: ");
    year = parseInt(inputYear, 10);

    // Validate year
    if (!Number.isNaN(year) && year >= 1966 && year <= 2024) { // Restrict to years in the Super Bowl map
      break;
    } else {
      console.log("Invalid input. Please enter a year between 1966 and 2024.");
    }
  }
  return year;
}

franchise.on('ready', async function () {
  
  // Prompt user for the franchise year
  const selectedYear = await promptForYear();
  
  // Get the season info table    
  const seasonInfoTable = franchise.getTableByUniqueId(tables.seasonInfoTable);
  await seasonInfoTable.readRecords();

  // Retrieve Super Bowl number for the selected year
  const superBowlNumber = superBowlMap[selectedYear];

  // Overwrite the fields with the selected year and Super Bowl number
  for (let i = 0; i < seasonInfoTable.records.length; i++) {
    seasonInfoTable.records[i]['CurrentSeasonYear'] = selectedYear;
    seasonInfoTable.records[i]['BaseCalendarYear'] = selectedYear;
    seasonInfoTable.records[i]['BaseSuperBowlNumber'] = superBowlNumber;
  }

  console.log(`Successfully set franchise year to ${selectedYear} and Super Bowl number to ${superBowlNumber}.`);
  
  // Save changes if necessary
  await FranchiseUtils.saveFranchiseFile(franchise);
  FranchiseUtils.EXIT_PROGRAM();
});
