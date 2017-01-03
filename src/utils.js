module.exports.saveObjectToFile = function(object, name, cb) {
    fs.writeFile(name, JSON.stringify(object, 1, 1), cb);
}
