import React, { Component } from 'react';
import numeric from 'numeric';
import Slider from 'rc-slider';
import 'rc-slider/assets/index.css';
import './audioshim';
import { LinearEnvelope, GaussianEnvelope, SincEnvelope,
         ExponentialDecayEnvelope, ReverseExponentialDecayEnvelope } from './envelopes';
import { WaveformGrainSource, SampleGrainSource } from './grainsources';
import './App.css';

export const mainColor = '#16ba42';

export function ParameterBox(props) {
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
      this.envelopeLabels = ['Linear attack & decay', 'Gaussian', 'Sinc', 'Exponential decay', 'Reverse exponential decay'];
      this.envelopeClasses = [LinearEnvelope, GaussianEnvelope, SincEnvelope, ExponentialDecayEnvelope, ReverseExponentialDecayEnvelope];
      this.state = { grainDensity: 10 // grains/s
                   , grainDuration: 0.03 // s
                   , envelopeType: 0
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
      const envopts = this.envelopeLabels.map((v,i) => <option value={i} key={i}>{v}</option>);
      const Env = this.envelopeClasses[this.state.envelopeType];
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
          <div className="envelopeBox">
            <label>Envelope</label>
            <select value={this.state.envelopeType} onChange={evt => this.changeEnvelopeType(evt)}>
              {envopts}
            </select>
            <Env
              ref={eg => this.envelope = eg}
              {...this.state}
              {...this.props} />
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
      this.setState({ envelopeType: parseInt(evt.target.value, 10) });
    }
    generateGrainEnvelope() {
      const grain = this.grainSource.makeGrain();
      const env = this.envelope.generate(grain);
      for (let ch=0; ch<grain.numberOfChannels; ch++) {
        const chanBuff = grain.getChannelData(ch);
        grain.copyToChannel(Float32Array.from(numeric.mul(env,chanBuff)), ch);
      }

      const src = this.props.audioCtx.createBufferSource();
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

const WaveformGrainCloud = grainCloud(WaveformGrainSource);
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
        <h1>GrainStorm: granular synthesis in the browser</h1>
        <div id="bigBox">
          {this.state.grainClouds.map(gc => <gc.type key={gc.id} audioCtx={this.audioCtx} audioData={gc.audioData || null} />)}
          <div className="addGrainCloudBox">
            <button type="button" onClick={() => this.addWaveform()}>Generate waveform</button>
            <div>OR</div>
            <div><input type="file" id="fileUpload" onChange={() => this.addSample()}></input></div>
          </div>
        </div>
      </div>
    );
  }
  addSample() {
    const fileUpload = document.getElementById('fileUpload');
    const reader = new FileReader();
    reader.onload = () => {
      // console.log('decoding...');
      this.audioCtx.decodeAudioData(reader.result,
        decodedAudioData => {
          // console.log('decoded.');
          const gc = { id: this.grainCloudIdSeq
                     , audioData: decodedAudioData
                     , type: SampleGrainCloud
                     };
          this.grainCloudIdSeq += 1;
          this.setState({ grainClouds: this.state.grainClouds.concat(gc) });
        },
        e => {
          // TODO: prettier, more informative
          alert("Error decoding audio data: \n" + e);
        });
    };
    reader.readAsArrayBuffer(fileUpload.files[0]);
  }
  addWaveform() {
    const gc = { id: this.grainCloudIdSeq
               , type: WaveformGrainCloud
               };
    this.grainCloudIdSeq += 1;
    this.setState({ grainClouds: this.state.grainClouds.concat(gc) });
  }
}

export default GrainStorm;
