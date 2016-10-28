const express = require('express');
const path = require('path');
const app = new express();
const http = require('http').Server(app);
const io = require('socket.io')(http);
const mongoose = require('mongoose');

app.use(express.static(path.join(__dirname, '/public')));

mongoose.Promise = global.Promise;
mongoose.connect('mongodb://user:user@ds047581.mlab.com:47581/survey');
var db = mongoose.connection;
var Total = require('./schemas/total.js');
var Excluded = require('./schemas/excluded.js');

db.once('open', () => {
	console.log('Db connected!');
});


app.get('/', (req, res) => {
	res.sendFile(__dirname + '/index.html');
});

var yesCounter = 0;
var noCounter = 0;
var total = 0;
var clientIp = '';
io.on('connection', (socket) => {

	clientIp = socket.request.connection.remoteAddress;

	checkIp(clientIp, (isValidIp) => {
		if (!isValidIp){
			socket.emit('isVoter', false);
		}else {
			socket.emit('isVoter', true);
		}
	});

	Total.findById('58125fb6ba8bd09f49a049ce', (err, doc) => {
		yesCounter = doc.yes;
		noCounter = doc.no;
		total = doc.yes + doc.no;

		io.sockets.emit('validYes', {yesCounter:yesCounter, total:total});
		io.sockets.emit('validNo', {noCounter:noCounter, total:total});
	});

	socket.on('dataYes', (data) => {

		checkIp(clientIp, (isValidIp) => {
			if (!isValidIp){
				console.log('KULLANAMAZSIN!');
			}else if (data) {
				++yesCounter;
				++total;

				Total.findOneAndUpdate({_id: '58125fb6ba8bd09f49a049ce'}, {$set:{yes:yesCounter}}, {new: true}, (err, doc) => {
					if(err){
						throw err;
					}

					var ip = new Excluded({ ip: clientIp });
					ip.save( (err) => {
						if (err) throw err;
					});

					io.sockets.emit('validYes', {yesCounter:yesCounter, total:total});
					socket.emit('isVoter', false);

				});
			}
		});
	});

	socket.on('dataNo', (data) => {
		checkIp(clientIp, (isValidIp) => {
			if (!isValidIp){
				console.log('KULLANAMAZSIN!');
			} else if (data) {
				++noCounter;
				++total;

				Total.findOneAndUpdate({_id: '58125fb6ba8bd09f49a049ce'}, {$set:{no:noCounter}}, {new: true}, function(err, doc){
					if(err){
						throw err;
					}
					var ip = new Excluded({ ip: clientIp });
					ip.save( (err) => {
						if (err) throw err;
					});
					io.sockets.emit('validNo', {noCounter:noCounter, total:total});
					socket.emit('isVoter', false);
				});
			}
		});
	});

	socket.on('disconnect', () => {
		console.log('Exit.')
	});
});

function checkIp(clientIp, callback) {
	Excluded.findOne({ip: clientIp}, (err,obj) => { 
		if (err) throw err;
		if (obj){
			callback(false);
		} else {
			callback(true);
		}
	});
}

http.listen(8081, '0.0.0.0', () => {
	console.log("0.0.0.0:8081 dinleniyor...");
});
