const {google} = require('googleapis');

let oAuth2Client, tagmanager;
const oauth2 = require('./oauth2.js');

async function cloneExampleContainer(targetContainerName, targetAccountId, exampleContainerPublicId) {
	oAuth2Client = await oauth2.getOAuth2Client();
	tagmanager = google.tagmanager({version: 'v2', auth: oAuth2Client});

	const exampleContainer = await getExampleContainerByPublicId(exampleContainerPublicId);
	const targetContainer = await findOrCreateContainer(targetContainerName, targetAccountId);
	await cloneContainerEntities(exampleContainer, targetContainer);
}

async function getAccounts() {
	return (await tagmanager.accounts.list()).data.account;
}

async function getExampleContainerByPublicId(publicId) {
	const accountIds = (await getAccounts()).map((acc) => acc.accountId);
	let containers = [];

	for (let id in accountIds) {
		let path = 'accounts/' + id + '/containers/' + publicId;
		exponentialBackoff(() => {
			containers.push(tagmanager.accounts.containers.get({path: path}));
		});
	}
}

async function findOrCreateContainer(newContainerName, targetAccountId) {

}

async function cloneContainerEntities(exampleContainer, targetContainer) {

}

function exponentialBackoff(request) {
	const msleep = (n) => {
		Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, n);
	};

	for (let i = 0; i < 5; i++) {
		try {
			request();
		} catch(err) {
			msleep(2**i + (Math.random() * 1000));
		}
	}
}

cloneExampleContainer("noah api onboarding container", "28458393", "GTM-PNJH2T")
	.catch(err => {
		console.error(err);
		throw err;
	});