const fs = require('fs');
const axios = require('axios');
const readline = require('readline');
const base64 = require('base-64');

const configFilePath = './config.json';
let config = {};

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function prompt(question) {
  return new Promise(resolve => {
    rl.question(question, answer => resolve(answer));
  });
}

async function setupFunction() {
  const setupToken = await prompt('SimpleFin Setup Token? ');
  const claimUrl = base64.decode(setupToken);
  const response = await axios.post(claimUrl);
  const accessUrl = response.data;

  const appriseUrl = await prompt('Apprise URL? (leave blank to skip) ');
  const appriseTag = await prompt('Apprise Tag? (leave blank to skip) ');

  config = {
    access_url: accessUrl,
    apprise_url: appriseUrl,
    apprise_tag: appriseTag
  };

  fs.writeFileSync(configFilePath, JSON.stringify(config));
}

async function sendViaApprise(appriseUrl, tag, content) {
  const payload = `body=${content}&tag=${tag}`;
  await axios.post(appriseUrl, payload, {
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    }
  });
}

function listToString(lst) {
  return lst && lst.length ? lst.join(' ') : false;
}

async function main() {
  if (fs.existsSync(configFilePath)) {
    config = JSON.parse(fs.readFileSync(configFilePath, 'utf8'));
  } else {
    await setupFunction();
  }

  if (!config.access_url) {
    await setupFunction();
  }

  const [scheme, rest] = config.access_url.split('//');
  const [auth, restUrl] = rest.split('@');
  const url = `${scheme}//${restUrl}/accounts`;
  const [username, password] = auth.split(':');

  const startDate = new Date('2023-11-01');
  const endDate = new Date('2023-11-02');
  const startUnixtime = Math.floor(startDate.getTime() / 1000);
  const endUnixtime = Math.floor(endDate.getTime() / 1000);

  try {
    const response = await axios.get(url, {
      auth: { username, password },
      params: { 'start-date': startUnixtime, 'end-date': endUnixtime }
    });

    const data = response.data;
    const errors = data.errors;
    const errorString = listToString(errors);

    if (errorString) {
      console.log(errorString);
      if (config.apprise_url) {
        await sendViaApprise(config.apprise_url, config.apprise_tag, errorString);
      }
    } else {
      console.log('No SimpleFin Accounts in Error State');
      if (config.apprise_url) {
        await sendViaApprise(config.apprise_url, config.apprise_tag, 'No SimpleFin Accounts in Error State');
      }
    }
  } catch (error) {
    console.error('Error fetching data:', error);
  }
}

main().then(() => rl.close());
