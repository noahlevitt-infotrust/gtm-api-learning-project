const {google} = require('googleapis');

let tagmanager;
const {getOAuth2Client} = require('./oauth2.js');

const msleep = (ms) => new Promise(resolve => {
	setTimeout(resolve, ms);
});

async function cloneExampleContainer(targetContainerName, targetAccountId, exampleContainerPublicId) {
	tagmanager = google.tagmanager({version: 'v2', auth: await getOAuth2Client()});

	const testAccount = await getAccountById("38028818");
	const exampleContainer = await getContainerByAccountAndPublicId(testAccount, exampleContainerPublicId);
	const targetContainer = await findOrCreateContainer(targetContainerName, targetAccountId);

	await cloneContainerEntities(exampleContainer, targetContainer);
}

async function getContainerByPublicId(publicId) {
	const response = await tagmanager.accounts.list();
	const accounts = response.data.account;

	for (let i = 0; i < accounts.length; i++) {
		const container = await getContainerByAccountAndPublicId(accounts[i], publicId);
		if (container)
			return container;
		const ms = 7000;
		await msleep(ms);
	}
	throw "Could not find container.";
}

async function findOrCreateContainer(newContainerName, targetAccountId) {
	const targetAccount = await getAccountById(targetAccountId);
	const existingContainer = await getContainerByAccountAndName(targetAccount, newContainerName);

	if (existingContainer)
		return existingContainer;

	const path = 'accounts/' + targetAccountId;
	const response = await tagmanager.accounts.containers.create({
		parent: path,
		requestBody: {
			name: newContainerName,
			usageContext: ['web']
		}
	});
	return response.data;
}

async function cloneContainerEntities(exampleContainer, targetContainer) {
	const exampleWorkspace = await getDefaultWorkspaceByContainer(exampleContainer);
	const targetWorkspace = await getDefaultWorkspaceByContainer(targetContainer);

	const propNames = ["trigger", "tag", "variable"];
	const exampleEntities = await Promise.all(propNames.map(prop => getPropertyListByWorkspace(exampleWorkspace, prop)));

	for (let trigger of exampleEntities[0]) {
		await tagmanager.accounts.containers.workspaces.triggers.create({
			parent: targetWorkspace.path,
			requestBody: trigger
		});
	}

	for (let tag of exampleEntities[1]) {

	}

	for (let variable of exampleEntities[2]) {
		await tagmanager.accounts.containers.workspaces.variables.create({
			parent: targetWorkspace.path,
			requestBody: variable
		});
	}

	await clearWorkspaceEntities(targetWorkspace);
}

async function getAccountById(accountId) {
	const response = await tagmanager.accounts.get({path: 'accounts/' + accountId});
	return response.data;
}

async function getContainerListByAccount(account) {
	const response = await tagmanager.accounts.containers.list({parent: account.path});
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
	const response = await tagmanager.accounts.containers.workspaces.list({parent: container.path});
	const workspaces = response.data.workspace;

	return !workspaces ? undefined : workspaces.find(workspace => workspace.name === "Default Workspace");
}

async function getPropertyListByWorkspace(workspace, property) {
	const response = await tagmanager.accounts.containers.workspaces[property + 's'].list({parent: workspace.path});
	return response.data[property];
}

async function getPropertyByWorkspaceAndName(workspace, name, property) {
	const entities = await getPropertyListByWorkspace(workspace, property);
	return !entities ? undefined : entities.find(entity => entity.name === name);
}

async function clearWorkspaceEntities(workspace) {
	for (let prop of ["trigger", "tag", "variable"]) {
		const entities = await getPropertyListByWorkspace(workspace, prop);
		if (entities) {
			for (let entity of entities) {
				tagmanager.accounts.containers.workspaces[prop + 's'].delete({path: entity.path});
			}
		}
	}
}

cloneExampleContainer("noah api onboarding container", "28458393", "GTM-PNJH2T")
	.catch(err => {
		console.error(err);
		throw err;
	});