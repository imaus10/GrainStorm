import React, { Component } from 'react';
import numeric from 'numeric';
import { Range } from 'rc-slider';

export class LinearEnvelope extends Component {
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

export class GaussianEnvelope extends Component {
  render() {
    return (
      <div></div>
    );
  }
}
