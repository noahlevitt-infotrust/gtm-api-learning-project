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
	const exampleWorkspace = await getDefaultWorkspaceFromContainer(exampleContainer);
	const targetWorkspace = await getDefaultWorkspaceFromContainer(targetContainer);

	const propNames = ["tag", "variable", "trigger"];
	const exampleEntities = await Promise.all(propNames.map(name => getPropertyListFromWorkspace(exampleWorkspace, name)));
}

async function getAccountById(accountId) {
	const response = await tagmanager.accounts.get({path: 'accounts/' + accountId});
	return response.data;
}

async function getContainerByAccountAndPublicId(account, publicId) {
	const response = await tagmanager.accounts.containers.list({parent: account.path});
	const containers = response.data.container;

	return !containers ? undefined : containers.find(container => container.publicId === publicId);
}

async function getContainerByAccountAndName(account, targetName) {
	const response = await tagmanager.accounts.containers.list({parent: account.path});
	const containers = response.data.container;

	return !containers ? undefined : containers.find(container => container.name === targetName);
}

async function getDefaultWorkspaceFromContainer(container) {
	const response = await tagmanager.accounts.containers.workspaces.list({parent: container.path});
	const workspaces = response.data.workspace;

	return !workspaces ? undefined : workspaces.find(workspace => workspace.name === "Default Workspace");
}

async function getPropertyListFromWorkspace(workspace, property) {
	const response = await tagmanager.accounts.containers.workspaces[property + 's'].list({parent: workspace.path});
	return response.data[property];
}

cloneExampleContainer("noah api onboarding container", "28458393", "GTM-PNJH2T")
	.catch(err => {
		console.error(err);
		throw err;
	});