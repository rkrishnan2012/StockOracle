// Google Finance Example: https://www.google.com/finance/getprices?q=ACN&i=3600&p=3d&f=d,c&df=cpct&auto=0&ei=Ef6XUYDfCqSTiAKEMg
// S&P Constituents: https://raw.githubusercontent.com/datasets/s-and-p-500-companies/master/data/constituents.csv

const csv = require('csv');
const fs = require('fs');
const request = require('request');
const ProgressBar = require('progress');

// [ { symbol: 'CVX', name: 'CHEVRON CORP.', sector: 'ENERGY' }, ...]
getSPCompanyList((spCompanyList) => {
    /*
		'CVX': {
		  timeSeries: 
		  [ { unixTime: 1483110000,
	  		CLOSE: '117.56',
		    HIGH: '117.75',
		    LOW: '117.31',
		    OPEN: '117.44',
		    VOLUME: '497215',
		    CDAYS: '0' }...]}
    */
    downloadAllSPPrices(spCompanyList, (priceList) => {
        console.log(priceList["CVX"]);
        saveObjectToFile(priceList, "../data/_s&pHistoricalMonthly.json", () => {

        });
    })
});

function getSPCompanyList(cb) {
    //	Read the S&P 500 Company list file.
    fs.readFile('../data/s&pConstituents.csv', 'utf8', (err, data) => {
        if (err) {
            console.log(err);
            process.exit(1);
        }
        //	Parse the CSV file.
        csv.parse(data, (err, data) => {
            csv.transform(data, (data) => {
                return data.map((value) => {
                    return value.toUpperCase()
                });
            }, (err, data) => {
                cb(data.slice(1).map((value) => {
                    return {
                        symbol: value[0],
                        name: value[1],
                        sector: value[2]
                    };
                }));
            });
        });
    });
}

function downloadAllSPPrices(spCompanyList, cb) {
    var output = {};
    console.log("Downloading the 1 month historical data of all companies in S&P 500 list.")
    var bar = new ProgressBar(':percent :bar :eta seconds remaining', {
        total: spCompanyList.length
    });

    var rateLimitWait = 0;

    var i = 0;

    console.log(spCompanyList[i]);
    getHistoricalPrices(spCompanyList[i], function getPrice(err, prices) {
        if (err) {
            if (err.code == 'ECONNRESET') {
                console.log("Internet is really bad, re-trying download for " + spCompanyList[i].symbol);
                setTimeout(() => {
                    getHistoricalPrices(spCompanyList[i], getPrice);
                }, rateLimitWait);
            }
        }
        if (!prices) {
            console.log(err);
            console.log("Google is rate-limiting, re-trying download for " + spCompanyList[i].symbol);
            rateLimitWait += 5000;
            //	Rate-limited by google T_T
            setTimeout(() => {
                getHistoricalPrices(spCompanyList[i], getPrice);
            }, rateLimitWait);
            return;
        }
        output[prices.symbol] = {
            ticker: prices.timeSeries,
            name: prices.name
        };
        bar.tick();
        if (bar.complete) {
            cb(output);
        } else {
            setTimeout(() => {
                getHistoricalPrices(spCompanyList[i++], getPrice);
            }, rateLimitWait);
        }
    });
}

function saveObjectToFile(object, name, cb) {
    fs.writeFile(name, object, cb);
}

//	company = { symbol: 'CVX', name: 'CHEVRON CORP.', sector: 'ENERGY' }
function getHistoricalPrices(company, cb) {
    const interval = 3600;
    var timeBefore = Date.now();
    //	Get last 30 days of data at interval of 1 hr for some symbol.
    //	API documentation:  http://www.networkerror.org/component/content/article/1-technical-wootness/44-googles-undocumented-finance-api.html
    const url = 'https://www.google.com/finance/getprices?q=' + company.symbol.toUpperCase() +
        '&i=' + interval + '&p=30d&f=d,c,v,k,o,h,l&df=cpct&auto=0&ei=Ef6XUYfCqSTiAKEMg';
    var options = {
        url: url,
        headers: {
            'User-Agent': 'qqq'
        }
    };
    request(options,
        (error, response, html) => {
            if (error || (response && response.statusCode != 200)) {
                console.log(url);
                //	Ignore connection reset errors.
                if (error && error.code == 'ECONNRESET') {
                    cb(error, null);
                    return;
                }
                if (response) {
                    //	if Google rate-limits, safely ignore.
                    if (response && response.statusCode == 403) {
                        cb(response.body, null);
                        return;
                    } else if(response && response.statusCode == 503) {

                    }
                    console.log("Error: " + url);
                    console.log(response.statusCode);
                    console.log(response.body);
                    return;
                }
                console.log("ERROR");
                console.log(error);
                cb(error, null);
                return;
            }
            var timeAfterDownload = Date.now();
            parseGoogleFinancePrices(company, interval, html, cb);
            var timeAfterProcess = Date.now();
        })
}

//	company = { symbol: 'CVX', name: 'CHEVRON CORP.', sector: 'ENERGY' }
function parseGoogleFinancePrices(company, interval, html, cb) {
    var data = html.split("\n");
    var output = {
        name: company.name,
        symbol: company.symbol,
        timeSeries: []
    };
    var lastAbsTimeStamp = 0;
    for (var i = 0; i < data.length; i++) {
        if (data[i].startsWith("EXCHANGE%3D")) {
            output.exchange = data[i].replace("EXCHANGE%3D", "");
            continue;
        } else if (data[i].indexOf("=") >= 0) {
            var property = data[i].substring(0, data[i].indexOf("=")).toLowerCase();
            var value = data[i].substring(data[i].indexOf("=") + 1);
            if (property == "columns") {
                value = value.split(",");
            }
            output[property] = value;
            continue;
        } else {
            var columns = data[i].split(',');
            if (data[i].startsWith("a")) {
                lastAbsTimeStamp = columns[0].substring(1);
                data[i] = data[i].substring(1);
                columns[0] = 0;
            }
            var timePoint = {
                unixTime: Number(lastAbsTimeStamp) + Number((columns[0] * interval))
            };
            for (var j = 1; j < columns.length; j++) {
                timePoint[output.columns[j]] = columns[j];
            }
            output.timeSeries.push(timePoint);
        }
    }
    cb(null, output);
}