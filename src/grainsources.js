import React, { Component } from 'react';
import numeric from 'numeric';
import { Range } from 'rc-slider';
import { mainColor } from './App';
import ParameterBox from './parametercontrol';

export class WaveformGrainSource extends Component {
  static waveTypeSVGPaths = { sine: "M 0 25 Q 25 -15, 50 25 T 100 25"
                            , square: "M 0 4 H 50 V 46 H 100"
                            , sawtooth: "M 0 25 L 50 4 V 46 L 100 25"
                            , triangle: "M 0 25 L 25 4 L 75 46 L 100 25"
                            }
  constructor(props) {
    super(props);
    this.audioAnalyzer = props.audioCtx.createAnalyser();
    this.audioAnalyzer.connect(props.audioCtx.destination);
    this.waveTypes = ['sine','square','sawtooth','triangle'];
    this.state = { waveFrequency: 10000 // Hz
                 , waveType: 'sine'
                 };
  }
  componentDidMount() {
    this.canvas.getContext('2d').strokeStyle = mainColor;
    this.resetViz();
    this.updateGrain();
  }
  componentDidUpdate(prevProps, prevState) {
    if (this.props.grainDuration !== prevProps.grainDuration ||
        prevState.waveType !== this.state.waveType ||
        prevState.waveFrequency !== this.state.waveFrequency) {
          this.updateGrain();
        }
  }
  render() {
    const wvopts = Object.keys(WaveformGrainSource.waveTypeSVGPaths).map(wv => {
      const wvhalp = 'Generate a ' + wv + ' wave.';
      const selected = this.state.waveType === wv;
      return (
        <div className={'waveType' + (selected ? ' selected' : '')}
             onClick={() => this.changeWaveType(wv)}
             onMouseEnter={() => this.props.changeHelpText(wvhalp)}
             key={wv}>
          <svg viewBox="0 0 100 50">
            <path d={WaveformGrainSource.waveTypeSVGPaths[wv]}
                  stroke={selected ? mainColor : 'white'}
                  strokeWidth={selected ? '10%' : '5%'} />
          </svg>
        </div>
      );
    });
    return (
      <div className="sourceBox">
        <canvas ref={c => this.canvas = c}></canvas>
        <div className="waveTypeSelect">
          {wvopts}
        </div>
        <ParameterBox
          label="Frequency"
          value={this.state.waveFrequency}
          min={20}
          max={20000}
          helpText={'The pitch of the grains in Hz.'}
          onChange={f => this.changeWaveFrequency(f)}
          {...this.props} />
      </div>
    );
  }
  changeWaveType(wv) {
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
    canvasCtx.beginPath();
    canvasCtx.moveTo(0, this.canvas.height/2);
    canvasCtx.lineTo(this.canvas.width, this.canvas.height/2);
    canvasCtx.stroke();
  }
  updateGrain() {
    const numsamples = Math.round(this.props.audioCtx.sampleRate * this.props.grainDuration);

    const x = numeric.linspace(0,this.props.grainDuration,numsamples);
    let y;
    if (this.state.waveType === 'sine') {
       y = numeric.sin(numeric.mul(2*Math.PI*this.state.waveFrequency, x));
    } else if (this.state.waveType === 'square') {
      // const sine = numeric.sin(numeric.mul(2*Math.PI*this.state.waveFrequency, x))
      const period = 1/this.state.waveFrequency;
      const modPeriod = numeric.mod(x,period);
      // if less than half a period, value of 1
      let pos = numeric.lt(modPeriod,period/2);
      pos = numeric.mul(pos,1);
      // if greater than/equal to half a period, value of -1
      let neg = numeric.not(pos);
      neg = numeric.mul(neg,-1);
      y = numeric.add(neg,pos);
    } else if (this.state.waveType === 'sawtooth') {
      const a = numeric.mul(x,this.state.waveFrequency);
      const b = numeric.floor(a);
      y = numeric.sub(a,b);
      y = numeric.mul(y,2);
      y = numeric.sub(y,1);
    } else if (this.state.waveType === 'triangle') {
      const period = 1/this.state.waveFrequency;
      y = numeric.sub(x,period/4)
      y = numeric.mod(y,period);
      y = numeric.sub(y,period/2);
      y = numeric.abs(y);
      y = numeric.sub(y,period/4);
      y = numeric.mul(y,4/period);
    }

    this.waveform = this.props.audioCtx.createBuffer(1,numsamples,this.props.audioCtx.sampleRate);
    this.waveform.copyToChannel(Float32Array.from(y),0);
  }
  makeGrain() {
    const wvCp = this.props.audioCtx.createBuffer(1,this.waveform.length,this.waveform.sampleRate);
    wvCp.copyToChannel(this.waveform.getChannelData(0),0);
    return wvCp;
  }
  getConnector(grain) {
    return this.audioAnalyzer;
  }
}

export class SampleGrainSource extends Component {
  constructor(props) {
    super(props);
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
    canvasCtx.strokeStyle = mainColor;
    const audio = this.props.audioData;

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
        this.playTime = this.props.audioCtx.currentTime;
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
      canvasCtx.fillStyle = 'rgba(0,15,40,0.7)';
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
        <div onMouseEnter={() => this.props.changeHelpText('Move the slider below the wave form to change where grains get sampled from.')}>
          <canvas ref={c => this.canvas = c}></canvas>
          <Range allowCross={false} defaultValue={[0,100]} onChange={pos => this.changeStartEnd(pos)} />
        </div>
        <ParameterBox
          label="Speed"
          value={this.state.speed*100}
          min={-200}
          max={200}
          helpText={'How quickly the playhead moves through the sound sample, as a percentage. Negative values move backward.'}
          onChange={sp => this.changeSpeed(sp)}
          {...this.props} />
        { typeof this.props.audioCtx.createBufferSource().detune === 'undefined'
          ? ''
          : <ParameterBox
          label="Pitch shift"
          value={this.state.pitchShift}
          min={-1200}
          max={1200}
          helpText={'How much to change the pitch of each grain, in cents.'}
          onChange={p => this.changePitchShift(p)}
          {...this.props} />
        }
      </div>
    );
  }
  changeStartEnd(pos) {
    if (this.props.playing) {
      this.initialPos = this.getAbsolutePos();
      this.playTime = this.props.audioCtx.currentTime;
    } else {
      this.initialPos = pos[0]/100*this.props.audioData.duration;
    }
    this.setState({ sampleStart: pos[0]/100, sampleEnd: pos[1]/100 });
  }
  changeSpeed(sp) {
    if (this.props.playing) {
      this.initialPos = this.getAbsolutePos();
      this.playTime = this.props.audioCtx.currentTime;
    }
    this.setState({ speed: sp/100 });
  }
  changePitchShift(p) {
    this.setState({ pitchShift: p });
  }
  getAbsolutePos() {
    const startTime = this.state.sampleStart*this.props.audioData.duration;
    const endTime = this.state.sampleEnd*this.props.audioData.duration;
    if (this.state.speed === 0) {
      return Math.min(Math.max(this.initialPos, startTime), endTime);
    }
    const timeElapsed = this.props.playing ? (this.props.audioCtx.currentTime - this.playTime)*this.state.speed : 0;
    const dur = (endTime - startTime);
    const pos = (timeElapsed + this.initialPos - startTime) % dur + startTime;
    if (pos >= startTime) {
      return pos;
    } else {
      return endTime - Math.abs(startTime-pos)%dur;
    }
  }
  drawViz() {
    const stepsize = this.canvas.width/this.props.audioData.getChannelData(0).length;
    const sampleRate = this.props.audioData.sampleRate;
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
    const sampleRate = this.props.audioData.sampleRate;
    const nchan = this.props.audioData.numberOfChannels;
    // TODO: get rid of time, use samples instead
    const grainSamples = Math.round(this.props.grainDuration*sampleRate);
    const grain = this.props.audioCtx.createBuffer(nchan, grainSamples, sampleRate);

    const startSample = Math.round(this.getAbsolutePos()*sampleRate);
    for (let ch=0; ch<nchan; ch++) {
      const chanBuff = new Float32Array(grainSamples);
      this.props.audioData.copyFromChannel(chanBuff, ch, startSample);
      grain.copyToChannel(chanBuff, ch);
    }
    return grain;
  }
  getConnector(grain) {
    if (typeof grain.detune !== 'undefined') {
      grain.detune.value = this.state.pitchShift;
    }
    // in this case, a no-op node
    return this.props.audioCtx.createGain();
  }
}
