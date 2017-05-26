import React, { Component } from 'react';
import numeric from 'numeric';
import Slider, { Range } from 'rc-slider';
import { mainColor } from './App';

function envelope(EnvelopeGenerator, xtraProps) {
  return class Envelope extends Component {
    static label = xtraProps.label
    componentDidMount() {
      this.canvas.getContext('2d').strokeStyle = mainColor;
      this.updateEnvelope();
      this.drawEnvelope();
    }
    componentDidUpdate(prevProps, prevState) {
      if (this.props.grainDuration !== prevProps.grainDuration) {
        this.updateEnvelope();
      }
    }
    render() {
      return (
        <div>
          <canvas ref={c => this.canvas = c}></canvas>
          <EnvelopeGenerator
            ref={eg => this.envelopeGenerator = eg}
            updateEnvelope={() => this.updateEnvelope()}
            {...this.props}
            {...xtraProps} />
        </div>
      );
    }
    drawEnvelope() {
      const canvasCtx = this.canvas.getContext('2d');
      canvasCtx.clearRect(0,0,this.canvas.width,this.canvas.height);

      canvasCtx.setLineDash([10,2]);
      canvasCtx.beginPath();
      canvasCtx.moveTo(0,this.canvas.height/2);
      canvasCtx.lineTo(this.canvas.width,this.canvas.height/2);
      canvasCtx.stroke();

      let canvasdata = this.envelopeGenerator.generate(this.canvas.width);
      const padding = 3; // pixels
      // convert to pixel heights on canvas
      // (with padding so envelope doesn't butt up against top)
      canvasdata = numeric.mul(canvasdata, this.canvas.height/2 - padding);
      canvasdata = numeric.add(canvasdata, this.canvas.height/2);
      canvasdata = numeric.sub(this.canvas.height, canvasdata);

      // graph
      for (let i=1; i<canvasdata.length; i++) {
        canvasCtx.beginPath();
        canvasCtx.moveTo(i-1, canvasdata[i-1]);
        canvasCtx.lineTo(i, canvasdata[i]);
        canvasCtx.stroke();
      }
    }
    generate(grain) {
      if (grain.length !== this.envelope.length) {
        // resample at the grain's sampleRate
        this.updateEnvelope(grain.length);
      }
      return this.envelope;
    }
    updateEnvelope(grainLength) {
      if (typeof grainLength === 'undefined') {
        grainLength = Math.round(this.props.grainDuration*this.props.audioCtx.sampleRate);
      }
      this.envelope = this.envelopeGenerator.generate(grainLength);
      this.drawEnvelope();
    }
  }
}

class LinearEnvelopeGenerator extends Component {
  static helpText = 'Move the range below to change the attack and decay of the envelope.'
  constructor(props) {
    super(props);
    // attack/decay times as pct of grainDuration
    this.state = { attackTime: 0.3
                 , decayTime: 0.3
                 };
  }
  componentDidUpdate(prevProps, prevState) {
    if (this.state.attackTime !== prevState.attackTime ||
        this.state.decayTime !== prevState.decayTime) {
      this.props.updateEnvelope();
    }
  }
  render() {
    const dfault = [this.state.attackTime*100, 100-this.state.decayTime*100];
    return (
      <Range allowCross={false} defaultValue={dfault} onChange={env => this.changeAttackDecay(env)} />
    );
  }
  changeAttackDecay(env) {
    const attack = (env[0]/100);
    const decay = (1-env[1]/100);
    this.setState({ attackTime: attack, decayTime: decay });
  }
  generate(envLength) {
    const attackSamples = Math.round(envLength*this.state.attackTime);
    const attack = numeric.linspace(0,1,attackSamples);
    const decaySamples = Math.round(envLength*this.state.decayTime);
    const decay = numeric.linspace(1,0,decaySamples);
    const sustain = Array(envLength-attack.length-decay.length).fill(1);
    return attack.concat(sustain).concat(decay);
  }
}
const LinearEnvelope = envelope(LinearEnvelopeGenerator, { label: 'Linear attack & decay' });

// first and last values mirror each other's movements
class MirrorRange extends Component {
  constructor(props) {
    super(props);
    this.state = { value: props.defaultValue };
  }
  render() {
    return (
      // TODO: fix allowCross bug (maybe...)
      <Range value={this.state.value} onChange={val => this.handleChange(val)} />
    );
  }
  handleChange(val) {
    let first = val[0];
    const prevFirst = this.state.value[0];
    let last = val[val.length-1];
    const prevLast = this.state.value[this.state.value.length-1];
    let mids = val.slice(1,val.length-1);
    if (first !== prevFirst) {
      const firstDiff = first-prevFirst;
      last -= firstDiff;
    } else if (last !== prevLast) {
      const lastDiff = last-prevLast;
      first -= lastDiff;
    }
    const newVal = [first].concat(mids).concat([last]);
    this.setState({ value: newVal });
    if (typeof this.props.onChange === 'function') {
      this.props.onChange(newVal);
    }
  }
}

class GaussianEnvelopeGenerator extends Component {
  constructor(props) {
    super(props);
    this.state = { sigma: 0.25 }; // set one standard deviation to 1/4 the grain duration
  }
  componentDidUpdate(prevProps, prevState) {
    if (this.state.sigma !== prevState.sigma) {
      this.props.updateEnvelope();
    }
  }
  render() {
    return (
      <MirrorRange defaultValue={[0,100]} onChange={env => this.changeSigma(env)} />
    );
  }
  changeSigma(env) {
    const pct = (50-env[0])/50;
    this.setState({ sigma: 0.25*pct });
  }
  generate(envLength) {
    const x = numeric.linspace(-1,1,envLength);
    let y = numeric.pow(x,2);
    y = numeric.div(y,-2*Math.pow(this.state.sigma,2));
    return numeric.exp(y);
  }
}
const GaussianEnvelope = envelope(GaussianEnvelopeGenerator, { label: 'Gaussian' });

class SincEnvelopeGenerator extends Component {
  constructor(props) {
    super(props);
    this.state = { zeroCrossings: 3 };
  }
  componentDidUpdate(prevProps, prevState) {
    if (this.state.zeroCrossings !== prevState.zeroCrossings) {
      this.props.updateEnvelope();
    }
  }
  render() {
    return (
      <MirrorRange defaultValue={[0,100]} onChange={env => this.changeWidth(env)} />
    );
  }
  changeWidth(env) {
    this.setState({ zeroCrossings: 3+env[0] });
  }
  generate(envLength) {
    const numzerocross = this.state.zeroCrossings;
    const x = numeric.linspace(-numzerocross*Math.PI,numzerocross*Math.PI,envLength);
    const y = numeric.div(numeric.sin(x),x);
    // replace NaN (x = 0) with 1
    return numeric.or(y,1);
  }
}
const SincEnvelope = envelope(SincEnvelopeGenerator, { label: 'Sinc' });

class ExponentialDecayEnvelopeGenerator extends Component {
  constructor(props) {
    super(props);
    this.baseDecayRate = 2;
    this.maxDecayRate = 25;
    this.state = { decayRate: this.baseDecayRate };
  }
  componentDidUpdate(prevProps, prevState) {
    if (this.state.decayRate !== prevState.decayRate) {
      this.props.updateEnvelope();
    }
  }
  render() {
    const dfault = this.props.reverse ? 0 : this.maxDecayRate;
    return (
      <Slider defaultValue={dfault} min={0} max={this.maxDecayRate} onChange={env => this.changeDecayRate(env)} />
    );
  }
  changeDecayRate(env) {
    const r = this.props.reverse ? env : this.maxDecayRate-env;
    this.setState({ decayRate: r+this.baseDecayRate });
  }
  generate(envLength) {
    const [begin,end] = this.props.reverse ? [1,0] : [0,1];
    const x = numeric.linspace(begin, end, envLength);
    return numeric.exp(numeric.mul(x,-this.state.decayRate));
  }
}
const ExponentialDecayEnvelope = envelope(ExponentialDecayEnvelopeGenerator, { label: 'Exponential decay' , reverse: false });
const ReverseExponentialDecayEnvelope = envelope(ExponentialDecayEnvelopeGenerator, { label: 'Reverse exponential decay', reverse: true });

export default class EnvelopePicker extends Component {
  constructor(props) {
    super(props);
    this.envelopeClasses = [LinearEnvelope, GaussianEnvelope, SincEnvelope, ExponentialDecayEnvelope, ReverseExponentialDecayEnvelope];
    this.state = { envelopeType: 0 };
  }
  render() {
    const envopts = this.envelopeClasses.map((cl,i) => <option value={i} key={i}>{cl.label}</option>);
    const Env = this.envelopeClasses[this.state.envelopeType];
    const envHelp = 'Each grain has an envelope applied to it that affects the shape. Different envelopes create different sound textures.';
    return (
      <div className="envelopeBox" onMouseEnter={() => this.props.changeHelpText(envHelp)}>
        <label>Envelope</label>
        <select value={this.state.envelopeType} onChange={evt => this.changeEnvelopeType(evt)}>
          {envopts}
        </select>
        <Env ref={env => this.envelope = env}
             {...this.props} />
      </div>
    );
  }
  changeEnvelopeType(evt) {
    this.setState({ envelopeType: parseInt(evt.target.value, 10) });
  }
  generate(grain) {
    return this.envelope.generate(grain);
  }
}
