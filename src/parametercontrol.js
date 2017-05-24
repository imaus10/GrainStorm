import React, { Component } from 'react';
import Slider, { Range } from 'rc-slider';

export default class ParameterBox extends Component {
  static paramIdSeq = 0
  constructor(props) {
    super(props);
    this.paramId = ParameterBox.paramIdSeq;
    ParameterBox.paramIdSeq += 1;
    this.state = { controlled: false, controlMin: props.min, controlMax: props.max };
  }
  componentDidUpdate(prevProps, prevState) {
    if (this.state.controlled !== prevState.controlled) {
      if (this.state.controlled) {
        this.props.addControlFunction(this.paramId, () => this.LFOControl());
      } else {
        this.props.removeControlFunction(this.paramId);
      }
    }

    if (this.state.controlMin !== prevState.controlMin ||
        this.state.controlMax !== prevState.controlMax)
    {
      this.props.addControlFunction(this.paramId, () => this.LFOControl());
    }
  }
  render() {
    return (
      <div className="parameterBox" onMouseEnter={() => this.props.changeHelpText(this.props.helpText)}>
        <label>{this.props.label}</label>
        <input type="number" value={this.props.value} readOnly></input>
        <Slider value={this.props.value}
                min={this.props.min}
                max={this.props.max}
                onChange={this.props.showControllable || this.state.controlled ? ()=>{} : this.props.onChange}
                onBeforeChange={this.props.showControllable ? () => this.changeControlled() : ()=>{}}
                className={this.props.showControllable || this.state.controlled ? 'controllable' : ''}/>
        { this.props.showControllable && this.state.controlled
        ? <Range defaultValue={[this.state.controlMin,this.state.controlMax]}
                 min={this.props.min}
                 max={this.props.max}
                 className='controlled'
                 onChange={(vals) => this.changeControls(vals)} />
        : ''
        }
      </div>
    );
  }
  changeControlled() {
    this.setState({ controlled: !this.state.controlled });
  }
  changeControls(vals) {
    this.setState({ controlMin: vals[0], controlMax: vals[1] });
  }
  randomControl() {
    const randInt = Math.floor(Math.random() * (this.state.controlMax-this.state.controlMin+1)) + this.state.controlMin;
    this.props.onChange(randInt);
  }
  LFOControl() {
    const f = 1;
    const A = (this.state.controlMax - this.state.controlMin)/2;
    const nextVal = A*Math.sin(2*Math.PI*f*Date.now()/1000) + this.state.controlMin + A;
    this.props.onChange(nextVal);
  }
}
