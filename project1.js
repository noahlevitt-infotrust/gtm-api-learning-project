const {google} = require('googleapis');

let oAuth2Client, tagmanager;
const oauth2 = require('./oauth2.js');

const msleep = (ms) => new Promise(resolve => {
	setTimeout(resolve, ms);
});

async function cloneExampleContainer(targetContainerName, targetAccountId, exampleContainerPublicId) {
	oAuth2Client = await oauth2.getOAuth2Client();
	tagmanager = google.tagmanager({version: 'v2', auth: oAuth2Client});

	const testAccountId = "38028818";
	const exampleContainer = await getContainerByAccountAndPublicId(testAccountId, exampleContainerPublicId);
	const targetContainer = await findOrCreateContainer(targetContainerName, targetAccountId);
	await cloneContainerEntities(exampleContainer, targetContainer);
}

async function getAccounts() {
	return (await tagmanager.accounts.list()).data.account;
}

async function getContainerByPublicId(publicId) {
	const accountIds = (await getAccounts()).map(acc => acc.accountId);
	for (let i = 0; i < accountIds.length; i++) {
		const container = await getContainerByAccountAndPublicId(accountIds[i], publicId);
		if (container)
			return container;
		const ms = 7000;
		await msleep(ms);
	}
	throw "Could not find container.";
}

async function getContainerByAccountAndPublicId(accountId, publicId) {
	const path = 'accounts/' + accountId;
	const response = await tagmanager.accounts.containers.list({parent: path});
	const containers = response.data.container;

	return !containers ? undefined : containers.find(container => container.publicId === publicId);
}

async function getContainerByAccountAndName(accountId, targetName) {
	const path = 'accounts/' + accountId;
	const response = await tagmanager.accounts.containers.list({parent: path});
	const containers = response.data.container;

	return !containers ? undefined : containers.find(container => container.name === targetName);
}

async function findOrCreateContainer(newContainerName, targetAccountId) {
	const existingContainer = await getContainerByAccountAndName(targetAccountId, newContainerName);

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

}

cloneExampleContainer("noah api onboarding container", "28458393", "GTM-PNJH2T")
	.catch(err => {
		console.error(err);
		throw err;
	});