//gerekli modüller dahil ediliyor.
const express = require('express');
const path = require('path');
const app = new express();
const http = require('http').Server(app);
const io = require('socket.io')(http);
const mongoose = require('mongoose');
const config = require('./config.js');
//css, js gibi static dosyalar public dizini altında, onlar set ediliyor.
app.use(express.static(path.join(__dirname, '/public')));

//mongoose bluebird promise deprecated olduğu için ES6 promise kullanmasını söylüyorum.
mongoose.Promise = global.Promise;

//mongodb endpoint bağlantı sağlanıyor.
mongoose.connect(config.dbUrl);
//mongodb bağlantısı nesnesi alınıyor.
var db = mongoose.connection;

//mongodb bağlantısı gerçekleşirse ekrana yazdırılıyor.
db.once('open', () => {
	console.log('Db connected!');
});

//şemalar set ediliyor.
var Total = require('./schemas/total.js');
var Excluded = require('./schemas/excluded.js');

//eğer / get isteği atılırsa, index.html yükletiliyor.
app.get('/', (req, res) => {
	res.sendFile(__dirname + '/index.html');
});

//kullanılan değişkenlere default değerler set ediliyor.
var yesCounter = 0;
var noCounter = 0;
var total = 0;
var clientIp = '';

//socket.io connection event'i gerçekleşirse yapılacaklar.
io.on('connection', (socket) => {
	//bağlanılar kullanıcının ip addresi alınıyor.
	clientIp = socket.request.connection.remoteAddress;

	//eğer bu ip adresi mongodb'de kayıtlı ise oy kullanamıyor.
	//bunun için arayüze kullanabilir/kullanamaz şeklinde değer gönderiliyor.
	checkIp(clientIp, (isValidIp) => {
		if (!isValidIp){
			socket.emit('isVoter', false);
		}else {
			socket.emit('isVoter', true);
		}
	});


	//mongodb şu ana kadar kullanılmış oylar arayüze gönderiliyor.
	Total.findOne({}, (err, doc) => {
		if (doc.yes && doc.no){
			yesCounter = doc.yes;
			noCounter = doc.no;
			total = doc.yes + doc.no;
		}

		io.sockets.emit('validYes', {yesCounter:yesCounter, total:total});
		io.sockets.emit('validNo', {noCounter:noCounter, total:total});
	});

	//eğer evet oyu kullanılırsa yapılacaklar
	socket.on('dataYes', (data) => {

		//eğer kullanıcının ip adresi mongodb kayıtlı ise oy kullanamıyor
		checkIp(clientIp, (isValidIp) => {
			if (!isValidIp){
				console.log('KULLANAMAZSIN!');
			}else if (data) {
				++yesCounter;
				++total;
				//oy kullandıktan sonra kullanıcının oyu gerekli kolon bulunup update ediliyor yani 1 artıyor.
				Total.findOneAndUpdate({}, {$set:{yes:yesCounter}}, {new: true}, function(err, doc){
					//kullanıcının ip'si kayıt ediliyor.
					saveIp(clientIp, (isSaved) => {
						if (isSaved) {
							io.sockets.emit('validYes', {yesCounter:yesCounter, total:total});
							socket.emit('isVoter', false);
						}
					})

				});
			}
		});
	});

	//hayır oyu kullanılırsa yapılacaklar
	socket.on('dataNo', (data) => {

		//eğer kullanıcının ip adresi mongodb kayıtlı ise oy kullanamıyor
		checkIp(clientIp, (isValidIp) => {
			if (!isValidIp){
				console.log('KULLANAMAZSIN!');
			} else if (data) {
				++noCounter;
				++total;

				//oy kullandıktan sonra kullanıcının oyu gerekli kolon bulunup update ediliyor yani 1 artıyor.
				Total.findOneAndUpdate({}, {$set:{no:noCounter}}, {new: true}, function(err, doc){
					//kullanıcının ip'si kayıt ediliyor.
					saveIp(clientIp, (isSaved) => {
						if (isSaved){
							io.sockets.emit('validNo', {noCounter:noCounter, total:total});
							socket.emit('isVoter', false);
						}
					})
				});
			}
		});
	});

	//kullanıcı bağlantıyı kopardığında yapılacaklar.
	socket.on('disconnect', () => {
		console.log('Exit.')
	});
});

//kullanıcının ipsini kontrol eden fonksiyon
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

//kullanıcının ipsini kayıt eden fonksiyon
function saveIp(clientIp, callback) {
	var ip = new Excluded({ ip: clientIp });
	ip.save( (err, isSaved) => {
		if (err) throw err;
		callback(isSaved._id);
	});
}

//basit bir web server çalıştırıyor, 8081 portundan her yerden erişilebiliyor.
http.listen(8081, '0.0.0.0', () => {
	console.log("0.0.0.0:8081 dinleniyor...");
});
