import React, { Component } from 'react';
import './App.css';
import numeric from 'numeric';
import { Range } from 'rc-slider';
import 'rc-slider/assets/index.css';

class GrainCloud extends Component {
  constructor(props) {
    super(props);
    this.state = { audioCtx: props.audioCtx
                 , audioData: props.audioData
                 , grainStart: 0
                 , grainEnd: 1
                 };
  }
  componentDidMount() {
    const canvasCtx = this.canvas.getContext('2d');
    const audio = this.state.audioData;

    // convert to mono
    // console.log('converting to mono...');
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

    // step thru the sample in chunks
    const stepsize = Math.floor(canvasdata.length/this.canvas.width);
    // draw a line for each pixel in canvas
    // between the highest and lowest sample value in the chunk
    for (let i=0; i<this.canvas.width; i++) {
      canvasCtx.beginPath();
      const chunk = canvasdata.slice(i*stepsize,(i+1)*stepsize);
      canvasCtx.moveTo(i, Math.min.apply(null, chunk));
      canvasCtx.lineTo(i, Math.max.apply(null, chunk));
      canvasCtx.stroke();
    }
    // console.log('drawn.');
    this.audioImage = canvasCtx.getImageData(0,0,this.canvas.width,this.canvas.height);
  }
  componentDidUpdate() {
    // draw opaque gray rectangle over non-playing audio
    const canvasCtx = this.canvas.getContext('2d');
    canvasCtx.putImageData(this.audioImage, 0, 0);
    canvasCtx.fillStyle = 'rgba(233,233,233,0.8)';
    const w = this.canvas.width;
    const h = this.canvas.height;
    canvasCtx.fillRect(0, 0, w*this.state.grainStart, h);
    canvasCtx.fillRect(w*this.state.grainEnd, 0, w*(1-this.state.grainEnd), h);
  }
  render() {
    const style = { width: 300 };
    return (
      <div>
        <canvas ref={c => {this.canvas = c}}></canvas>
        <div style={style}>
          <Range allowCross={false} defaultValue={[0,100]} onChange={value => this.changeGrain(value)} />
        </div>
        <button type="button" onClick={() => this.playGrain()}>play</button>
      </div>
    );
  }
  changeGrain(value) {
    this.setState({ grainStart: value[0]/100, grainEnd: value[1]/100 });
  }
  playGrain() {
    const audioCtx = this.state.audioCtx;
    const soundSource = audioCtx.createBufferSource();
    soundSource.buffer = this.state.audioData;
    soundSource.connect(audioCtx.destination);
    const playTime = audioCtx.currentTime;
    const startTime = this.state.grainStart*soundSource.buffer.duration;
    const endTime = this.state.grainEnd*soundSource.buffer.duration;
    soundSource.start(0, startTime, endTime-startTime);

    let animation;
    const canvasCtx = this.canvas.getContext('2d');
    const currCanvas = canvasCtx.getImageData(0,0,this.canvas.width,this.canvas.height);
    soundSource.onended = () => {
      window.cancelAnimationFrame(animation);
      canvasCtx.putImageData(currCanvas, 0, 0);
    };
    const drawPos = () => {
      animation = window.requestAnimationFrame(drawPos);
      const now = audioCtx.currentTime;
      const pos = Math.floor(soundSource.buffer.sampleRate * (now - playTime + startTime));
      const stepsize = this.canvas.width/soundSource.buffer.getChannelData(0).length
      canvasCtx.putImageData(currCanvas, 0, 0);
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
