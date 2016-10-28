var mongoose = require('mongoose');

var Schema = mongoose.Schema;
var totalSchema = new Schema({
	yes: Number,
	no: Number
});

var Total = mongoose.model('total', totalSchema);
module.exports = Total;