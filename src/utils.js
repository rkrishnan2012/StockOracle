const fs = require('fs');

module.exports.saveObjectToFile = function(object, name, cb) {
    fs.writeFile(name, JSON.stringify(object, 1, 1), cb);
}

module.exports.fileExists = function(name) {
    if (fs.existsSync(name)) {
        return true;
    }
    return false;
}