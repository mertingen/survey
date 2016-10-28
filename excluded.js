var mongoose = require('mongoose');

var Schema = mongoose.Schema;
var excludedSchema = new Schema({
	ip: String,
});

var Excluded = mongoose.model('excluded', excludedSchema);
module.exports = Excluded;