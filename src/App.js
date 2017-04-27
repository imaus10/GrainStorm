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

function grainCloud(GrainSource) {
  return class GrainCloud extends Component {
    constructor(props) {
      super(props);
      this.audioCtx = props.audioCtx;
      const grainDuration = 0.03;
      // set envelope attack and decay to 10% of grain duration
      const envAttack = grainDuration * 0.1;
      const envDecay = grainDuration * 0.1;
      this.state = { grainDensity: 10 // grains/s
                   , grainDuration: grainDuration // s
                   , envelope: { attack: envAttack, decay: envDecay } // s
                   , playing: false
                   };
    }
    componentDidMount() {
      // draw envelope
      // const canvasCtx = this.envelopeCanvas.getContext('2d');
    }
    componentDidUpdate() {
      this.stopCloud();
      if (this.state.playing) this.playCloud();
    }
    render() {
      const playButtonTxt = this.state.playing ? 'stop' : 'play';
      return (
        <div className="grainCloud">
          <GrainSource
            ref={gs => this.grainSource = gs}
            grainParams={this.state}
            {...this.props} />
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
            max={100}
            onChange={dur => this.changeGrainDuration(dur)} />
          <label>Envelope</label>
          <Range allowCross={false} defaultValue={[10,90]} onChange={env => this.changeEnvelope(env)} />
          <div>
            <button type="button" onClick={() => this.changePlaying()}>{playButtonTxt}</button>
          </div>
        </div>
      );
    }
    changePlaying() {
      if (this.state.playing) {
        this.stopCloud();
      } else if (typeof this.grainSource.setPlayTime === 'function') {
        this.grainSource.setPlayTime(); // TODO PUT IN COMPONENT
      }
      this.setState({ playing: !this.state.playing });
    }
    changeGrainDensity(d) {
      this.setState({ grainDensity: d });
    }
    changeGrainDuration(dur) {
      this.setState({ grainDuration: dur/1000 });
    }
    changeEnvelope(env) {
      const attack = (env[0]/100) * this.state.grainDuration;
      const decay = (env[1]/100) * this.state.grainDuration;
      this.setState({ envelope: { attack:attack, decay:decay } });
    }
    grainEnvelopeGenerator() {
      const grainDuration = this.state.grainDuration;
      const grain = this.grainSource.makeGrain();
      const gainNode = this.audioCtx.createGain();
      // the ol' grain-n-gain
      grain.connect(gainNode);
      gainNode.connect(this.audioCtx.destination);

      const now = this.audioCtx.currentTime;
      const attackTime = this.state.envelope.attack;
      const decayTime = this.state.envelope.decay;
      gainNode.gain.setValueAtTime(0, now);
      gainNode.gain.linearRampToValueAtTime(1, now+attackTime);
      gainNode.gain.setValueAtTime(1, now+grainDuration-decayTime);
      gainNode.gain.linearRampToValueAtTime(0, now+grainDuration);

      this.grainSource.playGrain(grain);
    }
    playCloud() {
      this.intervalId = window.setInterval(() => this.grainEnvelopeGenerator(), 1000/this.state.grainDensity);
      if (typeof this.grainSource.playAnimation === 'function') {
        this.grainSource.playAnimation();
      }
    }
    stopCloud() {
      window.clearInterval(this.intervalId);
      if (typeof this.grainSource.playAnimation === 'function') {
        this.grainSource.stopAnimation();
      }
    }
  }
}

class WaveformGrainSource extends Component {
  constructor(props) {
    super(props);
    this.audioCtx = props.audioCtx;
    this.waveTypes = ['sine','square','sawtooth','triangle'];
    this.state = { waveFrequency: 10000 // Hz
                 , waveType: this.waveTypes[0]
                 };
  }
  drawWave() { // TODO: draw oscilloscope/to scale
    const wv = this.state.waveType;
    let waveform;
    if (wv === 'sine') {
      waveform = numeric.linspace(0,Math.PI*2*2,this.canvas.width);
      waveform = numeric.sin(waveform);
    } else if (wv === 'square') {
      const maxes = Array(this.canvas.width/4).fill(1);
      const mins = Array(this.canvas.width/4).fill(-1);
      waveform = maxes.concat(mins).concat(maxes).concat(mins);
    } else if (wv === 'sawtooth') {
      const tooth = numeric.linspace(-1,1,this.canvas.width/2);
      waveform = tooth.concat(tooth);
    } else if (wv === 'triangle') {
      const up = numeric.linspace(-1,1,this.canvas.width/4);
      const down = numeric.linspace(1,-1,this.canvas.width/4);
      waveform = up.concat(down).concat(up).concat(down);
    }

    let canvasdata = numeric.add(waveform, 1);
    canvasdata = numeric.mul(canvasdata, this.canvas.height/2);
    canvasdata = numeric.sub(this.canvas.height, canvasdata);

    const canvasCtx = this.canvas.getContext('2d');
    canvasCtx.clearRect(0,0,this.canvas.width,this.canvas.height);
    for (let i=1; i<this.canvas.width; i++) {
      canvasCtx.beginPath();
      canvasCtx.moveTo(i-1, canvasdata[i-1]);
      canvasCtx.lineTo(i, canvasdata[i]);
      canvasCtx.stroke();
    }
  }
  componentDidMount() {
    this.drawWave();
  }
  componentDidUpdate() {
    this.drawWave();
  }
  render() {
    const wvopts = this.waveTypes.map((wv) => <option value={wv} key={wv}>{wv[0].toUpperCase() + wv.slice(1)}</option>);
    return (
      <div className="sourceBox">
        <canvas ref={c => this.canvas = c}></canvas>
        <select value={this.state.waveType} onChange={(evt) => this.changeWaveType(evt)}>
          {wvopts}
        </select>
        <ParameterBox
          label="Frequency (Hz)"
          value={this.state.waveFrequency}
          min={20}
          max={20000}
          onChange={f => this.changeWaveFrequency(f)} />
      </div>
    );
  }
  changeWaveType(evt) {
    const wv = evt.target.value;
    this.setState({ waveType: wv });
  }
  changeWaveFrequency(f) {
    this.setState({ waveFrequency: f });
  }
  makeGrain() {
    const osc = this.audioCtx.createOscillator();
    osc.type = this.state.waveType;
    osc.frequency.value = this.state.waveFrequency;
    return osc;
  }
  playGrain(grain) {
    grain.start();
    grain.stop(this.audioCtx.currentTime + this.props.grainParams.grainDuration);
  }
}
const WaveformGrainCloud = grainCloud(WaveformGrainSource);

class SampleGrainSource extends Component {
  constructor(props) {
    super(props);
    this.audioCtx = props.audioCtx; // begrudgingly, for playhead position...
    this.audioData = props.audioData;
    this.playTime = 0; // time audio started playing (to find current position in audio)
    this.state = { pos: { start:0, end:1 } // pct of total duration
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
  }
  render() {
    return (
      <div className="sourceBox">
        <canvas ref={c => this.canvas = c}></canvas>
        <Range allowCross={false} defaultValue={[0,100]} onChange={pos => this.changePosition(pos)} />
        <ParameterBox
          label="Speed (%)"
          value={this.state.speed*100}
          min={0}
          max={200}
          onChange={sp => this.changeSpeed(sp)} />
      </div>
    );
  }
  changePosition(pos) {
    if (pos[0]/100*this.audioData.duration > this.getRelativePos()) {
      this.setPlayTime();
    }
    this.setState({ pos: { start: pos[0]/100, end: pos[1]/100 } });
  }
  changeSpeed(sp) {
    sp /= 100;
    const pos = this.getRelativePos();
    const deltaSp = (sp-this.state.speed) / sp;
    const newPos = pos - pos*deltaSp;
    this.playTime = this.audioCtx.currentTime - newPos/sp;
    this.setState({ speed: sp });
  }
  setPlayTime() {
    this.playTime = this.audioCtx.currentTime;
  }
  getRelativePos() {
    const startTime = this.state.pos.start*this.audioData.duration;
    const endTime = this.state.pos.end*this.audioData.duration;
    const dur = (endTime - startTime) / this.state.speed;
    const pos = (this.audioCtx.currentTime-this.playTime) % dur * this.state.speed;
    return pos;
  }
  playAnimation() {
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
  stopAnimation() {
    window.cancelAnimationFrame(this.animation);
    this.canvas.getContext('2d').putImageData(this.posImage, 0, 0);
  }
  makeGrain() {
    const soundSource = this.audioCtx.createBufferSource();
    soundSource.buffer = this.audioData;
    soundSource.playbackRate.value = this.state.speed;
    return soundSource;
  }
  playGrain(grain) {
    const startTime = this.state.pos.start*grain.buffer.duration;
    const pos = this.getRelativePos();
    grain.start(0, pos+startTime, this.props.grainParams.grainDuration);
  }
}
const SampleGrainCloud = grainCloud(SampleGrainSource);

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
