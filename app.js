'use strict';

require('dotenv').config();

const express = require('express');
const app = express();

const fs = require('fs');
const path = require('path');
const HttpDispatcher = require('httpdispatcher');
const TranscriptionService = require('./class/transcription-service');

const dispatcher = new HttpDispatcher();
const server = require('http').Server(app);
const io = require('socket.io')(server);


function log(message, ...args) {
    console.log(new Date(), message, ...args);
}

dispatcher.onPost('/media', function(req,res) {
    log('POST TwiML');
  
    var filePath = path.join(__dirname+'/templates', 'streams.xml');
    var stat = fs.statSync(filePath);
  
    res.writeHead(200, {
        'Content-Type': 'text/xml',
        'Content-Length': stat.size
    });
  
    var readStream = fs.createReadStream(filePath);
    readStream.pipe(res);
});


io.on('connection', function(connection) {
    log('Media WS: Connection accepted');
    new MediaStreamHandler(connection);
});

/******************************************** */

class MediaStreamHandler {
    constructor(connection) {
        this.metaData = null;
        this.trackHandlers = {};
        connection.on('message', this.processMessage.bind(this));
        connection.on('disconnect', this.close.bind(this));
    }
  
    processMessage(message){
        if (message.type === 'utf8') {
            const data = JSON.parse(message.utf8Data);
            if (data.event === "start") {
                this.metaData = data.start;
            }
            if (data.event !== "media") {
                return;
            }
            const track = data.media.track;

            if (this.trackHandlers[track] === undefined) {
                const service = new TranscriptionService();
                service.on('transcription', (transcription) => {
                    log(`Transcription (${track}): ${transcription}`);
                });
                this.trackHandlers[track] = service;
            }
            this.trackHandlers[track].send(data.media.payload);
        } else if (message.type === 'binary') {
            log('Media WS: binary message received (not supported)');
        }
    }
    close(){
        log('Media WS: closed');
  
        for (let track of Object.keys(this.trackHandlers)) {
            log(`Closing ${track} handler`);
            this.trackHandlers[track].close();
        }
    }
}

// Start the server
if (module === require.main) {
    const PORT = process.env.PORT || 8080;
    app.listen(PORT, () => {
        console.log(`App listening on port ${PORT}`);
        console.log('Press Ctrl+C to quit.');
    });
}