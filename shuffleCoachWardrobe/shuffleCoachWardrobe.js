// Required modules
const fs = require('fs');
const FranchiseUtils = require('../Utils/FranchiseUtils');
const isonFunctions = require('../isonParser/isonFunctions');

// Valid game years
const validYears = [
	FranchiseUtils.YEARS.M25
];

// Print tool header message
console.log(`This program will update wardrobe for all head coaches. Only Madden ${FranchiseUtils.formatListString(validYears)} franchise files are supported.\n`)

// Set up franchise file
const franchise = FranchiseUtils.init(validYears, {isAutoUnemptyEnabled: true});
const gameYear = franchise.schema.meta.gameYear;
const tables = FranchiseUtils.getTablesObject(franchise);

// Required lookups
const topLookup = JSON.parse(fs.readFileSync('lookupFiles/coachTopLookup.json'), 'utf8');
const overrideLookup = JSON.parse(fs.readFileSync('lookupFiles/overrideTopLookup.json'), 'utf8');

/**
 * Copies all data in the equipment columns of the source row in the player table to the target row in the player table
 * 
 * @param {number} targetRow The row number of the target coach to update
 * @param {number} item The itemassetname to assign
 * @param {Object} slotType The item's slot type
 * @param {Object} coachTable The coach table object
 * @param {Object} visualsTable The character visuals table object
*/
async function assignCoachGear(targetRow, item, slotType, coachTable, visualsTable)
{
	const targetVisualsRow = FranchiseUtils.bin2Dec(coachTable.records[targetRow]['CharacterVisuals'].slice(15));

	let targetVisualsData = isonFunctions.isonVisualsToJson(visualsTable, targetVisualsRow);

	const targetVisualsLoadouts = targetVisualsData['loadouts'];

	let targetEquipmentLoadouts;

	let loadoutNumber;

	for(let i = 0; i < targetVisualsLoadouts.length; i++)
	{
		if(targetVisualsLoadouts[i]['loadoutCategory'] === 'CoachApparel')
		{
			targetEquipmentLoadouts = targetVisualsLoadouts[i];
			loadoutNumber = i;
			break;
		}
	}

	if(!targetEquipmentLoadouts)
	{
		if(FranchiseUtils.DEBUG_MODE)
		{
			console.log(`Coach ${targetRow} does not have equipment loadouts. Skipping assignment.`);
		}
		return;
	}

	const targetEquipmentSlots = targetEquipmentLoadouts['loadoutElements'];

	let foundSlot = false;

	for(let i = 0; i < targetEquipmentSlots.length; i++)
	{
		if(targetEquipmentSlots[i]['slotType'] === slotType)
		{
			targetEquipmentSlots[i]['itemAssetName'] = item;
			foundSlot = true;
			break;
		}
	}

	if(!foundSlot)
	{
		let newItem = {
			"itemAssetName": item,
			"slotType": slotType
		};

		targetEquipmentSlots.push(newItem);
	}

	targetEquipmentLoadouts['loadoutElements'] = targetEquipmentSlots;
	targetVisualsLoadouts[loadoutNumber] = targetEquipmentLoadouts;

	targetVisualsData['loadouts'] = targetVisualsLoadouts;

	isonFunctions.jsonVisualsToIson(visualsTable, targetVisualsRow, targetVisualsData);

};

/**
 * Enumerates all players in the player table and sorts them into draft class players, NFL players, and other active players
 * 
 * @param {Object} coachTable The player table object
 * @param {Array<number>} headCoachRows A list to store row numbers of head coaches
 */
async function enumerateHeadCoaches(coachTable, headCoachRows)
{
	// Number of rows in the player table
    const numRows = coachTable.header.recordCapacity; 
	
	// Iterate through the player table
    for (let i = 0; i < numRows; i++) 
	{ 
        // If it's an empty row or invalid coach, skip this row
		if(coachTable.records[i].isEmpty || coachTable.records[i]['CharacterVisuals'] === FranchiseUtils.ZERO_REF || coachTable.records[i]['Position'] !== "HeadCoach" || (coachTable.records[i].OffensivePlaybook === FranchiseUtils.ZERO_REF && coachTable.records[i].DefensivePlaybook === FranchiseUtils.ZERO_REF))
		{
			continue;
		}
		
		// Add the row number to the head coach rows array
		headCoachRows.push(i);
    }
}

async function isWarmWeatherCoach(teamIndex)
{
	const teamTable = franchise.getTableByUniqueId(tables.teamTable);
	const seasonGameTable = franchise.getTableByUniqueId(tables.seasonGameTable);
	const seasonInfoTable = franchise.getTableByUniqueId(tables.seasonInfoTable);

	const validWeekTypes = ['PreSeason', 'RegularSeason', 'WildcardPlayoff', 'DivisionalPlayoff', 'ConferencePlayoff', 'SuperBowl'];

	await FranchiseUtils.readTableRecords([teamTable, seasonGameTable, seasonInfoTable]);

	if(!validWeekTypes.includes(seasonInfoTable.records[0]['CurrentWeekType']))
	{
		return false;
	}

	const teamRows = teamTable.header.recordCapacity;
	const scheduleRows = seasonGameTable.header.recordCapacity;
	
	// Search teamTable records object for row with matching teamIndex
	let teamRowNum;
	for(let i = 0; i < teamRows; i++)
	{
		if(teamTable.records[i]['TeamIndex'] === teamIndex)
		{
			teamRowNum = i;
			break;
		}
	}

	if(!teamRowNum)
	{
		return false;
	}

	for(let i = 0; i < scheduleRows; i++)
	{
		if(seasonGameTable.records[i].isEmpty || seasonGameTable.records[i]['AwayPlayerStatCache'] === FranchiseUtils.ZERO_REF)
		{
			continue;
		}

		let homeTeamRow = FranchiseUtils.bin2Dec(seasonGameTable.records[i]['HomeTeam'].slice(15));
		let awayTeamRow = FranchiseUtils.bin2Dec(seasonGameTable.records[i]['AwayTeam'].slice(15));

		if(homeTeamRow !== teamRowNum && awayTeamRow !== teamRowNum)
		{
			continue;
		}

		let gameWeather = seasonGameTable.records[i]['Weather'];
		let gameTemp = seasonGameTable.records[i]['Temperature'];

		if(gameTemp > 80 && gameWeather !== 'Invalid_')
		{
			return true;
		}
		
		break;
	}

	return false;
}


franchise.on('ready', async function () {
    // Get required tables
	const coachTable = franchise.getTableByUniqueId(tables.coachTable);
	const visualsTable = franchise.getTableByUniqueId(tables.characterVisualsTable);

	// Read required tables
	await FranchiseUtils.readTableRecords([coachTable, visualsTable]);
    
	// Arrays to represent the head coach rows
	let coachRows = [];
	
	// Enumerate all head coaches in the coach table
	await enumerateHeadCoaches(coachTable, coachRows);
	
	// If there are no coaches, we can't continue, so inform the user and exit
	if (coachRows.length === 0)
	{
		console.log("\nThere are no coaches in your franchise file.");
		FranchiseUtils.EXIT_PROGRAM();
	}
	
	// Iterate through all head coaches
	for (let j = 0; j < coachRows.length; j++)
	{
		const coachRow = coachRows[j];
		let coachRecord = coachTable.records[coachRow];

		// If the coach's assetname is in the override lookup, just assign that item
		if(overrideLookup.hasOwnProperty(coachRecord['AssetName']))
		{
			let item = overrideLookup[coachRecord['AssetName']];
			await assignCoachGear(coachRow, item, 'JerseyStyle', coachTable, visualsTable);
			continue;
		}
		else if(overrideLookup.hasOwnProperty(coachRecord['AssetName'].replace("_C_PRO", "")))
		{
			let item = overrideLookup[coachRecord['AssetName'].replace("_C_PRO", "")];
			await assignCoachGear(coachRow, item, 'JerseyStyle', coachTable, visualsTable);
			continue;
		}
		else if(overrideLookup.hasOwnProperty(coachRecord['AssetName'] + "_C_PRO"))
		{
			let item = overrideLookup[coachRecord['AssetName'] + "_C_PRO"];
			await assignCoachGear(coachRow, item, 'JerseyStyle', coachTable, visualsTable);
			continue;
		}

		// If the coach is a free agent, just randomly choose a gear option
		if(coachRecord['ContractStatus'] === 'FreeAgent')
		{
			let keys = Object.keys(topLookup);
			let item = topLookup[keys[FranchiseUtils.getRandomNumber(0, keys.length - 1)]];
			await assignCoachGear(coachRow, item, 'JerseyStyle', coachTable, visualsTable);
			continue;
		}

		// Otherwise, we should assign coach gear randomly but with branching logic based on game weather if applicable
		let isWarmOutdoorCoach = await isWarmWeatherCoach(coachRecord['TeamIndex']);

		if(isWarmOutdoorCoach)
		{
			let keys = Object.keys(topLookup);

			let randomNumber;
			let itemKey;
			do
			{
				randomNumber = FranchiseUtils.getRandomNumber(0, 2);

				itemKey = keys[FranchiseUtils.getRandomNumber(0, keys.length - 1)];
			}
			while(itemKey === "Polo" && randomNumber !== 2);

			let item = topLookup[itemKey];
			await assignCoachGear(coachRow, item, 'JerseyStyle', coachTable, visualsTable);
			continue;
		}
		else
		{
			let keys = Object.keys(topLookup);
			
			// Remove polo from keys
			keys = keys.filter(key => key !== "Polo");

			let item = topLookup[keys[FranchiseUtils.getRandomNumber(0, keys.length - 1)]];
			await assignCoachGear(coachRow, item, 'JerseyStyle', coachTable, visualsTable);
			continue;
		}
	}
	
	// Program complete, so print success message, save the franchise file, and exit
	console.log("\nCoach wardrobe updated successfully.\n");
    await FranchiseUtils.saveFranchiseFile(franchise);
	FranchiseUtils.EXIT_PROGRAM();
  
});
  