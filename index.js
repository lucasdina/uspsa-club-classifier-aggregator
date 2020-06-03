let request = require('request');
let cheerio = require('cheerio');
let classifiers = require('./json/classifier');
let clubs = require('./json/club');
const express = require('express');
const app = express();
const handlebars = require('express-handlebars');
const port = 3000;
let classifierMap = {};

app.set('view engine', 'hbs');
app.engine('hbs', handlebars({
    layoutsDir: __dirname + '/views/layouts',
    extname: 'hbs'
}));
app.use(express.static('public'));

app.get('/', async function (req, res) {
    // let clubCodes = ['ID07', 'ID08', 'ID03'];
    let clubCodes = req.query.clubIds;
    let lookBack = req.query.lookBack;
    if (!lookBack) {
        lookBack = (60 * 60 * 24 * 30 * 6);
    }
    if (!clubCodes || clubCodes.length === 0) {
        res.render('main', {
            layout: 'index',
            cleanClassifiers: {},
            clubs: clubs,
            lookBack: lookBack,
            selectedClubs: JSON.stringify(clubCodes)
        });
    } else {
        if (typeof clubCodes === 'string') {
            clubCodes = [clubCodes];
        }
        let cleanClassifiers = await getCleanClassifiers(clubCodes, lookBack);
        // let cleanClassifiers = {};
        res.render('main', {
            layout: 'index',
            cleanClassifiers: cleanClassifiers,
            clubs: clubs,
            lookBack: lookBack,
            selectedClubs: JSON.stringify(clubCodes)
        });
    }
});

app.listen(port, () => console.log(`App listening to port ${port}`));

let getCleanClassifiers = async function (clubCodes, lookBack) {
    return new Promise((resolve, reject) => {
        classifierMap = {};
        let currentDate = Math.round((new Date()).getTime() / 1000);
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

