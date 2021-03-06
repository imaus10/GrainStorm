import React, { Component } from 'react';
import Slider, { Range } from 'rc-slider';

// this file defines Control components
// that can be applied to any Parameter.
// each Control component must define one method:
// 1. getNextVal -- the value the controlled parameter should take
// it is otherwise responsible for its own parameters and their display logic.
// it also must define a static label.

class LFOControl extends Component {
  static label = 'Low Frequency Oscillator'

  // React methods:
  constructor(props) {
    super(props);
    // so the LFO will always begin at the same value on play
    this.phaseOffset = Date.now();
    this.state = { period: 5 }; // in s
  }
  componentDidUpdate(prevProps, prevState) {
    if (prevProps.playing !== this.props.playing) {
      this.phaseOffset = Date.now();
    }

    if (!this.props.playing &&
          ( prevProps.controlMin !== this.props.controlMin ||
            prevProps.controlMax !== this.props.controlMax ))
    {
      this.phaseOffset = Date.now();
    }
  }
  render() {
    return (
      <div className="controlParam">
        <label>Period</label>
        <Slider min={0.5}
                max={60}
                step={0.1}
                defaultValue={this.state.period}
                disabled={this.props.walkthru < 13}
                onChange={T => this.changePeriod(T)}
                className={'controller' + (this.props.walkthru === 13 ? ' glimmer' : '')} />
      </div>
    );
  }

  // methods that call setState:
  changePeriod(T) {
    this.setState({ period: T });
  }

  getNextVal() {
    const min = this.props.controlMin;
    const max = this.props.controlMax;
    const A = (max - min)/2;
    const f = 1/this.state.period;
    const t = (Date.now() - this.phaseOffset)/1000;
    return A*Math.sin(2*Math.PI*f*t) + min + A;
  }
}

class RandomControl extends Component {
  static label = 'Random'
  render() {
    return <div></div>;
  }
  getNextVal() {
    const min = this.props.controlMin;
    const max = this.props.controlMax;
    return Math.floor(Math.random() * (max-min+1)) + min;
  }
}

class GaussianControl extends Component {
  static label = 'Normal distribution'

  // React methods:
  constructor(props) {
    super(props);
    // standard deviation here is a pct of (controlMax-controlMin)/2
    // default puts max & min 5 stddevs away from mean
    this.state = { stdDevPct: 0.2 };
  }
  render() {
    return (
      <div className="controlParam">
        <label>Standard deviation</label>
        <Slider defaultValue={this.state.stdDevPct}
                min={0.1}
                max={0.33}
                step={0.01}
                onChange={sd => this.changeStdDevPct(sd)}
                className="controller" />
      </div>
    );
  }

  // methods that call setState:
  changeStdDevPct(sd) {
    this.setState({ stdDevPct: sd });
  }

  // Box-Muller transform to convert
  // two uniformly random variables to
  // two normally distributed random variables
  // (second not returned)
  // https://en.wikipedia.org/wiki/Box–Muller_transform
  getNextVal() {
    // Subtraction to flip [0, 1) to (0, 1]
    const u1 = 1 - Math.random();
    const u2 = 1 - Math.random();
    // generate a value according to the standard normal dist
    // (mean 0 and variance 1)
    const stdNorm = Math.sqrt(-2*Math.log(u1)) * Math.cos(2*Math.PI*u2);
    // scale it to these parameters
    const min = this.props.controlMin;
    const max = this.props.controlMax;
    // mean right in the middle of the min & max values
    const mean = (max-min)/2 + min;
    const stddev = (max-min/2) * this.state.stdDevPct;
    const norm = stdNorm*stddev + mean;
    // truncate any values below min or above max
    return Math.min(Math.max(min, norm), max);
  }
}

// this is the "control picker" class
// that displays the params for the selected control
// and routes to the actual control functions (getNextVal) with getControlFunc
// it's only active & visible when the props.showControllable is true
class ControlParams extends Component {
  static controlClasses = [ LFOControl, RandomControl, GaussianControl ]

  // React methods:
  constructor(props) {
    super(props);
    this.resizeEvt = evt => {this.forceUpdate()};
    window.addEventListener('resize', this.resizeEvt);
    this.state = { controlIdx: 0 };
  }
  componentWillUnmount() {
    window.removeEventListener('resize', this.resizeEvt);
  }
  render() {
    const ctrlopts = ControlParams.controlClasses.map((cl,i) => <option value={i} key={i}>{cl.label}</option>);
    const CtrlCls = ControlParams.controlClasses[this.state.controlIdx];
    // this ControlParams box would normally be directly under the regular
    // Parameter. instead, grab the paramCtrlScreen div and get its position,
    // and put this over top using absolute positioning.
    // somewhat hacky, and brittle...if the paramCtrlScreen id changes,
    // it won't position correctly.
    const paramCtrlScreen = document.getElementById('paramCtrlScreen').getBoundingClientRect();
    const style = { display: this.props.selected && this.props.showControllable ? '' : 'none'
                  , position: 'absolute'
                  , left: paramCtrlScreen.left
                  , top: paramCtrlScreen.top
                  , width: paramCtrlScreen.width
                  , height: paramCtrlScreen.height-20
                  , padding: '10px 0'
                  , overflowY: 'scroll'
                  };
    return (
      <div className="controlParameters" style={style}>
        <div className="controlParam">
          <label>Control function</label>
          <select value={this.state.controlIdx}
                  disabled={this.props.walkthru < 14}
                  className={this.props.walkthru === 14 ? 'glimmer' : ''}
                  onChange={evt => this.changeControlType(evt)}>
            {ctrlopts}
          </select>
        </div>
        <CtrlCls ref={ctrl => this.control = ctrl} {...this.props} />
      </div>
    );
  }

  // methods that call setState:
  changeControlType(evt) {
    const idx = evt.target.value;
    this.setState({ controlIdx: idx });
  }

  getControlFunc() {
    // return a function that triggers the parameter's onChange
    // with the next control value
    return () => this.props.onChange(this.control.getNextVal());
  }
}

// this is a Parameter for granular synthesis.
// after the "show" button is clicked (props.showControllable = true),
// each Parameter can be controlled with automatic functions.
// after a Parameter is clicked, it is selected
// (only one Parameter may be selected at one time)
// and the ControlParams appears in the Parameter Ctrl screen on the left.
export default class Parameter extends Component {
  static paramIdSeq = 0
  // a list of all the Parameters so when one is selected,
  // all the others will be deselected
  static registry = []

  // React methods:
  constructor(props) {
    super(props);
    this.paramId = Parameter.paramIdSeq;
    Parameter.paramIdSeq += 1;
    // add this to the registry on construction
    Parameter.registry.push(this);
    this.state = { controlled: false
                 , selected: false
                 , controlMin: props.min
                 , controlMax: props.max
                 };
  }
  componentWillUnmount() {
    // remove this from the registry upon destruction
    const idx = Parameter.registry.findIndex(pb => pb === this);
    Parameter.registry.splice(idx, 1);
  }
  componentDidUpdate(prevProps, prevState) {
    // once it becomes controlled, add the control func to GrainCloud
    if (this.state.controlled !== prevState.controlled) {
      if (this.state.controlled) {
        this.props.addControlFunction(this.paramId, this.getControlFunc());
      } else {
        this.props.removeControlFunction(this.paramId);
      }
    }

    // if the control range changes, call the control func
    // once to set the Parameter to its starting value.
    if ( this.state.controlMax !== prevState.controlMax ||
         this.state.controlMin !== prevState.controlMin )
    {
      this.getControlFunc()();
    }
  }
  render() {
    // custom handle for a controlled & selected Parameter --
    // stop controlling if the middle handle is clicked.
    const handle = (props) => {
      const { index, dragging, ...restProps } = props;
      return <Slider.Handle key={index}
                            onClick={() => {
                              if ( index === 1 && this.props.walkthru >= 15 ) {
                                this.stopControlling();
                              }
                            }}
                            {...restProps} />;
    };

    const show = this.props.walkthru >= this.props.walkthruReveal;
    return (
      <div style={{display: show ? 'block' : 'none'}}>
        <div className="parameterBox">
          <label>{this.props.label}</label>
          { this.props.showControllable && this.state.selected
          ? <Range value={[this.state.controlMin,this.props.value,this.state.controlMax]}
                   min={this.props.min}
                   max={this.props.max}
                   step={this.props.step}
                   handle={handle}
                   className={'controller' + (this.props.walkthru === 11 ? ' glimmer' : '')}
                   onChange={(vals) => this.changeControlRange(vals)} />
          : <Slider value={this.props.value}
                    min={this.props.min}
                    max={this.props.max}
                    step={this.props.step}
                    marks={ this.state.controlled
                          ? { [this.state.controlMin]: ''
                            , [this.state.controlMax]: ''
                            }
                          : this.props.marks }
                    disabled={this.props.walkthru >= 12 && this.props.walkthru < 15}
                    onChange={val => this.wrapOnChange(val)}
                    onBeforeChange={() => this.handleParameterClick()}
                    className={this.getClassName()} />
          }
        </div>
        { this.state.controlled
        ? <ControlParams ref={ctrl => this.controlParams = ctrl}
                             {...this.state}
                             {...this.props} />
        : ''
        }
      </div>
    );
  }

  // methods that call setState:
  handleParameterClick() {
    if (this.props.showControllable) {
      if (this.props.walkthru === 11) {
        this.props.bumpWalkthru();
      }
      // select it (and deselect the other parameters)
      Parameter.registry.forEach(pb => pb.deselect());
      this.setState({ selected: true, controlled: true });
    }
  }
  stopControlling() {
    this.setState({ selected: false, controlled: false });
  }
  deselect() {
    if (this.state.selected) {
      this.setState({ selected: false });
    }
  }
  changeControlRange(vals) {
    this.setState({ controlMin: vals[0], controlMax: vals[2] });
  }

  // wrap the props.onChange function to be a no-op if
  // not showControllable and not controlled
  wrapOnChange(val) {
    if (!(this.props.showControllable || this.state.controlled)) {
      this.props.onChange(val);
    }
  }

  getClassName() {
    if (this.state.controlled) {
      return 'controlled';
    } else if (this.props.showControllable) {
      return 'controllable' + (this.props.walkthru === 11 ? ' glimmer' : '');
    } else if (this.props.walkthru === this.props.walkthruReveal) {
      return 'glimmer';
    } else {
      return '';
    }
  }

  getControlFunc() {
    return this.controlParams.getControlFunc();
  }

  isControlled() {
    return this.state.controlled;
  }
  isSelected() {
    return this.state.selected;
  }
}
