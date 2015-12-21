var request = require('request');
var access_token = '';
var WebSocket = require('ws');
var fs = require('fs');
var parseString = require('xml2js').parseString;
var ws;
var ws = new WebSocket('ws://chat.goodgame.ru:8081/chat/websocket');
var interval = {uptime: 0, next: 0, ask: 0};
var channel_id = '41677';
var nextMsgs = ['Через 30 минут', 'Через полчаса', 'https://www.youtube.com/watch?v=SsduG34ntgM'];
var askMsgs = ['Можешь быть уверен в этом', 'По моим данным — «нет»', 'Бесспорно', 'Весьма сомнительно', 'Мой ответ — «нет»', 'Спроси позже', 'Да', 'Вероятнее всего', 'Никаких сомнений', 'Пока не ясно, попробуй снова', 'Мне кажется — «да»', 'Знаки говорят — «да»', 'Даже не думай', 'Перспективы не очень хорошие', 'Хорошие перспективы', 'Сконцентрируйся и спроси опять'];
ws.on('message', function(data, flags) {
	console.log(data);
	var data = JSON.parse(data);
	if(data.type == "success_auth")
		loggedIn();
	if(data.type == "message")
		handleMessage(data.data);
	if(data.type == "premium")
		sendMsg("Добро пожаловать, "+data.data.userName+"! :squirrel:");
	if(data.type == "user_ban")
		handleBan(data.data);
});

var cmdMsgs = {vk: 'https://vk.com/mad_streams', yt: 'http://youtube.com/madgostream', inst: 'https://www.instagram.com/mafakkamadd/', games: 'https://bit.ly/maddygames'};
var g_timeout = 15;

ws.on('open', function() {
	request.post({url: "http://goodgame.ru/ajax/chatlogin/"})
	request.post({url:'http://goodgame.ru/ajax/chatlogin/', form: {login:'hamedbot', password: ""}}, function(err,httpResponse,body){
		body = JSON.parse(body);
		ws.send(JSON.stringify({type:'auth', data: {user_id: "562464", token: body.token}}));
	});
});

process.on('uncaughtException', function(err) { console.log(err.stack) });

function loggedIn() {
	ws.send(JSON.stringify({type:'join', data: {channel_id: channel_id}}));
} 

function handleBan(data) {
	fs.appendFile("bans.csv", JSON.stringify(data), function(err) {});
}

function nextStream(callback) {
	var temp = Math.round(new Date().getTime()/1000);
	if((temp - interval['next']) < g_timeout)
		return;
	var index = getRandomInt(0,2);
	userInfo(function(err,body) {
		if(err)
			return;
		body = JSON.parse(body)["41677"];
		temp = Math.round(new Date().getTime()/1000);
		interval['next'] = temp;
		if(body.status == 'Live') {
			callback("Стрим уже идет :fp:");
			return;
		}
		callback(nextMsgs[index]);
	});
}

function ask() {
	var answer = askMsgs[getRandomInt(0, askMsgs.length-1)];
	return answer;
}

function getRandomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function sendMsg(msg) {
	ws.send(JSON.stringify({type:'send_message', data: {channel_id: channel_id, text: msg}}));
}

function getUptime(callback) {
	var temp = Math.round(new Date().getTime()/1000);
	if((temp - interval.uptime) < g_timeout)
		return;
	userInfo(function(err,body) {
		if(err)
			return;
		body = JSON.parse(body)["41677"];
		temp = Math.round(new Date().getTime()/1000);
		interval.uptime = temp;
		if(body.status != 'Live') {
			callback("Cтрима ещё нет :fp:");
			return;
		}
		request('http://hls.goodgame.ru/dash/41677/index.mpd?time='+new Date().getTime(), function(err,coode,body){
			parseString(body, function (err, result) {
			   	//callback(result.MPD.$.availabilityStartTime);
			   	var d = new Date();
				d.setTime(Date.parse(result.MPD.$.availabilityStartTime));
				var startTime = Math.round(d.getTime()/1000);
				var curTime = Math.round(new Date().getTime()/1000);
				callback('Стрим идет уже '+(curTime-startTime).toString().toHHMMSS());
			});
		});
	});
}

function userInfo(callback) {
	request('http://goodgame.ru/api/getchannelstatus?id=ilyamaddyson&fmt=json', function(err,coode,body){
		callback(err,body);
	});
} 

function handleMessage(data) {
	if(data.text == "!up") {
		getUptime(function(time) {
			sendMsg(time);
		});
	} else if(data.text == "!next") {
		nextStream(function(msg) {
			sendMsg(msg);
		});
	} else if(data.text.split(' ')[0] == "!ask") {
		var temp = Math.round(new Date().getTime()/1000);
		if((temp - interval['ask']) < g_timeout)
			return;
		interval['ask'] = temp;
		sendMsg(ask());
	} else if(data.text.split(' ')[0] == "!pick") {
		var options = data.text.replace('!pick','').split(',');
		sendMsg(options[getRandomInt(0, options.length-1)].trim());
	} else if(data.text.replace('!','') in cmdMsgs) {
		sendMsg(cmdMsgs[data.text.replace('!','')]);
	}
}

String.prototype.toHHMMSS = function () {
    var sec_num = parseInt(this, 10); // don't forget the second param
    var hours   = Math.floor(sec_num / 3600);
    var minutes = Math.floor((sec_num - (hours * 3600)) / 60);
    var seconds = sec_num - (hours * 3600) - (minutes * 60);

    if (hours   < 10) {hours   = "0"+hours;}
    if (minutes < 10) {minutes = "0"+minutes;}
    if (seconds < 10) {seconds = "0"+seconds;}
    var time    = hours+':'+minutes;
    return time;
}

process.stdin.resume();
