nexe --build -i maddenSynth.js -t x64-14.15.3 -r "../node_modules/madden-franchise/data/schemas" -r "../node_modules/madden-franchise/services/lookupFiles/*.json" -r "../Utils/FranchiseUtils.js" -r "../Utils/FranchiseTableId.js" -r "lookupFiles/*.json" -r "../Utils/JsonLookups/*.json" -o "maddenSynth.exe" --verbose 