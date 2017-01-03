/*
 *  Calculate the daily technical indicators:
 *  PriceList has to be an object formatted like such:
 *  {
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
module.exports.getTechnicalIndicators = function(priceList, intervalSecs, cb) {
    for (var symbol in priceList) {
        var prevDaySec = -1;
        var LL = Number(priceList[symbol].ticker[0]["LOW"]);
        var HH = Number(priceList[symbol].ticker[0]["HIGH"]);
        var dayNum = 0;
        priceList[symbol].indicators = [];
        for (var i = 0; i < priceList[symbol].ticker.length; i++) {
            var todaySec = priceList[symbol].ticker[i].unixTime;
            var todayLow = Number(priceList[symbol].ticker[i]["LOW"]);
            var todayHigh = Number(priceList[symbol].ticker[i]["HIGH"]);
            var todayClose = Number(priceList[symbol].ticker[i]["CLOSE"]);
            if (todaySec - prevDaySec > intervalSecs) {
                if (todayLow < LL) {
                    LL = todayLow;
                }
                if (todayHigh > HH) {
                    HH = todayHigh;
                }
                var indicator = {
                    unixTime: todaySec,
                    dayNumber: dayNum,
                    close: todayClose,
                    ll: LL,
                    hh: HH
                };

                priceList[symbol].indicators.push(indicator);
                //	Depends on above indicators	
                priceList[symbol].indicators[dayNum].stochasticK3 = getStochasticK(priceList[symbol].indicators, dayNum, 4);
                priceList[symbol].indicators[dayNum].momentum = getMomentum(priceList[symbol].indicators, dayNum, 4);
                priceList[symbol].indicators[dayNum].rateOfChange = getRateOfChange(priceList[symbol].indicators, dayNum, 4);
                priceList[symbol].indicators[dayNum].williamsR = getWilliamsR(priceList[symbol].indicators, dayNum, 4);
                priceList[symbol].indicators[dayNum].adOscillator = getADOscillator(priceList[symbol].indicators, dayNum);
                priceList[symbol].indicators[dayNum].disparity5 = getDisparity5(priceList[symbol].indicators, dayNum);
                //	Depends on Stochastic K3
                priceList[symbol].indicators[dayNum].stochasticD3 = getStochasticD(priceList[symbol].indicators, dayNum, 4);

                dayNum++;
                prevDaySec = todaySec;
            }
        }
    }
    cb(priceList);
}

/**
 * indicatorList: an ordered list like this:
 *		  [{
 *		       unixTime: 1483030800,
 *		       dayNumber: 29,
 *		       ll: '37.245',
 *		       hh: '44.15',
 *		   }, {
 *		       unixTime: 1483120800,
 *		       dayNumber: 30,
 *		       ll: '37.245',
 *		       hh: '44.15',
 *		   }]
 *		 with at least close, ll, and hh.
 * dayNumber: the day at which to perform the calculation (starting at 0)
 * n: number of days to look back
 */
function getStochasticK(indicatorList, dayNumber, n) {
    var Ct = indicatorList[dayNumber].close;
    var LLn = indicatorList[dayNumber].ll,
        HHn = indicatorList[dayNumber].hh;
    //	Calculate lowest low and highest high of last K days.
    for (var i = dayNumber;
        (i >= 0 && i > dayNumber - n); i--) {
        if (indicatorList[i].ll < LLn) {
            LLn = indicatorList[i].ll;
        }
        if (indicatorList[i].hh > HHn) {
            HHn = indicatorList[i].hh;
        }
    }
    //	Stochastic %K = (Ct - LLn) / (HHn - LLn)
    return (Ct - LLn) / (HHn - LLn);
}

/**
 * Depends on StochasticK3 of previous days.
 * dayNumber: the day at which to perform the calculation (starting at 0)
 * n: number of days to look back
 */
function getStochasticD(indicatorList, dayNumber, n) {
    var sum = 0, numDays = 0;
    //	Calculate lowest low and highest high of last K days.
    for (var i = dayNumber;
        (i >= 0 && i > dayNumber - n); i--) {
        sum += indicatorList[i].stochasticK3;
    	numDays++;
    }
    //	Stochastic %D = Average of last n days of stochastic K
    return sum / numDays;
}

/**
 * Depends on closing price of today and n days ago.
 * dayNumber: the day at which to perform the calculation (starting at 0)
 * n: number of days to look back
 */
function getMomentum(indicatorList, dayNumber, n) {
    if(dayNumber >= n) {
    	return indicatorList[dayNumber].close - indicatorList[dayNumber - n].close;
    } else {
    	return 0;
    }
}

/**
 * Depends on closing price of today and n days ago.
 * dayNumber: the day at which to perform the calculation (starting at 0)
 * n: number of days to look back
 */
function getRateOfChange(indicatorList, dayNumber, n) {
    if(dayNumber >= n) {
    	return (100 * indicatorList[dayNumber].close) / (indicatorList[dayNumber - n].close);
    } else {
    	return 0;
    }
}

/**
 * Depends on close, ll, and hh of the last n days.
 * dayNumber: the day at which to perform the calculation (starting at 0)
 * n: number of days to look back
 */
function getWilliamsR(indicatorList, dayNumber, n) {
	var Ct = indicatorList[dayNumber].close;
    var LLn = indicatorList[dayNumber].ll,
        HHn = indicatorList[dayNumber].hh;
    //	Calculate lowest low and highest high of last K days.
    for (var i = dayNumber;
        (i >= 0 && i > dayNumber - n); i--) {
        if (indicatorList[i].ll < LLn) {
            LLn = indicatorList[i].ll;
        }
        if (indicatorList[i].hh > HHn) {
            HHn = indicatorList[i].hh;
        }
    }
    //	Williams %R = 100 * (HHn - Ct) / (HHn - LLn)
    return 100 * (HHn - Ct) / (HHn - LLn);
}

/**
 * Depends on close, ll, and hh of today and yesterday.
 * dayNumber: the day at which to perform the calculation (starting at 0)
 */
function getADOscillator(indicatorList, dayNumber) {
    if(dayNumber >= 1) {
    	var Ct1 = indicatorList[dayNumber - 1].close;
    	var LLt = indicatorList[dayNumber].ll,
        HHt = indicatorList[dayNumber].hh;
        //	A/D Oscillator = (HHt - C_t-1) / (HHt - LLt)
    	return (HHt - Ct1) / (HHt - LLt);
    } else {
    	return 0;
    }
}


/**
 * Depends on closing price of last 5 days
 * dayNumber: the day at which to perform the calculation (starting at 0)
 */
function getDisparity5(indicatorList, dayNumber) {
    if(dayNumber >= 5) {
    	var Ct = indicatorList[dayNumber].close;
    	var sum = 0;
    	var numDays = 0;
    	//	Calculate lowest moving average for last 5 days.
	    for (var i = dayNumber;
	        (i >= 0 && i > dayNumber - 5); i--) {
	        sum += indicatorList[i].close;
	    	numDays++;
	    }
	    var MA = (sum / numDays);
	    //	Disparity 5 = today's closing price * 100 / moving average of 5 days
	    return (100 * Ct / MA);
    } else {
    	return 0;
    }
}