const {google} = require('googleapis');
const {backOff} = require('exponential-backoff');

let tagmanager;
const {getOAuth2Client} = require('./oauth2setup.js');

const msleep = (ms) => new Promise(resolve => {
	setTimeout(resolve, ms);
});

const backOffOptions = {
	numOfAttempts: 15,
	jitter: 'full',
	retry: (error, attemptNumber) => {
		console.log('Failed attempt #' + attemptNumber + ' (' + error + ')');
		console.log('Attempting to retry...\n');
		return true;
	}
};

async function cloneExampleContainer(targetContainerName, targetAccountId, exampleContainerPublicId) {
	tagmanager = google.tagmanager({version: 'v2', auth: await getOAuth2Client()});

	const testAccount = await getAccountById("38028818");
	const exampleContainer = await getContainerByAccountAndPublicId(testAccount, exampleContainerPublicId);
	const targetContainer = await findOrCreateContainer(targetContainerName, targetAccountId);

	await clearWorkspaceEntities(await getDefaultWorkspaceByContainer(targetContainer));
	await cloneContainerEntities(exampleContainer, targetContainer);
}

async function getContainerByPublicId(publicId) {
	const response = await backOff(() => tagmanager.accounts.list(), backOffOptions);
	const accounts = response.data;

	for (let i = 0; i < accounts.length; i++) {
		const container = await getContainerByAccountAndPublicId(accounts[i], publicId);
		if (container)
			return container;
	}
	throw "Could not find container.";
}

async function findOrCreateContainer(newContainerName, targetAccountId) {
	const targetAccount = await getAccountById(targetAccountId);
	const existingContainer = await getContainerByAccountAndName(targetAccount, newContainerName);

	if (existingContainer)
		return existingContainer;

	const response = await backOff(() => tagmanager.accounts.containers.create({
		parent: targetAccount.path,
		requestBody: {
			name: newContainerName,
			usageContext: ['web']
		}
	}), backOffOptions);
	return response.data;
}

async function cloneContainerEntities(exampleContainer, targetContainer) {
	const exampleWorkspace = await getDefaultWorkspaceByContainer(exampleContainer);
	const targetWorkspace = await getDefaultWorkspaceByContainer(targetContainer);

	const propNames = ['trigger', 'tag', 'variable'];
	const exampleEntities = await Promise.all(propNames.map(prop => getEntityListByWorkspaceAndProperty(exampleWorkspace, prop)));
	const targetEntities = await Promise.all(propNames.map(prop => getEntityListByWorkspaceAndProperty(targetWorkspace, prop)));

	for (let trigger of exampleEntities[0]) {
		const fields = [
			'autoEventFilter',
			'checkValidation',
			'continuousTimeMinMilliseconds',
			'customEventFilter',
			'eventName',
			'filter',
			'horizontalScrollPercentageList',
			'interval',
			'intervalSeconds',
			'limit',
			'maxTimerLengthSeconds',
			'name',
			'notes',
			'parameter',
			'selector',
			'totalTimeMinMilliseconds',
			'type',
			'uniqueTriggerId',
			'verticalScrollPercentageList',
			'visibilitySelector',
			'visiblePercentageMax',
			'visiblePercentageMin',
			'waitForTags',
			'waitForTagsTimeout'
		];
		await cloneEntity(targetWorkspace, trigger, fields, 'trigger');
	}

	for (let tag of exampleEntities[1]) {

	}

	for (let variable of exampleEntities[2]) {
		const fields = [
			'formatValue',
			'name',
			'notes',
			'parameter',
			'type'
		];
		await cloneEntity(targetWorkspace, variable, fields, 'variable');
	}
}

async function getAccountById(accountId) {
	const response = await backOff(() => tagmanager.accounts.get({path: 'accounts/' + accountId}), backOffOptions);
	return response.data;
}

async function getContainerListByAccount(account) {
	const response = await backOff(() => tagmanager.accounts.containers.list({parent: account.path}), backOffOptions);
	return response.data.container;
}

async function getContainerByAccountAndPublicId(account, publicId) {
	const containers = await getContainerListByAccount(account);
	return !containers ? undefined : containers.find(container => container.publicId === publicId);
}

async function getContainerByAccountAndName(account, targetName) {
	const containers = await getContainerListByAccount(account);
	return !containers ? undefined : containers.find(container => container.name === targetName);
}

async function getDefaultWorkspaceByContainer(container) {
	const response = await backOff(() => tagmanager.accounts.containers.workspaces.list({parent: container.path}), backOffOptions);
	const workspaces = response.data.workspace;

	return !workspaces ? undefined : workspaces.find(workspace => workspace.name === "Default Workspace");
}

async function getEntityListByWorkspaceAndProperty(workspace, property) {
	const response = await backOff(() => tagmanager.accounts.containers.workspaces[property + 's'].list({parent: workspace.path}), backOffOptions);
	return response.data[property];
}

async function getPropertyByWorkspaceAndName(workspace, name, property) {
	const entities = await getEntityListByWorkspaceAndProperty(workspace, property);
	return !entities ? undefined : entities.find(entity => entity.name === name);
}

async function cloneEntity(targetWorkspace, entity, fields, property) {
	let requestBody = {};
	for (let field of fields) {
		requestBody[field] = entity[field];
	}

	await backOff(() => tagmanager.accounts.containers.workspaces[property + 's'].create({
		parent: targetWorkspace.path,
		requestBody: requestBody
	}), backOffOptions);
}

async function clearWorkspaceEntities(workspace) {
	for (let prop of ["trigger", "tag", "variable"]) {
		const entities = await getEntityListByWorkspaceAndProperty(workspace, prop);
		if (entities) {
			for (let entity of entities) {
				await backOff(() => tagmanager.accounts.containers.workspaces[prop + 's'].delete({path: entity.path}), backOffOptions);
			}
		}
	}
}

cloneExampleContainer("noah api onboarding container", "28458393", "GTM-PNJH2T")
	.catch(err => {
		console.error(err);
		throw err;
	});