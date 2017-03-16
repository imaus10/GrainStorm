import React, { Component } from 'react';
import numeric from 'numeric';
import './App.css';

class GrainCloud extends Component {
  constructor(props) {
    super(props);
    this.state = { audioCtx: props.audioCtx
                 , audioData: props.audioData
                 };
  }
  componentDidMount() {
    const canvasCtx = this.canvas.getContext('2d');
    const audio = this.state.audioData;

    // convert to mono
    // console.log('converting...');
    const nchan = audio.numberOfChannels;
    let canvasdata = audio.getChannelData(0);
    for (let ch=1; ch<nchan; ch++) {
      canvasdata = numeric.add(canvasdata, audio.getChannelData(ch));
    }
    canvasdata = numeric.div(canvasdata, nchan);
    // convert to values between 0 and 2
    canvasdata = numeric.add(canvasdata, 1);
    // convert to pixel heights on canvas
    canvasdata = numeric.mul(canvasdata, this.canvas.height/2);
    canvasdata = numeric.sub(this.canvas.height, canvasdata);
    // console.log('converted.');

    // draw
    // TODO: for big files, step thru samples in chunks (avg chunks)
    // console.log('drawing visualization...');
    const stepsize = this.canvas.width/canvasdata.length;
    for (let i=0; i<canvasdata.length-1; i++) {
      canvasCtx.beginPath();
      canvasCtx.moveTo(stepsize*i, canvasdata[i]);
      canvasCtx.lineTo(stepsize*(i+1), canvasdata[i+1]);
      canvasCtx.stroke();
    }
    // console.log('drawn.');
  }
  render() {
    return (
      <div>
        <canvas ref={c => {this.canvas = c}}></canvas>
        <button type="button" onClick={() => this.playGrain()}>play</button>
      </div>
    );
  }
  playGrain() {
    const audioCtx = this.state.audioCtx;
    const soundSource = audioCtx.createBufferSource();
    soundSource.buffer = this.state.audioData;
    soundSource.connect(audioCtx.destination);
    const startTime = audioCtx.currentTime;
    soundSource.start();

    let animation;
    const canvasCtx = this.canvas.getContext('2d');
    const amplitudeImage = canvasCtx.getImageData(0,0,this.canvas.width,this.canvas.height);
    soundSource.onended = () => {
      window.cancelAnimationFrame(animation);
      canvasCtx.putImageData(amplitudeImage, 0, 0);
    };
    const drawPos = () => {
      animation = window.requestAnimationFrame(drawPos);
      const now = audioCtx.currentTime;
      const pos = Math.floor(soundSource.buffer.sampleRate * (now - startTime));
      const stepsize = this.canvas.width/soundSource.buffer.getChannelData(0).length
      canvasCtx.putImageData(amplitudeImage, 0, 0);
      canvasCtx.strokeStyle = 'red';
      canvasCtx.beginPath();
      canvasCtx.moveTo(stepsize*pos, 0);
      canvasCtx.lineTo(stepsize*pos, this.canvas.height);
      canvasCtx.stroke();
    };
    drawPos();
  }
}

class GrainStorm extends Component {
  constructor(props) {
    super(props);
    this.state = { audioCtx: new (window.AudioContext || window.webkitAudioContext)()
                 , grainCloudIdSeq: 0
                 , grainClouds: []
                 };
  }
  render() {
    return (
      <div>
        {this.state.grainClouds.map(gc => <GrainCloud key={gc.id} audioCtx={this.state.audioCtx} audioData={gc.audioData} />)}
        <input type="file" id="fileUpload" onChange={() => this.addGrainCloud()}></input>
      </div>
    );
  }
  addGrainCloud() {
    const id = this.state.grainCloudIdSeq;
    const fileUpload = document.getElementById('fileUpload');
    const reader = new FileReader();
    reader.onload = () => {
      // console.log('decoding...');
      this.state.audioCtx.decodeAudioData(reader.result, decodedAudioData => {
        // console.log('decoded.');
        const gc = { id: id
                   , audioData: decodedAudioData
                   };
        this.setState({ grainCloudIdSeq: id+1
                      , grainClouds: this.state.grainClouds.concat(gc)
                      });
      });
    };
    reader.readAsArrayBuffer(fileUpload.files[0]);
  }
}

export default GrainStorm;
