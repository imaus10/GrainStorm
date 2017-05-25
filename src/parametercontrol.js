import React, { Component } from 'react';
import Slider, { Range } from 'rc-slider';

class LFOControl extends Component {
  static label = 'Low Frequency Oscillator'
  constructor(props) {
    super(props);
    this.state = { frequency: 1 }; // in Hz
  }
  render() {
    return (
      <div>
        <label>Frequency</label>
        <input type="number" value={this.state.frequency} readOnly></input>
        <Slider min={0.1}
                max={10}
                step={0.1}
                defaultValue={this.state.frequency}
                onChange={f => this.changeFrequency(f)}
                className='controlled' />
      </div>
    );
  }
  changeFrequency(f) {
    this.setState({ frequency: f });
  }
  getNextVal(min, max) {
    const A = (max - min)/2;
    return A*Math.sin(2*Math.PI*this.state.frequency*Date.now()/1000) + min + A;
  }
}

class RandomControl extends Component {
  static label = 'Random'
  render() {
    return <div></div>;
  }
  getNextVal(min, max) {
    return Math.floor(Math.random() * (max-min+1)) + min;
  }
}

class ControlParams extends Component {
  static controlClasses = [ LFOControl, RandomControl ]
  constructor(props) {
    super(props);
    this.state = { controlIdx: 0 };
  }
  render() {
    const ctrlopts = ControlParams.controlClasses.map((cl,i) => <option value={i} key={i}>{cl.label}</option>);
    const CtrlCls = ControlParams.controlClasses[this.state.controlIdx];
    const btnPos = document.getElementById('ctrlButton').getBoundingClientRect();
    const style = { display: this.props.visible ? '' : 'none'
                  , position: 'absolute'
                  , left: btnPos.left
                  , top: btnPos.bottom+10
                  , width: 290
                  };
    return (
      <div className="controlParameters" style={style}>
        <label>Control function</label>
        <select value={this.state.controlIdx} onChange={evt => this.changeControlType(evt)}>
          {ctrlopts}
        </select>
        <CtrlCls ref={ctrl => this.control = ctrl} />
      </div>
    );
  }
  changeControlType(evt) {
    const idx = evt.target.value;
    this.setState({ controlIdx: idx });
  }
  getControlFunc(min,max) {
    return () => this.props.onChange(this.control.getNextVal(min, max));
  }
}

export default class ParameterBox extends Component {
  static paramIdSeq = 0
  static registry = []
  constructor(props) {
    super(props);
    this.paramId = ParameterBox.paramIdSeq;
    ParameterBox.paramIdSeq += 1;
    ParameterBox.registry.push(this);
    this.state = { controlled: false
                 , selected: false
                 , controlMin: props.min
                 , controlMax: props.max
                 };
  }
  componentWillUnmount() {
    const idx = ParameterBox.registry.findIndex(pb => pb === this);
    ParameterBox.registry.splice(idx, 1);
  }
  componentDidUpdate(prevProps, prevState) {
    if (this.state.controlled !== prevState.controlled) {
      if (this.state.controlled) {
        this.props.addControlFunction(this.paramId, this.getControlFunc());
      } else {
        this.props.removeControlFunction(this.paramId);
      }
    }

    if (this.state.controlMin !== prevState.controlMin ||
        this.state.controlMax !== prevState.controlMax)
    {
      this.props.addControlFunction(this.paramId, this.getControlFunc());
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
                onChange={val => this.wrapOnChange(val)}
                onBeforeChange={() => this.handleParameterClick()}
                className={this.getClassName()} />
        { this.props.showControllable && this.state.selected
        ? <Range defaultValue={[this.state.controlMin,this.state.controlMax]}
                 min={this.props.min}
                 max={this.props.max}
                 className='controlled'
                 onChange={(vals) => this.changeControlRange(vals)} />
        : ''
        }
        { this.state.controlled
        ? <ControlParams ref={ctrl => this.controlParams = ctrl}
                         visible={this.state.selected && this.props.showControllable}
                         {...this.state}
                         {...this.props} />
        : ''
        }
      </div>
    );
  }
  wrapOnChange(val) {
    if (!(this.props.showControllable || this.state.controlled)) {
      this.props.onChange(val);
    }
  }
  getClassName() {
    if (this.state.controlled) {
      return 'controlled';
    } else if (this.props.showControllable) {
      return 'controllable';
    } else {
      return '';
    }
  }
  handleParameterClick() {
    if (this.props.showControllable) {
      // if already selected, deselect
      if (this.state.selected) {
        this.setState({ selected: false, controlled: false });
        this.props.changeControlBox('');
      } else { // otherwise, select it (and deselect the other parameters)
        ParameterBox.registry.forEach(pb => pb.deselect());
        this.setState({ selected: true, controlled: true });
      }
    }
  }
  deselect() {
    if (this.state.selected) {
      this.setState({ selected: false });
    }
  }
  changeControlRange(vals) {
    this.setState({ controlMin: vals[0], controlMax: vals[1] });
  }
  getControlFunc() {
    return this.controlParams.getControlFunc(this.state.controlMin, this.state.controlMax);
  }
}
