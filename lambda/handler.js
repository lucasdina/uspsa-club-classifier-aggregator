'use strict';
let request = require('request');
let cheerio = require('cheerio');
let classifiers = require('./json/classifier');
let clubs = require('./json/club');
let classifierMap = {};

module.exports.getFreshClassifiers = async function (event, context, callback) {
  let response = {
    statusCode: 200,
    headers: {
      'Access-Control-Allow-Origin': '*', // Required for CORS support to work
      'Content-Type': 'application/json'
    }
  };
  // let clubCodes = ['ID07', 'ID08', 'ID03'];
  let clubCodes = event['multiValueQueryStringParameters']['clubIds'];
  let lookBack = event['multiValueQueryStringParameters']['lookBack'];
  if (!clubCodes || clubCodes.length === 0) {
    response.body = JSON.stringify({});
  } else {
    if (typeof clubCodes === 'string') {
      clubCodes = [clubCodes];
    }
    response.body = JSON.stringify(await getCleanClassifiers(clubCodes, lookBack));
  }

  callback(null, response);
};

let getCleanClassifiers = async function (clubCodes, lookBack) {
  return new Promise((resolve, reject) => {
    classifierMap = {};
    let currentDate = Math.round((new Date()).getTime());
    let promises = [];
    clubCodes.forEach(code => {
      promises.push(getClubClassifiers(code));
    });
    Promise.all(promises).then(() => {
      let usedClassifiers = [];
      let cleanClassifiers = [];
      for (let i in classifierMap) {
        classifierMap[i].forEach(item => {
          let dateDiff = (currentDate - item.date);
          if (dateDiff < lookBack && !usedClassifiers.includes(item.id)) {
            usedClassifiers.push(item.id);
          }
        })
      }
      classifiers.forEach(classifier => {
        if (!usedClassifiers.includes(classifier.classifier)) {
          cleanClassifiers.push(classifier);
        }
      });
      console.log('classifiers total: ', classifiers.length);
      console.log('used classifiers: ', usedClassifiers.length);
      console.log('clean classifiers: ', cleanClassifiers.length);
      resolve(cleanClassifiers);
    });
  });
}

let getClubClassifiers = async function (clubCode) {
  return new Promise((resolve, reject) => {
    request({
      'method': 'GET',
      'url': `https://uspsa.org/classifiers-by-club?action=show&club=${clubCode}`,
    }, function (error, response) {
      let objectsToPush = [];
      if (error) throw new Error(error);
      let $ = cheerio.load(response.body);
      let rows = $("body > div:nth-child(10) > div > div > div > div > table > tbody > tr");
      rows.each((index, element) => {
        objectsToPush.push({
          id: $($(element).find('td')[0]).text(),
          date: Date.parse($($(element).find('td')[2]).text())
        });
      });
      classifierMap[clubCode] = objectsToPush;
      console.log('total run classifiers: ', objectsToPush.length);
      resolve({});
    });
  });
};
