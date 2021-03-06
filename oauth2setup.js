module.exports = {
	getOAuth2Client: getOAuth2Client
};

const fs = require('fs');
const util = require('util');
const readline = require('readline');

const {google} = require('googleapis');

const readFilePromise = util.promisify(fs.readFile);
const writeFilePromise = util.promisify(fs.writeFile);

const SCOPES = [
	'https://www.googleapis.com/auth/tagmanager.manage.accounts',
	'https://www.googleapis.com/auth/tagmanager.edit.containers',
	'https://www.googleapis.com/auth/tagmanager.delete.containers',
	'https://www.googleapis.com/auth/tagmanager.edit.containerversions',
	'https://www.googleapis.com/auth/tagmanager.manage.users',
	'https://www.googleapis.com/auth/tagmanager.publish'
];
const TOKEN_PATH = 'token.json';

async function getOAuth2Client() {
	let creds;
	try {
		creds = await readFilePromise('authkey.json');
	} catch (err) {
		return console.error('Error loading client secret file:', err);
	}

	return authorize(JSON.parse(creds));
}

async function authorize(credentials) {
	const {client_id, client_secret, redirect_uris} = credentials.installed;
	const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);

	let token;
	try {
		token = await readFilePromise(TOKEN_PATH);
	} catch (err) {
		return getNewToken(oAuth2Client);
	}
	oAuth2Client.setCredentials(JSON.parse(token));
	return oAuth2Client;
}

async function getNewToken(oAuth2Client) {
	const getTokenPromise = (code) => {
		return new Promise((resolve, reject) => {
			oAuth2Client.getToken(code, (err, token) => {
				if (err) return reject(err);
				resolve(token);
			});
		});
	};

	const authUrl = oAuth2Client.generateAuthUrl({
		access_type: 'offline',
		scope: SCOPES,
	});
	console.log('Authorize this app by visiting this url:', authUrl);

	const rl = readline.createInterface({
		input: process.stdin,
		output: process.stdout,
	});
	const questionPromise = (question) => {
		return new Promise(resolve => {
			rl.question(question, answer => {
				resolve(answer);
			});
		});
	};

	const code = await questionPromise("Enter the code from that page here: ");
	rl.close();

	let token;
	try {
		token = await getTokenPromise(code);
	} catch (err) {
		return console.error('Error retrieving access token:', err);
	}

	oAuth2Client.setCredentials(token);
	try {
		await writeFilePromise(TOKEN_PATH, JSON.stringify(token));
	} catch (err) {
		return console.error('Error writing to', TOKEN_PATH, err);
	}
	console.log('Token stored to', TOKEN_PATH);

	return oAuth2Client;
}