import React, { Component } from 'react';
import './App.css';
import numeric from 'numeric';
import Slider, { Range } from 'rc-slider';
import 'rc-slider/assets/index.css';

function ParameterBox(props) {
  return (
    <div className="parameterBox">
      <label>{props.label}</label>
      <input type="number" value={props.value} readOnly></input>
      <Slider defaultValue={props.value} min={props.min} max={props.max} onChange={props.onChange} />
    </div>
  );
}

class WaveformGrainCloud extends Component {
  constructor(props) {
    super(props);
    this.audioCtx = props.audioCtx;
    this.state = { grainDensity: 10 // grains/s
                 , grainDuration: .03 // s
                 , playing: false
                 , waveFrequency: 10000 // Hz
                 };
  }
  componentDidMount() {
    let waveform = numeric.linspace(0,Math.PI*2,this.canvas.width);
    waveform = numeric.sin(waveform);

    let canvasdata = numeric.add(waveform, 1);
    canvasdata = numeric.mul(canvasdata, this.canvas.height/2);
    canvasdata = numeric.sub(this.canvas.height, canvasdata);

    const canvasCtx = this.canvas.getContext('2d');
    for (let i=1; i<this.canvas.width; i++) {
      canvasCtx.beginPath();
      canvasCtx.moveTo(i-1, canvasdata[i-1]);
      canvasCtx.lineTo(i, canvasdata[i]);
      canvasCtx.stroke();
    }
  }
  componentDidUpdate() {
    this.stopCloud();
    if (this.state.playing) this.playCloud();
  }
  render() {
    const playButtonTxt = this.state.playing ? 'stop' : 'play';
    return (
      <div className="grainCloud">
        <div className="sourceBox">
          <canvas ref={c => this.canvas = c}></canvas>
        </div>
        <ParameterBox
          label="Frequency (Hz)"
          value={this.state.waveFrequency}
          min={1}
          max={20000}
          onChange={f => this.changeWaveFrequency(f)} />
        <ParameterBox
          label="Grain density (grains/second)"
          value={this.state.grainDensity}
          min={1}
          max={100}
          onChange={d => this.changeGrainDensity(d)} />
        <ParameterBox
          label="Grain duration (ms)"
          value={this.state.grainDuration*1000}
          min={1}
          max={5000}
          onChange={dur => this.changeGrainDuration(dur)} />
        <div>
          <button type="button" onClick={() => this.changePlaying()}>{playButtonTxt}</button>
        </div>
      </div>
    );
  }
  changePlaying() {
    if (this.state.playing) {
      this.stopCloud();
    }
    this.setState({ playing: !this.state.playing });
  }
  changeWaveFrequency(f) {
    this.setState({ waveFrequency: f });
  }
  changeGrainDensity(d) {
    this.setState({ grainDensity: d });
  }
  changeGrainDuration(dur) {
    this.setState({ grainDuration: dur/1000 });
  }
  playCloud() {
    this.intervalId = window.setInterval(() => this.playGrain(), 1000/this.state.grainDensity);
  }
  stopCloud() {
    window.clearInterval(this.intervalId);
  }
  playGrain() {
    const osc = this.audioCtx.createOscillator();
    osc.connect(this.audioCtx.destination);
    osc.type = 'sine';
    osc.frequency.value = this.state.waveFrequency;
    osc.start();
    osc.stop(this.audioCtx.currentTime + this.state.grainDuration);
  }
}

class SampleGrainCloud extends Component {
  constructor(props) {
    super(props);
    this.audioCtx = props.audioCtx;
    this.audioData = props.audioData;
    this.playTime = 0; // time audio started playing (to find current position in audio)
    this.state = { grainDensity: 10 // grains/s
                 , grainDuration: .03 // s
                 , pos: { start:0, end:1 } // pct of total duration
                 , speed: 1 // pct
                 , playing: false
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
    this.stopCloud();
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
        <ParameterBox
          label="Speed (%)"
          value={this.state.speed*100}
          min={0}
          max={200}
          onChange={sp => this.changeSpeed(sp)} />
        <ParameterBox
          label="Grain density (grains/second)"
          value={this.state.grainDensity}
          min={1}
          max={100}
          onChange={d => this.changeGrainDensity(d)} />
        <ParameterBox
          label="Grain duration (ms)"
          value={this.state.grainDuration*1000}
          min={1}
          max={5000}
          onChange={dur => this.changeGrainDuration(dur)} />
        <div>
          <button type="button" onClick={() => this.changePlaying()}>{playButtonTxt}</button>
        </div>
      </div>
    );
  }
  changePlaying() {
    this.playTime = this.audioCtx.currentTime;
    this.setState({ playing: !this.state.playing });
  }
  changePosition(pos) {
    this.playTime = this.audioCtx.currentTime;
    this.setState({ pos: { start: pos[0]/100, end: pos[1]/100 } });
  }
  changeGrainDensity(d) {
    this.setState({ grainDensity: d });
  }
  changeGrainDuration(dur) {
    this.setState({ grainDuration: dur/1000 });
  }
  changeSpeed(sp) {
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
        {this.state.grainClouds.map(gc => gc.type === 'sample' ? <SampleGrainCloud key={gc.id} audioCtx={this.audioCtx} audioData={gc.audioData} /> : <WaveformGrainCloud key={gc.id} audioCtx={this.audioCtx} />)}
        <div className="addGrainCloudBox">
          <button type="button" onClick={() => this.addWaveform()}>Generate waveform</button>
          <input type="file" id="fileUpload" onChange={() => this.addSample()}></input>
        </div>
      </div>
    );
  }
  addSample() {
    const fileUpload = document.getElementById('fileUpload');
    const reader = new FileReader();
    reader.onload = () => {
      // console.log('decoding...');
      this.audioCtx.decodeAudioData(reader.result, decodedAudioData => {
        // console.log('decoded.');
        const gc = { id: this.grainCloudIdSeq
                   , audioData: decodedAudioData
                   , type: 'sample'
                   };
        this.grainCloudIdSeq += 1;
        this.setState({ grainClouds: this.state.grainClouds.concat(gc) });
      });
    };
    reader.readAsArrayBuffer(fileUpload.files[0]);
  }
  addWaveform() {
    const gc = { id: this.grainCloudIdSeq
               , type: 'waveform'
               };
    this.grainCloudIdSeq += 1;
    this.setState({ grainClouds: this.state.grainClouds.concat(gc) });
  }
}

export default GrainStorm;
