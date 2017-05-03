import React, { Component } from 'react';
import numeric from 'numeric';
import { Range } from 'rc-slider';

function envelope(EnvelopeSource) {
  return class Envelope extends Component {
    componentDidMount() {
      this.envelopeSource.updateEnvelope();
      this.drawEnvelope();
    }
    componentDidUpdate(prevProps, prevState) {
      if (this.props.grainDuration !== prevProps.grainDuration) {
        this.envelopeSource.updateEnvelope();
        this.drawEnvelope();
      }
    }
    render() {
      return (
        <div>
          <canvas ref={c => this.canvas = c}></canvas>
          <EnvelopeSource
            ref={es => this.envelopeSource = es}
            drawEnvelope={() => this.drawEnvelope()}
            {...this.props} />
        </div>
      );
    }
    drawEnvelope() {
      const canvasCtx = this.canvas.getContext('2d');
      canvasCtx.clearRect(0,0,this.canvas.width,this.canvas.height);
      // convert to pixel heights on canvas
      let canvasdata = numeric.mul(this.envelopeSource.envelope, this.canvas.height);
      canvasdata = numeric.sub(this.canvas.height, canvasdata);

      // step thru the sample in chunks
      const stepsize = canvasdata.length/this.canvas.width;
      for (let i=1; i<this.canvas.width; i++) {
        canvasCtx.beginPath();
        canvasCtx.moveTo(i-1, canvasdata[Math.floor((i-1)*stepsize)]);
        canvasCtx.lineTo(i, canvasdata[Math.floor(i*stepsize)]);
        canvasCtx.stroke();
      }
    }
    generate(grain) {
      if (grain.length !== this.envelopeSource.envelope.length) {
        // resample at the grain's sampleRate
        this.envelopeSource.updateEnvelope(grain.length);
      }
      return this.envelopeSource.envelope;
    }
  }
}

class LinearEnvelopeSource extends Component {
  constructor(props) {
    super(props);
    // attack/decay times as pct of grainDuration
    this.state = { attackTime: 0.1
                 , decayTime: 0.1
                 };
  }
  componentDidUpdate(prevProps, prevState) {
    if (this.state.attackTime !== prevState.attackTime ||
        this.state.decayTime !== prevState.decayTime) {
      this.updateEnvelope();
      this.props.drawEnvelope();
    }
  }
  render() {
    return (
      <Range allowCross={false} defaultValue={[10,90]} onChange={env => this.changeAttackDecay(env)} />
    );
  }
  changeAttackDecay(env) {
    const attack = (env[0]/100);
    const decay = (1-env[1]/100);
    this.setState({ attackTime: attack, decayTime: decay });
  }
  updateEnvelope(grainLength) {
    if (typeof grainLength === 'undefined') {
      grainLength = Math.round(this.props.grainDuration*this.props.audioCtx.sampleRate);
    }
    const attackSamples = Math.round(grainLength*this.state.attackTime);
    const attack = numeric.linspace(0,1,attackSamples);
    const decaySamples = Math.round(grainLength*this.state.decayTime);
    const decay = numeric.linspace(1,0,decaySamples);
    const sustain = Array(grainLength-attack.length-decay.length).fill(1);
    this.envelope = attack.concat(sustain).concat(decay);
  }
}
export const LinearEnvelope = envelope(LinearEnvelopeSource);

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

class GaussianEnvelopeSource extends Component {
  constructor(props) {
    super(props);
    this.state = { sigma: 0.25 }; // set one standard deviation to 1/4 the grain duration
  }
  componentDidUpdate(prevProps, prevState) {
    if (this.state.sigma !== prevState.sigma) {
      this.updateEnvelope();
      this.props.drawEnvelope();
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
  updateEnvelope(grainLength) {
    if (typeof grainLength === 'undefined') {
      grainLength = Math.round(this.props.grainDuration*this.props.audioCtx.sampleRate);
    }
    const x = numeric.linspace(-1,1,grainLength);
    let y = numeric.pow(x,2);
    y = numeric.div(y,-2*Math.pow(this.state.sigma,2));
    this.envelope = numeric.exp(y);
  }
}
export const GaussianEnvelope = envelope(GaussianEnvelopeSource);
