import React, { Component } from 'react';
import numeric from 'numeric';
import { Range } from 'rc-slider';
import { mainColor } from './App';
import Parameter from './Parameter';

// each GrainSource must implement these functions:
// 1. drawViz: show what's being played in a visualizer
// 2. resetViz: return to the default state of the visualizer
// 3. makeGrain: make an AudioBuffer grain to be played!
// 4. getConnector: return an AudioNode that will be connected to the grain
//    (this is so WaveformGrainSource's visualizer can
//     make the oscillator with an AnalyserNode)

// this generates grains using mathematical wave functions.
// (the wave types are implemented in updateGrain)
// the only additional controllable parameter is frequency.
export class WaveformGrainSource extends Component {
  // the classy wave shapes on the buttons are drawn with SVG paths
  static waveTypeSVGPaths = { sine: "M 0 25 Q 25 -15, 50 25 T 100 25"
                            , square: "M 0 4 H 50 V 46 H 100"
                            , sawtooth: "M 0 25 L 50 4 V 46 L 100 25"
                            , triangle: "M 0 25 L 25 4 L 75 46 L 100 25"
                            }

  // React methods:
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
    // WaveformGrainSource "generates" the exact same grain (this.waveform)
    // until grainDuration, waveType, or waveFrequency changes
    if (this.props.grainDuration !== prevProps.grainDuration ||
        prevState.waveType !== this.state.waveType ||
        prevState.waveFrequency !== this.state.waveFrequency) {
          this.updateGrain();
        }
  }
  render() {
    const wvopts = Object.keys(WaveformGrainSource.waveTypeSVGPaths).map(wv => {
      const selected = this.state.waveType === wv;
      return (
        <button className={'waveType' + (selected ? ' selected glow' : '')}
             onClick={() => this.changeWaveType(wv)}
             key={wv}>
          <svg viewBox="0 0 100 50">
            <path d={WaveformGrainSource.waveTypeSVGPaths[wv]} />
          </svg>
        </button>
      );
    });
    return (
      <div className="sourceBox">
        <canvas ref={c => this.canvas = c} className="screen"></canvas>
        <div className={'waveTypeSelect' + (this.props.walkthru === 17 ? ' glimmer' : '')}>
          {wvopts}
        </div>
        <Parameter
          label="Frequency"
          value={this.state.waveFrequency}
          min={20}
          max={20000}
          walkthruReveal={17}
          onChange={f => this.changeWaveFrequency(f)}
          {...this.props} />
      </div>
    );
  }

  // methods that call setState:
  changeWaveType(wv) {
    this.setState({ waveType: wv });
  }
  changeWaveFrequency(f) {
    this.setState({ waveFrequency: f });
  }

  // draw an oscilloscope!
  drawViz() {
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

  // draw inactive oscilloscope
  resetViz() {
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

// this generates grains using a sampled sound file.
// additional controllable parameters: speed & pitch shift
// (IE doesn't implement AudioBufferSourceNode.detune, so no pitch shift there)
export class SampleGrainSource extends Component {
  // React methods:
  constructor(props) {
    super(props);
    // used with this.playTime to find the current position of the playhead
    // both properties are reset when sampleStart, sampleEnd, or speed changes
    this.initialPos = 0;
    // additional properties:
    // this.audioImage -- unmodified image of original audio drawn on canvas
    //                    (see componentDidMount)
    // this.trimmedAudioImage -- image of audio plus sampleStart
    //                           and sampleEnd markers
    // this.lastRandPos -- last randomly chosen grain position
    this.state = { sampleStart: 0 // pct of total duration
                 , sampleEnd: 1 // pct of total duration
                 , speed: 1 // pct - 0 means playhead is still, negative reverses audio
                 , pitchShift: 0 // cents
                 , randomness: 0 // pct of total duration
                 };
  }
  componentDidMount() {
    // draw the audio on the canvas
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
        <div className="sampleViz">
          <canvas className="screen"
                  ref={c => this.canvas = c}></canvas>
          { this.props.walkthru < 4
          ? ''
          : <Range defaultValue={[0,100]}
                   allowCross={false}
                   className={this.props.walkthru === 4 ? 'glimmer' : ''}
                   onChange={pos => this.changeStartEnd(pos)} />
          }
        </div>
        <Parameter label="Randomness"
                   value={this.state.randomness}
                   min={0}
                   max={1}
                   step={0.01}
                   walkthruReveal={5}
                   onChange={r => this.changeRandomness(r)}
                   {...this.props} />
        <Parameter label="Speed"
                   value={this.state.speed*100}
                   min={-200}
                   max={200}
                   walkthruReveal={5}
                   onChange={sp => this.changeSpeed(sp)}
                   {...this.props} />
        { typeof this.props.audioCtx.createBufferSource().detune === 'undefined'
        ? ''
        : <Parameter label="Pitch shift"
                     value={this.state.pitchShift}
                     min={-1200}
                     max={1200}
                     walkthruReveal={6}
                     onChange={p => this.changePitchShift(p)}
                     {...this.props} />
        }
      </div>
    );
  }

  // methods that call setState:
  changeStartEnd(pos) {
    if (this.props.playing) {
      // catch the current playhead position before state change
      // to use as initialPos after state change
      this.initialPos = this.getPlayheadPos();
      this.playTime = this.props.audioCtx.currentTime;
    } else {
      this.initialPos = pos[0]/100*this.props.audioData.duration;
    }
    this.setState({ sampleStart: pos[0]/100, sampleEnd: pos[1]/100 });
  }
  changeRandomness(rand) {
    this.setState({ randomness: rand });
  }
  changeSpeed(sp) {
    if (this.props.playing) {
      // catch the current playhead position before state change
      // to use as initialPos after state change
      this.initialPos = this.getPlayheadPos();
      this.playTime = this.props.audioCtx.currentTime;
    }
    this.setState({ speed: sp/100 });
  }
  changePitchShift(p) {
    this.setState({ pitchShift: p });
  }

  wrapForward(pos) {
    const startTime = this.state.sampleStart*this.props.audioData.duration;
    const endTime = this.state.sampleEnd*this.props.audioData.duration;
    const dur = (endTime - startTime);

    return (pos - startTime) % dur + startTime;
  }
  wrapBackward(pos) {
    const startTime = this.state.sampleStart*this.props.audioData.duration;
    const endTime = this.state.sampleEnd*this.props.audioData.duration;
    const dur = (endTime - startTime);

    // if the speed is negative, the playhead will go below startTime and
    // continue to decrease.
    if (pos >= startTime) {
      return pos;
    } else {
      // once it does, correct by wrapping pos around endTime.
      // Math.abs(startTime-pos) is how far below startTime pos has gone.
      // use that as a distance from endTime instead --
      // mod with dur and subtract from endTime to make pos wrap around.
      return endTime - Math.abs(startTime-pos)%dur;
    }
  }
  getRandomPos() {
    const pos = this.getPlayheadPos();
    const dur = (this.state.sampleEnd - this.state.sampleStart)*this.props.audioData.duration;
    const randDelta = this.state.randomness*dur;
    const randPos = Math.random()*randDelta + (pos-randDelta/2);
    const randPosWrap = this.wrapBackward(this.wrapForward(randPos));

    // store for visualizing
    this.lastRandPos = randPosWrap;
    return randPosWrap;
  }
  getPlayheadPos() {
    const startTime = this.state.sampleStart*this.props.audioData.duration;
    const endTime = this.state.sampleEnd*this.props.audioData.duration;

    // if the speed is zero, return the same position over and over again
    if (this.state.speed === 0) {
      // but don't go beyond startTime or endTime
      return Math.min(Math.max(this.initialPos, startTime), endTime);
    }

    // the current position is the last position plus the time elapsed
    const timeElapsed = this.props.playing ? (this.props.audioCtx.currentTime - this.playTime)*this.state.speed : 0;
    const pos = timeElapsed + this.initialPos;

    return this.wrapBackward(this.wrapForward(pos));
  }

  drawViz() {
    const stepsize = this.canvas.width/this.props.audioData.getChannelData(0).length;
    const sampleRate = this.props.audioData.sampleRate;
    const canvasCtx = this.canvas.getContext('2d');
    canvasCtx.putImageData(this.trimmedAudioImage, 0, 0);
    // draw a red playhead at current position on the trimmedAudioImage
    const pos = Math.floor(sampleRate*this.getPlayheadPos());
    canvasCtx.strokeStyle = 'rgba(255, 56, 56, 1)';
    canvasCtx.beginPath();
    canvasCtx.moveTo(stepsize*pos, 0);
    canvasCtx.lineTo(stepsize*pos, this.canvas.height);
    canvasCtx.stroke();
    // draw a less opaque line for the random grain choice
    if (this.state.randomness > 0) {
      const rPos = Math.floor(sampleRate*this.lastRandPos);
      canvasCtx.strokeStyle = 'rgba(255, 56, 56, 0.5)';
      canvasCtx.beginPath();
      canvasCtx.moveTo(stepsize*rPos, 0);
      canvasCtx.lineTo(stepsize*rPos, this.canvas.height);
      canvasCtx.stroke();
    }
  }

  // reset the trimmedAudioImage
  resetViz() {
    this.canvas.getContext('2d').putImageData(this.trimmedAudioImage, 0, 0);
  }

  makeGrain() {
    // make an empty buffer with the correct number of samples
    const sampleRate = this.props.audioData.sampleRate;
    const nchan = this.props.audioData.numberOfChannels;
    const grainSamples = Math.round(this.props.grainDuration*sampleRate);
    const grain = this.props.audioCtx.createBuffer(nchan, grainSamples, sampleRate);

    // fill it from the sound file starting at the current position
    const startSample = Math.round(this.getRandomPos()*sampleRate);
    for (let ch=0; ch<nchan; ch++) {
      const chanBuff = new Float32Array(grainSamples);
      this.props.audioData.copyFromChannel(chanBuff, ch, startSample);
      grain.copyToChannel(chanBuff, ch);
    }
    return grain;
  }

  getConnector(grain) {
    // IE doesn't have detune...
    if (typeof grain.detune !== 'undefined') {
      grain.detune.value = this.state.pitchShift;
    }
    // in this case, a no-op node
    return this.props.audioCtx.createGain();
  }
}
