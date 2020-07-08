const {google} = require('googleapis');
const {backOff} = require('exponential-backoff');

let tagmanager;
const {getOAuth2Client} = require('./oauth2setup.js');

const msleep = (ms) => new Promise(resolve => {
	setTimeout(resolve, ms);
});

const backOffOptions = {
	numOfAttempts: Infinity,
	startingDelay: 500,
	maxDelay: 64000,
	delayFirstAttempt: true,
	jitter: 'full',
	retry(error, attemptNumber) {
		console.log('Failed attempt #' + attemptNumber + ' (' + error + ')');
		if (error.code === 429) {
			const delayTime = this.timeMultiple ** (attemptNumber - 1) * this.startingDelay / 1000;
			console.log('Retrying after about ' + delayTime + ' second(s)...');
		}
		return error.code === 429;
	}
};

async function cloneExampleContainer(targetContainerName, targetAccountId, exampleContainerPublicId) {
	tagmanager = google.tagmanager({version: 'v2', auth: await getOAuth2Client()});
	const testAccount = await getAccountById("38028818");

	console.log("Getting example container...");
	const exampleContainer = await getContainerByAccountAndPublicId(testAccount, exampleContainerPublicId);

	console.log("Getting target container...");
	const targetContainer = await findOrCreateContainer(targetContainerName, targetAccountId);

	console.log("Clearing target workspace...");
	await deleteWorkspace(await getDefaultWorkspaceByContainer(targetContainer));

	console.log("Preparing to clone container entities...");
	await cloneContainerEntities(exampleContainer, targetContainer);
}

async function getContainerByPublicId(publicId) {
	const response = await backOff(() => tagmanager.accounts.list(), backOffOptions);
	const accounts = response.data.account;

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
	console.log("Getting workspaces...");
	const exampleWorkspace = await getDefaultWorkspaceByContainer(exampleContainer);
	const targetWorkspace = await getDefaultWorkspaceByContainer(targetContainer);

	console.log("Getting example entities...");
	const propNames = ['trigger', 'tag', 'variable'];
	const exampleEntities = await Promise.all(propNames.map(prop => getEntityListByWorkspaceAndProperty(exampleWorkspace, prop)));
	//const targetEntities = await Promise.all(propNames.map(prop => getEntityListByWorkspaceAndProperty(targetWorkspace, prop)));

	let triggerMap = {};
	let alreadyAdded = [];
	for (let i = 0; i < 3; i++) {
		console.log("Cloning " + propNames[i] + "s...");
		for (let entity of exampleEntities[i]) {
			for (let setupTag of entity.setupTag?.map(entry => exampleEntities[1].find(tag => tag.name === entry.tagName)) ?? []) {
				await cloneEntity(targetWorkspace, setupTag, propNames[i], triggerMap);
				alreadyAdded.push(setupTag);
			}
			if (!alreadyAdded.includes(entity))
				await cloneEntity(targetWorkspace, entity, propNames[i], triggerMap);
		}
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
	return containers?.find(container => container.publicId === publicId);
}

async function getContainerByAccountAndName(account, targetName) {
	const containers = await getContainerListByAccount(account);
	return containers?.find(container => container.name === targetName);
}

async function getDefaultWorkspaceByContainer(container) {
	const response = await backOff(() => tagmanager.accounts.containers.workspaces.list({parent: container.path}), backOffOptions);
	const workspaces = response.data.workspace;

	return workspaces?.find(workspace => workspace.name === "Default Workspace");
}

async function getEntityListByWorkspaceAndProperty(workspace, property) {
	const response = await backOff(() => tagmanager.accounts.containers.workspaces[property + 's'].list({parent: workspace.path}), backOffOptions);
	return response.data[property];
}

async function createEntity(parent, requestBody, property) {
	const newEntity = await backOff(() => tagmanager.accounts.containers.workspaces[property + 's'].create({
		parent: parent,
		requestBody: requestBody
	}), backOffOptions);
	return newEntity.data;
}

async function cloneEntity(targetWorkspace, entity, property, triggerMap) {
	let requestBody = JSON.parse(JSON.stringify(entity));
	const fieldsToRemove = [
		'accountId',
		'containerId',
		'fingerprint',
		property + 'Id',
		'parentFolderId',
		'path',
		'tagManagerUrl',
		'workspaceId'
	];
	for (let field of fieldsToRemove) {
		requestBody[field] = undefined;
	}

	if (property === 'tag') {
		for (let triggers of ['blockingTriggerId', 'firingTriggerId']) {
			requestBody[triggers] = requestBody[triggers]?.map(id => triggerMap[id]);
		}
	}

	const newEntity = await createEntity(targetWorkspace.path, requestBody, property);
	if (property === 'trigger') {
		triggerMap[entity[property + 'Id']] = newEntity[property + 'Id'];
	}
}

async function deleteWorkspace(workspace) {
	await backOff(() => tagmanager.accounts.containers.workspaces.delete({path: workspace.path}), backOffOptions);
}

cloneExampleContainer("noah api onboarding container", "28458393", "GTM-PNJH2T")
	.then(() => console.log("Done!"))
	.catch(err => console.error(err));