'use strict';

const qt = require('qtools-functional-library');
const configFileProcessor = require('qtools-config-file-processor');

const fs = require('fs');
const path = require('path');

//START OF moduleFunction() ============================================================

const moduleFunction = function({ 
			wetlNameConfigLocationPaths,
			assessmentConfigsDirPath, log=message=>console.log(message), callback }) {

//CHECK FILE EXISTENCE ============================================================

	const schoolListDir = path.join(assessmentConfigsDirPath, 'schoolLists');
	const moduleConfigsDir = path.join(assessmentConfigsDirPath, 'moduleConfigs');

	if (!fs.existsSync(schoolListDir)) {
		const message = `ERROR: ${schoolListDir} does not exist`;
		log(message);
		callback(message);
		return;
	}
	if (!fs.existsSync(moduleConfigsDir)) {
		const message = `ERROR: ${moduleConfigsDir} does not exist`;
		log(message);
		callback(message);
		return;
	}

	const schoolListFiles = fs.readdirSync(schoolListDir);
	const moduleConfigsFiles = fs.readdirSync(moduleConfigsDir);

//FILE RETRIEVAL FUNCTIONS ============================================================

	const loadConfigFiles = fileName => {
		const schoolConfig = configFileProcessor
			.getConfig(path.join(schoolListDir, fileName))
			.qtNumberKeysToArray();
		const moduleConfig = configFileProcessor
			.getConfig(path.join(moduleConfigsDir, fileName))
			.qtNumberKeysToArray();

		const assessmentName = fileName.replace(/\.ini$/, '');

		return { schoolConfig, moduleConfig, assessmentName };
	};

	const compileSchooList = ({
		oneSchoolConfig,
		moduleConfig,
		assessmentName
	}) => {
		const { defaults = {}, overrides = {} } = moduleConfig.qtClone();

		const { fileElements = {}, fileList = [] } = defaults.qtClone();

		defaults.fileList = fileList.map(item => item.qtMerge(fileElements));

		return defaults
			.qtMerge(oneSchoolConfig)
			.qtMerge(overrides)
			.qtMerge({ assessmentName });
	};

	const compileEachDistrict = ({
		schoolConfig,
		moduleConfig,
		assessmentName
	}) => {
		return schoolConfig.schoolList.qtNumberKeysToArray().map(oneSchoolConfig =>
			compileSchooList({
				oneSchoolConfig,
				moduleConfig,
				assessmentName
			})
		);
	};


//CALCULATE CONSOLIDATE LIST ============================================================

	const finalConfigSet = (schoolListFiles.length < moduleConfigsFiles.length
		? schoolListFiles
		: moduleConfigsFiles
	)
		.map(fileName => loadConfigFiles(fileName))
		.map(item => compileEachDistrict(item))
		.reduce((result, item) => result.concat(item), [])
		.qtPassThrough(item => console.log(item.length));

//ACCESS METHODS ============================================================

	this.getConfig = (
		filter = item => {
			return item;
		}
	) =>
		finalConfigSet.filter(item => {
			return filter(item);
		});

	this.getUniqueWetlNameList = (
		filter = item => {
			return item;
		}
	) => {

		const wetlNameConfigLocationPaths = {
			['fast-v1']: 'changedFileProcess.wetl.clientId',
			['map-v1']: 'changedFileProcess.wetl.clientId',
			['mca-v1']: 'changedFileProcess.wetl.clientId',
			['plp-to-plans-v1']: 'db-retriever.credentialSource.parameters.clientId',
			['plp-to-viewpoint-v1']:
				'changedFileProcessParameters.credentialSource.parameters.clientId',
			['star-v1']: 'changedFileProcess.wetl.clientId'
		};
		const wetlNameList = this.getConfig(filter)
			.qtClone()
			.map(item => {
				const wetlName = item.qtGetSurePath(
					wetlNameConfigLocationPaths.qtGetSurePath(
						item.assessmentName,
						'NOWETL'
					)
				);

				return item.qtMerge({ wetlName });
			})
			.filter(item => item.wetlName != 'NOWETL')
			.filter(item => !typeof item.wetlName != 'undefined')
			.map(item => item.wetlName)
			.reduce(
				(result, item) => (result.includes(item) ? result : [...result, item]),
				[]
			)
			.slice(0, 4)
			.qtPassThrough(() =>
				log('WARNING: truncating WETL name list to three items for testing')
			);

		return wetlNameList;
	};

	callback('', this);

	return this;
};

//END OF moduleFunction() ============================================================

//module.exports = moduleFunction;
module.exports = args => new moduleFunction(args);

