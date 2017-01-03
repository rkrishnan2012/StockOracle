const svm = require('node-svm');
const so = require('stringify-object');
const ProgressBar = require('progress');

module.exports.analyzeData = function(dailyIndicatorList) {
    var training = [];
    var testing = [];

    var symbols = [];
    var names = [];
    var i = 0;

    for (var symbol in dailyIndicatorList) {
        if (dailyIndicatorList[symbol].indicators.length > 0) {
            training.push([]);
            testing.push([]);
            symbols.push(symbol);
            names.push(dailyIndicatorList[symbol].name);
            for (var dayNumber = 0; dayNumber < dailyIndicatorList[symbol].indicators.length - 30; dayNumber++) {
                var xi = [];
                for (var indicator in dailyIndicatorList[symbol].indicators[dayNumber]) {
                    xi.push(dailyIndicatorList[symbol].indicators[dayNumber][indicator]);
                }
                training[i].push([xi, (dailyIndicatorList[symbol].indicators[dayNumber + 1].close - dailyIndicatorList[symbol].indicators[dayNumber].close) > 0 ? 1 : 0]);
            }

            for (var dayNumber = dailyIndicatorList[symbol].indicators.length - 30; dayNumber < dailyIndicatorList[symbol].indicators.length - 1; dayNumber++) {
                var xi = [];
                for (var indicator in dailyIndicatorList[symbol].indicators[dayNumber]) {
                    xi.push(dailyIndicatorList[symbol].indicators[dayNumber][indicator]);
                }
                testing[i].push([xi, dailyIndicatorList[symbol].indicators[dayNumber].close]);
            }
            i++;
        }
    }

    i = 0;
    var highestSymbol = "";
    var highestFScore = 0;
    var highestReport;
    var highestIdx = 0;
    var bestModel;

    var bar = new ProgressBar('Training - :percent :bar :eta seconds remaining', {
        total: training.length
    });

    function trainNext() {
        bar.tick();
        var clf = new svm.SVM({
            svmType: 'C_SVC',
            c: [10, 20, 30],

            // kernels parameters 
            kernelType: 'RBF',
            gamma: [1, 3, 5, 7],

            // training options 
            kFold: 3,
            normalize: true,
            reduce: true,
            retainedVariance: 0.99,
            eps: 1e-3,
            cacheSize: 1024,
            shrinking: true,
            probability: true
        });
        clf.train(training[i]).progress(function(progress) {

        }).spread(function(model, report) {
            if (report.fscore > highestFScore) {
                highestFScore = report.fscore;
                highestSymbol = names[i];
                highestReport = report;
                highestIdx = i;
                bestModel = model;
                //console.log("Current highest fscore is " + highestFScore + " by " + highestSymbol);
            }
            i++;
            if (i == training.length) {
                console.log("Done training against " + i + " companies. Highest fscore is " + highestFScore + " by " + highestSymbol);
                console.log(highestReport);
                predictGains(svm, bestModel, names[highestIdx], testing[highestIdx]);
            } else {
                trainNext();
            }
        });
    }

    trainNext();

}

function predictGains(svm, model, name, testSet) {
    console.log("Predicting the gains for the test set on " + name);
    var clf = svm.restore(model);
    var money = 1000;
    var shares = 0;
    var bought = 0;
    var sold = 0;
    for (var day = 0; day < testSet.length - 1; day++) {
        //	Tomorrow stocks will go up babyyyy
        var p = clf.predictProbabilitiesSync(testSet[day][0]);
        var buy = (p[1] > p[0]);
        var sell = (p[0] > p[1]);
        if (buy) {
            if (money > testSet[day][1]) {
            	console.log("Buying with confidence " + p[1] + ".");
            	if(testSet[day+1][1] > testSet[day][1]) {
            		console.log("	Good buy. Gains = $" + (testSet[day+1][1] - testSet[day][1]));
            	} else {
            		console.log("	Bad buy. Loss = $" + (testSet[day+1][1] - testSet[day][1]));
            	}
                money -= testSet[day][1];
                shares ++;
                bought ++;
            }
        } else if(sell) {
            if (shares > 0) {
            	console.log("Selling with confidence " + p[0] + ".");
            	if(testSet[day][1] > testSet[day+1][1]) {
            		console.log("	Good sell. Gains = $" + (testSet[day][1] - testSet[day+1][1]));
            	} else {
            		console.log("	Bad sell. Loss = $" + (testSet[day][1] - testSet[day+1][1]));
            	}
                money += testSet[day][1];
                shares--;
                sold++;
            }
        }
    }

    //	Sell whatever is at the end.
    while (shares > 0) {
        money += testSet[testSet.length - 1][1];
        shares--;
        sold++;
    }
    
    console.log("Gains after " + testSet.length + " days is $" + (money - 1000) + ". Traded " + bought + " total.");
}