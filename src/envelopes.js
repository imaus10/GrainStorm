import React, { Component } from 'react';
import numeric from 'numeric';
import { Range } from 'rc-slider';

function drawEnvelope(canvas, envelope) {
  const canvasCtx = canvas.getContext('2d');
  canvasCtx.clearRect(0,0,canvas.width,canvas.height);
  // convert to values between 0 and 2
  // let canvasdata = numeric.add(envelope,1);
  // convert to pixel heights on canvas
  let canvasdata = numeric.mul(envelope, canvas.height);
  // 2px of top padding
  canvasdata = numeric.sub(canvas.height, canvasdata);

  // step thru the sample in chunks
  const stepsize = canvasdata.length/canvas.width;
  for (let i=1; i<canvas.width; i++) {
    canvasCtx.beginPath();
    canvasCtx.moveTo(i-1, canvasdata[Math.floor((i-1)*stepsize)]);
    canvasCtx.lineTo(i, canvasdata[Math.floor(i*stepsize)]);
    canvasCtx.stroke();
  }
}

export class LinearEnvelope extends Component {
  constructor(props) {
    super(props);
    // attack/decay times as pct of grainDuration
    this.state = { attackTime: 0.1
                 , decayTime: 0.1
                 };
  }
  componentDidMount() {
    this.updateEnvelope(Math.round(this.props.grainDuration*this.props.audioCtx.sampleRate));
    drawEnvelope(this.canvas, this.envelope);
  }
  componentDidUpdate(prevProps, prevState) {
    if (this.state.attackTime !== prevState.attackTime ||
        this.state.decayTime !== prevState.decayTime ||
        this.props.grainDuration !== prevProps.grainDuration) {
      this.updateEnvelope(Math.round(this.props.grainDuration*this.props.audioCtx.sampleRate));
      drawEnvelope(this.canvas, this.envelope);
    }
  }
  render() {
    return (
      <div>
        <canvas ref={c => this.canvas = c}></canvas>
        <Range allowCross={false} defaultValue={[10,90]} onChange={env => this.changeAttackDecay(env)} />
      </div>
    );
  }
  changeAttackDecay(env) {
    const attack = (env[0]/100);
    const decay = (1-env[1]/100);
    this.setState({ attackTime: attack, decayTime: decay });
  }
  updateEnvelope(grainLength) {
    const attackSamples = Math.round(grainLength*this.state.attackTime);
    const attack = numeric.linspace(0,1,attackSamples);
    const decaySamples = Math.round(grainLength*this.state.decayTime);
    const decay = numeric.linspace(1,0,decaySamples);
    const sustain = Array(grainLength-attack.length-decay.length).fill(1);
    this.envelope = attack.concat(sustain).concat(decay);
  }
  generate(grain) {
    if (grain.length !== this.envelope.length) {
      this.updateEnvelope(grain.length); // resample at the grain's sampleRate
    }
    return this.envelope;
  }
}

// first and last values mirror each other's movements
class MirrorRange extends Component {
  constructor(props) {
    super(props);
    this.state = { value: props.defaultValue };
  }
  componentDidUpdate() {
    // this.props.onChange(this.state.value);
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
  }
}

export class GaussianEnvelope extends Component {
  constructor(props) {
    super(props);
    this.state = { sigma: 0.25 }; // 1/4 the grain duration
  }
  componentDidMount() {
    this.updateEnvelope(Math.round(this.props.grainDuration*this.props.audioCtx.sampleRate));
    drawEnvelope(this.canvas, this.envelope);
  }
  render() {
    return (
      <div>
        <canvas ref={c => this.canvas = c}></canvas>
        <MirrorRange defaultValue={[0,100]} />
      </div>
    );
  }
  updateEnvelope(grainLength) {
    const x = numeric.linspace(-1,1,grainLength);
    let y = numeric.pow(x,2);
    y = numeric.div(y,-2*Math.pow(this.state.sigma,2));
    this.envelope = numeric.exp(y);
    console.log(this.envelope);
  }
  generate(grain) {
    if (grain.length !== this.envelope.length) {
      this.updateEnvelope(grain.length); // resample at the grain's sampleRate
    }
    return this.envelope;
  }
}
