import React, { Component } from 'react';
import numeric from 'numeric';
import Slider, { Range } from 'rc-slider';
import { mainColor } from './App';

// each EnvelopeGenerator has its own particular parameters,
// but must define the following method:
// 1. generate(envLength) -- make an envelope with the given number of samples
// and also a static helpText property that displays when hovered over

// this higher order component (HOC) abstracts the shared drawing code
// while pushing the envelope implementation to the EnvelopeGenerator
function envelope(EnvelopeGenerator, xtraProps) {
  return class Envelope extends Component {
    static label = xtraProps.label
    // the classy envelope shapes on the buttons are drawn with SVG paths
    static path = xtraProps.path

    // React methods:
    componentDidMount() {
      this.canvas.getContext('2d').strokeStyle = mainColor;
      this.updateEnvelope();
    }
    componentDidUpdate(prevProps, prevState) {
      if (this.props.grainDuration !== prevProps.grainDuration) {
        this.updateEnvelope();
      }
    }
    render() {
      return (
        <div className="envelope"
             onMouseEnter={() => this.props.changeHelpText(EnvelopeGenerator.helpText)}>
          <canvas ref={c => this.canvas = c} className="screen"></canvas>
          <EnvelopeGenerator
            ref={eg => this.envelopeGenerator = eg}
            updateEnvelope={() => this.updateEnvelope()}
            {...this.props}
            {...xtraProps} />
        </div>
      );
    }

    // draw the generated envelope on this.canvas
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

    // only actually generate a new envelope when grainDuration changes,
    // and store it in this.envelope.
    // this gets passed down to the EnvelopeGenerator child component
    // in case it requires a redraw due to parameter changes.
    updateEnvelope(grainLength) {
      // before we actually know the grainLength, guess...
      // (sample could be different length if
      //  its sample rate differs from audioCtx's)
      if (typeof grainLength === 'undefined') {
        grainLength = Math.round(this.props.grainDuration*this.props.audioCtx.sampleRate);
      }
      this.envelope = this.envelopeGenerator.generate(grainLength);
      // don't forget to redraw!
      this.drawEnvelope();
    }

    generate(grain) {
      // the unlikely scenario where a sample has a different
      // sample rate than the audioCtx
      if (grain.length !== this.envelope.length) {
        // resample at the grain's sampleRate
        this.updateEnvelope(grain.length);
      }
      return this.envelope;
    }
  }
}

class LinearEnvelopeGenerator extends Component {
  static helpText = 'Move the range below to change the attack and decay times of the envelope.'

  // React methods:
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

  // methods that call setState:
  changeAttackDecay(env) {
    const attack = (env[0]/100);
    const decay = (1-env[1]/100);
    this.setState({ attackTime: attack, decayTime: decay });
  }

  generate(envLength) {
    // linear ramp-up over attackTime
    const attackSamples = Math.round(envLength*this.state.attackTime);
    const attack = numeric.linspace(0,1,attackSamples);
    // linear ramp-down over decayTime
    const decaySamples = Math.round(envLength*this.state.decayTime);
    const decay = numeric.linspace(1,0,decaySamples);
    // fill the space between with 1s
    const sustain = Array(envLength-attack.length-decay.length).fill(1);
    // and stick em all together
    return attack.concat(sustain).concat(decay);
  }
}
const LinearEnvelope = envelope(LinearEnvelopeGenerator,
        { label: 'linear attack & decay'
        , path: 'M 0 25 L 20 4 H 80 L 100 25'
        });

// extend rc-slider Range component where
// first and last values mirror each other's movements
class MirrorRange extends Component {
  constructor(props) {
    super(props);
    this.state = { value: props.defaultValue };
  }
  render() {
    return (
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
  static helpText = 'Move the slider below to change the width of the Gaussian envelope.'

  // React methods:
  constructor(props) {
    super(props);
    // set one standard deviation to 1/4 the grain duration
    this.state = { sigma: 0.25 };
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

  // methods that call setState:
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
const GaussianEnvelope = envelope(GaussianEnvelopeGenerator,
        { label: 'gaussian'
        , path: 'M 0 25 C 30 25, 40 4, 50 4 S 70 25, 100 25'
        });

class SincEnvelopeGenerator extends Component {
  static helpText = 'Move the slider below to change the width of the sinc envelope.'

  // React methods:
  constructor(props) {
    super(props);
    // minimum of 3 zero crossings
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

  // methods that call setState:
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
const SincEnvelope = envelope(SincEnvelopeGenerator,
        { label: 'sinc'
        , path: 'M 0 25 ' +
                'C 6.25 30, 6.25 30, 12.5 25 ' +
                'C 18.75 15, 18.75 15, 25 25 ' +
                'C 31.25 40, 31.25 40, 37.5 25 ' +
                'C 50 -5, 50 -5, 62.5 25 ' +
                'C 68.75 40, 68.75 40, 75 25 ' +
                'C 81.25 15, 81.25 15, 87.5 25 ' +
                'C 93.75 30, 93.75 30, 100 25'
        });

// this has an additional reverse prop, passed down from the HOC,
// that flips the envelope around. that way, we can get two components
// for the price of one. useful abstraction.
class ExponentialDecayEnvelopeGenerator extends Component {
  static helpText = 'Move the slider below to change the decay rate of the envelope.'

  // React methods:
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

  // methods that call setState:
  changeDecayRate(env) {
    const r = this.props.reverse ? env : this.maxDecayRate-env;
    this.setState({ decayRate: r+this.baseDecayRate });
  }

  generate(envLength) {
    // reversal magic -- same func, different numbers
    const [begin,end] = this.props.reverse ? [1,0] : [0,1];
    const x = numeric.linspace(begin, end, envLength);
    return numeric.exp(numeric.mul(x,-this.state.decayRate));
  }
}
// two very similar components for the price of one:
const ExponentialDecayEnvelope = envelope(ExponentialDecayEnvelopeGenerator,
        { label: 'exponential decay'
        , reverse: false
        , path: 'M 0 0 C 20 25, 70 25, 100 25'
        });
const ReverseExponentialDecayEnvelope = envelope(ExponentialDecayEnvelopeGenerator,
        { label: 'reverse exponential decay'
        , reverse: true
        , path: 'M 0 25 C 20 25, 70 25, 100 0'
        });

// this class is the display and selection logic for envelopes --
// the only thing exported.
export default class EnvelopePicker extends Component {
  // React methods:
  constructor(props) {
    super(props);
    this.envelopeClasses = [LinearEnvelope, GaussianEnvelope, SincEnvelope, ExponentialDecayEnvelope, ReverseExponentialDecayEnvelope];
    this.state = { envelopeType: 0 };
  }
  render() {
    const envopts = this.envelopeClasses.map((cl,i) => {
      const selected = i === this.state.envelopeType;
      const envhalp = 'Use a ' + cl.label + ' envelope.';
      const clzNm = 'envelopeType' + (selected ? ' selected' : '')
                                   + (i === 0 ? ' first' : '')
                                   + (i === this.envelopeClasses.length-1 ? ' last' : '');
      return (
        <button className={clzNm}
             onClick={() => this.changeEnvelopeType(i)}
             onMouseEnter={() => this.props.changeHelpText(envhalp)}
             key={cl.label}>
          <svg viewBox="0 0 100 50">
            <path d={cl.path}
                  stroke={selected ? mainColor : "white"}
                  strokeWidth={selected ? "10%" : "5%"} />
          </svg>
        </button>
      );
    });
    const Env = this.envelopeClasses[this.state.envelopeType];
    const envlabhalp = 'Each grain has an envelope to stop clicks and pops caused by sudden onsets and stops.';
    return (
      <div className="envelopeBox"
           onMouseEnter={() => this.props.changeHelpText(envlabhalp)}>
        <label>Envelope</label>
        <div className="envelopeBoxContent">
          <div className="envelopeTypeSelect">
            {envopts}
          </div>
          <Env ref={env => this.envelope = env}
               {...this.props} />
        </div>
      </div>
    );
  }

  // methods that call setState:
  changeEnvelopeType(idx) {
    this.setState({ envelopeType: idx });
  }

  // the GrainSources will call EnvelopePicker.generate, which calls
  // Envelope.generate, which will have called the EnvelopeGenerator.generate.
  // whew. a bit sticky.
  generate(grain) {
    return this.envelope.generate(grain);
  }
}
