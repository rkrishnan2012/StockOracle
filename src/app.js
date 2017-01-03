// Google Finance Example: https://www.google.com/finance/getprices?q=ACN&i=3600&p=3d&f=d,c&df=cpct&auto=0&ei=Ef6XUYDfCqSTiAKEMg
// S&P Constituents: https://raw.githubusercontent.com/datasets/s-and-p-500-companies/master/data/constituents.csv

const fs = require('fs');

const indicators = require('./indicators.js');
const financeScraper = require('./financeScraper.js');
const utils = require('./utils.js');
const svm = require('./svm.js');

financeScraper.getSPCompanyList((spCompanyList) => {
	var NEEDS_DOWNLOAD_DATA = !utils.fileExists("../data/_s&pHistoricalYearly.json");
    if (NEEDS_DOWNLOAD_DATA) {
        financeScraper.downloadAllSPPrices(spCompanyList, (priceList) => {
            utils.saveObjectToFile(priceList, "../data/_s&pHistoricalYearly.json", () => {
                processData(priceList);
            });
        });
    } else {
        var priceList = require("../data/_s&pHistoricalYearly.json");
        processData(priceList);
    }
});

/*
 *	PriceList has to be an object formatted like such:
 *	{
 *        'CVX': {
 *            timeSeries: [{
 *                unixTime: 1483110000,
 *                CLOSE: '117.56',
 *                HIGH: '117.75',
 *                LOW: '117.31',
 *                OPEN: '117.44',
 *                VOLUME: '497215',
 *                CDAYS: '0'
 *            }...]
 *        },...
 *   }
 */
function processData(priceList) {
    indicators.getTechnicalIndicators(priceList, 24 * 60 * 60, (dailyIndicatorList) => {
    	svm.analyzeData(dailyIndicatorList, () => {

    	});
    });
}