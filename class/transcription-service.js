const EventEmitter = require('events');
const Speech = require('@google-cloud/speech');
const speech = new Speech.SpeechClient();

const LANG_ENCORDING = "ja-JP";

//
class TranscriptionService extends EventEmitter {
  constructor() {
    super();
    this.stream = null;
    this.streamCreatedAt = null;
  }
  
  send(payload) {
    this.getStream().write(payload);
  }

  close() {
    if (this.stream) {
      this.stream.destroy();
    }
  }


  newStreamRequired() {
    if (!this.stream) {
      //Stream が空
      return true;
    } else {
      const now = new Date();
      const timeSinceStreamCreated = now - this.streamCreatedAt;
      return ( timeSinceStreamCreated / 1000 ) > 60;
    }
  }

  getStream() {
    if (this.newStreamRequired()) {
      if (this.stream) {
        this.stream.destroy();
      }

      var request = {
        config: {
          encoding: "MULAW",
          sampleRateHertz: 8000,
          languageCode: LANG_ENCORDING,
        },
        interimResults: true
      };

      this.streamCreatedAt = new Date();
      this.stream = speech
        .streamingRecognize(request)
        .on("error", console.error)// ここのonはspeechのほうのやつ
        .on("data", (data) => {
          const result = data.results[0];
          if (result === undefined || result.alternatives[0] === undefined) {
            return; 
          }

          // 翻訳結果を引数にして transcription イベントを呼び出す
          // transcription りすなは (このクラスのインスタンス).on("transcription",())とか書いてるところ
          this.emit('transcription', result.alternatives[0].transcript);

        });
    }

    return this.stream;
  }
}

module.exports = TranscriptionService;