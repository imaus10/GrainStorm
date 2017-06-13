import React, { Component } from 'react';
import Slider, { Range } from 'rc-slider';

class LFOControl extends Component {
  static label = 'Low Frequency Oscillator'
  constructor(props) {
    super(props);
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
    const lfohalp = 'The amount of time it takes to complete one cycle from the lowest parameter value to the highest and back again.';
    return (
      <div className="controlParam"
           onMouseEnter={() => this.props.changeHelpText(lfohalp)}>
        <label>Period</label><span> = {this.state.period}</span>
        <Slider min={0.5}
                max={60}
                step={0.1}
                defaultValue={this.state.period}
                onChange={T => this.changePeriod(T)}
                className='controller' />
      </div>
    );
  }
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
  constructor(props) {
    super(props);
    // standard deviation here is a pct of (controlMax-controlMin)/2
    // default puts max & min 5 stddevs away from mean
    this.state = { stdDevPct: 0.2 };
  }
  render() {
    const stddevhalp = 'Standard deviation of values from the midpoint. Here it is defined as a percentage of the distance from the middle. For instance, a standard deviation of 0.2 means that the min and max values are 5 standard deviations away from the middle.';
    return (
      <div className="controlParam"
           onMouseEnter={() => this.props.changeHelpText(stddevhalp)}>
        <label>Standard deviation</label><span> = {this.state.stdDevPct}</span>
        <Slider defaultValue={this.state.stdDevPct}
                min={0.1}
                max={0.33}
                step={0.01}
                onChange={sd => this.setState({ stdDevPct: sd })} />
      </div>
    );
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

class ControlParams extends Component {
  static controlClasses = [ LFOControl, RandomControl, GaussianControl ]
  constructor(props) {
    super(props);
    window.addEventListener('resize', evt => {this.forceUpdate()});
    this.state = { controlIdx: 0 };
  }
  render() {
    const ctrlopts = ControlParams.controlClasses.map((cl,i) => <option value={i} key={i}>{cl.label}</option>);
    const CtrlCls = ControlParams.controlClasses[this.state.controlIdx];
    return (
      <div>
        <div onMouseEnter={() => this.props.changeHelpText('The type of control function that will be applied to the selected parameter.')}>
          <label>Control function</label>
          <select value={this.state.controlIdx} onChange={evt => this.changeControlType(evt)}>
            {ctrlopts}
          </select>
        </div>
        <CtrlCls ref={ctrl => this.control = ctrl} {...this.props} />
      </div>
    );
  }
  changeControlType(evt) {
    const idx = evt.target.value;
    this.setState({ controlIdx: idx });
  }
  getControlFunc() {
    return () => this.props.onChange(this.control.getNextVal());
  }
}

export default class Parameter extends Component {
  static paramIdSeq = 0
  static registry = []
  constructor(props) {
    super(props);
    this.paramId = Parameter.paramIdSeq;
    Parameter.paramIdSeq += 1;
    Parameter.registry.push(this);
    this.state = { controlled: false
                 , selected: false
                 , controlMin: props.min
                 , controlMax: props.max
                 };
  }
  componentWillUnmount() {
    const idx = Parameter.registry.findIndex(pb => pb === this);
    Parameter.registry.splice(idx, 1);
  }
  componentDidUpdate(prevProps, prevState) {
    if (this.state.controlled !== prevState.controlled) {
      if (this.state.controlled) {
        this.props.addControlFunction(this.paramId, this.getControlFunc());
      } else {
        this.props.removeControlFunction(this.paramId);
      }
    }

    if ( this.state.controlMax !== prevState.controlMax ||
         this.state.controlMin !== prevState.controlMin )
    {
      this.getControlFunc()();
    }
  }
  render() {
    const metaScreen = document.getElementById('metaScreen').getBoundingClientRect();
    const style = { display: this.state.selected && this.props.showControllable ? '' : 'none'
                  , position: 'absolute'
                  , left: metaScreen.left
                  , top: metaScreen.top
                  , width: 290
                  , padding: 5
                  };
    const handle = (props) => {
      const { index, dragging, ...restProps } = props;
      return <Slider.Handle key={index}
                            onClick={() => {
                              if (index === 1) {
                                this.stopControlling();
                              }
                            }}
                            {...restProps} />;
    };
    return (
      <div className="parameterBox" onMouseEnter={() => this.props.changeHelpText(this.props.helpText)}>
        <label>{this.props.label}</label>
        <input type="number" value={this.props.value} readOnly></input>
        { this.props.showControllable && this.state.selected
        ? <Range value={[this.state.controlMin,this.props.value,this.state.controlMax]}
                 min={this.props.min}
                 max={this.props.max}
                 step={this.props.step}
                 handle={handle}
                 className='controller'
                 onChange={(vals) => this.changeControlRange(vals)} />
        : <Slider value={this.props.value}
                  min={this.props.min}
                  max={this.props.max}
                  step={this.props.step || 1}
                  marks={ this.state.controlled
                        ? { [this.state.controlMin]: ''
                          , [this.state.controlMax]: ''
                          }
                        : {}}
                  onChange={val => this.wrapOnChange(val)}
                  onBeforeChange={() => this.handleParameterClick()}
                  className={this.getClassName()} />
        }
        { this.state.controlled
        ? <div className="controlParameters" style={style}>
            <ControlParams ref={ctrl => this.controlParams = ctrl}
                           {...this.state}
                           {...this.props} />
          </div>
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
      // select it (and deselect the other parameters)
      Parameter.registry.forEach(pb => pb.deselect());
      this.props.changeHelpText('Move the purple range to select a minimum and maximum value for the control function.');
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
  getControlFunc() {
    return this.controlParams.getControlFunc();
  }
}
