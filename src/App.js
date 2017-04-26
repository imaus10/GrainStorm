import React, { Component } from 'react';
import './App.css';
import numeric from 'numeric';
import Slider, { Range } from 'rc-slider';
import 'rc-slider/assets/index.css';

class GrainCloud extends Component {
  constructor(props) {
    super(props);
    this.audioCtx = props.audioCtx;
    this.audioData = props.audioData;
    this.playTime = 0; // time audio started playing (to find current position in audio)
    this.state = { pos: { start:0, end:1 } // pct of total duration
                 , grainDensity: 10 // grains/s
                 , grainDuration: .03 // s
                 , playing: false
                 , speed: 1 // pct
                 };
  }
  componentDidMount() {
    const canvasCtx = this.canvas.getContext('2d');
    const audio = this.audioData;

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
    this.posImage = this.audioImage;
  }
  componentDidUpdate() {
    // draw opaque gray rectangle over non-playing audio
    const canvasCtx = this.canvas.getContext('2d');
    canvasCtx.putImageData(this.audioImage, 0, 0);
    canvasCtx.fillStyle = 'rgba(233,233,233,0.8)';
    const w = this.canvas.width;
    const h = this.canvas.height;
    canvasCtx.fillRect(0, 0, w*this.state.pos.start, h);
    canvasCtx.fillRect(w*this.state.pos.end, 0, w*(1-this.state.pos.start), h);
    this.posImage = canvasCtx.getImageData(0,0,this.canvas.width,this.canvas.height);
    if (this.state.playing) this.playCloud();
  }
  render() {
    const playButtonTxt = this.state.playing ? 'stop' : 'play';
    return (
      <div className="grainCloud">
        <div className="sourceBox">
          <canvas ref={c => this.canvas = c}></canvas>
          <Range allowCross={false} defaultValue={[0,100]} onChange={pos => this.changePosition(pos)} />
        </div>
        <div className="parameterBox">
          <label>Speed (%)</label>
          <input type="number" value={this.state.speed*100} readOnly></input>
          <Slider defaultValue={this.state.speed*100} min={0} max={200} onChange={sp => this.changeSpeed(sp)} />
        </div>
        <div className="parameterBox">
          <label>Grain density (grains/second)</label>
          <input type="number" value={this.state.grainDensity} readOnly></input>
          <Slider defaultValue={this.state.grainDensity} min={1} max={100} onChange={gd => this.changeGrainDensity(gd)} />
        </div>
        <div className="parameterBox">
          <label>Grain duration (ms)</label>
          <input type="number" value={this.state.grainDuration*1000} readOnly></input>
          <Slider defaultValue={this.state.grainDuration*1000} min={1} max={5000} onChange={gs => this.changeGrainDuration(gs)} />
        </div>
        <div>
          <button type="button" onClick={() => this.changePlaying()}>{playButtonTxt}</button>
        </div>
      </div>
    );
  }
  changePlaying() {
    this.playTime = this.audioCtx.currentTime;
    if (this.state.playing) {
      this.stopCloud();
    }
    this.setState({ playing: !this.state.playing });
  }
  changePosition(pos) {
    this.stopCloud();
    this.playTime = this.audioCtx.currentTime;
    this.setState({ pos: { start: pos[0]/100, end: pos[1]/100 } });
  }
  changeGrainDensity(gd) {
    this.stopCloud();
    this.setState({ grainDensity: gd });
  }
  changeGrainDuration(gs) {
    this.stopCloud();
    this.setState({ grainDuration: gs/1000 });
  }
  changeSpeed(sp) {
    this.stopCloud();
    sp /= 100;
    const pos = this.getRelativePos();
    const deltaSp = (sp-this.state.speed) / sp;
    const newPos = pos - pos*deltaSp;
    this.playTime = this.audioCtx.currentTime - newPos/sp;
    this.setState({ speed: sp });
  }
  getRelativePos() {
    const startTime = this.state.pos.start*this.audioData.duration;
    const endTime = this.state.pos.end*this.audioData.duration;
    const dur = (endTime - startTime) / this.state.speed;
    const pos = (this.audioCtx.currentTime-this.playTime) % dur * this.state.speed;
    return pos;
  }
  playCloud() {
    this.intervalId = window.setInterval(() => this.playGrain(), 1000/this.state.grainDensity);
    const drawPos = () => {
      this.animation = window.requestAnimationFrame(drawPos);
      const stepsize = this.canvas.width/this.audioData.getChannelData(0).length;
      const sampleRate = this.audioData.sampleRate;
      const canvasCtx = this.canvas.getContext('2d');
      canvasCtx.putImageData(this.posImage, 0, 0);
      const startTime = this.state.pos.start*this.audioData.duration;
      const pos = Math.floor( sampleRate * (startTime+this.getRelativePos()) );
      canvasCtx.strokeStyle = 'red';
      canvasCtx.beginPath();
      canvasCtx.moveTo(stepsize*pos, 0);
      canvasCtx.lineTo(stepsize*pos, this.canvas.height);
      canvasCtx.stroke();
    };
    drawPos();
  }
  stopCloud() {
    window.clearInterval(this.intervalId);
    window.cancelAnimationFrame(this.animation);
    this.canvas.getContext('2d').putImageData(this.posImage, 0, 0);
  }
  playGrain() {
    const soundSource = this.audioCtx.createBufferSource();
    soundSource.buffer = this.audioData;
    soundSource.playbackRate.value = this.state.speed;
    soundSource.connect(this.audioCtx.destination);
    const startTime = this.state.pos.start*soundSource.buffer.duration;
    const pos = this.getRelativePos();
    soundSource.start(0, pos+startTime, this.state.grainDuration);
  }
}

class GrainStorm extends Component {
  constructor(props) {
    super(props);
    this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    this.grainCloudIdSeq = 0;
    this.state = { grainClouds: [] };
  }
  render() {
    return (
      <div>
        {this.state.grainClouds.map(gc => <GrainCloud key={gc.id} audioCtx={this.audioCtx} audioData={gc.audioData} />)}
        <div className="addGrainCloudBox">
          <input type="file" id="fileUpload" onChange={() => this.addGrainCloud()}></input>
        </div>
      </div>
    );
  }
  addGrainCloud() {
    const fileUpload = document.getElementById('fileUpload');
    const reader = new FileReader();
    reader.onload = () => {
      // console.log('decoding...');
      this.audioCtx.decodeAudioData(reader.result, decodedAudioData => {
        // console.log('decoded.');
        const gc = { id: this.grainCloudIdSeq
                   , audioData: decodedAudioData
                   };
        this.grainCloudIdSeq += 1;
        this.setState({ grainClouds: this.state.grainClouds.concat(gc) });
      });
    };
    reader.readAsArrayBuffer(fileUpload.files[0]);
  }
}

export default GrainStorm;
