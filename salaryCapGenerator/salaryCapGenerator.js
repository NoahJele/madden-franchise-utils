// Required modules
const FranchiseUtils = require('../Utils/FranchiseUtils');
const { tables } = require('../Utils/FranchiseTableId');

// List of allowed game years
const validGameYears = [
  FranchiseUtils.YEARS.M20,
  FranchiseUtils.YEARS.M21,
  FranchiseUtils.YEARS.M22,
  FranchiseUtils.YEARS.M23,
  FranchiseUtils.YEARS.M24,
  FranchiseUtils.YEARS.M25
];

// Print tool header message
console.log("This program will randomly generate the yearly salary cap increases over a 30 season period.");

// Get the file's game year from the user
const gameYear = FranchiseUtils.getGameYear(validGameYears);

// Ensure auto-unempty is set to false, as this is an advanced option that we don't need for this program
const autoUnempty = false;

// Get the desired franchise file for the selected game year from the user, and pass in our auto-unempty option defined above
const franchise = FranchiseUtils.selectFranchiseFile(gameYear, autoUnempty);

franchise.on('ready', async function () {
  // Ensure the selected file is from a valid game year
  FranchiseUtils.validateGameYears(franchise, validGameYears);

  // Get required tables
  const salCapIncreaseTable = franchise.getTableByUniqueId(tables.salCapIncreaseTable);

  // Read required tables
  await FranchiseUtils.readTableRecords([salCapIncreaseTable]);

  // Iterate through each row of the salary cap increase array table
  for (let i = 0; i < salCapIncreaseTable.header.numMembers; i++) {
    // Generate a random integer between 0 and 2500
    const randomInt = FranchiseUtils.getRandomNumber(0, 2500);

    // Update the current salary cap increase column (0th row and i-th column) with the random integer
    salCapIncreaseTable.records[0][`int${i}`] = randomInt;
  }

  // Program complete, so print success message, save the franchise file, and exit the program
  console.log("Successfully generated random salary cap increases.");
  await FranchiseUtils.saveFranchiseFile(franchise);
  FranchiseUtils.EXIT_PROGRAM();
});
