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

class LinearEnvelope extends Component {
  constructor(props) {
    super(props);
    // attack/decay times as pct of grainDuration
    this.state = { attackTime: 0.1
                 , decayTime: 0.1
                 };
  }
  render() {
    return (
      <div>
        <Range allowCross={false} defaultValue={[10,90]} onChange={env => this.changeAttackDecay(env)} />
      </div>
    );
  }
  changeAttackDecay(env) {
    const attack = (env[0]/100);
    const decay = (1-env[1]/100);
    this.setState({ attackTime: attack, decayTime: decay });
  }
  generate(grain) { // TODO: generate only on change?
    const attackSamples = Math.round(grain.length*this.state.attackTime);
    const attack = numeric.linspace(0,1,attackSamples);
    const decaySamples = Math.round(grain.length*this.state.decayTime);
    const decay = numeric.linspace(1,0,decaySamples);
    // console.log('attackSamples: ' + attackSamples);
    // console.log('decaySamples: ' + decaySamples);
    // console.log('grain.length: ' + grain.length);
    const sustain = Array(grain.length-attack.length-decay.length).fill(1);
    const env = attack.concat(sustain).concat(decay);
    return env;
  }
}

function grainCloud(GrainSource) {
  return class GrainCloud extends Component {
    constructor(props) {
      super(props);
      this.audioCtx = props.audioCtx;
      this.envelopeTypes = ['linear'];
      this.state = { grainDensity: 10 // grains/s
                   , grainDuration: 0.03 // s
                   , envelopeType: this.envelopeTypes[0]
                   , playing: false
                   };
    }
    componentDidUpdate(prevProps, prevState) {
      if (prevState.playing !== this.state.playing) {
        if (this.state.playing) {
          this.playCloud();
        } else {
          this.stopCloud();
        }
      } else if (this.state.playing && prevState.grainDensity !== this.state.grainDensity) {
        // reset the interval when density changes
        this.stopCloud();
        this.playCloud();
      }
    }
    render() {
      const playButtonTxt = this.state.playing ? 'stop' : 'play';
      const envopts = this.envelopeTypes.map(env => <option value={env} key={env}>{env[0].toUpperCase() + env.slice(1)}</option>);
      let envelope;
      if (this.state.envelopeType === 'linear') {
        envelope = <LinearEnvelope
                     ref={eg => this.envelope = eg}
                     {...this.state}
                     {...this.props} />;
      } //else if (this.state.envelopeType === 'gaussian') {
      //   envelope = <GaussianEnvelope
      //                ref={eg => this.envelope = eg}
      //                {...this.state}
      //                {...this.props} />;
      // }
      return (
        <div className="grainCloud">
          <GrainSource
            ref={gs => this.grainSource = gs}
            {...this.state}
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
          <div>
            <label>Envelope</label>
            <select value={this.state.envelopeType} onChange={evt => this.changeEnvelopeType(evt)}>
              {envopts}
            </select>
            {envelope}
          </div>
          <div>
            <button type="button" onClick={() => this.changePlaying()}>{playButtonTxt}</button>
          </div>
        </div>
      );
    }
    changePlaying() {
      this.setState({ playing: !this.state.playing });
    }
    changeGrainDensity(d) {
      this.setState({ grainDensity: d });
    }
    changeGrainDuration(dur) {
      this.setState({ grainDuration: dur/1000 });
    }
    changeEnvelopeType(evt) {
      const env = evt.target.value;
      this.setState({ envelopeType: env });
    }
    generateGrainEnvelope() {
      const grain = this.grainSource.makeGrain();
      const env = this.envelope.generate(grain);
      for (let ch=0; ch<grain.numberOfChannels; ch++) {
        const chanBuff = grain.getChannelData(ch);
        grain.copyToChannel(Float32Array.from(numeric.mul(env,chanBuff)), ch);
      }

      const src = this.audioCtx.createBufferSource();
      src.buffer = grain;
      this.grainSource.playGrain(src);
    }
    playCloud() {
      this.intervalId = window.setInterval(() => this.generateGrainEnvelope(), 1000/this.state.grainDensity);
      const animationFunc = () => {
        this.animation = window.requestAnimationFrame(animationFunc);
        this.grainSource.drawViz();
      }
      animationFunc();
    }
    stopCloud() {
      window.clearInterval(this.intervalId);
      this.animation = window.cancelAnimationFrame(this.animation);
      this.grainSource.resetViz();
    }
  }
}

class WaveformGrainSource extends Component {
  constructor(props) {
    super(props);
    this.audioCtx = props.audioCtx;
    this.audioAnalyzer = this.audioCtx.createAnalyser();
    this.audioAnalyzer.connect(this.audioCtx.destination);
    this.waveTypes = ['sine','square','sawtooth','triangle'];
    this.state = { waveFrequency: 10000 // Hz
                 , waveType: this.waveTypes[0]
                 };
  }
  componentDidMount() {
    this.resetViz();
  }
  render() {
    const wvopts = this.waveTypes.map(wv => <option value={wv} key={wv}>{wv[0].toUpperCase() + wv.slice(1)}</option>);
    return (
      <div className="sourceBox">
        <canvas ref={c => this.canvas = c}></canvas>
        <select value={this.state.waveType} onChange={evt => this.changeWaveType(evt)}>
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
  drawViz() {
    // oscilloscope!
    this.audioAnalyzer.fftSize = 2048;
    const bufferLength = this.audioAnalyzer.frequencyBinCount;
    let dataArray = new Uint8Array(bufferLength);
    this.audioAnalyzer.getByteTimeDomainData(dataArray);

    const canvasCtx = this.canvas.getContext('2d');
    canvasCtx.clearRect(0,0,this.canvas.width,this.canvas.height);
    canvasCtx.lineWidth = 2;
    canvasCtx.beginPath();
    const sliceWidth = this.canvas.width / bufferLength;
    var x = 0;
    for(var i=0; i<bufferLength; i++) {
      var v = dataArray[i] / 128.0;
      var y = v * this.canvas.height/2;
      if(i === 0) {
        canvasCtx.moveTo(x, y);
      } else {
        canvasCtx.lineTo(x, y);
      }
      x += sliceWidth;
    }
    canvasCtx.lineTo(this.canvas.width, this.canvas.height/2);
    canvasCtx.stroke();
  }
  resetViz() {
    // draw inactive oscilloscope
    const canvasCtx = this.canvas.getContext('2d');
    canvasCtx.clearRect(0,0,this.canvas.width,this.canvas.height);
    const canvasdata = Array(this.canvas.width).fill(this.canvas.height/2);
    for (let i=1; i<this.canvas.width; i++) {
      canvasCtx.beginPath();
      canvasCtx.moveTo(i-1, canvasdata[i-1]);
      canvasCtx.lineTo(i, canvasdata[i]);
      canvasCtx.stroke();
    }
  }
  makeGrain() {
    // TODO: other types of wave
    const numsamples = Math.round(this.audioCtx.sampleRate * this.props.grainDuration);
    const x = numeric.linspace(0,this.props.grainDuration,numsamples);
    const y = numeric.sin(numeric.mul(2*Math.PI*this.state.waveFrequency, x));

    const buff = this.audioCtx.createBuffer(1,numsamples,this.audioCtx.sampleRate);
    buff.copyToChannel(Float32Array.from(y),0);
    return buff;
  }
  playGrain(grain) {
    grain.connect(this.audioAnalyzer);
    grain.start();
  }
}
const WaveformGrainCloud = grainCloud(WaveformGrainSource);

class SampleGrainSource extends Component {
  constructor(props) {
    super(props);
    this.audioCtx = props.audioCtx;
    this.audioData = props.audioData; // AudioBuffer of sample
    this.initialPos = 0; // where the playhead was when sampleStart, sampleEnd, or speed changed
    // additional properties:
    // this.playTime -- time audio started playing (to find current position in audio)
    // this.audioImage -- unmodified image of original audio drawn on canvas
    // this.trimmedAudioImage -- image of audio plus sampleStart and sampleEnd markers
    this.state = { sampleStart: 0 // pct of total duration
                 , sampleEnd: 1 // pct of total duration
                 , speed: 1 // pct - 0 means playhead is still, negative reverses audio
                 , pitchShift: 0 // cents
                 };
  }
  // draw the audio on the canvas
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
    this.trimmedAudioImage = this.audioImage;
  }
  componentDidUpdate(prevProps, prevState) {
    // start or stop animation if playing has changed
    if (this.props.playing !== prevProps.playing) {
      if (this.props.playing) {
        this.playTime = this.audioCtx.currentTime;
      } else {
        this.initialPos = 0;
      }
    }

    if (this.sampleStart !== prevState.sampleStart || this.state.sampleEnd !== prevState.sampleEnd) {
      const start = this.state.sampleStart;
      const end = this.state.sampleEnd;
      // draw opaque gray rectangle over non-playing audio
      const canvasCtx = this.canvas.getContext('2d');
      canvasCtx.putImageData(this.audioImage, 0, 0);
      canvasCtx.fillStyle = 'rgba(233,233,233,0.8)';
      const w = this.canvas.width;
      const h = this.canvas.height;
      canvasCtx.fillRect(0, 0, w*start, h);
      canvasCtx.fillRect(w*end, 0, w*(1-start), h);
      this.trimmedAudioImage = canvasCtx.getImageData(0,0,w,h);
    }
  }
  render() {
    return (
      <div className="sourceBox">
        <canvas ref={c => this.canvas = c}></canvas>
        <Range allowCross={false} defaultValue={[0,100]} onChange={pos => this.changeStartEnd(pos)} />
        <ParameterBox
          label="Speed (%)"
          value={this.state.speed*100}
          min={-200}
          max={200}
          onChange={sp => this.changeSpeed(sp)} />
        <ParameterBox
          label="Pitch shift (cents)"
          value={this.state.pitchShift}
          min={-1200}
          max={1200}
          onChange={p => this.changePitchShift(p)} />
      </div>
    );
  }
  changeStartEnd(pos) {
    if (this.props.playing) {
      this.initialPos = this.getAbsolutePos();
      this.playTime = this.audioCtx.currentTime;
    } else {
      this.initialPos = pos[0]/100*this.audioData.duration;
    }
    this.setState({ sampleStart: pos[0]/100, sampleEnd: pos[1]/100 });
  }
  changeSpeed(sp) {
    if (this.props.playing) {
      this.initialPos = this.getAbsolutePos();
      this.playTime = this.audioCtx.currentTime;
    }
    this.setState({ speed: sp/100 });
  }
  changePitchShift(p) {
    this.setState({ pitchShift: p });
  }
  getAbsolutePos() {
    const startTime = this.state.sampleStart*this.audioData.duration;
    const endTime = this.state.sampleEnd*this.audioData.duration;
    if (this.state.speed === 0) {
      return Math.min(Math.max(this.initialPos, startTime), endTime);
    }
    const timeElapsed = this.props.playing ? (this.audioCtx.currentTime - this.playTime)*this.state.speed : 0;
    const dur = (endTime - startTime);
    const pos = (timeElapsed + this.initialPos - startTime) % dur + startTime;
    if (pos >= startTime) {
      return pos;
    } else {
      return endTime - Math.abs(startTime-pos)%dur;
    }
  }
  drawViz() {
    const stepsize = this.canvas.width/this.audioData.getChannelData(0).length;
    const sampleRate = this.audioData.sampleRate;
    const canvasCtx = this.canvas.getContext('2d');
    canvasCtx.putImageData(this.trimmedAudioImage, 0, 0);
    const pos = Math.floor( sampleRate * (this.getAbsolutePos()) );
    canvasCtx.strokeStyle = 'red';
    canvasCtx.beginPath();
    canvasCtx.moveTo(stepsize*pos, 0);
    canvasCtx.lineTo(stepsize*pos, this.canvas.height);
    canvasCtx.stroke();
  }
  resetViz() {
    this.canvas.getContext('2d').putImageData(this.trimmedAudioImage, 0, 0);
  }
  makeGrain() {
    const sampleRate = this.audioData.sampleRate;
    const nchan = this.audioData.numberOfChannels;
    // TODO: get rid of time, use samples instead
    const grainSamples = Math.round(this.props.grainDuration*sampleRate);
    const grain = this.audioCtx.createBuffer(nchan, grainSamples, sampleRate);

    const startSample = Math.round(this.getAbsolutePos()*sampleRate);
    for (let ch=0; ch<nchan; ch++) {
      const chanBuff = new Float32Array(grainSamples);
      this.audioData.copyFromChannel(chanBuff, ch, startSample);
      grain.copyToChannel(chanBuff, ch);
    }
    return grain;
  }
  playGrain(grain) {
    grain.detune.value = this.state.pitchShift;
    grain.connect(this.audioCtx.destination);
    grain.start();
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
